// /js/organizer-data.js - Socle de donnees de l'ORGANIZER (le cerveau du site).
//
// PUR cote logique : lecture/ecriture Firestore + normalisation + operations
// sur le board. Partage par la page /organizer/ ET le widget en tete de /app/,
// pour qu'il n'existe qu'UN SEUL modele de donnees.
//
// Document : users/{uid}.organizer
//   {
//     v: 2,
//     columns: [{ id, title, color, cards: [Card] }],
//     links:   [{ id, from, to }],          // connecteurs de la vue Canvas
//     canvas:  { x, y, z }, view: 'board'|'canvas',
//     lockCols, lockCards
//   }
//
// Card :
//   { id, title, desc, due (ms|null), checklist: [{id,t,done}], logs: [{at,m}],
//     done, createdAt,
//     branch: <cle Maslow|null>,   // la branche de l'arbre que la fiche nourrit
//     gcalId: <id evenement|null>, // evenement Google Agenda cree depuis la fiche
//     cx, cy }                     // position dans la vue Canvas

import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const ORGANIZER_VERSION = 2;
export const TRI_ID = 'tri';
export const FINISH_ID = 'finish';
export const FINISH_XP = 50;

export const DEFAULT_COLUMNS = [
  { id: TRI_ID,    title: 'Idées à trier',                                color: '#8aa0bf' },
  { id: 'ui',      title: 'Urgent · Important - à faire',                 color: '#f87171' },
  { id: 'ni',      title: 'Important, non urgent - à planifier',          color: '#38bdf8' },
  { id: 'up',      title: 'Urgent, peu important - vite fait / déléguer', color: '#fbbf24' },
  { id: 'nn',      title: 'Non urgent · non important - plus tard',       color: '#7e9ab5' },
  { id: FINISH_ID, title: 'Terminé',                                      color: '#4ade80' },
];

// Les 8 branches Maslow (miroir de tree-model.js, sans dependance THREE).
// PALETTE ORGANIQUE - source unique de verite des couleurs de branche : elle
// est reprise a l'identique par app.js (anneaux), tree-model.js (arbre 3D),
// le hub ORGANIZER, l'agenda et le brief CYL. Avant, trois palettes navy v2
// concurrentes coloraient la meme branche differemment (AUDIT 2026-08-16).
export const BRANCHES = [
  { key: 'physio',          label: 'Physiologique',   emoji: '🌱', color: '#84c25e' },
  { key: 'securite',        label: 'Sécurité',        emoji: '🛡️', color: '#e7b15c' },
  { key: 'appartenance',    label: 'Appartenance',    emoji: '🤝', color: '#e0785f' },
  { key: 'estime',          label: 'Estime',          emoji: '🏆', color: '#c39a6b' },
  { key: 'cognitif',        label: 'Cognitif',        emoji: '📚', color: '#9d8ec4' },
  { key: 'esthetique',      label: 'Esthétique',      emoji: '🎨', color: '#d98cae' },
  { key: 'accomplissement', label: 'Accomplissement', emoji: '🚀', color: '#6f9a52' },
  { key: 'transcendance',   label: 'Transcendance',   emoji: '✨', color: '#f1cd92' },
];
export const BRANCH_BY_KEY = Object.fromEntries(BRANCHES.map((b) => [b.key, b]));

// ── Utilitaires ──────────────────────────────────────────────────────────────
export const now = () => Date.now();
export const uid6 = (p) => (p || 'c') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function stripEmoji(s) { return String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}✅✔️]/gu, '').trim(); }

// ── Chargement / sauvegarde ──────────────────────────────────────────────────
export function emptyBoard() {
  return {
    v: ORGANIZER_VERSION,
    columns: DEFAULT_COLUMNS.map((c) => ({ ...c, cards: [] })),
    links: [], canvas: { x: 20, y: 20, z: 1 }, view: 'board',
    lockCols: false, lockCards: false,
  };
}

export function normalizeBoard(raw) {
  const board = (raw && Array.isArray(raw.columns)) ? raw : emptyBoard();
  board.v = ORGANIZER_VERSION;
  board.columns.forEach((c) => {
    if (!Array.isArray(c.cards)) c.cards = [];
    c.cards.forEach((k) => {
      if (!Array.isArray(k.checklist)) k.checklist = [];
      if (!Array.isArray(k.logs)) k.logs = [];
      if (!('branch' in k)) k.branch = null;
      if (!('gcalId' in k)) k.gcalId = null;
      if (typeof k.createdAt !== 'number') k.createdAt = now();
    });
  });
  board.lockCols = !!board.lockCols;
  board.lockCards = !!board.lockCards;
  board.view = board.view === 'canvas' ? 'canvas' : 'board';
  if (!board.canvas || typeof board.canvas.z !== 'number') board.canvas = { x: 20, y: 20, z: 1 };
  if (!Array.isArray(board.links)) board.links = [];
  // garantit que 'tri' existe et passe en tete
  if (!getCol(board, TRI_ID)) board.columns.unshift({ ...DEFAULT_COLUMNS[0], cards: [] });
  board.columns.sort((a, b) => (a.id === TRI_ID ? -1 : b.id === TRI_ID ? 1 : 0));
  return board;
}

export async function loadBoard(db, uid) {
  let raw = null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    raw = snap.exists() ? snap.data().organizer : null;
  } catch (_) { raw = null; }
  return normalizeBoard(raw);
}

// Ecriture debouncee. `onError` permet d'afficher un vrai retour (pas de perte
// silencieuse - cf. AUDIT P0 « ecritures Firestore perdues en silence »).
const saveTimers = new WeakMap();
export function saveBoard(db, uid, board, { delay = 250, onError = null, onSaved = null } = {}) {
  clearTimeout(saveTimers.get(board));
  saveTimers.set(board, setTimeout(async () => {
    try {
      await setDoc(doc(db, 'users', uid), { organizer: board }, { merge: true });
      if (onSaved) onSaved();
    } catch (e) {
      console.error('[organizer] save failed:', e && e.message);
      if (onError) onError(e);
    }
  }, delay));
}

// ── Operations sur le board ──────────────────────────────────────────────────
export function getCol(board, id) { return board.columns.find((c) => c.id === id); }
export function colTitle(board, id) { const c = getCol(board, id); return c ? c.title : ''; }
export function findCard(board, id) {
  for (const c of board.columns) { const k = c.cards.find((x) => x.id === id); if (k) return { card: k, col: c }; }
  return null;
}
export function allCards(board) {
  return board.columns.flatMap((c) => c.cards.map((card) => ({ card, col: c })));
}
export function logCard(card, m) {
  card.logs = card.logs || [];
  card.logs.unshift({ at: now(), m });
  if (card.logs.length > 60) card.logs.length = 60;
}

export function newCard(title, extra = {}) {
  const card = {
    id: uid6(), title: String(title || '').trim(), desc: '', due: null,
    checklist: [], logs: [], done: false, createdAt: now(),
    branch: extra.branch || guessBranch(title), gcalId: null, ...extra,
  };
  logCard(card, 'Fiche créée');
  return card;
}

export function addCard(board, colId, title, extra) {
  const c = getCol(board, colId) || getCol(board, TRI_ID);
  if (!c) return null;
  const card = newCard(title, extra);
  if (c.id === FINISH_ID) card.done = true;
  c.cards.unshift(card);
  return card;
}

// Deplace une fiche. Retourne { finished, reopened } pour que l'appelant decide
// de l'XP / du toast (la logique XP reste cote UI, avec le feedback visuel).
export function moveCard(board, cardId, toColId) {
  const f = findCard(board, cardId);
  if (!f || f.col.id === toColId) return { finished: false, reopened: false };
  const dest = getCol(board, toColId);
  if (!dest) return { finished: false, reopened: false };
  f.col.cards = f.col.cards.filter((x) => x.id !== cardId);
  dest.cards.push(f.card);
  logCard(f.card, `Deplacee : ${stripEmoji(f.col.title)} -> ${stripEmoji(dest.title)}`);
  let finished = false, reopened = false;
  if (toColId === FINISH_ID && !f.card.done) { f.card.done = true; logCard(f.card, 'Termine'); finished = true; }
  else if (toColId !== FINISH_ID && f.card.done) { f.card.done = false; reopened = true; }
  return { finished, reopened, card: f.card };
}

// ── Priorisation / tri du jour ───────────────────────────────────────────────
// Poids d'urgence par colonne Eisenhower (sert au classement « quoi maintenant »).
const COL_WEIGHT = { ui: 100, up: 70, ni: 55, nn: 20, [TRI_ID]: 30, [FINISH_ID]: -100 };

export function cardScore(card, col, ref = now()) {
  let s = COL_WEIGHT[col.id] ?? 40;
  if (card.due) {
    const days = (card.due - ref) / 86400000;
    if (days < 0) s += 60;              // en retard : remonte fort
    else if (days < 1) s += 45;
    else if (days < 3) s += 25;
    else if (days < 7) s += 10;
  }
  const checked = (card.checklist || []).filter((x) => x.done).length;
  if (checked && checked < (card.checklist || []).length) s += 8;   // deja entame
  return s;
}

// Les N fiches les plus prioritaires, hors « Termine ».
export function topPriorities(board, n = 5, ref = now()) {
  return allCards(board)
    .filter(({ card, col }) => !card.done && col.id !== FINISH_ID)
    .map((x) => ({ ...x, score: cardScore(x.card, x.col, ref) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// Fiches echues aujourd'hui ou avant (le « d'abord ca » de la journee).
export function dueToday(board, ref = new Date()) {
  const end = new Date(ref); end.setHours(23, 59, 59, 999);
  return allCards(board)
    .filter(({ card, col }) => !card.done && col.id !== FINISH_ID && card.due && card.due <= end.getTime())
    .sort((a, b) => a.card.due - b.card.due);
}

// ── Heuristique de branche (pre-remplissage, l'utilisateur peut corriger) ────
// Volontairement simple et locale : CYL affinera cote serveur. Aucune decision
// n'est imposee, c'est juste une suggestion de rangement.
// Le `\b` de fin est volontairement absent : il permet de tolerer pluriels et
// conjugaisons (« impots », « courses », « meditation ») sans lister chaque forme.
const BRANCH_HINTS = [
  ['physio',          /\b(dormir|sommeil|sieste|manger|repas|course|cuisine|sport|muscu|courir|marche|velo|hydrat|medecin|dentiste)/i],
  ['securite',        /\b(loyer|factur|impot|banque|assurance|budget|epargne|papier|admin|contrat|demenag|reparer|menage|ranger)/i],
  ['appartenance',    /\b(appeler|famille|maman|papa|mere|pere|ami|copain|couple|anniversaire|diner|soiree|message|repondre)/i],
  ['estime',          /\b(entretien|cv|candidatur|promo|presentation|bilan|feedback|reussir|defi)/i],
  // « livre(?!r) » : sinon « livrer » (accomplissement) serait pris pour un livre.
  ['cognitif',        /\b(lire|livre(?!r)|cours|apprendre|formation|etudier|revis|recherche|tuto|comprendre)/i],
  ['esthetique',      /\b(design|dessin|musique|photo|deco|creer|ecrire|expo)/i],
  ['accomplissement', /\b(projet|lancer|livrer|coder|dev\b|site|business|client|objectif|deadline|construire)/i],
  ['transcendance',   /\b(mediter|meditation|gratitude|benevol|aider|donner|spirituel|silence)/i],
];
// Les motifs sont ecrits SANS accent : on normalise le titre avant de tester,
// sinon « mediter » ne matcherait jamais « mediter » ecrit avec un accent (le
// \b de JS s'appuie sur [A-Za-z0-9_], les lettres accentuees le cassent).
function deaccent(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
export function guessBranch(title) {
  const t = deaccent(title);
  for (const [key, re] of BRANCH_HINTS) if (re.test(t)) return key;
  return null;
}
