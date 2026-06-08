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
  const opacity = (opts.opacity != null) ? opts.opacity : 0.3;
  const clippingPlanes = opts.clippingPlanes || null;
  // azimuths (degrés) : si fourni, on NE GARDE le wireframe que sur le tronc + les
  // secteurs angulaires des catégories. [] = tronc seul. null = arbre entier.
  const azimuths = opts.azimuths || null;
  const sector = (opts.sector != null) ? opts.sector : 18;   // demi-largeur d'un secteur (deg)

  const targets = [];
  root.traverse((n) => {
    if (!n.isMesh || !n.geometry || n.name === 'esp-skeleton') return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    const isLeaf = m && (m.transparent === true || (m.alphaTest && m.alphaTest > 0) || /leaf|leaves|feuille/i.test(n.name || ''));
    if (isLeaf) return;   // on ne garde que tronc + branches (pas les feuilles)
    targets.push(n);
  });

  const angDist = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

  targets.forEach((n) => {
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });
    if (clippingPlanes) { mat.clippingPlanes = clippingPlanes; mat.clipShadows = true; }
    const full = new THREE.WireframeGeometry(n.geometry);   // arêtes dédupliquées
    let geo = full;
    if (azimuths) {
      n.geometry.computeBoundingBox();
      const bb = n.geometry.boundingBox;
      const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
      const rTrunk = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.07;   // colonne du tronc
      const pos = full.attributes.position;
      const arr = [];
      for (let e = 0; e + 1 < pos.count; e += 2) {
        const mx = (pos.getX(e) + pos.getX(e + 1)) / 2 - cx;
        const mz = (pos.getZ(e) + pos.getZ(e + 1)) / 2 - cz;
        let keep = Math.hypot(mx, mz) < rTrunk;   // tronc
        if (!keep) {
          const az = Math.atan2(mz, mx) * 180 / Math.PI;
          for (let k = 0; k < azimuths.length; k++) { if (angDist(az, azimuths[k]) < sector) { keep = true; break; } }
        }
        if (keep) arr.push(pos.getX(e), pos.getY(e), pos.getZ(e), pos.getX(e + 1), pos.getY(e + 1), pos.getZ(e + 1));
      }
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      full.dispose();
    }
    const wf = new THREE.LineSegments(geo, mat);
    wf.name = 'esp-skeleton'; wf.renderOrder = 9; wf.frustumCulled = false;
    n.add(wf);   // enfant du mesh -> transform exact (parfaitement aligné sur l'arbre)
  });
  return root;
}

// Squelette ESP par CORRIDORS : on ne garde le wireframe (aligné) que près du
// TRONC (axe vertical) + le long des trajets vers chaque nœud-catégorie (tipsWorld,
// positions MONDE). Tout le reste de l'arbre reste visible (sans squelette).
// À appeler quand l'arbre est à sa taille finale (positions des nœuds correctes).
export function addEspSkeletonCorridors(THREE, treeObj, tipsWorld, opts = {}) {
  if (!treeObj) return treeObj;
  const opacity = (opts.opacity != null) ? opts.opacity : 0.34;
  treeObj.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(treeObj);
  const H = (box.max.y - box.min.y) || 1, baseY = box.min.y;
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const rTrunk = (opts.trunkRadius != null) ? opts.trunkRadius : H * 0.04;
  const D = (opts.corridor != null) ? opts.corridor : H * 0.06;
  const mat = new THREE.LineBasicMaterial({ color: opts.color != null ? opts.color : 0xffffff, transparent: true, opacity, depthTest: false });
  if (opts.clippingPlanes) { mat.clippingPlanes = opts.clippingPlanes; mat.clipShadows = true; }

  // segments tronc->nœud (corridors)
  const segs = (tipsWorld || []).map((t) => {
    const b = (t.isVector3) ? t : new THREE.Vector3(t.x, t.y, t.z);
    return { a: new THREE.Vector3(cx, baseY + (b.y - baseY) * 0.30, cz), b };
  });
  const A = new THREE.Vector3(), B = new THREE.Vector3(), M = new THREE.Vector3();
  const AB = new THREE.Vector3(), AP = new THREE.Vector3(), CP = new THREE.Vector3();
  function d2seg(p, a, b) {
    AB.subVectors(b, a); const denom = AB.lengthSq() || 1;
    const t = Math.max(0, Math.min(1, AP.subVectors(p, a).dot(AB) / denom));
    CP.copy(a).addScaledVector(AB, t); return p.distanceTo(CP);
  }
  const meshes = [];
  treeObj.traverse((n) => {
    if (!n.isMesh || !n.geometry || n.name === 'esp-skeleton') return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    const leaf = m && (m.transparent === true || (m.alphaTest && m.alphaTest > 0));
    if (!leaf) meshes.push(n);
  });
  meshes.forEach((n) => {
    n.updateWorldMatrix(true, false);
    const wf = new THREE.WireframeGeometry(n.geometry);
    const pos = wf.attributes.position; const arr = [];
    for (let e = 0; e + 1 < pos.count; e += 2) {
      A.set(pos.getX(e), pos.getY(e), pos.getZ(e)).applyMatrix4(n.matrixWorld);
      B.set(pos.getX(e + 1), pos.getY(e + 1), pos.getZ(e + 1)).applyMatrix4(n.matrixWorld);
      M.addVectors(A, B).multiplyScalar(0.5);
      let keep = Math.hypot(M.x - cx, M.z - cz) < rTrunk;   // tronc (axe vertical)
      if (!keep) { for (let s = 0; s < segs.length; s++) { if (d2seg(M, segs[s].a, segs[s].b) < D) { keep = true; break; } } }
      if (keep) arr.push(pos.getX(e), pos.getY(e), pos.getZ(e), pos.getX(e + 1), pos.getY(e + 1), pos.getZ(e + 1));
    }
    wf.dispose();
    if (arr.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const ls = new THREE.LineSegments(g, mat); ls.name = 'esp-skeleton'; ls.renderOrder = 9; ls.frustumCulled = false;
      n.add(ls);
    }
  });
  return treeObj;
}
