// api/delete-account.js - Supprimer OU exporter TOUTES les donnees d'un compte.
//
// POURQUOI (audit securite 2026-10-17, I1 et I2) : la suppression faite depuis
// le navigateur ne pouvait toucher que ce que les regles Firestore lui
// ouvrent. Restaient orphelins apres fermeture du compte : verificationCodes
// (qui contient l'adresse email), chatRate, briefRate, roles, et la
// participation au tirage. La politique de confidentialite promet pourtant
// « ton compte et l'ensemble des donnees associees ». Et l'export des donnees
// (portabilite, art. 20 RGPD) n'existait que sous forme de simulation.
//
// Ici, l'Admin SDK voit tout. Deux actions :
//   { action: 'export' }  -> renvoie un JSON de tout ce que le compte contient
//   { action: 'delete' }  -> efface tout, puis le compte Firebase Auth
//
// GARDE-FOUS : ID token verifie, et pour la suppression une connexion RECENTE
// (auth_time < 5 min) : le client re-authentifie avant d'appeler, comme avant.

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  return initializeApp({ credential: cert(sa) });
}

// Les collections de premier niveau indexees par uid dans un champ `uid`.
const PAR_CHAMP_UID = ['assessments', 'codexNotes'];
// Les documents serveur indexes par uid dans leur identifiant.
const PAR_ID_UID = ['chatRate', 'briefRate', 'verificationCodes', 'roles'];

async function lireTout(db, uid) {
  const out = { exportedAt: new Date().toISOString(), uid };
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  out.user = userSnap.exists ? userSnap.data() : null;
  out.collections = {};
  const subs = await userRef.listCollections();
  for (const col of subs) {
    const snap = await col.get();
    out.collections[col.id] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  for (const name of PAR_CHAMP_UID) {
    const snap = await db.collection(name).where('uid', '==', uid).get();
    out.collections[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  try {
    const ent = await db.collectionGroup('entries').where('uid', '==', uid).get();
    out.collections.giveawayEntries = ent.docs.map((d) => ({ path: d.ref.path, ...d.data() }));
  } catch (_) { out.collections.giveawayEntries = []; }
  return out;
}

async function effacerTout(db, uid) {
  const userRef = db.collection('users').doc(uid);
  await db.recursiveDelete(userRef);
  for (const name of PAR_CHAMP_UID) {
    const snap = await db.collection(name).where('uid', '==', uid).get();
    let batch = db.batch(); let n = 0;
    for (const d of snap.docs) { batch.delete(d.ref); n += 1; if (n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
    if (n % 400 !== 0) await batch.commit();
  }
  for (const name of PAR_ID_UID) {
    await db.collection(name).doc(uid).delete().catch(() => {});
  }
  try {
    const ent = await db.collectionGroup('entries').where('uid', '==', uid).get();
    await Promise.all(ent.docs.map((d) => d.ref.delete().catch(() => {})));
  } catch (_) {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://changeyourlife.ai');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(503).json({ error: 'Service temporairement indisponible' });

  const { idToken, action } = req.body || {};
  if (!idToken || typeof idToken !== 'string') return res.status(401).json({ error: 'Non authentifié' });
  if (action !== 'export' && action !== 'delete') return res.status(400).json({ error: 'action invalide' });

  let decoded;
  try { decoded = await getAuth(getAdminApp()).verifyIdToken(idToken, true); }
  catch (_) { return res.status(401).json({ error: 'Session invalide, reconnecte-toi.' }); }
  const uid = decoded.uid;
  const db = getFirestore(getAdminApp());

  try {
    if (action === 'export') {
      const data = await lireTout(db, uid);
      res.setHeader('Content-Disposition', 'attachment; filename="changeyourlife-mes-donnees.json"');
      return res.status(200).json(data);
    }
    // Suppression : connexion recente exigee (le client re-authentifie avant).
    const age = Date.now() / 1000 - Number(decoded.auth_time || 0);
    if (!(age < 300)) return res.status(401).json({ error: 'Reconnecte-toi pour confirmer la suppression.', code: 'RECENT_LOGIN' });
    await effacerTout(db, uid);
    await getAuth(getAdminApp()).deleteUser(uid);
    console.log('[delete-account] compte supprime', uid);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[delete-account] erreur', action, e?.message || e);
    return res.status(500).json({ error: "L'opération a échoué. Réessaie, ou écris-nous." });
  }
};
