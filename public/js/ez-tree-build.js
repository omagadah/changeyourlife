// /js/ez-tree-build.js - Génère l'arbre ez-tree DANS le navigateur (vraies
// textures écorce/feuilles) et le fait GRANDIR avec l'XP de l'utilisateur.
// 2 catégories au choix : Chêne (chene) et Frêne (frene).

import { Tree, TreePreset } from '/vendor/ez-tree/ez-tree.es.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Surcharge "majestueux" (arbre centenaire) appliquée à un preset de base.
function majestic(base) {
  const o = clone(base);
  o.seed = 28207;
  o.branch.levels = 3;
  o.branch.children = { 0: 13, 1: 6, 2: 4 };
  o.branch.length = { 0: 56, 1: 34, 2: 19, 3: 9 };
  o.branch.radius = { 0: 4.1, 1: 0.8, 2: 0.66, 3: 0.9 };   // tronc épais
  o.branch.angle = { 1: 34, 2: 44, 3: 38 };                 // branches verticales -> apex qui fourche
  o.branch.start = { 1: 0.30, 2: 0.32, 3: 0 };
  o.branch.gnarliness = { 0: 0.03, 1: 0.16, 2: 0.12, 3: 0.06 };
  o.branch.force = { direction: { x: 0, y: 1, z: 0 }, strength: 0.035 };
  o.branch.sections = { 0: 16, 1: 10, 2: 8, 3: 5 };
  o.branch.segments = { 0: 12, 1: 8, 2: 6, 3: 4 };
  if (o.leaves) { o.leaves.count = 16; o.leaves.size = 3.4; o.leaves.alphaTest = 0.5; }
  return o;
}

// Les 2 catégories proposées à l'utilisateur.
export const TREE_TYPES = {
  chene: () => majestic(TreePreset['Oak Large']),
  frene: () => majestic(TreePreset['Ash Large']),
};

// Préférence utilisateur (Chêne par défaut).
export function getTreeType() {
  try { const t = localStorage.getItem('cyl_treeType'); if (t === 'chene' || t === 'frene') return t; } catch (_) {}
  return 'chene';
}
export function setTreeType(t) { try { localStorage.setItem('cyl_treeType', t); } catch (_) {} }

// Applique un niveau de CROISSANCE g (0 = jeune pousse, 1 = arbre majestueux)
// aux options : moins de niveaux de branches, branches plus courtes/fines et
// moins de feuilles quand l'arbre est jeune. La taille absolue diminue aussi.
export function applyGrowth(base, g) {
  g = clamp01(g);
  const o = clone(base);
  const lerp = (a, b) => a + (b - a) * g;
  o.branch.levels = g < 0.18 ? 1 : g < 0.55 ? 2 : 3;     // étapes : pousse -> jeune -> mature
  for (const k in o.branch.length) o.branch.length[k] *= lerp(0.40, 1);
  for (const k in o.branch.radius) o.branch.radius[k] *= lerp(0.55, 1);
  o.branch.children = { ...o.branch.children };
  o.branch.children[0] = Math.max(2, Math.round((o.branch.children[0] || 8) * lerp(0.45, 1)));
  if (o.leaves) o.leaves.count = Math.max(2, Math.round(o.leaves.count * lerp(0.2, 1)));
  return o;
}

// Construit l'arbre (THREE.Group). type: 'chene'|'frene' (ou objet d'options).
// opts: { growth (0..1, defaut 1), seed }.
export function buildEzTree(type = 'chene', opts = {}) {
  const growth = (typeof opts.growth === 'number') ? opts.growth : 1;
  let o = typeof type === 'string' ? (TREE_TYPES[type] || TREE_TYPES.chene)() : type;
  if (growth < 0.999) o = applyGrowth(o, growth);
  if (typeof opts.seed === 'number') o.seed = opts.seed;
  const tree = new Tree();
  tree.loadFromJson(o);   // applique les options + génère (loadPreset attend un NOM, pas un objet)
  tree.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; if (n.material) n.material.side = 2; } });
  return tree;
}

// Ajoute un SQUELETTE ESP (effet rayon-X / exosquelette) qui ÉPOUSE exactement
// l'arbre : on superpose un wireframe blanc sur la géométrie réelle du tronc et
// des branches (on saute les feuilles). depthTest:false -> visible à travers le
// feuillage. À appeler sur n'importe quel arbre ez-tree (accueil, /app, login).
export function addEspSkeleton(THREE, root, opts = {}) {
  if (!root) return root;
  const color = (opts.color != null) ? opts.color : 0xffffff;
  const opacity = (opts.opacity != null) ? opts.opacity : 0.28;
  const clippingPlanes = opts.clippingPlanes || null;
  const targets = [];
  root.traverse((n) => {
    if (!n.isMesh || !n.geometry || n.name === 'esp-skeleton') return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    // feuilles = matériau transparent / alphaTest -> on ne garde que tronc + branches
    const isLeaf = m && (m.transparent === true || (m.alphaTest && m.alphaTest > 0) || /leaf|leaves|feuille/i.test(n.name || ''));
    if (isLeaf) return;
    targets.push(n);
  });
  targets.forEach((n) => {
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });
    if (clippingPlanes) { mat.clippingPlanes = clippingPlanes; mat.clipShadows = true; }
    const wf = new THREE.LineSegments(new THREE.WireframeGeometry(n.geometry), mat);
    wf.name = 'esp-skeleton'; wf.renderOrder = 9; wf.frustumCulled = false;
    n.add(wf);   // enfant du mesh -> hérite du transform exact de la branche
  });
  return root;
}
