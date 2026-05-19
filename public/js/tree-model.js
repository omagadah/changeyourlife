// /js/tree-model.js — Arbre de vie procédural CYL.
// Modèle de données + génération de géométrie. AUCUN import : reçoit THREE
// en paramètre → réutilisable (landing /arbre/ ET intérieur du site post-login).
//
// Principe (cf. docs/ARCHITECTURE.md) : l'arbre EST un graphe.
//   - 7 branches maîtresses = 7 dimensions, organisées en 4 tiers
//     (Maslow + Erikson) : le tier pilote la hauteur d'accroche sur le tronc.
//   - chaque branche a des sous-branches SÉMANTIQUES (Relations → Famille,
//     Amis, Amour…). Le nombre de sous-branches « écloses » dépend de dev.
//   - dev (cumulatif → longueur/épaisseur) · vitality (→ feuilles/couleur)
//     · state ('active' | 'dormant' | 'broken').
// Corps organique (tubes) ET exosquelette ESP (lignes + nœuds) dérivent du
// MÊME graphe → alignement parfait par construction.

// ── Les 7 dimensions, en 4 tiers ────────────────────────────────────────────
// tier 1 = fondations (bas du tronc, épais) … tier 4 = transcendance (cime).
export const DIMENSIONS = [
  { key: 'corps',     label: 'Corps',     color: 0x2dd4bf, tier: 1, azimuth: 205, attach: 0.28, elev: 44,
    sub: ['Sommeil', 'Nutrition', 'Mouvement', 'Santé', 'Énergie'] },
  { key: 'finances',  label: 'Finances',  color: 0xfbbf24, tier: 1, azimuth:  30, attach: 0.40, elev: 46,
    sub: ['Revenus', 'Épargne', 'Sécurité', 'Investir'] },
  { key: 'relations', label: 'Relations', color: 0xf87171, tier: 2, azimuth: 300, attach: 0.55, elev: 39,
    sub: ['Famille', 'Amis', 'Amour', 'Travail', 'Communauté'] },
  { key: 'mental',    label: 'Mental',    color: 0xa78bfa, tier: 2, azimuth: 110, attach: 0.65, elev: 41,
    sub: ['Émotions', 'Stress', 'Clarté', 'Estime'] },
  { key: 'creation',  label: 'Création',  color: 0xfb923c, tier: 3, azimuth: 235, attach: 0.77, elev: 34,
    sub: ['Projets', 'Apprentissage', 'Compétences', 'Expression'] },
  { key: 'sens',      label: 'Sens',      color: 0x38bdf8, tier: 3, azimuth: 140, attach: 0.88, elev: 32,
    sub: ['Valeurs', 'Spiritualité', 'Contribution', 'Raison d’être'] },
  { key: 'heritage',  label: 'Héritage',  color: 0x94a3b8, tier: 4, azimuth:   0, attach: 1.00, elev: 80,
    sub: ['Transmission', 'Trace', 'Mémoire'] },
];

// ── Modèle de démo : un jeune arbre ─────────────────────────────────────────
export function createDemoModel() {
  const dev = { corps: 42, finances: 8, relations: 10, mental: 46, creation: 34, sens: 28, heritage: 5 };
  const vit = { corps: 66, finances: 14, relations: 20, mental: 70, creation: 56, sens: 50, heritage: 10 };
  return {
    stage: 'sapling',
    branches: DIMENSIONS.map((d) => ({
      ...d,
      dev: dev[d.key],
      vitality: vit[d.key],
      state: dev[d.key] < 12 ? 'dormant' : 'active',
    })),
  };
}

// ── RNG déterministe (mulberry32) ───────────────────────────────────────────
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const deg = (d) => (d * Math.PI) / 180;

// ── Tube fuselé le long d'une courbe ────────────────────────────────────────
function taperedTube(THREE, curve, r0, r1, tubular, radial) {
  const frames = curve.computeFrenetFrames(tubular, false);
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const c = curve.getPoint(t);
    const N = frames.normals[i], B = frames.binormals[i];
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cx = Math.cos(a), cy = Math.sin(a);
      const vx = N.x * cx + B.x * cy, vy = N.y * cx + B.y * cy, vz = N.z * cx + B.z * cy;
      pos.push(c.x + vx * r, c.y + vy * r, c.z + vz * r);
      nor.push(vx, vy, vz);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// ── Courbe d'une branche (origine, direction, longueur) ─────────────────────
function branchCurve(THREE, origin, dir, length, rnd) {
  const up = new THREE.Vector3(0, 1, 0);
  const pts = [origin.clone()];
  let p = origin.clone();
  let cur = dir.clone().normalize();
  const steps = 4;
  for (let i = 1; i <= steps; i++) {
    cur.lerp(up, 0.12).normalize();
    const jit = (rnd() - 0.5) * length * 0.1;
    p = p.clone()
      .add(cur.clone().multiplyScalar(length / steps))
      .add(new THREE.Vector3(jit, 0, jit));
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

/**
 * Construit l'objet 3D de l'arbre depuis un modèle.
 * @returns {{ group, nodes }} group = THREE.Group ; nodes = 7 sphères cliquables.
 */
export function buildTree(THREE, model) {
  const group = new THREE.Group();
  const rnd = rng(0x4c594c);

  const barkActive = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.9 });
  const barkDormant = new THREE.MeshStandardMaterial({ color: 0x3d4657, roughness: 1 });
  const barkBroken = new THREE.MeshStandardMaterial({ color: 0x7a2e2e, roughness: 0.9 });
  const barkOf = (st) => (st === 'broken' ? barkBroken : st === 'dormant' ? barkDormant : barkActive);

  const espSegs = [];
  const espAdd = (a, b) => espSegs.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const leafMat = [], leafCol = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(),
        _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

  function scatterLeaves(center, count, color, spread) {
    for (let i = 0; i < count; i++) {
      _p.set(center.x + (rnd() - 0.5) * spread,
             center.y + (rnd() - 0.5) * spread,
             center.z + (rnd() - 0.5) * spread);
      _q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
      const sc = 0.7 + rnd() * 0.7;
      _s.set(sc, sc * 0.55, sc);
      _m.compose(_p, _q, _s);
      leafMat.push(_m.clone());
      _c.setHex(color);
      leafCol.push(_c.r, _c.g, _c.b);
    }
  }

  // petite sphère ESP (nœud)
  const ballGeo = new THREE.SphereGeometry(1, 16, 12);
  function espNode(pos, color, radius, opacity, order) {
    const core = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({
      color, depthTest: false, transparent: true, opacity }));
    core.scale.setScalar(radius);
    core.position.copy(pos);
    core.renderOrder = order;
    const halo = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: opacity * 0.3,
      blending: THREE.AdditiveBlending, depthTest: false }));
    halo.scale.setScalar(radius * 2.7);
    halo.position.copy(pos);
    halo.renderOrder = order - 1;
    group.add(halo, core);
    return core;
  }

  // ── Tronc ─────────────────────────────────────────────────────────────────
  const trunkH = model.stage === 'sapling' ? 26 : 38;
  const trunkCurve = branchCurve(
    THREE, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.04, 1, 0.02), trunkH, rnd);
  group.add(new THREE.Mesh(taperedTube(THREE, trunkCurve, 2.6, 0.9, 26, 10), barkActive));
  for (let i = 0; i < 8; i++) espAdd(trunkCurve.getPoint(i / 8), trunkCurve.getPoint((i + 1) / 8));
  espNode(trunkCurve.getPoint(0).setY(0.5), 0x9ecaff, 1.3, 1, 12);

  // ── Une branche maîtresse + ses sous-branches sémantiques ────────────────
  const nodes = [];
  for (const b of model.branches) {
    const origin = trunkCurve.getPoint(b.attach);
    const dir = new THREE.Vector3(
      Math.cos(deg(b.elev)) * Math.cos(deg(b.azimuth)),
      Math.sin(deg(b.elev)),
      Math.cos(deg(b.elev)) * Math.sin(deg(b.azimuth))
    );
    // tier 1 = fondations → branches plus épaisses
    const tierThick = b.tier === 1 ? 1.35 : b.tier === 2 ? 1.1 : 0.9;
    const len = 6 + (b.dev / 100) * 22;
    const r0 = (0.5 + (b.dev / 100) * 1.0) * tierThick;
    const r1 = r0 * 0.32;

    const curve = branchCurve(THREE, origin, dir, len, rnd);
    group.add(new THREE.Mesh(taperedTube(THREE, curve, r0, r1, 18, 8), barkOf(b.state)));
    for (let i = 0; i < 6; i++) espAdd(curve.getPoint(i / 6), curve.getPoint((i + 1) / 6));
    const tip = curve.getPoint(1);

    // sous-branches sémantiques : combien ont « éclos » dépend de dev
    const grown = b.state === 'active'
      ? Math.min(b.sub.length, 1 + Math.round((b.dev / 100) * b.sub.length))
      : 0;
    for (let k = 0; k < grown; k++) {
      const at = 0.45 + (k / Math.max(1, grown)) * 0.45;
      const sOrigin = curve.getPoint(at);
      const sDir = curve.getTangent(at);
      const ang = ((k / grown) - 0.5) * 2.4; // éventail latéral
      const side = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)).normalize();
      sDir.lerp(side, 0.45).add(new THREE.Vector3(0, 0.45, 0)).normalize();
      const sLen = len * (0.4 + rnd() * 0.22);
      const sCurve = branchCurve(THREE, sOrigin, sDir, sLen, rnd);
      group.add(new THREE.Mesh(taperedTube(THREE, sCurve, r1 * 1.1, r1 * 0.4, 12, 6), barkOf(b.state)));
      for (let i = 0; i < 4; i++) espAdd(sCurve.getPoint(i / 4), sCurve.getPoint((i + 1) / 4));
      const sTip = sCurve.getPoint(1);
      espNode(sTip, b.color, 0.65, 0.85, 10);
      if (b.vitality > 8) scatterLeaves(sTip, Math.round((b.vitality / 100) * 6), b.color, 3);
    }

    // feuilles au bout de la branche maîtresse
    if (b.state === 'active' && b.vitality > 8) {
      scatterLeaves(tip, Math.round((b.vitality / 100) * 11), b.color, 4.5);
    }

    // nœud-dimension (cliquable, labellé)
    const dim = b.state === 'dormant' ? 0.35 : 1;
    const baseR = b.state === 'dormant' ? 0.95 : 1.7;
    const core = espNode(tip, b.color, baseR, 0.4 + dim * 0.6, 13);
    core.userData = { key: b.key, label: b.label, color: b.color, baseR, state: b.state, tier: b.tier };
    nodes.push(core);
  }

  // ── Exosquelette ESP : lignes blanches X-ray ─────────────────────────────
  const espGeo = new THREE.BufferGeometry();
  espGeo.setAttribute('position', new THREE.Float32BufferAttribute(espSegs, 3));
  const espLines = new THREE.LineSegments(espGeo, new THREE.LineBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.5, depthTest: false }));
  espLines.renderOrder = 9;
  group.add(espLines);

  // ── Feuilles en InstancedMesh ────────────────────────────────────────────
  if (leafMat.length) {
    const leafMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.9, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }),
      leafMat.length);
    for (let i = 0; i < leafMat.length; i++) {
      leafMesh.setMatrixAt(i, leafMat[i]);
      leafMesh.setColorAt(i, _c.setRGB(leafCol[i * 3], leafCol[i * 3 + 1], leafCol[i * 3 + 2]));
    }
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    group.add(leafMesh);
  }

  return { group, nodes };
}
