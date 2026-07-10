// api/giveaway-draw.js - Back-office du giveaway (réservé ADMIN).
// Deux actions :
//   - 'status' : nombre de participants du cycle + gagnant éventuel.
//   - 'draw'   : tire un gagnant au hasard (crypto) parmi les participants et
//                écrit le résultat dans giveaways/{cycleId} (idempotent).
//
// Sécurité : ID token Firebase valide + custom claim role === 'admin'. Le tirage
// se fait côté serveur (Admin SDK) : impossible à truquer côté client.
//
// Variables d'env Vercel : FIREBASE_SERVICE_ACCOUNT (déjà configurée).

const crypto = require('crypto');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({ credential: cert(sa) });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://changeyourlife.ai');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return res.status(500).json({ error: 'Configuration serveur manquante' });
  }

  const { idToken, cycleId, action } = req.body || {};
  if (!idToken) return res.status(401).json({ error: 'idToken requis' });
  if (!cycleId || typeof cycleId !== 'string' || !/^\d{6,20}$/.test(cycleId)) {
    return res.status(400).json({ error: 'cycleId invalide' });
  }

  // ── Auth + contrôle admin (custom claim) ──────────────────────────────────
  let decoded;
  try {
    decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
  if (decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux administrateurs' });
  }

  const db = getFirestore(getAdminApp());
  const resultRef = db.collection('giveaways').doc(cycleId);
  const entriesRef = resultRef.collection('entries');

  try {
    // Participants du cycle
    const snap = await entriesRef.get();
    const uids = snap.docs.map((d) => d.id);
    const resultSnap = await resultRef.get();
    const existing = resultSnap.exists ? resultSnap.data() : null;

    if (action === 'status') {
      return res.status(200).json({
        cycleId, count: uids.length,
        winnerUid: existing?.winnerUid || null,
        drawnAt: existing?.drawnAt ? existing.drawnAt.toMillis?.() || null : null,
      });
    }

    if (action === 'draw') {
      // Idempotent : si déjà tiré, on renvoie le gagnant existant.
      if (existing?.winnerUid) {
        return res.status(200).json({ cycleId, count: uids.length, winnerUid: existing.winnerUid, alreadyDrawn: true });
      }
      if (!uids.length) return res.status(200).json({ cycleId, count: 0, winnerUid: null, empty: true });

      const winnerUid = uids[crypto.randomInt(uids.length)];
      await resultRef.set({
        winnerUid, count: uids.length, drawnAt: new Date(), drawnBy: decoded.uid,
      }, { merge: true });
      return res.status(200).json({ cycleId, count: uids.length, winnerUid, drawn: true });
    }

    return res.status(400).json({ error: "action doit être 'status' ou 'draw'" });
  } catch (e) {
    console.error('[giveaway-draw] error:', e?.message || e);
    return res.status(500).json({ error: 'Erreur interne' });
  }
};
