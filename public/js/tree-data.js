// /js/tree-data.js — Le socle : modèle de données de l'arbre de vie.
//
// Schéma Firestore `users/{uid}.tree` + migration depuis le legacy `levels`
// + dérivations (dev, vitalité, stade) + modèle visuel pour buildTree().
//
// PUR : aucune dépendance Firestore/THREE. Importe seulement les métadonnées
// des 7 branches. Réutilisable client ET miroir de la Cloud Function `addXp`.
//
// ── Schéma `users/{uid}.tree` ───────────────────────────────────────────────
//   {
//     v: 1,                       // version du schéma
//     createdAt: <ms epoch>,
//     branches: {
//       corps:     { xp: <number cumulé>, lastActionAt: <ms epoch> },
//       finances:  { ... }, relations, mental, creation, sens, heritage
//     }
//   }
// On ne stocke QUE l'xp cumulé + la date de dernière action. Tout le reste
// (niveau, développement, vitalité, stade, état) est DÉRIVÉ → pas de donnée
// redondante, pas de désynchronisation possible.

import { DIMENSIONS } from '/js/tree-model.js';

export const TREE_SCHEMA_VERSION = 1;
export const BRANCH_KEYS = DIMENSIONS.map((d) => d.key);

// Modèle 4-axes legacy → 8 branches Maslow (au mieux — données pré-refonte)
export const LEGACY_DOMAIN_MAP = {
  body: 'physio', heart: 'appartenance', etre: 'cognitif', mind: 'cognitif', order: 'securite',
};

const XP_CAP = 10000;          // garde-fou par appel
const VITALITY_DAYS = 21;      // une branche négligée se fane en ~3 semaines
const DEV_SCALE = 3500;        // constante de saturation du développement

// ── Création / migration ────────────────────────────────────────────────────
export function createTree(now = Date.now()) {
  const branches = {};
  for (const k of BRANCH_KEYS) branches[k] = { xp: 0, lastActionAt: 0 };
  return { v: TREE_SCHEMA_VERSION, createdAt: now, branches };
}

// xp cumulé reconstitué depuis un ancien { level, xp } (seuil k = 100 + k*20)
function legacyTotalXp(lvl) {
  if (!lvl) return 0;
  let total = Math.max(0, lvl.xp || 0);
  for (let k = 0; k < Math.max(0, lvl.level || 0); k++) total += 100 + k * 20;
  return total;
}

export function migrateFromLevels(levels, now = Date.now()) {
  const tree = createTree(now);
  if (levels && typeof levels === 'object') {
    for (const [oldKey, branchKey] of Object.entries(LEGACY_DOMAIN_MAP)) {
      const xp = legacyTotalXp(levels[oldKey]);
      if (xp > 0) {
        tree.branches[branchKey].xp += xp;
        tree.branches[branchKey].lastActionAt = now;
      }
    }
  }
  return tree;
}

// Normalise un doc `tree` potentiellement partiel.
export function normalizeTree(raw, now = Date.now()) {
  if (!raw || !raw.branches) return createTree(now);
  const tree = createTree(now);
  tree.createdAt = raw.createdAt || now;
  for (const k of BRANCH_KEYS) {
    const b = raw.branches[k];
    if (b) tree.branches[k] = { xp: Math.max(0, b.xp || 0), lastActionAt: b.lastActionAt || 0 };
  }
  return tree;
}

// Construit le tree depuis le document utilisateur Firestore (tree, sinon
// migration de levels, sinon arbre neuf).
export function treeFromUserDoc(userDoc, now = Date.now()) {
  const d = userDoc || {};
  if (d.tree && d.tree.branches) return normalizeTree(d.tree, now);
  if (d.levels) return migrateFromLevels(d.levels, now);
  return createTree(now);
}

// ── Dérivations ─────────────────────────────────────────────────────────────
// niveau d'une branche depuis son xp cumulé
export function levelFromXp(xp) {
  let level = 0, need = 100, acc = 0;
  while (acc + need <= xp) { acc += need; level += 1; need = 100 + level * 20; }
  return level;
}

// développement 0-100, saturant (un arbre centenaire frôle 100 sans l'atteindre)
export function devFromXp(xp) {
  return Math.round(100 * (1 - Math.exp(-Math.max(0, xp) / DEV_SCALE)));
}

// vitalité 0-100 : 100 juste après une action, décroît vers 0 en ~21 jours
export function vitalityOf(branch, now = Date.now()) {
  if (!branch || !branch.lastActionAt) return 0;
  const days = (now - branch.lastActionAt) / 86400000;
  return Math.max(0, Math.min(100, Math.round(100 - (days / VITALITY_DAYS) * 100)));
}

// stade de l'arbre depuis l'xp total cumulé
export function stageOf(tree) {
  const total = BRANCH_KEYS.reduce((s, k) => s + (tree.branches[k]?.xp || 0), 0);
  if (total < 600) return 'sapling';
  if (total < 4000) return 'jeune';
  if (total < 16000) return 'mature';
  return 'centenaire';
}

// ── Application d'XP (pure — miroir exact de la Cloud Function addXp) ────────
export function applyXp(tree, branchKey, amount, now = Date.now()) {
  const key = BRANCH_KEYS.includes(branchKey) ? branchKey : LEGACY_DOMAIN_MAP[branchKey];
  if (!key) return normalizeTree(tree, now);
  const inc = Math.max(0, Math.min(XP_CAP, Number(amount) || 0));
  const next = normalizeTree(tree, now);
  next.branches[key].xp += inc;
  next.branches[key].lastActionAt = now;
  return next;
}

// ── Modèle visuel pour buildTree() (cf. tree-model.js) ──────────────────────
export function toVisualModel(tree, now = Date.now()) {
  const t = normalizeTree(tree, now);
  return {
    stage: stageOf(t),
    branches: DIMENSIONS.map((d) => {
      const b = t.branches[d.key];
      const dev = devFromXp(b.xp);
      return {
        ...d,
        xp: b.xp,
        level: levelFromXp(b.xp),
        dev,
        vitality: vitalityOf(b, now),
        state: dev < 6 ? 'dormant' : 'active',
      };
    }),
  };
}
