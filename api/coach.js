// api/coach.js — IA Coach endpoint using Gemini 2.0 Flash (free tier)
// Requires GEMINI_API_KEY + FIREBASE_SERVICE_ACCOUNT in Vercel environment variables

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `Tu es Lya, une coach de vie bienveillante, empathique et directe, sur l'application Change Your Life.

Ton rôle : aider l'utilisateur à mieux se connaître, à progresser et à personnaliser son espace Change Your Life.

RÈGLES :
- Réponds TOUJOURS en JSON valide (pas de markdown autour)
- Sois chaleureux, concis, personnalisé (2-4 phrases max pour "reply")
- Pose une question de suivi pour approfondir
- Détecte les thèmes dans le message pour nourrir l'arbre de vie

FORMAT DE RÉPONSE OBLIGATOIRE :
{
  "reply": "Ta réponse en français, chaleureuse et personnalisée",
  "analysis": {
    "topics": ["liste", "de", "topics", "détectés"],
    "stats_delta": {
      "mental": 0,
      "corps": 0,
      "social": 0,
      "pro": 0
    },
    "new_nodes": [
      { "label": "Nom du noeud", "branch": "serenite|vitalite|ambition|liens|conscience|discipline", "xp": 10 }
    ],
    "priority_modules": ["meditation", "journal", "objectifs", "habitudes", "sommeil", "humeur"],
    "insight": "Une observation courte sur le profil de l'utilisateur"
  }
}

MAPPING TOPICS → BRANCHES :
- stress, anxiété, calme, respiration, méditation → branche "serenite"
- sport, corps, santé, sommeil, énergie, nutrition → branche "vitalite"
- travail, carrière, ambition, projet, objectif, succès → branche "ambition"
- famille, amis, relation, amour, social, couple → branche "liens"
- journal, réflexion, pensées, identité, valeurs, croissance → branche "conscience"
- habitude, routine, discipline, régularité, organisation → branche "discipline"

RÈGLE stats_delta : incrémente de 0-15 points par domaine détecté (pas plus).`;

// ── Firebase Admin singleton ──────────────────────────────────────────────────
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({ credential: cert(sa) });
}

module.exports = async function handler(req, res) {
  // Same-origin only — no wildcard CORS for an authenticated endpoint
  res.setHeader('Access-Control-Allow-Origin', 'https://changeyourlife.ai');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Env checks
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY non configurée', setup: 'https://aistudio.google.com/apikey' });
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return res.status(500).json({ error: 'Configuration serveur manquante', code: 'MISSING_SA' });
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { idToken, messages, userProfile } = req.body || {};
  if (!idToken) return res.status(401).json({ error: 'idToken requis' });
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages array required' });
  }

  let uid;
  try {
    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    uid = decoded.uid;
    if (!decoded.email_verified) {
      return res.status(403).json({ error: 'Email non vérifié' });
    }
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }

  // ── Rate limit (10 req / min / uid) ────────────────────────────────────────
  const db = getFirestore(getAdminApp());
  const rateRef = db.collection('coachRate').doc(uid);
  try {
    const snap = await rateRef.get();
    const now = Date.now();
    const windowMs = 60_000;
    const maxPerWindow = 10;
    let calls = [];
    if (snap.exists) {
      calls = (snap.data().calls || []).filter(t => now - t < windowMs);
    }
    if (calls.length >= maxPerWindow) {
      return res.status(429).json({
        error: 'Trop de requêtes. Patiente une minute.',
        retryAfter: Math.ceil((windowMs - (now - calls[0])) / 1000),
      });
    }
    calls.push(now);
    await rateRef.set({ calls, lastAt: new Date() }, { merge: true });
  } catch (e) {
    console.error('[coach] rate-limit error:', e?.message || e);
    // Fail-closed: if rate-limit can't be enforced, refuse the call
    return res.status(503).json({ error: 'Service temporairement indisponible' });
  }

  // ── Truncate input to prevent abuse ────────────────────────────────────────
  const safeMessages = messages.slice(-10).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '').slice(0, 4000) }],
  }));

  // Inject user profile context in last user message (capped)
  if (userProfile && typeof userProfile === 'object') {
    const profileCtx = `\n\n[Contexte utilisateur: ${JSON.stringify(userProfile).slice(0, 1500)}]`;
    const last = safeMessages[safeMessages.length - 1];
    last.parts[0].text += profileCtx;
  }

  // ── Call Gemini (key in header, not query string) ──────────────────────────
  try {
    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: safeMessages,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.85,
          maxOutputTokens: 1024,
          topK: 40,
          topP: 0.95,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[coach] Gemini error:', geminiRes.status, errText);
      return res.status(502).json({ error: 'Service IA temporairement indisponible' });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: 'Réponse IA vide' });

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = {
        reply: text,
        analysis: {
          topics: [],
          stats_delta: { mental: 0, corps: 0, social: 0, pro: 0 },
          new_nodes: [],
          priority_modules: [],
          insight: '',
        },
      };
    }

    return res.status(200).json(parsed);
  } catch (e) {
    console.error('[coach] handler error:', e?.message || e);
    return res.status(500).json({ error: 'Erreur interne' });
  }
};
