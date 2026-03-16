// api/verify-code.js
// Vérifie le code OTP et marque l'email comme vérifié via Firebase Admin

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({ credential: cert(sa) });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { idToken, code } = req.body || {};
  if (!idToken || !code) return res.status(400).json({ error: 'idToken et code requis' });

  const cleanCode = String(code).trim().replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleanCode)) return res.status(400).json({ error: 'Code invalide (6 chiffres requis)' });

  try {
    const app = getAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    if (decoded.email_verified) {
      return res.status(200).json({ success: true, alreadyVerified: true });
    }

    const codeRef = db.collection('verificationCodes').doc(uid);
    const snap = await codeRef.get();

    if (!snap.exists) {
      return res.status(400).json({ error: 'Aucun code envoyé. Demandez-en un nouveau.' });
    }

    const data = snap.data();

    const expiresAt = data.expiresAt?.toMillis?.() || 0;
    if (Date.now() > expiresAt) {
      await codeRef.delete();
      return res.status(400).json({ error: 'Code expiré. Demandez-en un nouveau.' });
    }

    const attempts = (data.attempts || 0) + 1;
    if (attempts > 5) {
      await codeRef.delete();
      return res.status(400).json({ error: 'Trop de tentatives. Demandez un nouveau code.' });
    }

    await codeRef.update({ attempts: FieldValue.increment(1) });

    if (data.code !== cleanCode) {
      const remaining = 5 - attempts;
      return res.status(400).json({
        error: remaining > 0
          ? `Code incorrect. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.`
          : 'Code incorrect. Trop de tentatives — demandez un nouveau code.',
        attemptsLeft: remaining
      });
    }

    await auth.updateUser(uid, { emailVerified: true });
    await codeRef.delete();

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('verify-code error:', err);
    if (err.code === 'auth/argument-error' || err.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
