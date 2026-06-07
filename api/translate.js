// api/translate.js — Traduction IA à la demande pour l'i18n du site.
//
// Le contenu est écrit une seule fois en français ; ce endpoint le traduit
// vers n'importe quelle langue. Le client met le résultat en cache
// (localStorage) → un seul appel par langue et par version de contenu.
//
// Provider : Groq (Llama 3.3 70B, rapide/gratuit) si GROQ_API_KEY, sinon
// Gemini 2.0 Flash. Endpoint PUBLIC (page d'accueil non connectée) mais
// plafonné (nb d'items + taille) pour limiter l'abus.

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const MAX_ITEMS = 200;
const MAX_CHARS = 24000;

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
      return res.status(502).json({ error: 'Service de traduction indisponible', details: errText.slice(0, 200) });
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
