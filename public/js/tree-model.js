// /js/tree-model.js — Arbre de vie procédural CYL.
// Modèle de données + génération de géométrie. AUCUN import : reçoit THREE
// en paramètre → réutilisable (landing /arbre/ ET intérieur du site post-login).
//
// Principe (cf. docs/ARCHITECTURE.md) : l'arbre EST un graphe.
//   - 7 branches maîtresses = les 7 dimensions de vie.
//   - chaque branche porte dev (développement, cumulatif → longueur/épaisseur)
//     et vitality (vitalité, décroît si négligé → feuilles/couleur).
//   - state : 'active' | 'dormant' | 'broken'.
// Le corps organique (tubes) ET l'exosquelette ESP (lignes + nœuds) sont
// dérivés du MÊME graphe → alignement parfait par construction.

// ── Les 7 dimensions + leur implantation sur le tronc ───────────────────────
export const DIMENSIONS = [
  { key: 'corps',     label: 'Corps',     color: 0x2dd4bf, azimuth: 200, attach: 0.42, elev: 40 },
  { key: 'mental',    label: 'Mental',    color: 0xa78bfa, azimuth:  40, attach: 0.52, elev: 44 },
  { key: 'relations', label: 'Relations', color: 0xf87171, azimuth: 320, attach: 0.60, elev: 37 },
  { key: 'finances',  label: 'Finances',  color: 0xfbbf24, azimuth:  95, attach: 0.69, elev: 41 },
  { key: 'sens',      label: 'Sens',      color: 0x38bdf8, azimuth: 250, attach: 0.79, elev: 33 },
  { key: 'creation',  label: 'Création',  color: 0xfb923c, azimuth: 150, attach: 0.88, elev: 34 },
  { key: 'heritage',  label: 'Héritage',  color: 0x94a3b8, azimuth:   0, attach: 1.00, elev: 78 },
];

// ── Modèle de démo : un jeune arbre (4 dimensions actives, 3 dormantes) ─────
export function createDemoModel() {
  const dev = { corps: 38, mental: 44, relations: 9, finances: 6, sens: 30, creation: 33, heritage: 4 };
  const vit = { corps: 64, mental: 72, relations: 22, finances: 14, sens: 52, creation: 56, heritage: 10 };
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

// ── Construit la courbe d'une branche (origine, direction, longueur) ────────
function branchCurve(THREE, origin, dir, length, rnd) {
  const d = dir.clone().normalize();
  // les branches se redressent vers le haut en grandissant (gravitropisme)
  const up = new THREE.Vector3(0, 1, 0);
  const pts = [origin.clone()];
  const steps = 4;
  let p = origin.clone();
  let cur = d.clone();
  for (let i = 1; i <= steps; i++) {
    cur.lerp(up, 0.12).normalize();                       // redressement
    const jit = (rnd() - 0.5) * length * 0.10;            // irrégularité
    const seg = cur.clone().multiplyScalar(length / steps);
    p = p.clone().add(seg).add(new THREE.Vector3(jit, 0, jit));
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

/**
 * Construit l'objet 3D de l'arbre depuis un modèle.
 * @returns {{ group, nodes }} group = THREE.Group ; nodes = sphères cliquables.
 */
export function buildTree(THREE, model) {
  const group = new THREE.Group();
  const rnd = rng(0x4c594c); // graine fixe → arbre stable

  // Matériaux
  const barkActive = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.9 });
  const barkDormant = new THREE.MeshStandardMaterial({ color: 0x3d4657, roughness: 1 });
  const barkBroken = new THREE.MeshStandardMaterial({ color: 0x7a2e2e, roughness: 0.9 });
  const barkOf = (st) => (st === 'broken' ? barkBroken : st === 'dormant' ? barkDormant : barkActive);

  // Collecteurs ESP + feuilles
  const espSegs = [];
  const espAdd = (a, b) => espSegs.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const leafMatrix = [];
  const leafColor = [];

  // ── Tronc ─────────────────────────────────────────────────────────────────
  const trunkH = 16 + (model.stage === 'sapling' ? 8 : 16);
  const trunkCurve = branchCurve(
    THREE, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.04, 1, 0.02), trunkH, rnd);
  group.add(new THREE.Mesh(taperedTube(THREE, trunkCurve, 2.4, 0.9, 24, 10), barkActive));
  for (let i = 0; i <= 8; i++) {
    espAdd(trunkCurve.getPoint(i / 8), trunkCurve.getPoint(Math.min(1, (i + 1) / 8)));
  }

  // ── Feuilles : petits amas près d'un point ───────────────────────────────
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(),
        _s = new THREE.Vector3(), _p = new THREE.Vector3(), _col = new THREE.Color();
  function scatterLeaves(center, count, color, spread) {
    for (let i = 0; i < count; i++) {
      _p.set(
        center.x + (rnd() - 0.5) * spread,
        center.y + (rnd() - 0.5) * spread,
        center.z + (rnd() - 0.5) * spread
      );
      _q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
      const sc = 0.7 + rnd() * 0.7;
      _s.set(sc, sc * 0.55, sc);
      _m.compose(_p, _q, _s);
      leafMatrix.push(_m.clone());
      _col.setHex(color);
      leafColor.push(_col.r, _col.g, _col.b);
    }
  }

  // ── Une branche (récursive : maîtresse → sous-branches) ──────────────────
  const nodes = [];
  function growBranch(origin, dir, length, r0, r1, depth, branch) {
    const curve = branchCurve(THREE, origin, dir, length, rnd);
    const tub = depth === 1 ? 18 : 12;
    group.add(new THREE.Mesh(
      taperedTube(THREE, curve, r0, r1, tub, depth === 1 ? 8 : 6), barkOf(branch.state)));

    // ESP : ligne le long de la branche
    for (let i = 0; i <= 6; i++) {
      espAdd(curve.getPoint(i / 6), curve.getPoint(Math.min(1, (i + 1) / 6)));
    }
    const tip = curve.getPoint(1);

    // feuilles au bout (si vivante)
    if (branch.state === 'active' && branch.vitality > 8) {
      const n = Math.round((branch.vitality / 100) * (depth === 1 ? 13 : 6));
      scatterLeaves(tip, n, branch.color, depth === 1 ? 5 : 3);
    }

    // sous-branches (depth 1 actives uniquement)
    if (depth === 1 && branch.state === 'active' && branch.dev > 18) {
      const subCount = branch.dev > 55 ? 3 : 2;
      for (let k = 0; k < subCount; k++) {
        const at = 0.5 + k * 0.18;
        const sOrigin = curve.getPoint(at);
        const sDir = curve.getTangent(at);
        // dévie latéralement + vers le haut
        const side = new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize();
        sDir.lerp(side, 0.4).add(new THREE.Vector3(0, 0.4, 0)).normalize();
        const sLen = length * (0.42 + rnd() * 0.2);
        growBranch(sOrigin, sDir, sLen, r1 * 1.1, r1 * 0.4, 2, branch);
      }
    }
    return tip;
  }

  // ── Les 7 branches maîtresses ────────────────────────────────────────────
  for (const b of model.branches) {
    const origin = trunkCurve.getPoint(b.attach);
    const dir = new THREE.Vector3(
      Math.cos(deg(b.elev)) * Math.cos(deg(b.azimuth)),
      Math.sin(deg(b.elev)),
      Math.cos(deg(b.elev)) * Math.sin(deg(b.azimuth))
    );
    const len = 6 + (b.dev / 100) * 22;
    const r0 = 0.5 + (b.dev / 100) * 1.0;
    const tip = growBranch(origin, dir, len, r0, r0 * 0.32, 1, b);

    // nœud-dimension ESP au bout de la branche
    const dim = b.state === 'dormant' ? 0.35 : 1;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1, 18, 14),
      new THREE.MeshBasicMaterial({ color: b.color, depthTest: false,
        transparent: true, opacity: 0.4 + dim * 0.6 })
    );
    const baseR = b.state === 'dormant' ? 0.9 : 1.7;
    core.scale.setScalar(baseR);
    core.position.copy(tip);
    core.renderOrder = 12;
    core.userData = { key: b.key, label: b.label, color: b.color, baseR, state: b.state };
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: b.color, transparent: true,
        opacity: 0.22 * dim, blending: THREE.AdditiveBlending, depthTest: false })
    );
    halo.scale.setScalar(baseR * 2.7);
    halo.position.copy(tip);
    halo.renderOrder = 11;
    group.add(core, halo);
    nodes.push(core);
  }

  // nœud-racine (base du tronc)
  const root = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x9ecaff, depthTest: false })
  );
  root.scale.setScalar(1.3);
  root.position.set(0, 0.5, 0);
  root.renderOrder = 12;
  group.add(root);

  // ── Exosquelette ESP : lignes blanches X-ray ─────────────────────────────
  const espGeo = new THREE.BufferGeometry();
  espGeo.setAttribute('position', new THREE.Float32BufferAttribute(espSegs, 3));
  const espLines = new THREE.LineSegments(
    espGeo,
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true,
      opacity: 0.5, depthTest: false })
  );
  espLines.renderOrder = 10;
  group.add(espLines);

  // ── Feuilles en InstancedMesh (1 draw call) ──────────────────────────────
  if (leafMatrix.length) {
    const leafGeo = new THREE.IcosahedronGeometry(0.9, 0);
    const leafMesh = new THREE.InstancedMesh(
      leafGeo,
      new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }),
      leafMatrix.length
    );
    for (let i = 0; i < leafMatrix.length; i++) {
      leafMesh.setMatrixAt(i, leafMatrix[i]);
      leafMesh.setColorAt(i, _col.setRGB(
        leafColor[i * 3], leafColor[i * 3 + 1], leafColor[i * 3 + 2]));
    }
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    group.add(leafMesh);
  }

  return { group, nodes };
}
