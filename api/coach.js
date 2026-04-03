// api/coach.js — IA Coach endpoint using Gemini 2.0 Flash (free tier)
// Requires GEMINI_API_KEY in Vercel environment variables
// Get a free key at: https://aistudio.google.com/apikey

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `Tu es CYL Coach, un coach de vie bienveillant, empathique et direct sur l'application Change Your Life.

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

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured', setup: 'https://aistudio.google.com/apikey' });
  }

  const { messages, userProfile } = req.body || {};
  if (!messages || !Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Build conversation for Gemini
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  // Inject user profile context in the last user message
  if (userProfile && Object.keys(userProfile).length) {
    const profileCtx = `\n\n[Contexte utilisateur: ${JSON.stringify(userProfile)}]`;
    const last = contents[contents.length - 1];
    last.parts[0].text += profileCtx;
  }

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.85,
          maxOutputTokens: 1024,
          topK: 40,
          topP: 0.95,
        }
      })
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('Gemini error:', err);
      return res.status(502).json({ error: 'Gemini API error', details: err });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: 'Empty Gemini response' });

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch(e) {
      // Fallback if Gemini returns non-JSON
      parsed = {
        reply: text,
        analysis: { topics: [], stats_delta: { mental:0, corps:0, social:0, pro:0 }, new_nodes: [], priority_modules: [], insight: '' }
      };
    }

    return res.status(200).json(parsed);
  } catch(e) {
    console.error('coach handler error:', e);
    return res.status(500).json({ error: 'Internal error', message: e.message });
  }
}
