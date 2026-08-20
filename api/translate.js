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


const MAX_ITEMS = 200;
const MAX_CHARS = 24000;
const IP_WINDOW_MS = 60_000;      // fenêtre du rate-limit IP
const IP_MAX_PER_WINDOW = 10;     // le cache partage absorbe le reste : ce plafond ne concerne plus que les textes JAMAIS traduits
const GLOBAL_DAILY_MAX = 600;     // plafond global / jour. Amorcer les 16 langues du site coute ~270 appels UNE SEULE FOIS
const IP_DAILY_MAX = 250;         // plafond / jour / IP : empêche une seule IP d'épuiser le global

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({ credential: cert(sa) });
}


// ── CACHE PARTAGE DES TRADUCTIONS ───────────────────────────────────────────
// Le site est ECRIT UNE FOIS : « Ta journée » se traduit de la meme facon pour
// tout le monde. Sans cache commun, chaque visiteur refaisait traduire les
// memes 800 chaines, ce qui epuisait le quota (4 requetes/min, 60/jour par IP)
// des la premiere page - et l i18n echouait en silence.
//
// Ici, une langue = un document Firestore { empreinte du texte -> traduction }.
// Ce qui a deja ete traduit une fois ne repasse plus jamais par le modele, ni
// par le compteur de quota. Le site se traduit donc progressivement, puis
// devient instantane et gratuit pour tous.
const CACHE_DOC_MAX = 800_000;   // un document Firestore plafonne a 1 Mo

// Empreinte courte et stable du texte source (FNV-1a). Sert de cle : deux
// chaines identiques partagent leur traduction, ou qu'elles apparaissent.
function fp(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

async function readCache(db, lang) {
  try {
    const snap = await db.collection('translations').doc(lang).get();
    return snap.exists ? (snap.data().m || {}) : {};
  } catch (e) {
    console.error('[translate] lecture cache', e?.message || e);
    return {};
  }
}

async function writeCache(db, lang, add) {
  if (!Object.keys(add).length) return;
  try {
    const ref = db.collection('translations').doc(lang);
    const snap = await ref.get();
    const m = snap.exists ? (snap.data().m || {}) : {};
    Object.assign(m, add);
    // Au-dela du plafond on cesse d ecrire plutot que de faire echouer TOUTES
    // les ecritures suivantes : le cache deja constitue continue de servir.
    if (JSON.stringify(m).length > CACHE_DOC_MAX) {
      console.warn('[translate] cache ' + lang + ' plein, ecriture ignoree');
      return;
    }
    await ref.set({ m, updatedAt: new Date() }, { merge: true });
  } catch (e) {
    console.error('[translate] ecriture cache', e?.message || e);
  }
}

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket?.remoteAddress || 'unknown';
}


// ── MODELES : UNE LISTE, PAS UN NOM ─────────────────────────────────────────
// Les deux fournisseurs ont renvoye 404 en production : les cles etaient
// bonnes, mais les modeles codes en dur avaient ete retires. Groq et Google
// deprecient regulierement leurs references, et un nom fige casse la
// traduction du site a chaque fois, en silence.
//
// On essaie donc une liste, du plus capable au plus leger, et le premier qui
// repond gagne. Une variable d'environnement passe toujours en tete, pour
// pouvoir epingler un modele sans redeployer le code.
const GROQ_MODELS = [
  process.env.GROQ_MODEL,
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
].filter(Boolean);

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash',
].filter(Boolean);

// Le modele qui a marche est retenu en memoire de l'instance : la cascade ne
// se rejoue donc pas a chaque appel tant que la fonction reste chaude.
let goodGroq = null, goodGemini = null;

function sysPrompt(targetName) {
  return `You are a professional UI translator for « Change Your Life », a warm, calm well-being app (tone close to Calm / Headspace).
Translate the given user-interface strings from French into ${targetName}.

STRICT RULES:
- Return ONLY a valid JSON object mapping each id to its translated string. No markdown, no commentary.
- Keep the SAME ids as the input. Include EVERY id from the input in your output - never omit, merge or rename a single id, even short ones.
- Preserve any HTML tags exactly (<br>, <strong>…) and their position.
- Preserve placeholders like %s exactly.
- Do NOT translate these: "ChangeYourLife.ai", "Cyl", "XP".
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

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return res.status(503).json({ error: 'Service temporairement indisponible' });
  }
  const db = getFirestore(getAdminApp());

  // ── Le cache d'abord ────────────────────────────────────────────────────
  // Un lot deja connu repart tout de suite, SANS toucher au quota : celui-ci
  // protege le cout du modele, pas la lecture d'un dictionnaire.
  const cached = await readCache(db, target);
  const known = {};
  const missing = {};
  for (const id of ids) {
    const src = String(items[id] || '');
    const hit = cached[fp(src)];
    if (hit) known[id] = hit; else missing[id] = src;
  }
  const missingIds = Object.keys(missing);
  if (!missingIds.length) {
    return res.status(200).json({ translations: known, provider: 'cache' });
  }

  // ── Rate-limit IP + plafond global journalier (fail-closed) ────────────────
  try {
    const now = Date.now();
    const ip = clientIp(req);

    const day = new Date().toISOString().slice(0, 10);

    // Par IP : IP_MAX_PER_WINDOW req/min ET IP_DAILY_MAX req/jour.
    // Sans le plafond journalier par IP, une seule IP anonyme épuisait le
    // quota global (400/j) en ~100 min et coupait l'i18n pour tout le monde
    // (AUDIT 2026-08-16).
    const ipKey = Buffer.from(ip).toString('base64url').slice(0, 60);
    const ipRef = db.collection('translateRate').doc(ipKey);
    const ipSnap = await ipRef.get();
    const ipData = ipSnap.exists ? ipSnap.data() : {};
    let calls = ipSnap.exists ? (ipData.calls || []).filter((t) => now - t < IP_WINDOW_MS) : [];
    if (calls.length >= IP_MAX_PER_WINDOW) {
      return res.status(429).json({ error: 'Trop de requêtes. Patiente une minute.' });
    }
    const ipDayCount = ipData.day === day ? (ipData.dayCount || 0) : 0;
    if (ipDayCount >= IP_DAILY_MAX) {
      return res.status(429).json({ error: 'Quota de traduction atteint pour aujourd\'hui.' });
    }
    calls.push(now);
    await ipRef.set({ calls, lastAt: new Date(), day, dayCount: ipDayCount + 1 }, { merge: true });

    // Global : GLOBAL_DAILY_MAX req / jour (protège le quota Groq/Gemini)
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
  // Seuls les textes encore inconnus partent au modele : un lot de 45 chaines
  // dont 44 sont deja en cache ne coute qu'une seule chaine.
  const userPayload = 'Translate these strings:\n' + JSON.stringify(missing);

  // Fusionne ce qui vient du modele avec ce que le cache savait deja, et
  // enregistre les nouveautes pour le visiteur suivant.
  async function respond(parsed, provider) {
    const add = {};
    for (const id of missingIds) {
      const tr = parsed && parsed[id];
      if (typeof tr === 'string' && tr.trim()) add[fp(missing[id])] = tr;
    }
    await writeCache(db, target, add);
    const out = Object.assign({}, known);
    for (const id of missingIds) if (parsed && parsed[id]) out[id] = parsed[id];
    return res.status(200).json({ translations: out, provider });
  }

  // Sert au diagnostic quand tout echoue : sans lui, une panne de cle et une
  // panne de quota donnent le meme message et rien n est actionnable.
  let groqStatus = process.env.GROQ_API_KEY ? 0 : 'absente';

  // ── Groq (préféré) ──────────────────────────────────────────────────────────
  if (process.env.GROQ_API_KEY) {
    for (const model of (goodGroq ? [goodGroq] : GROQ_MODELS)) {
      try {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
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
          const parsed = safeParse(data.choices?.[0]?.message?.content);
          if (parsed) { goodGroq = model; return await respond(parsed, 'groq:' + model); }
          groqStatus = 'reponse illisible';
        } else {
          groqStatus = r.status;
          const body = (await r.text()).slice(0, 160);
          console.error('[translate] Groq', model, r.status, body);
          // 404 = modele inconnu : on passe au suivant. Tout autre code (401,
          // 429, 5xx) ne se reglera pas en changeant de modele.
          if (r.status !== 404 && r.status !== 400) break;
        }
      } catch (e) {
        groqStatus = 'exception';
        console.error('[translate] Groq', model, e?.message || e);
      }
    }
    // si Groq échoue, on tente Gemini ci-dessous (s'il est configuré)
  }

  // ── Gemini (repli) ──────────────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Aucun provider IA configuré (GROQ_API_KEY ou GEMINI_API_KEY)', detail: { groq: groqStatus } });
  }
  let gemStatus = 0;
  for (const model of (goodGemini ? [goodGemini] : GEMINI_MODELS)) {
    try {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userPayload }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 8000 },
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const parsed = safeParse(data.candidates?.[0]?.content?.parts?.[0]?.text);
        if (parsed) { goodGemini = model; return await respond(parsed, 'gemini:' + model); }
        gemStatus = 'reponse illisible';
      } else {
        gemStatus = r.status;
        console.error('[translate] Gemini', model, r.status, (await r.text()).slice(0, 160));
        if (r.status !== 404 && r.status !== 400) break;
      }
    } catch (e) {
      gemStatus = 'exception';
      console.error('[translate] Gemini', model, e?.message || e);
    }
  }
  return res.status(502).json({
    error: 'Service de traduction indisponible',
    detail: { groq: groqStatus, gemini: gemStatus },
  });
};

function safeParse(text) {
  if (!text || typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch (_) {}
  // tolère un éventuel bloc ```json … ```
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return null;
}
