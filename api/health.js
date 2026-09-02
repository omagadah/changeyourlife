// api/health.js - Le site se surveille lui-meme.
//
// ── POURQUOI ────────────────────────────────────────────────────────────────
// La traduction est restee morte TREIZE JOURS en production sans que personne
// le sache. Elle echouait pourtant a chaque appel, et l'echec etait meme
// journalise. Il manquait juste quelqu'un pour regarder.
//
// Ce endpoint verifie ce qui peut tomber en silence, et previent par email
// quand quelque chose est casse. Appele une fois par jour par un cron Vercel
// (declare dans vercel.json), il ne coute rien tant que tout va bien.
//
// Il ne verifie PAS que le site s'affiche : ca, un navigateur le dirait tout
// de suite. Il verifie les dependances externes, celles dont la panne ne se
// voit pas depuis la page d'accueil.

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { candidats } = require('./_models.js');

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({ credential: cert(sa) });
}

/** Un fournisseur de modeles repond-il, et reste-t-il un modele utilisable ? */
async function checkModeles(provider, apiKey) {
  if (!apiKey) return { ok: false, detail: 'cle absente' };
  try {
    const list = await candidats(provider, apiKey, { budgetMs: 6000, max: 3 });
    if (!list.length) return { ok: false, detail: 'annuaire vide' };
    return { ok: true, detail: list.join(', ') };
  } catch (e) {
    return { ok: false, detail: String(e?.message || e).slice(0, 160) };
  }
}

/** Firestore repond-il en ecriture ? C'est ce qui porte tout le contenu. */
async function checkFirestore() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return { ok: false, detail: 'compte de service absent' };
  try {
    const db = getFirestore(getAdminApp());
    await db.collection('health').doc('probe').set({ at: new Date() }, { merge: true });
    return { ok: true, detail: 'lecture et ecriture' };
  } catch (e) {
    return { ok: false, detail: String(e?.message || e).slice(0, 160) };
  }
}

async function alerter(pannes) {
  if (!process.env.RESEND_API_KEY) return 'RESEND_API_KEY absente';
  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const lignes = pannes.map((p) => `- ${p.nom} : ${p.detail}`).join('\n');
    const { error } = await resend.emails.send({
      from: 'ChangeYourLife <noreply@changeyourlife.ai>',
      to: process.env.ALERT_EMAIL || 'noreply@changeyourlife.ai',
      subject: `[CYL] ${pannes.length} service(s) en panne`,
      text:
        `Le controle de sante quotidien a trouve un probleme.\n\n${lignes}\n\n` +
        `Detail complet : https://changeyourlife.ai/api/health\n` +
        `Journaux : tableau de bord Vercel, projet changeyourlife.\n`,
    });
    return error ? 'echec envoi : ' + JSON.stringify(error).slice(0, 120) : 'email envoye';
  } catch (e) {
    return 'exception : ' + String(e?.message || e).slice(0, 120);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Le cron Vercel s'authentifie avec CRON_SECRET. Un appel non authentifie
  // reste autorise mais N'ENVOIE PAS d'email : le rapport est consultable a la
  // main sans qu'un tiers puisse declencher des envois en boucle.
  const attendu = process.env.CRON_SECRET;
  const recu = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const estCron = Boolean(attendu) && recu === attendu;

  const [groq, gemini, firestore] = await Promise.all([
    checkModeles('groq', process.env.GROQ_API_KEY),
    checkModeles('gemini', process.env.GEMINI_API_KEY),
    checkFirestore(),
  ]);

  // La cle du chat de CYL porte deux noms selon l'historique du projet.
  const anthropic = (process.env.API_ANTHROPIC_CHATBOT || process.env.ANTHROPIC_API_KEY)
    ? { ok: true, detail: 'cle presente' }
    : { ok: false, detail: 'ni API_ANTHROPIC_CHATBOT ni ANTHROPIC_API_KEY' };

  const checks = { groq, gemini, firestore, anthropic };

  // La traduction ne tombe que si les DEUX fournisseurs sont morts : l'un est
  // le repli de l'autre. Une seule panne est une degradation, pas un incident.
  const traductionMorte = !groq.ok && !gemini.ok;
  const pannes = [];
  if (traductionMorte) pannes.push({ nom: 'Traduction (Groq ET Gemini)', detail: `groq: ${groq.detail} | gemini: ${gemini.detail}` });
  if (!firestore.ok) pannes.push({ nom: 'Firestore', detail: firestore.detail });
  if (!anthropic.ok) pannes.push({ nom: 'CYL (Anthropic)', detail: anthropic.detail });

  let alerte = 'non declenchee';
  if (pannes.length && estCron) alerte = await alerter(pannes);
  else if (pannes.length) alerte = 'appel non authentifie : email non envoye';

  const statut = pannes.length ? 'panne' : 'ok';
  return res.status(pannes.length ? 503 : 200).json({
    statut, checks, pannes, alerte, verifie: new Date().toISOString(),
  });
};
