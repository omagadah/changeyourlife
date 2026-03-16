// api/send-verification.js
// Génère un OTP 6 chiffres, le stocke en Firestore, envoie un beau mail français via Resend

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { Resend } = require('resend');

// ── Firebase Admin singleton ──────────────────────────────────────────────────
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({ credential: cert(sa) });
}

// ── HTML email template ───────────────────────────────────────────────────────
function buildEmailHtml(code, email) {
  const digits = code.split('');
  const digitBoxes = digits.map(d =>
    `<span style="display:inline-block;width:52px;height:64px;line-height:64px;text-align:center;font-size:2rem;font-weight:700;background:#1a2a40;border:2px solid #0070f3;border-radius:12px;color:#ffffff;margin:0 4px;">${d}</span>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code de vérification - ChangeYourLife</title>
</head>
<body style="margin:0;padding:0;background:#07192f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07192f;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">

      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:rgba(15,30,55,0.98);border:1px solid rgba(0,112,243,0.3);border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.5);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0a1628 0%,#0d2040 100%);padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(0,112,243,0.2);">
            <div style="display:inline-block;background:linear-gradient(135deg,#0070f3,#00aaff);border-radius:16px;padding:12px 20px;margin-bottom:16px;">
              <span style="font-size:1.5rem;font-weight:800;color:#fff;letter-spacing:1px;">CYL</span>
            </div>
            <div style="font-size:1.5rem;font-weight:700;color:#ffffff;margin-top:4px;">ChangeYourLife</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:1.4rem;font-weight:700;color:#ffffff;">Confirmez votre email</p>
            <p style="margin:0 0 28px;font-size:0.95rem;color:#9bb3d0;line-height:1.6;">
              Bienvenue ! Entrez le code ci-dessous dans l'application pour activer votre compte.
              Ce code expire dans <strong style="color:#f59e0b;">15 minutes</strong>.
            </p>

            <!-- Code display -->
            <div style="text-align:center;margin:32px 0;">
              ${digitBoxes}
            </div>

            <div style="text-align:center;margin:8px 0 32px;">
              <span style="font-size:0.8rem;color:#6b8aaa;">Code valable 15 minutes · À ne partager avec personne</span>
            </div>

            <!-- Divider -->
            <div style="height:1px;background:rgba(255,255,255,0.08);margin:0 0 28px;"></div>

            <p style="margin:0 0 6px;font-size:0.85rem;color:#6b8aaa;">Ce code a été demandé pour :</p>
            <p style="margin:0 0 24px;font-size:0.9rem;font-weight:600;color:#7bbfff;">${email}</p>

            <p style="margin:0;font-size:0.82rem;color:#4a6580;line-height:1.6;">
              Si vous n'avez pas créé de compte sur ChangeYourLife, ignorez simplement cet email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#060f1e;padding:20px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:0.78rem;color:#3a5470;">
              © ${new Date().getFullYear()} ChangeYourLife · Prenez le contrôle de votre vie
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { idToken } = req.body || {};
  if (!idToken) return res.status(400).json({ error: 'idToken requis' });

  // Check env vars before attempting anything
  if (!process.env.RESEND_API_KEY) {
    console.error('[send-verification] RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Configuration email manquante (RESEND_API_KEY)', code: 'MISSING_API_KEY' });
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('[send-verification] FIREBASE_SERVICE_ACCOUNT is not set');
    return res.status(500).json({ error: 'Configuration serveur manquante', code: 'MISSING_SA' });
  }

  try {
    const app = getAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Verify the Firebase ID token
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;

    if (!email) return res.status(400).json({ error: 'Aucun email associé au compte' });
    if (decoded.email_verified) return res.status(400).json({ error: 'Email déjà vérifié' });

    // Rate limit: check last sent time
    const codeRef = db.collection('verificationCodes').doc(uid);
    const existing = await codeRef.get();
    if (existing.exists) {
      const data = existing.data();
      const elapsed = Date.now() - (data.sentAt?.toMillis?.() || 0);
      if (elapsed < 60_000) {
        return res.status(429).json({ error: 'Attendez 60 secondes avant de renvoyer', retryAfter: Math.ceil((60_000 - elapsed) / 1000) });
      }
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Store in Firestore with 15min expiry
    await codeRef.set({
      code,
      email,
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      attempts: 0,
    });

    // Send email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data: resendData, error: resendError } = await resend.emails.send({
      from: 'ChangeYourLife <noreply@changeyourlife.ai>',
      to: email,
      subject: `${code} — Votre code de vérification ChangeYourLife`,
      html: buildEmailHtml(code, email),
    });

    if (resendError) {
      console.error('[send-verification] Resend error:', JSON.stringify(resendError, null, 2));
      return res.status(500).json({
        error: 'Impossible d\'envoyer l\'email',
        code: resendError.name || 'RESEND_ERROR',
      });
    }

    console.log('[send-verification] Email sent successfully, id:', resendData?.id);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('[send-verification] error:', err.message, err.code);
    if (err.code === 'auth/argument-error' || err.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
    }
    return res.status(500).json({ error: 'Erreur serveur: ' + err.message });
  }
};
