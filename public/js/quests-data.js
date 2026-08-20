// /js/quests-data.js - Les quetes du jour et leurs recompenses.
//
// L'idee : rendre visible que ce qu'on fait compte. Trois quetes par jour,
// tirees d'un catalogue, avec une recompense nommee et de l'XP qui part dans
// une branche de l'arbre. Un jeu video indexe sur la vraie vie.
//
// LA REGLE QUI TIENT TOUT (CYL non-directif) :
// aucune quete ne dit a quelqu'un COMMENT VIVRE. Pas de « bois deux litres
// d'eau », pas de « couche-toi avant 23h », pas de « fais du sport ». Une
// quete porte soit sur un geste DANS le site (deposer, ranger, dater, relier),
// soit sur quelque chose que l'utilisateur A LUI-MEME POSE - une habitude
// qu'il a creee, un objectif qu'il s'est donne. Le catalogue ne contient
// aucune norme de vie, et c'est non negociable : c'est ce qui separe un
// compagnon d'un donneur de lecons.
//
// TIRAGE DETERMINISTE : les trois quetes viennent d'un hachage de (uid + jour).
// Elles ne changent donc pas si on recharge la page, elles changent a minuit,
// et elles ne demandent aucune ecriture pour etre fixees.

import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { BRANCH_BY_KEY, TRI_ID, FINISH_ID } from '/js/organizer-data.js';

export const DAILY_COUNT = 3;
export const STREAK_BONUS = 25;      // les trois quetes bouclees dans la journee

// ── Raretes ─────────────────────────────────────────────────────────────────
// Elles ne sont pas decoratives : elles disent le poids reel de l'effort. Une
// quete « epique » demande vraiment plus qu'un clic.
export const RARITY = {
  commune: { label: 'Commune',  xp: 12, color: '#b4ad94', w: 60 },
  rare:    { label: 'Rare',     xp: 28, color: '#84c25e', w: 30 },
  epique:  { label: 'Épique',   xp: 55, color: '#e7b15c', w: 10 },
};

// ── Le catalogue ────────────────────────────────────────────────────────────
// `need(s)` renvoie le nombre atteint, `goal` la cible. `can(s)` dit si la
// quete a un sens aujourd'hui : proposer « coche une habitude » a quelqu'un
// qui n'en a aucune, c'est lui donner une quete impossible.
const Q = [
  // ── Deposer et trier : le cœur du site ──
  { id: 'depose-1',  t: 'Vider sa tête',           d: 'Dépose une idée dans l’ORGANIZER',            r: 'Terrain dégagé',      b: 'cognitif',        rar: 'commune', goal: 1, need: (s) => s.createdToday },
  { id: 'depose-3',  t: 'Tout sortir',             d: 'Dépose trois idées aujourd’hui',              r: 'Tête légère',         b: 'cognitif',        rar: 'rare',    goal: 3, need: (s) => s.createdToday },
  { id: 'trie-1',    t: 'Une de rangée',           d: 'Range une fiche hors de « À trier »',         r: 'Premier tri',         b: 'securite',        rar: 'commune', goal: 1, need: (s) => s.sortedToday, can: (s) => s.tri > 0 },
  { id: 'trie-3',    t: 'Grand ménage',            d: 'Range trois fiches aujourd’hui',              r: 'Ordre retrouvé',      b: 'securite',        rar: 'rare',    goal: 3, need: (s) => s.sortedToday, can: (s) => s.tri >= 3 },
  { id: 'trie-zero', t: 'Boîte vide',              d: 'Ne laisse plus rien dans « À trier »',        r: 'Clarté totale',       b: 'securite',        rar: 'epique',  goal: 1, need: (s) => (s.tri === 0 ? 1 : 0), can: (s) => s.tri > 0 && s.tri <= 5 },
  { id: 'fini-1',    t: 'Fait',                    d: 'Termine une fiche',                           r: 'Élan',                b: 'accomplissement', rar: 'rare',    goal: 1, need: (s) => s.finishedToday },
  { id: 'fini-2',    t: 'Deux de moins',           d: 'Termine deux fiches',                         r: 'Second souffle',      b: 'accomplissement', rar: 'epique',  goal: 2, need: (s) => s.finishedToday },
  { id: 'precise-1', t: 'Dire vraiment',           d: 'Ajoute une description à une fiche vague',    r: 'Contour net',         b: 'cognitif',        rar: 'rare',    goal: 1, need: (s) => s.describedToday, can: (s) => s.vague > 0 },
  { id: 'branche-1', t: 'Rattacher',               d: 'Donne une branche de vie à une fiche',        r: 'Racine posée',        b: 'transcendance',   rar: 'commune', goal: 1, need: (s) => s.branchedToday },

  // ── Le temps : ce qui a une date existe ──
  { id: 'date-1',    t: 'Poser dans le temps',     d: 'Donne une échéance à une fiche',              r: 'Ancrage',             b: 'securite',        rar: 'commune', goal: 1, need: (s) => s.datedToday },
  { id: 'date-2',    t: 'Une vraie semaine',       d: 'Date deux fiches',                            r: 'Semaine dessinée',    b: 'securite',        rar: 'rare',    goal: 2, need: (s) => s.datedToday },
  { id: 'agenda-1',  t: 'Rien ne flotte',          d: 'Aie au moins une chose prévue aujourd’hui',   r: 'Journée habitée',     b: 'securite',        rar: 'rare',    goal: 1, need: (s) => (s.dueToday > 0 ? 1 : 0) },
  { id: 'retard-0',  t: 'Rattrapage',              d: 'Plus aucune fiche en retard',                 r: 'Dette effacée',       b: 'estime',          rar: 'epique',  goal: 1, need: (s) => (s.late === 0 ? 1 : 0), can: (s) => s.late > 0 && s.late <= 4 },

  // ── Objectifs et jalons ──
  { id: 'obj-new',   t: 'Se donner un cap',        d: 'Crée un objectif',                            r: 'Cap fixé',            b: 'accomplissement', rar: 'rare',    goal: 1, need: (s) => s.goalsCreatedToday },
  { id: 'obj-step',  t: 'Un pas de plus',          d: 'Franchis un jalon d’objectif',                r: 'Marche gravie',       b: 'accomplissement', rar: 'epique',  goal: 1, need: (s) => s.milestonesToday, can: (s) => s.goals > 0 },
  { id: 'obj-look',  t: 'Reprendre la carte',      d: 'Ouvre tes objectifs et regarde où tu en es',  r: 'Recentrage',          b: 'estime',          rar: 'commune', goal: 1, need: (s) => s.visited.objectifs, can: (s) => s.goals > 0 },

  // ── Habitudes : celles que TU as creees ──
  { id: 'hab-1',     t: 'Tenir parole',            d: 'Coche une habitude que tu t’es donnée',       r: 'Parole tenue',        b: 'estime',          rar: 'commune', goal: 1, need: (s) => s.habitsToday, can: (s) => s.habits > 0 },
  { id: 'hab-all',   t: 'Jour plein',              d: 'Coche toutes tes habitudes du jour',          r: 'Journée pleine',      b: 'estime',          rar: 'epique',  goal: 1, need: (s) => (s.habits && s.habitsToday >= s.habits ? 1 : 0), can: (s) => s.habits > 0 && s.habits <= 6 },
  { id: 'hab-new',   t: 'Un nouveau repère',       d: 'Ajoute une habitude à suivre',                r: 'Repère posé',         b: 'securite',        rar: 'rare',    goal: 1, need: (s) => s.habitsCreatedToday },

  // ── Se regarder : humeur, journal ──
  { id: 'mood-1',    t: 'Dire où tu en es',        d: 'Note ton humeur du jour',                     r: 'Météo intérieure',    b: 'appartenance',    rar: 'commune', goal: 1, need: (s) => (s.mood ? 1 : 0) },
  { id: 'mood-note', t: 'Mettre des mots',         d: 'Note ton humeur, avec un mot d’explication',  r: 'Mots posés',          b: 'cognitif',        rar: 'rare',    goal: 1, need: (s) => (s.mood && s.moodNote ? 1 : 0) },

  // ── Meditation : une fonction du site, jamais une prescription ──
  { id: 'med-1',     t: 'S’arrêter',               d: 'Fais une séance de méditation',               r: 'Souffle retrouvé',    b: 'physio',          rar: 'rare',    goal: 1, need: (s) => s.medToday },
  { id: 'med-long',  t: 'Vraiment s’arrêter',      d: 'Une séance de dix minutes ou plus',           r: 'Repos profond',       b: 'physio',          rar: 'epique',  goal: 1, need: (s) => (s.medMinutes >= 10 ? 1 : 0) },
  { id: 'med-streak',t: 'Deux jours de suite',     d: 'Médite aujourd’hui, comme hier',              r: 'Régularité',          b: 'transcendance',   rar: 'epique',  goal: 1, need: (s) => (s.medToday && s.medStreak >= 2 ? 1 : 0), can: (s) => s.medStreak >= 1 },

  // ── La frise : la memoire longue ──
  { id: 'frise-1',   t: 'Se souvenir',             d: 'Renseigne un thème de ta frise',              r: 'Mémoire ravivée',     b: 'transcendance',   rar: 'rare',    goal: 1, need: (s) => s.friseFilledToday },
  { id: 'frise-date',t: 'Poser une date',          d: 'Date un événement de ta vie',                 r: 'Jalon de vie',        b: 'transcendance',   rar: 'rare',    goal: 1, need: (s) => s.friseDatedToday },
  { id: 'frise-link',t: 'Faire le lien',           d: 'Relie un fait du passé à ton présent',        r: 'Fil conducteur',      b: 'cognitif',        rar: 'epique',  goal: 1, need: (s) => s.friseLinkedToday },

  // ── L'arbre : nourrir ce qui manque ──
  { id: 'branch-new',t: 'Branche oubliée',         d: 'Nourris une branche restée à zéro',           r: 'Pousse nouvelle',     b: 'transcendance',   rar: 'epique',  goal: 1, need: (s) => s.emptyBranchFedToday, can: (s) => s.emptyBranches > 0 },
  { id: 'xp-50',     t: 'Cinquante',               d: 'Gagne 50 XP aujourd’hui',                     r: 'Sève montante',       b: 'accomplissement', rar: 'rare',    goal: 50, need: (s) => s.xpToday },
  { id: 'xp-120',    t: 'Grosse journée',          d: 'Gagne 120 XP aujourd’hui',                    r: 'Croissance visible',  b: 'accomplissement', rar: 'epique',  goal: 120, need: (s) => s.xpToday },

  // ── Regarder ce que le site dit de toi ──
  { id: 'see-frise', t: 'Prendre du recul',        d: 'Ouvre ta frise chronologique',                r: 'Vue d’ensemble',      b: 'esthetique',      rar: 'commune', goal: 1, need: (s) => s.visited.frise },
  { id: 'see-pyr',   t: 'Où j’en suis',            d: 'Ouvre la lecture que CYL fait de toi',        r: 'Miroir',              b: 'estime',          rar: 'commune', goal: 1, need: (s) => s.visited.yourlife },
  { id: 'see-bilan', t: 'Regarder la semaine',     d: 'Ouvre ton bilan',                             r: 'Recul',               b: 'cognitif',        rar: 'commune', goal: 1, need: (s) => s.visited.bilan },
  { id: 'see-agenda',t: 'Voir venir',              d: 'Ouvre l’agenda vivant',                       r: 'Horizon dégagé',      b: 'securite',        rar: 'commune', goal: 1, need: (s) => s.visited.agenda },

  // ── Parler ──
  { id: 'cyl-1',     t: 'En parler',               d: 'Échange avec CYL',                            r: 'Voix entendue',       b: 'appartenance',    rar: 'commune', goal: 1, need: (s) => s.chatToday },
  { id: 'cyl-card',  t: 'Demander de l’aide',      d: 'Demande à CYL de t’aider sur une fiche',      r: 'Nœud défait',         b: 'appartenance',    rar: 'rare',    goal: 1, need: (s) => s.chatAboutCardToday, can: (s) => s.needsHelp > 0 },

  // ── Competences ──
  { id: 'skill-1',   t: 'Pratiquer',               d: 'Marque une compétence comme pratiquée',       r: 'Main sûre',           b: 'accomplissement', rar: 'commune', goal: 1, need: (s) => s.skillsPracticedToday, can: (s) => s.skills > 0 },
  { id: 'skill-new', t: 'Nommer ce que tu sais',   d: 'Ajoute une compétence',                       r: 'Savoir reconnu',      b: 'estime',          rar: 'rare',    goal: 1, need: (s) => s.skillsCreatedToday },
];

export const QUESTS = Q;
export const QUEST_BY_ID = Object.fromEntries(Q.map((q) => [q.id, q]));

// ── Tirage ──────────────────────────────────────────────────────────────────
// Hachage FNV : rapide, stable, et surtout SANS Math.random - deux chargements
// le meme jour doivent donner exactement les memes trois quetes.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function dayKey(d) {
  const n = d || new Date();
  return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
}

export function pickDaily(uid, day, state) {
  const pool = Q.filter((q) => !q.can || q.can(state));
  if (!pool.length) return [];
  // Un tirage pondere par rarete : l'epique doit rester rare, sinon il ne
  // veut plus rien dire.
  const seed = hash(String(uid) + '|' + day);
  const scored = pool.map((q, i) => {
    const w = RARITY[q.rar].w;
    // Le poids devient un decalage du rang : plus la quete est commune, plus
    // elle a de chances de remonter.
    const r = hash(String(uid) + '|' + day + '|' + q.id) % 1000;
    return { q, k: r - w * 6 + (seed % 7) * i * 0 };
  });
  scored.sort((a, b) => a.k - b.k);

  // Pas deux quetes de la meme branche : trois cartes identiques de couleur
  // donneraient l'impression d'une seule journee a theme.
  const out = [], used = new Set();
  for (const s of scored) {
    if (out.length >= DAILY_COUNT) break;
    if (used.has(s.q.b)) continue;
    used.add(s.q.b);
    out.push(s.q);
  }
  for (const s of scored) {          // s'il n'y a pas assez de branches distinctes
    if (out.length >= DAILY_COUNT) break;
    if (!out.includes(s.q)) out.push(s.q);
  }
  return out;
}

// ── Etat : ce que les modules savent ──────────────────────────────────────
// Deux lectures suffisent - le document utilisateur porte deja l'ORGANIZER, la
// frise, la meditation, les objectifs et les habitudes.
export function buildState(userDoc, mood, visited, day) {
  const u = userDoc || {};
  const board = u.organizer || { columns: [] };
  const cols = Array.isArray(board.columns) ? board.columns : [];
  const cards = cols.flatMap((c) => (c.cards || []).map((card) => ({ card, col: c })));
  const t0 = new Date(day + 'T00:00:00').getTime();
  const t1 = t0 + 86400000;
  const isToday = (ts) => Number.isFinite(ts) && ts >= t0 && ts < t1;
  // Un journal de bord par fiche : c'est lui qui date chaque geste, donc ce
  // qui permet de savoir ce qui a ete fait AUJOURD'HUI sans rien stocker de plus.
  const logsToday = (card, re) => (card.logs || []).filter((l) => isToday(l.at) && re.test(l.m || '')).length;

  const tri = (cols.find((c) => c.id === TRI_ID) || { cards: [] }).cards.length;
  const open = cards.filter(({ card, col }) => !card.done && col.id !== FINISH_ID);
  const frise = u.frise || { nodes: {}, links: [] };
  const fnodes = Object.values(frise.nodes || {});
  const med = u.meditation || {};
  const goals = Array.isArray(u.goals) ? u.goals : (u.goals && u.goals.list) || [];
  const habits = Array.isArray(u.habits) ? u.habits : (u.habits && u.habits.list) || [];
  const skills = u.skills ? Object.values(u.skills) : [];

  const branchXp = {};
  for (const k of Object.keys(BRANCH_BY_KEY)) branchXp[k] = (u.tree && u.tree[k]) || 0;
  const emptyBranches = Object.values(branchXp).filter((v) => !v).length;

  return {
    day,
    tri,
    late: open.filter(({ card }) => card.due && card.due < Date.now()).length,
    dueToday: cards.filter(({ card }) => isToday(card.due)).length,
    vague: cards.filter(({ card }) => !((card.desc || '').trim())).length,
    needsHelp: cards.filter(({ card }) => card.cylReason && !card.cylDismissed).length,

    createdToday: cards.filter(({ card }) => isToday(card.createdAt)).length,
    sortedToday: cards.reduce((n, { card }) => n + logsToday(card, /Déplacée/i), 0),
    finishedToday: cards.reduce((n, { card }) => n + logsToday(card, /Terminée|Déplacée.*Terminé/i), 0),
    describedToday: cards.reduce((n, { card }) => n + logsToday(card, /[Dd]escription/), 0),
    branchedToday: cards.reduce((n, { card }) => n + logsToday(card, /[Bb]ranche/), 0),
    datedToday: cards.reduce((n, { card }) => n + logsToday(card, /Échéance/i), 0),

    goals: goals.length,
    goalsCreatedToday: goals.filter((g) => isToday(g.createdAt)).length,
    milestonesToday: goals.reduce((n, g) => n + (g.subtasks || []).filter((s) => s.done && isToday(s.doneAt)).length, 0),

    habits: habits.length,
    habitsToday: habits.filter((h) => (h.days || h.log || {})[day]).length,
    habitsCreatedToday: habits.filter((h) => isToday(h.createdAt)).length,

    skills: skills.length,
    skillsPracticedToday: skills.filter((s) => isToday(s.lastAt)).length,
    skillsCreatedToday: skills.filter((s) => isToday(s.createdAt)).length,

    mood: mood ? mood.mood : null,
    moodNote: mood && mood.note ? 1 : 0,

    medToday: med.lastSessionAt && isToday(med.lastSessionAt) ? 1 : 0,
    medMinutes: (med.history || []).filter((h) => isToday(h.completedAt)).reduce((n, h) => n + (h.duration || 0), 0),
    medStreak: med.streak || 0,

    friseFilledToday: fnodes.filter((n) => n.custom && isToday(n.createdAt)).length,
    friseDatedToday: fnodes.filter((n) => n.date && isToday(n.createdAt)).length,
    friseLinkedToday: (frise.links || []).length && u.friseLinkedAt && isToday(u.friseLinkedAt) ? 1 : 0,

    xpToday: (u.quests && u.quests.day === day && u.quests.xpToday) || 0,
    emptyBranches,
    emptyBranchFedToday: 0,   // renseigne par l'attribution d'XP, cf. quests-bar
    chatToday: (u.quests && u.quests.day === day && u.quests.chat) || 0,
    chatAboutCardToday: (u.quests && u.quests.day === day && u.quests.chatCard) || 0,
    visited: visited || {},
  };
}

export function progressOf(q, state) {
  const n = Math.max(0, Number(q.need(state)) || 0);
  const goal = q.goal || 1;
  return { n: Math.min(n, goal), goal, done: n >= goal, pct: Math.min(100, Math.round((n / goal) * 100)) };
}

// ── Persistance ─────────────────────────────────────────────────────────────
// Un seul champ : users/{uid}.quests. Il ne stocke QUE ce qui ne se deduit pas
// de l'etat des modules - le jour en cours, ce qui a deja ete encaisse, la
// serie, et les quelques compteurs qu'aucun module ne tient (visites, chat).
export function normalizeQuests(raw, day) {
  const q = raw && typeof raw === 'object' ? raw : {};
  const fresh = q.day !== day;
  return {
    day,
    claimed: fresh ? [] : (Array.isArray(q.claimed) ? q.claimed.slice(0, 12) : []),
    bonusClaimed: fresh ? false : !!q.bonusClaimed,
    xpToday: fresh ? 0 : (Number.isFinite(q.xpToday) ? q.xpToday : 0),
    chat: fresh ? 0 : (Number.isFinite(q.chat) ? q.chat : 0),
    chatCard: fresh ? 0 : (Number.isFinite(q.chatCard) ? q.chatCard : 0),
    visited: fresh ? {} : (q.visited && typeof q.visited === 'object' ? q.visited : {}),
    // La serie survit au changement de jour : c'est tout son interet.
    streak: Number.isFinite(q.streak) ? q.streak : 0,
    lastFullDay: typeof q.lastFullDay === 'string' ? q.lastFullDay : null,
  };
}

export async function loadUserDoc(db, uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : {};
  } catch (_) { return {}; }
}

export async function loadMood(db, uid, day) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'moods', day));
    return snap.exists() ? snap.data() : null;
  } catch (_) { return null; }
}

const timers = new WeakMap();
export function saveQuests(db, uid, q, { delay = 300, onError = null } = {}) {
  clearTimeout(timers.get(q));
  timers.set(q, setTimeout(async () => {
    try { await setDoc(doc(db, 'users', uid), { quests: q }, { merge: true }); }
    catch (e) { if (onError) onError(e); }
  }, delay));
}

// La serie : une journee complete de plus, a condition que ce soit un jour
// nouveau. Deux passages le meme jour ne la font pas monter deux fois.
export function bumpStreak(q, day) {
  if (q.lastFullDay === day) return q.streak;
  const y = new Date(day + 'T12:00:00');
  y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y);
  q.streak = q.lastFullDay === yesterday ? (q.streak || 0) + 1 : 1;
  q.lastFullDay = day;
  return q.streak;
}
