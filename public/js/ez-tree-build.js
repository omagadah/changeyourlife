// /js/ez-tree-build.js - Génère un bel arbre ez-tree DANS le navigateur.
// Avantage vs GLB pré-généré : les textures (écorce + feuilles) sont décodées
// nativement par le navigateur -> vraies feuilles, vrai bois (pas de blocs gris).
// Paramètres maximisés pour un arbre centenaire : grand, tronc épais, beaucoup
// de branches et de sous-branches.

import { Tree, TreePreset } from '/vendor/ez-tree/ez-tree.es.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

// Surcharge "majestueux" appliquée par-dessus un preset de base (Chêne).
// On pousse : niveaux de branches au max (3 + sous-branches), plus d'enfants,
// tronc plus épais, arbre plus haut. Feuillage dense mais pas excessif.
function majestic(base) {
  const o = clone(base);
  o.seed = 28207;
  o.branch.levels = 3;
  o.branch.children = { 0: 13, 1: 6, 2: 4 };
  o.branch.length = { 0: 56, 1: 34, 2: 19, 3: 9 };
  o.branch.radius = { 0: 4.1, 1: 0.8, 2: 0.66, 3: 0.9 };   // tronc un peu plus épais
  o.branch.angle = { 1: 34, 2: 44, 3: 38 };                 // branches + verticales -> co-leaders (apex qui fourche)
  o.branch.start = { 1: 0.30, 2: 0.32, 3: 0 };
  o.branch.gnarliness = { 0: 0.03, 1: 0.16, 2: 0.12, 3: 0.06 };
  o.branch.force = { direction: { x: 0, y: 1, z: 0 }, strength: 0.035 };
  o.branch.sections = { 0: 16, 1: 10, 2: 8, 3: 5 };
  o.branch.segments = { 0: 12, 1: 8, 2: 6, 3: 4 };
  if (o.leaves) {
    o.leaves.count = 16;     // feuilles par rameau (dense mais lisible)
    o.leaves.size = 3.4;
    o.leaves.alphaTest = 0.5;
  }
  return o;
}

export const PRESETS = {
  majestic: () => majestic(TreePreset['Oak Large']),
  oak: () => clone(TreePreset['Oak Large']),
  ash: () => clone(TreePreset['Ash Large']),
  aspen: () => clone(TreePreset['Aspen Large']),
  pine: () => clone(TreePreset['Pine Large']),
};

// Construit l'arbre et renvoie le THREE.Group (Tree etend THREE.Group).
// `which` : clé de PRESETS ou objet d'options complet. `seed` : graine optionnelle.
export function buildEzTree(which = 'majestic', seed) {
  const opts = typeof which === 'string' ? (PRESETS[which] || PRESETS.majestic)() : which;
  if (typeof seed === 'number') opts.seed = seed;
  const tree = new Tree();
  tree.loadFromJson(opts);   // applique les options (loadPreset attend un NOM, pas un objet) + génère
  tree.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.side = 2; }
  });
  return tree;
}
