// api/translate.js — Traduction IA à la demande pour l'i18n du site.
//
// Le contenu est écrit une seule fois en français ; ce endpoint le traduit
// vers n'importe quelle langue. Le client met le résultat en cache
// (localStorage) → un seul appel par langue et par version de contenu.
//
// Provider : Groq (Llama 3.3 70B, rapide/gratuit) si GROQ_API_KEY, sinon
// Gemini 2.0 Flash. Endpoint PUBLIC (page d'accueil non connectée) mais
// protégé : bornes par requête + rate-limit par IP + plafond global journalier
// (fail-closed, comme api/chat.js) + contrôle d'origine.

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const MAX_ITEMS = 200;
const MAX_CHARS = 24000;
const IP_WINDOW_MS = 60_000;      // fenêtre du rate-limit IP
const IP_MAX_PER_WINDOW = 4;      // 4 requêtes / min / IP (le client cache en localStorage : largement assez)
const GLOBAL_DAILY_MAX = 400;     // plafond global de traductions / jour (protège le quota provider)

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({ credential: cert(sa) });
}

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket?.remoteAddress || 'unknown';
}

function sysPrompt(targetName) {
  return `You are a professional UI translator for « Change Your Life », a warm, calm well-being app (tone close to Calm / Headspace).
Translate the given user-interface strings from French into ${targetName}.

STRICT RULES:
- Return ONLY a valid JSON object mapping each id to its translated string. No markdown, no commentary.
- Keep the SAME ids as the input. Include EVERY id from the input in your output - never omit, merge or rename a single id, even short ones.
- Preserve any HTML tags exactly (<br>, <strong>…) and their position.
- Preserve placeholders like %s exactly.
- Do NOT translate these: "ChangeYourLife.ai", "Syl", "XP".
- Use simple hyphens "-" only. NEVER use em dashes (—) or en dashes (–).
- Keep the tone warm, encouraging, natural — not literal. Use the informal/friendly register when the language has one (tutoiement, du, tú…).
- Output the translation in ${targetName} only.`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://changeyourlife.ai');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Contrôle d'origine (couche légère : bloque les abus navigateur tiers) ──
  const origin = req.headers.origin || '';
  if (origin && origin !== 'https://changeyourlife.ai') {
    return res.status(403).json({ error: 'Origine non autorisée' });
  }

  const { target, targetName, items } = req.body || {};
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'target (code langue) requis' });
  }
  if (!items || typeof items !== 'object' || Array.isArray(items)) {
    return res.status(400).json({ error: 'items (objet {id: texte}) requis' });
  }
  const ids = Object.keys(items);
  if (!ids.length) return res.status(200).json({ translations: {} });
  if (ids.length > MAX_ITEMS) {
    return res.status(413).json({ error: `Trop d'items (max ${MAX_ITEMS})` });
  }
  const totalChars = ids.reduce((n, k) => n + String(items[k] || '').length, 0);
  if (totalChars > MAX_CHARS) {
    return res.status(413).json({ error: `Contenu trop volumineux (max ${MAX_CHARS} caractères)` });
  }

  // Le français n'a pas besoin de traduction.
  if (target.toLowerCase().startsWith('fr')) {
    return res.status(200).json({ translations: items });
  }

  // ── Rate-limit IP + plafond global journalier (fail-closed) ────────────────
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return res.status(503).json({ error: 'Service temporairement indisponible' });
  }
  try {
    const db = getFirestore(getAdminApp());
    const now = Date.now();
    const ip = clientIp(req);

    // Par IP : IP_MAX_PER_WINDOW req / min (doc par hash simple de l'IP)
    const ipKey = Buffer.from(ip).toString('base64url').slice(0, 60);
    const ipRef = db.collection('translateRate').doc(ipKey);
    const ipSnap = await ipRef.get();
    let calls = ipSnap.exists ? (ipSnap.data().calls || []).filter((t) => now - t < IP_WINDOW_MS) : [];
    if (calls.length >= IP_MAX_PER_WINDOW) {
      return res.status(429).json({ error: 'Trop de requêtes. Patiente une minute.' });
    }
    calls.push(now);
    await ipRef.set({ calls, lastAt: new Date() }, { merge: true });

    // Global : GLOBAL_DAILY_MAX req / jour (protège le quota Groq/Gemini)
    const day = new Date().toISOString().slice(0, 10);
    const gRef = db.collection('translateRate').doc('_global');
    const gSnap = await gRef.get();
    const g = gSnap.exists ? gSnap.data() : {};
    const count = g.day === day ? (g.count || 0) : 0;
    if (count >= GLOBAL_DAILY_MAX) {
      return res.status(429).json({ error: 'Quota de traduction du jour atteint.' });
    }
    await gRef.set({ day, count: count + 1, lastAt: new Date() });
  } catch (e) {
    console.error('[translate] rate-limit error:', e?.message || e);
    return res.status(503).json({ error: 'Service temporairement indisponible' });
  }

  const langName = (typeof targetName === 'string' && targetName.trim()) || target;
  const system = sysPrompt(langName);
  const userPayload = 'Translate these strings:\n' + JSON.stringify(items);

  // ── Groq (préféré) ──────────────────────────────────────────────────────────
  if (process.env.GROQ_API_KEY) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userPayload },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 8000,
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const text = data.choices?.[0]?.message?.content;
        const parsed = safeParse(text);
        if (parsed) return res.status(200).json({ translations: parsed, provider: 'groq' });
      } else {
        console.error('[translate] Groq error', r.status, (await r.text()).slice(0, 200));
      }
    } catch (e) {
      console.error('[translate] Groq handler', e?.message || e);
    }
    // si Groq échoue, on tente Gemini ci-dessous (s'il est configuré)
  }

  // ── Gemini (repli) ──────────────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Aucun provider IA configuré (GROQ_API_KEY ou GEMINI_API_KEY)' });
  }
  try {
    const r = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userPayload }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 8000 },
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error('[translate] Gemini error', r.status, errText.slice(0, 200));
      return res.status(502).json({ error: 'Service de traduction indisponible' });
    }
    const data = await r.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = safeParse(text);
    if (!parsed) return res.status(502).json({ error: 'Réponse de traduction invalide' });
    return res.status(200).json({ translations: parsed, provider: 'gemini' });
  } catch (e) {
    console.error('[translate] handler', e?.message || e);
    return res.status(500).json({ error: 'Erreur interne' });
  }
};

function safeParse(text) {
  if (!text || typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch (_) {}
  // tolère un éventuel bloc ```json … ```
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return null;
}
