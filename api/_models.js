// api/_models.js - Quel modele existe VRAIMENT, demande au fournisseur.
//
// LE SOULIGNE DU NOM EST VOLONTAIRE : Vercel ne route pas les fichiers de /api
// prefixes par « _ ». Ne pas le renommer sans le deplacer hors de /api.
//
// ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
//
// La traduction du site est tombee DEUX FOIS pour la meme raison.
//
// Le 20 aout : un nom de modele code en dur avait ete deprecie. Le correctif a
// remplace ce nom par une CASCADE de noms codes en dur, du plus capable au plus
// leger, en se disant qu il en resterait bien un de valide.
//
// Le 2 septembre, treize jours plus tard : les HUIT modeles de la cascade
// etaient morts. Groq renvoyait 404 ou « decommissionne » sur ses quatre
// references, Google repondait « ce modele n est plus disponible » sur les
// siennes. 143 erreurs en production, quinze langues qui ne se traduisaient
// plus, et personne pour le voir pendant treize jours.
//
// La lecon n est pas « il fallait de meilleurs noms ». C est qu une liste de
// noms ecrite a la main POURRIRA TOUJOURS : Groq et Google deprecient en
// continu, et rien dans le depot ne le signale.
//
// Ce module interroge donc l ANNUAIRE de chaque fournisseur - la liste des
// modeles qu il sert reellement, a cet instant - et choisit dedans. Un modele
// deprecie disparait de l annuaire : il n est plus jamais essaye, sans qu une
// ligne de code ait besoin de changer.
//
// Le repli code en dur existe encore, tout en bas, pour le cas ou l annuaire
// lui-meme serait injoignable. Il n est plus le chemin normal.

// L annuaire est stable a l echelle de la minute : le relire a chaque appel
// couterait un aller-retour pour rien. Il est donc garde en memoire de
// l instance, comme l etait deja le « modele qui a marche ».
const TTL_MS = 30 * 60 * 1000;
const cache = { groq: { at: 0, list: null }, gemini: { at: 0, list: null } };

/** fetch avec plafond de temps : sans lui, un fournisseur qui ne repond pas
 *  bloque la fonction jusqu au timeout de la plateforme (300 s constatees). */
async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(1, ms));
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ── Tri des candidats ───────────────────────────────────────────────────────
// L ordre n est qu une optimisation : on essaie les modeles dans l ordre et le
// premier qui repond gagne. Se tromper de tri coute un aller-retour, pas une
// panne - contrairement a se tromper de nom.

/** Groq sert aussi de l audio, de la moderation et de la synthese vocale.
 *  Les envoyer traduire du texte est un echec garanti : on les ecarte. */
const GROQ_EXCLUS = /whisper|tts|guard|embed|vision|distil-whisper/i;

function scoreGroq(id) {
  let s = 0;
  if (/versatile/i.test(id)) s += 40;        // variantes generalistes, bonnes en traduction
  if (/instruct/i.test(id)) s += 30;
  if (/70b|90b|120b/i.test(id)) s += 20;     // plus de parametres, meilleure langue
  if (/llama/i.test(id)) s += 10;
  if (/instant|8b|mini/i.test(id)) s += 5;   // rapides : bons derniers recours
  if (/preview|beta/i.test(id)) s -= 15;     // instables, mais utilisables en dernier
  return s;
}

/** Google sert de l embedding, de l image, de la video et des modeles temps
 *  reel qui exigent un websocket. Seuls les modeles de generation de texte
 *  nous concernent, et le champ supportedGenerationMethods le dit. */
const GEMINI_EXCLUS = /embedding|aqa|imagen|veo|image|tts|live|native-audio|thinking/i;

function scoreGemini(id) {
  let s = 0;
  if (/flash/i.test(id)) s += 40;            // la traduction veut de la latence basse
  if (/lite/i.test(id)) s += 10;
  if (/pro/i.test(id)) s += 15;
  if (/latest/i.test(id)) s -= 5;            // alias mouvant : bon repli, mauvais premier choix
  if (/preview|exp/i.test(id)) s -= 20;
  // Un numero de version plus eleve passe devant, sans qu on ait a le connaitre.
  const v = id.match(/(\d+)\.(\d+)/);
  if (v) s += Number(v[1]) * 6 + Number(v[2]);
  return s;
}

// ── Annuaires ───────────────────────────────────────────────────────────────

/** Liste les modeles de conversation reellement servis par Groq. */
async function listGroq(apiKey, budgetMs) {
  const now = Date.now();
  if (cache.groq.list && now - cache.groq.at < TTL_MS) return cache.groq.list;
  const r = await fetchWithTimeout(
    'https://api.groq.com/openai/v1/models',
    { headers: { Authorization: `Bearer ${apiKey}` } },
    budgetMs,
  );
  if (!r.ok) throw new Error('annuaire Groq ' + r.status);
  const data = await r.json();
  const list = (data.data || [])
    .filter((m) => m && m.id && !GROQ_EXCLUS.test(m.id))
    // Groq expose `active` : un modele inactif est deja mort, on l ecarte ici
    // plutot que d apprendre son deces par un 404 en pleine traduction.
    .filter((m) => m.active !== false)
    .map((m) => m.id)
    .sort((a, b) => scoreGroq(b) - scoreGroq(a));
  cache.groq = { at: now, list };
  return list;
}

/** Liste les modeles Google capables de generateContent. */
async function listGemini(apiKey, budgetMs) {
  const now = Date.now();
  if (cache.gemini.list && now - cache.gemini.at < TTL_MS) return cache.gemini.list;
  const r = await fetchWithTimeout(
    'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
    { headers: { 'x-goog-api-key': apiKey } },
    budgetMs,
  );
  if (!r.ok) throw new Error('annuaire Gemini ' + r.status);
  const data = await r.json();
  const list = (data.models || [])
    .filter((m) => Array.isArray(m.supportedGenerationMethods)
      && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => String(m.name || '').replace(/^models\//, ''))
    .filter((id) => id && !GEMINI_EXCLUS.test(id))
    .sort((a, b) => scoreGemini(b) - scoreGemini(a));
  cache.gemini = { at: now, list };
  return list;
}

// ── Replis ──────────────────────────────────────────────────────────────────
// Uniquement pour le cas ou l annuaire est injoignable (panne reseau, cle sans
// droit de lecture sur /models). Ces noms peuvent etre morts : c est justement
// ce qu on cherche a ne plus dependre. Ils ne servent qu a ne pas rendre les
// armes sans avoir essaye.
const REPLI_GROQ = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const REPLI_GEMINI = ['gemini-flash-latest', 'gemini-2.0-flash'];

/**
 * Les modeles a essayer, dans l ordre, pour un fournisseur.
 * @param {'groq'|'gemini'} provider
 * @param {string} apiKey
 * @param {{ budgetMs?: number, epingle?: string, max?: number }} [opts]
 *   epingle : force un modele en tete (variable d env GROQ_MODEL / GEMINI_MODEL).
 *   max     : borne le nombre de candidats, pour ne pas enchainer vingt echecs.
 * @returns {Promise<string[]>}
 */
async function candidats(provider, apiKey, opts = {}) {
  const { budgetMs = 4000, epingle = '', max = 4 } = opts;
  let liste = [];
  try {
    liste = provider === 'groq'
      ? await listGroq(apiKey, budgetMs)
      : await listGemini(apiKey, budgetMs);
  } catch (e) {
    console.error('[models] annuaire ' + provider + ' injoignable :', e?.message || e);
    liste = provider === 'groq' ? REPLI_GROQ : REPLI_GEMINI;
  }
  if (!liste.length) liste = provider === 'groq' ? REPLI_GROQ : REPLI_GEMINI;
  // Un modele epingle par variable d environnement passe toujours devant :
  // c est le moyen de forcer un choix sans redeployer.
  const out = epingle ? [epingle, ...liste.filter((m) => m !== epingle)] : liste;
  return out.slice(0, max);
}

/** Oublie les annuaires memorises. Utile si un modele meurt en cours de vie
 *  d instance : on reinterroge au lieu de s acharner sur une liste perimee. */
function invalider(provider) {
  if (provider) cache[provider] = { at: 0, list: null };
  else { cache.groq = { at: 0, list: null }; cache.gemini = { at: 0, list: null }; }
}

module.exports = { candidats, invalider, fetchWithTimeout };
