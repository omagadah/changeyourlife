// /js/tree-model.js — Arbre de vie procédural CYL.
// Modèle de données + génération de géométrie + animation de croissance.
// AUCUN import : reçoit THREE en paramètre → réutilisable (landing ET app).
//
// Principe (cf. docs/ARCHITECTURE.md) : l'arbre EST un graphe.
//   - 7 branches = 7 dimensions, en 4 tiers (Maslow + Erikson). Le tier
//     pilote la hauteur d'accroche : Corps (santé) est LA base, le plus bas.
//   - sous-branches SÉMANTIQUES nommées ; le nombre « éclos » dépend de dev.
//   - dev (cumulatif) · vitality (→ feuilles) · state ('active'|'dormant'|'broken').
//   - Hiérarchie de groupes (tronc → branches → sous-branches) → l'arbre peut
//     POUSSER : buildTree renvoie grow(age) qui anime sapling → centenaire.

// ── Les 8 branches = les 8 niveaux de la pyramide de Maslow (étendue) ───────
// De la base du tronc (besoins vitaux) à la cime (transcendance). C'est
// l'épine dorsale du modèle : l'arbre EST la pyramide de Maslow, verticale.
export const DIMENSIONS = [
  { key: 'physio',          label: 'Physiologique',  color: 0x2dd4bf, tier: 1, azimuth: 205, attach: 0.20, elev: 47,
    sub: ['Sommeil', 'Nutrition', 'Hydratation', 'Mouvement', 'Repos'] },
  { key: 'securite',        label: 'Sécurité',       color: 0xfbbf24, tier: 1, azimuth:  35, attach: 0.32, elev: 46,
    sub: ['Logement', 'Stabilité', 'Finances', 'Santé', 'Sérénité'] },
  { key: 'appartenance',    label: 'Appartenance',   color: 0xf87171, tier: 2, azimuth: 300, attach: 0.44, elev: 41,
    sub: ['Famille', 'Amis', 'Amour', 'Empathie', 'Communauté'] },
  { key: 'estime',          label: 'Estime',         color: 0xfb923c, tier: 2, azimuth: 110, attach: 0.56, elev: 40,
    sub: ['Confiance', 'Compétence', 'Réussite', 'Reconnaissance', 'Fierté'] },
  { key: 'cognitif',        label: 'Cognitif',       color: 0xa78bfa, tier: 3, azimuth: 250, attach: 0.67, elev: 36,
    sub: ['Savoir', 'Curiosité', 'Compréhension', 'Apprentissage', 'Lucidité'] },
  { key: 'esthetique',      label: 'Esthétique',     color: 0xe879c7, tier: 3, azimuth: 140, attach: 0.78, elev: 34,
    sub: ['Beauté', 'Harmonie', 'Ordre', 'Créativité', 'Émerveillement'] },
  { key: 'accomplissement', label: 'Accomplissement',color: 0x38bdf8, tier: 4, azimuth:  20, attach: 0.89, elev: 33,
    sub: ['Croissance', 'Projets', 'Maîtrise', 'Authenticité', 'Vision'] },
  { key: 'transcendance',   label: 'Transcendance',  color: 0xc4b5fd, tier: 4, azimuth:   0, attach: 1.00, elev: 80,
    sub: ['Spiritualité', 'Contribution', 'Sens', 'Transmission', 'Héritage'] },
];

// ── Modèle de démo : un arbre centenaire (la landing montre l'aboutissement) ─
export function createDemoModel() {
  const dev = {
    physio: 96, securite: 84, appartenance: 88, estime: 80,
    cognitif: 74, esthetique: 66, accomplissement: 70, transcendance: 52,
  };
  const vit = {
    physio: 82, securite: 70, appartenance: 78, estime: 72,
    cognitif: 66, esthetique: 60, accomplissement: 64, transcendance: 56,
  };
  return {
    stage: 'centenaire',
    branches: DIMENSIONS.map((d) => ({
      ...d, dev: dev[d.key], vitality: vit[d.key],
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
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

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

// ── Courbe d'une branche, en coordonnées LOCALES (origine = 0,0,0) ──────────
function localCurve(THREE, dir, length, rnd) {
  const up = new THREE.Vector3(0, 1, 0);
  const pts = [new THREE.Vector3(0, 0, 0)];
  let p = new THREE.Vector3(0, 0, 0);
  let cur = dir.clone().normalize();
  for (let i = 1; i <= 4; i++) {
    cur.lerp(up, 0.12).normalize();
    const jit = (rnd() - 0.5) * length * 0.1;
    p = p.clone().add(cur.clone().multiplyScalar(length / 4)).add(new THREE.Vector3(jit, 0, jit));
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

/**
 * Construit l'arbre. Renvoie { group, nodes, grow }.
 *   grow(age) — age ∈ [0,1] : anime la pousse, sapling → centenaire.
 */
export function buildTree(THREE, model) {
  const root = new THREE.Group();
  const rnd = rng(0x4c594c);

  // Tronc en chêne clair plutôt qu'en chocolat sombre : se voit nettement sur
  // fond marine #060e1a, et la grille ESP blanche par-dessus ne « grille » plus
  // le tronc par contraste — on lit enfin l'arbre comme un arbre.
  const barkActive = new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.7, metalness: 0.05 });
  const barkDormant = new THREE.MeshStandardMaterial({ color: 0x5d6677, roughness: 0.95 });
  const barkBroken = new THREE.MeshStandardMaterial({ color: 0x8a3c3c, roughness: 0.85 });
  const barkOf = (st) => (st === 'broken' ? barkBroken : st === 'dormant' ? barkDormant : barkActive);
  const espMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthTest: false });
  const ballGeo = new THREE.SphereGeometry(1, 16, 12);

  const growables = [];   // { obj, birth, dur, target }
  const nodes = [];       // 8 nœuds-dimension cliquables
  const subNodes = [];    // nœuds des sous-branches (labellés sous-élément)
  // feuilles : InstancedMesh global, croissance par instance
  const lp = [], lq = [], ls = [], lb = []; // position, quaternion, scale, birth

  // ligne ESP locale le long d'une courbe
  function espLine(curve, segs) {
    const pts = [];
    for (let i = 0; i < segs; i++) {
      const a = curve.getPoint(i / segs), b = curve.getPoint((i + 1) / segs);
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(g, espMat);
    l.renderOrder = 9;
    return l;
  }
  // nœud ESP (sphère + halo) ajouté à un parent, à une position locale
  function espNode(parent, localPos, color, radius, opacity, order) {
    const core = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({
      color, depthTest: false, transparent: true, opacity }));
    core.position.copy(localPos);
    core.renderOrder = order;
    core.scale.setScalar(0.0001);
    const halo = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: opacity * 0.3,
      blending: THREE.AdditiveBlending, depthTest: false }));
    halo.renderOrder = order - 1;
    core.add(halo);            // enfant du core (centré dessus)
    halo.scale.setScalar(2.4);
    parent.add(core);
    return core;
  }
  // dépose des feuilles (monde) autour d'un point, écloses à `birth`
  // Teintées vers le vert (55%) pour qu'on lise un feuillage d'arbre — sans
  // perdre l'identité couleur de la branche (qui reste discernable).
  const _e = new THREE.Euler();
  const _foliageGreen = new THREE.Color(0x4a7a3a);
  function scatterLeaves(worldPos, count, color, spread, birth) {
    for (let i = 0; i < count; i++) {
      lp.push(new THREE.Vector3(
        worldPos.x + (rnd() - 0.5) * spread,
        worldPos.y + (rnd() - 0.5) * spread,
        worldPos.z + (rnd() - 0.5) * spread));
      _e.set(rnd() * 3, rnd() * 3, rnd() * 3);
      lq.push(new THREE.Quaternion().setFromEuler(_e));
      const sc = 0.9 + rnd() * 0.9;
      ls.push(new THREE.Vector3(sc, sc * 0.6, sc));
      lb.push(birth + rnd() * 0.05);
      const c = new THREE.Color(color).lerp(_foliageGreen, 0.55);
      lp[lp.length - 1].userColor = c;
    }
  }

  // ── Sol herbeux + touffes d'herbe ────────────────────────────────────────
  // Disque légèrement bosselé (relief organique) sous l'arbre, vert forêt.
  const groundGeo = new THREE.CircleGeometry(95, 56);
  const gp = groundGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    // displacement en Z avant rotation = Y après → micro-relief du sol
    gp.setZ(i, gp.getZ(i) + (rnd() - 0.5) * 0.7);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: 0x223d18, roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = false;
  root.add(ground);

  // ── Vraies lames d'herbe (InstancedMesh) ────────────────────────────────
  // Chaque lame = un quad fuselé (5 vertices, 3 triangles) qui se rétrécit
  // jusqu'à la pointe. ~900 instances réparties en disque autour du tronc
  // (densité radiale racine carrée → plus dense près du pied). Rotation Y
  // aléatoire + léger tilt pour casser la grille. 5 nuances de vert via
  // instanceColor pour le relief naturel. Coût ~2700 triangles, négligeable.
  const bladeGeo = (() => {
    const g = new THREE.BufferGeometry();
    const w = 0.07, h = 1.4;
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array([
      -w, 0,        0,
       w, 0,        0,
      -w * 0.55,  h * 0.55, 0,
       w * 0.55,  h * 0.55, 0,
       0,         h,        0,
    ]), 3));
    g.setIndex([0, 1, 2,  1, 3, 2,  2, 3, 4]);
    g.computeVertexNormals();
    return g;
  })();
  const bladeMat = new THREE.MeshStandardMaterial({
    roughness: 0.85, side: THREE.DoubleSide, flatShading: true,
  });
  const BLADE_COUNT = 900;
  const grassMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, BLADE_COUNT);
  const _bm = new THREE.Matrix4();
  const _bq = new THREE.Quaternion();
  const _bp = new THREE.Vector3();
  const _bs = new THREE.Vector3();
  const _be = new THREE.Euler();
  const _bc = new THREE.Color();
  const grassGreens = [0x4a7a3a, 0x5d8a48, 0x3a6230, 0x68a350, 0x52904a];
  for (let i = 0; i < BLADE_COUNT; i++) {
    // racine carrée → distribution plus dense au centre, plus aérée loin
    const r = 3 + Math.sqrt(rnd()) * 82;
    const ang = rnd() * Math.PI * 2;
    _bp.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    _be.set(
      (rnd() - 0.5) * 0.28,           // léger tilt avant/arrière
      rnd() * Math.PI * 2,            // rotation Y libre (lame tournée au hasard)
      (rnd() - 0.5) * 0.2             // léger tilt latéral
    );
    _bq.setFromEuler(_be);
    const sc = 0.55 + rnd() * 1.1;     // ~55% à ~165% de la taille de base
    _bs.set(sc, sc * (0.8 + rnd() * 0.6), sc);
    _bm.compose(_bp, _bq, _bs);
    grassMesh.setMatrixAt(i, _bm);
    grassMesh.setColorAt(i, _bc.setHex(grassGreens[(rnd() * grassGreens.length) | 0]));
  }
  grassMesh.instanceMatrix.needsUpdate = true;
  if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  root.add(grassMesh);

  // Palette pour le feuillage des branches actives (canopée verte)
  const folMatA = new THREE.MeshStandardMaterial({ color: 0x3d7032, roughness: 0.85, flatShading: true });
  const folMatB = new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.85, flatShading: true });
  const folMatC = new THREE.MeshStandardMaterial({ color: 0x6aa852, roughness: 0.85, flatShading: true });

  // ── Tronc ─────────────────────────────────────────────────────────────────
  const trunkH = 48;
  const trunkGroup = new THREE.Group();
  trunkGroup.scale.setScalar(0.0001);
  root.add(trunkGroup);
  const trunkCurve = localCurve(THREE, new THREE.Vector3(0.05, 1, 0.03), trunkH, rnd);
  trunkGroup.add(new THREE.Mesh(taperedTube(THREE, trunkCurve, 3.4, 1.0, 30, 12), barkActive));
  trunkGroup.add(espLine(trunkCurve, 9));
  growables.push({ obj: trunkGroup, birth: 0, dur: 0.16, target: 1 });
  // nœud-racine
  const baseNode = espNode(trunkGroup, new THREE.Vector3(0, 0.4, 0), 0x9ecaff, 1, 1, 12);
  growables.push({ obj: baseNode, birth: 0.06, dur: 0.1, target: 0.85 });

  // ── Branches maîtresses ──────────────────────────────────────────────────
  for (const b of model.branches) {
    const attachLocal = trunkCurve.getPoint(b.attach);          // tronc-local
    const branchBirth = 0.13 + (b.tier - 1) * 0.135;

    const bGroup = new THREE.Group();
    bGroup.position.copy(attachLocal);
    bGroup.scale.setScalar(0.0001);
    trunkGroup.add(bGroup);
    growables.push({ obj: bGroup, birth: branchBirth, dur: 0.13, target: 1 });

    const dir = new THREE.Vector3(
      Math.cos(deg(b.elev)) * Math.cos(deg(b.azimuth)),
      Math.sin(deg(b.elev)),
      Math.cos(deg(b.elev)) * Math.sin(deg(b.azimuth)));
    const tierThick = b.tier === 1 ? 1.4 : b.tier === 2 ? 1.1 : 0.9;
    const len = 6 + (b.dev / 100) * 22;
    const r0 = (0.5 + (b.dev / 100) * 1.0) * tierThick;
    const r1 = r0 * 0.32;

    const curve = localCurve(THREE, dir, len, rnd);
    bGroup.add(new THREE.Mesh(taperedTube(THREE, curve, r0, r1, 16, 8), barkOf(b.state)));
    bGroup.add(espLine(curve, 6));
    const tipLocal = curve.getPoint(1);
    const tipWorld = attachLocal.clone().add(tipLocal);

    // nœud-dimension (cliquable)
    const dim = b.state === 'dormant' ? 0.35 : 1;
    const baseR = b.state === 'dormant' ? 0.62 : 1.1;
    const node = espNode(bGroup, tipLocal, b.color, baseR, 0.4 + dim * 0.6, 13);
    node.userData = { key: b.key, label: b.label, color: b.color, baseR, state: b.state, tier: b.tier };
    growables.push({ obj: node, birth: branchBirth + 0.15, dur: 0.1, target: baseR });
    nodes.push(node);

    // Canopée : feuillage vert épais autour de l'extrémité de chaque branche
    // active — c'est ce qui fait qu'on lit un arbre et non un schéma.
    if (b.state === 'active') {
      const folGroup = new THREE.Group();
      folGroup.position.copy(tipLocal);
      folGroup.scale.setScalar(0.0001);
      bGroup.add(folGroup);
      growables.push({ obj: folGroup, birth: branchBirth + 0.40, dur: 0.22, target: 1 });

      const puffCount = 3 + Math.round((b.vitality / 100) * 3);     // 3 à 6
      const palette = [folMatA, folMatB, folMatC];
      for (let p = 0; p < puffCount; p++) {
        const pr = 2.4 + rnd() * 1.6;
        const fol = new THREE.Mesh(
          new THREE.IcosahedronGeometry(pr, 1),
          palette[(rnd() * palette.length) | 0]
        );
        fol.position.set(
          (rnd() - 0.5) * 3.8,
          0.4 + (rnd() - 0.3) * 2.4,
          (rnd() - 0.5) * 3.8
        );
        folGroup.add(fol);
      }
    }

    // sous-branches sémantiques : combien écloses ∝ dev
    const grown = b.state === 'active'
      ? Math.min(b.sub.length, 1 + Math.round((b.dev / 100) * b.sub.length)) : 0;
    for (let k = 0; k < grown; k++) {
      const at = 0.45 + (k / Math.max(1, grown)) * 0.45;
      const sBirth = branchBirth + 0.15 + k * 0.025;
      const sOriginLocal = curve.getPoint(at);
      const sGroup = new THREE.Group();
      sGroup.position.copy(sOriginLocal);
      sGroup.scale.setScalar(0.0001);
      bGroup.add(sGroup);
      growables.push({ obj: sGroup, birth: sBirth, dur: 0.1, target: 1 });

      const sTangent = curve.getTangent(at);
      const ang = ((k / grown) - 0.5) * 2.4;
      const side = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)).normalize();
      sTangent.lerp(side, 0.45).add(new THREE.Vector3(0, 0.45, 0)).normalize();
      const sLen = len * (0.4 + rnd() * 0.22);
      const sCurve = localCurve(THREE, sTangent, sLen, rnd);
      sGroup.add(new THREE.Mesh(taperedTube(THREE, sCurve, r1 * 1.1, r1 * 0.4, 10, 6), barkOf(b.state)));
      sGroup.add(espLine(sCurve, 4));
      const sTipLocal = sCurve.getPoint(1);
      const sNode = espNode(sGroup, sTipLocal, b.color, 0.42, 0.85, 11);
      sNode.userData = { label: b.sub[k] || '', color: b.color, key: b.key };
      subNodes.push(sNode);
      growables.push({ obj: sNode, birth: sBirth + 0.1, dur: 0.08, target: 0.42 });

      // rejet (niveau 3) : un cran de ramification de plus
      if (b.state === 'active') {
        const twAt = 0.55 + rnd() * 0.2;
        const twBirth = sBirth + 0.12;
        const twOriginLocal = sCurve.getPoint(twAt);
        const twGroup = new THREE.Group();
        twGroup.position.copy(twOriginLocal);
        twGroup.scale.setScalar(0.0001);
        sGroup.add(twGroup);
        growables.push({ obj: twGroup, birth: twBirth, dur: 0.08, target: 1 });

        const twTan = sCurve.getTangent(twAt);
        const twSide = new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize();
        twTan.lerp(twSide, 0.5).add(new THREE.Vector3(0, 0.5, 0)).normalize();
        const twLen = sLen * (0.42 + rnd() * 0.2);
        const twCurve = localCurve(THREE, twTan, twLen, rnd);
        twGroup.add(new THREE.Mesh(
          taperedTube(THREE, twCurve, r1 * 0.45, r1 * 0.16, 8, 5), barkOf(b.state)));
        twGroup.add(espLine(twCurve, 3));
        const twTipLocal = twCurve.getPoint(1);
        const twNode = espNode(twGroup, twTipLocal, b.color, 0.26, 0.8, 11);
        growables.push({ obj: twNode, birth: twBirth + 0.08, dur: 0.07, target: 0.26 });
        if (b.vitality > 8) {
          const twTipWorld = attachLocal.clone()
            .add(sOriginLocal).add(twOriginLocal).add(twTipLocal);
          scatterLeaves(twTipWorld, Math.round((b.vitality / 100) * 4), b.color, 2.4, twBirth + 0.1);
        }
      }

      if (b.vitality > 8) {
        const sTipWorld = attachLocal.clone().add(sOriginLocal).add(sTipLocal);
        scatterLeaves(sTipWorld, Math.round((b.vitality / 100) * 6), b.color, 3.2, sBirth + 0.14);
      }
    }
    if (b.state === 'active' && b.vitality > 8) {
      scatterLeaves(tipWorld, Math.round((b.vitality / 100) * 11), b.color, 4.6, branchBirth + 0.28);
    }
  }

  // ── Feuilles : InstancedMesh global, croissance par instance ─────────────
  let leafMesh = null;
  if (lp.length) {
    leafMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.9, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }),
      lp.length);
    const c = new THREE.Color();
    for (let i = 0; i < lp.length; i++) leafMesh.setColorAt(i, lp[i].userColor || c.setHex(0x6abf6a));
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    root.add(leafMesh);
  }

  // ── grow(age) — applique l'état de croissance ────────────────────────────
  const _m = new THREE.Matrix4(), _ts = new THREE.Vector3();
  function grow(age) {
    for (const g of growables) {
      const p = easeOut(Math.min(1, Math.max(0, (age - g.birth) / g.dur)));
      g.obj.scale.setScalar(Math.max(0.0001, p * g.target));
    }
    if (leafMesh) {
      for (let i = 0; i < lp.length; i++) {
        const p = easeOut(Math.min(1, Math.max(0, (age - lb[i]) / 0.12)));
        _ts.copy(ls[i]).multiplyScalar(Math.max(0.0001, p));
        _m.compose(lp[i], lq[i], _ts);
        leafMesh.setMatrixAt(i, _m);
      }
      leafMesh.instanceMatrix.needsUpdate = true;
    }
  }
  grow(0);

  return { group: root, nodes, subNodes, grow };
}
