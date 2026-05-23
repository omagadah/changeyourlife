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

// ── Texture de Terre procédurale (canvas, zéro téléchargement) ──────────────
// Océan dégradé + continents (blobs verts/tan) + calottes polaires. Stylisée
// mais reconnaissable, légère (générée à la volée), pas de fichier image.
function makeEarthTexture(THREE) {
  const w = 1024, h = 512;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  // océan
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b2e5c'); g.addColorStop(0.5, '#0e4f93'); g.addColorStop(1, '#0b2e5c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // continents : amas de blobs organiques
  const land = ['#3d7a3a', '#4a8a3f', '#71873b', '#8a7a4a', '#356a33'];
  ctx.save();
  for (let c = 0; c < 24; c++) {
    const cx = Math.random() * w, cy = h * (0.16 + Math.random() * 0.66);
    ctx.fillStyle = land[(Math.random() * land.length) | 0];
    ctx.globalAlpha = 0.9;
    const blobs = 8 + (Math.random() * 16 | 0);
    for (let b = 0; b < blobs; b++) {
      const r = 12 + Math.random() * 46;
      const x = cx + (Math.random() - 0.5) * 130;
      const y = cy + (Math.random() - 0.5) * 90;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.55 + Math.random() * 0.6), Math.random() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  // calottes polaires
  let cap = ctx.createLinearGradient(0, 0, 0, h * 0.13);
  cap.addColorStop(0, 'rgba(238,246,255,0.95)'); cap.addColorStop(1, 'rgba(238,246,255,0)');
  ctx.fillStyle = cap; ctx.fillRect(0, 0, w, h * 0.13);
  cap = ctx.createLinearGradient(0, h * 0.87, 0, h);
  cap.addColorStop(0, 'rgba(238,246,255,0)'); cap.addColorStop(1, 'rgba(238,246,255,0.95)');
  ctx.fillStyle = cap; ctx.fillRect(0, h * 0.87, w, h * 0.13);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Construit l'arbre. Renvoie { group, nodes, grow }.
 *   grow(age) — age ∈ [0,1] : anime la pousse, sapling → centenaire.
 */
export function buildTree(THREE, model, opts) {
  const root = new THREE.Group();
  const rnd = rng(0x4c594c);
  opts = opts || {};
  // bonus d'herbe persisté entre sessions (chaque récompense XP ajoute des brins)
  const extraGrass = Math.max(0, Math.min(1500, Math.floor(opts.extraGrass || 0)));

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
  const branchGroups = new Map(); // key Maslow → bGroup (pour grossir une branche au gain d'XP)
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
  const BASE_BLADES = 900;
  const BLADE_COUNT = BASE_BLADES + extraGrass; // densité bonifiée par persistance
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

  // Fonction exposée : ajoute n brins d'herbe live (chaque récompense en
  // pousse quelques-uns). On crée un petit InstancedMesh par appel — c'est
  // léger pour le GPU et ça évite de re-créer le mesh global.
  function addGrassBlades(n) {
    n = Math.max(1, Math.min(20, n | 0));
    const m = new THREE.InstancedMesh(bladeGeo, bladeMat, n);
    const _m2 = new THREE.Matrix4(), _q2 = new THREE.Quaternion(), _p2 = new THREE.Vector3();
    const _s2 = new THREE.Vector3(), _e2 = new THREE.Euler(), _c2 = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const r = 3 + Math.sqrt(Math.random()) * 82;
      const ang = Math.random() * Math.PI * 2;
      _p2.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
      _e2.set(
        (Math.random() - 0.5) * 0.28,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.2,
      );
      _q2.setFromEuler(_e2);
      const sc = 0.55 + Math.random() * 1.1;
      _s2.set(sc, sc * (0.8 + Math.random() * 0.6), sc);
      _m2.compose(_p2, _q2, _s2);
      m.setMatrixAt(i, _m2);
      m.setColorAt(i, _c2.setHex(grassGreens[(Math.random() * grassGreens.length) | 0]));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    root.add(m);
    return m;
  }

  // Palette pour le feuillage des branches actives (canopée verte)
  const folMatA = new THREE.MeshStandardMaterial({ color: 0x3d7032, roughness: 0.85, flatShading: true });
  const folMatB = new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.85, flatShading: true });
  const folMatC = new THREE.MeshStandardMaterial({ color: 0x6aa852, roughness: 0.85, flatShading: true });

  // ── Cosmos : étoiles + soleil + planètes en orbite ──────────────────────
  // Toujours dans la scène. Invisible/lointain au zoom normal, se révèle
  // quand l'utilisateur dézoome : « tu es minuscule sur une petite planète,
  // remets-toi en perspective ». Coût quasi nul (Points + sphères basiques).

  // Champ d'étoiles — 2200 points sur une coquille lointaine
  const STAR_COUNT = 2200;
  const starPos = new Float32Array(STAR_COUNT * 3);
  const starCol = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // distribution uniforme sur sphère
    const u = rnd(), v = rnd();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 6000 * (0.85 + rnd() * 0.3);
    starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const intens = 0.55 + rnd() * 0.45;
    starCol[i * 3]     = intens * (0.85 + rnd() * 0.15);
    starCol[i * 3 + 1] = intens * (0.85 + rnd() * 0.15);
    starCol[i * 3 + 2] = intens * (0.90 + rnd() * 0.10);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  starGeo.setAttribute('color',    new THREE.Float32BufferAttribute(starCol, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.7,
  }));
  root.add(stars);

  // Helper de chargement de texture (async, non bloquant, repli silencieux).
  const _texLoader = new THREE.TextureLoader();
  function applyTexture(mat, path, mode) {
    _texLoader.load(path, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      if (mode === 'alpha') { mat.alphaMap = tex; mat.transparent = true; }
      else { mat.map = tex; if (mat.color) mat.color.set(0xffffff); }
      if (mode === 'sky') mat.opacity = 1;
      mat.needsUpdate = true;
    });
  }

  // Ciel — vraie Voie lactée en fond (sphère inversée géante). Invisible tant
  // que la texture n'est pas chargée → on garde les points d'étoiles sinon.
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, transparent: true, opacity: 0 });
  applyTexture(skyMat, '/textures/stars-milky-way.jpg', 'sky');
  root.add(new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 32), skyMat));

  // Soleil — loin et haut dans l'espace (hors de la Terre), halos + lumière warm
  const sunGroup = new THREE.Group();
  sunGroup.position.set(-2400, 1500, -2800);
  root.add(sunGroup);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd86a });
  applyTexture(sunMat, '/textures/sun.jpg');
  sunGroup.add(new THREE.Mesh(new THREE.SphereGeometry(45, 48, 32), sunMat));
  sunGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(85, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0xffb84a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
  ));
  sunGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(150, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false })
  ));
  // une lumière point qui pose un poil de chaleur du côté soleil
  sunGroup.add(new THREE.PointLight(0xffd6a0, 1.4, 4000, 0.6));

  // Planètes en orbite (parentées au soleil pour orbite naturelle)
  const planetsData = [
    { tex: 'mercury', color: 0x9a8a7a, radius:  4, dist: 180, speed: 0.18,  tilt:  0.04 },
    { tex: 'venus',   color: 0xddc06a, radius:  6, dist: 280, speed: 0.10,  tilt: -0.03 },
    { tex: 'mars',    color: 0xd17a48, radius:  5, dist: 380, speed: 0.07,  tilt:  0.04 },
    { tex: 'jupiter', color: 0xd4a574, radius: 16, dist: 540, speed: 0.04,  tilt:  0.02 },
    { tex: 'saturn',  color: 0xc9b078, radius: 13, dist: 720, speed: 0.025, tilt:  0.05, ring: true },
    { tex: 'uranus',  color: 0x8fc6d4, radius:  8, dist: 920, speed: 0.018, tilt: -0.04 },
    { tex: 'neptune', color: 0x4a78d4, radius:  8, dist:1120, speed: 0.014, tilt:  0.02 },
  ];
  const planets = [];
  for (const p of planetsData) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius, 32, 22),
      new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.9, metalness: 0.0 })
    );
    if (p.tex) applyTexture(mesh.material, '/textures/' + p.tex + '.jpg');
    mesh.scale.setScalar(1.8);             // plus grosses → visibles au dézoom
    const ang = rnd() * Math.PI * 2;
    mesh.userData = { dist: p.dist, speed: p.speed, tilt: p.tilt, angle: ang };
    mesh.position.set(Math.cos(ang) * p.dist, p.tilt * p.dist, Math.sin(ang) * p.dist);
    sunGroup.add(mesh);
    // ESP : anneau d'orbite — relie visuellement la planète au soleil
    // (lit comme un schéma de système solaire).
    const orbit = new THREE.Mesh(
      new THREE.RingGeometry(p.dist - 1.6, p.dist + 1.6, 128),
      new THREE.MeshBasicMaterial({ color: 0x9ec5ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    orbit.rotation.x = Math.PI / 2;
    orbit.position.y = p.tilt * p.dist;
    sunGroup.add(orbit);
    if (p.ring) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(p.radius * 1.5, p.radius * 2.4, 48),
        new THREE.MeshBasicMaterial({ color: 0xc9b078, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      );
      ring.rotation.x = Math.PI * 0.42;
      mesh.add(ring);
    }
    planets.push(mesh);
  }

  // ── La Terre ── l'arbre pousse au pôle nord d'une vraie planète ──────────
  // Énorme sphère sous le sol (pôle nord = y 0). Au zoom normal la surface
  // paraît plate (c'est « le sol ») ; au dézoom la courbure puis la planète
  // entière se révèlent, jusqu'à sortir dans l'espace.
  // Grande sphère, et surtout posée BIEN en-dessous du sol : le clignotement
  // précédent venait de la Terre (sommet à y≈0) et du disque d'herbe (y≈0)
  // coplanaires → z-fighting. On laisse un vrai écart.
  const EARTH_R = 2400;
  const earthGroup = new THREE.Group();
  earthGroup.position.set(0, -EARTH_R - 3, 0);
  root.add(earthGroup);
  // Texture réelle si présente (public/textures/earth-day.jpg, ex: Solar System
  // Scope 2K), sinon repli procédural. Chargement async sans bloquer.
  const earthMat = new THREE.MeshStandardMaterial({ color: 0x24405e, roughness: 1, metalness: 0 });
  new THREE.TextureLoader().load(
    '/textures/earth-day.jpg',
    (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; earthMat.map = tex; earthMat.color.set(0xffffff); earthMat.needsUpdate = true; },
    undefined,
    () => { earthMat.map = makeEarthTexture(THREE); earthMat.color.set(0xffffff); earthMat.needsUpdate = true; }
  );
  const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 64), earthMat);
  earthGroup.add(earth);
  // Couche de nuages : texture N&B en alphaMap (blanc = nuage opaque, noir = transparent)
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
  applyTexture(cloudMat, '/textures/earth-clouds.jpg', 'alpha');
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.006, 96, 64), cloudMat);
  earthGroup.add(clouds);
  // halo d'atmosphère (rim glow cyan)
  earthGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.018, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x6db3ff, transparent: true, opacity: 0.10, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
  ));

  // Géolocalisation : place le PAYS de l'utilisateur sous l'arbre (au sommet),
  // au lieu du pôle nord. On oriente la Terre + nuages pour amener (lat,lon)
  // en haut, et on fige l'auto-rotation pour que le pays reste sous l'arbre.
  let geoLocked = false;
  function setEarthLocation(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return;
    const latR = lat * Math.PI / 180;
    const lonR = lon * Math.PI / 180;
    const LON_OFFSET = -Math.PI / 2; // calage du méridien d'origine (ajustable)
    const d = new THREE.Vector3(
      Math.cos(latR) * Math.sin(lonR + LON_OFFSET),
      Math.sin(latR),
      Math.cos(latR) * Math.cos(lonR + LON_OFFSET)
    ).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(0, 1, 0));
    earth.quaternion.copy(q);
    clouds.quaternion.copy(q);
    geoLocked = true;
  }

  // Animation des orbites (appelée chaque frame par l'orchestrateur).
  // Lente exprès : ce n'est pas un écran de veille, c'est un repère mental.
  function animateCosmos(dt) {
    if (!dt || dt > 0.5) dt = 0.016; // garde-fou (onglet en veille…)
    if (!geoLocked) {                 // sans géoloc, la Terre tourne sur elle-même
      earth.rotation.y += dt * 0.015;
      clouds.rotation.y += dt * 0.022;
    }
    for (const p of planets) {
      p.userData.angle += p.userData.speed * dt;
      const a = p.userData.angle;
      p.position.set(
        Math.cos(a) * p.userData.dist,
        p.userData.tilt * p.userData.dist,
        Math.sin(a) * p.userData.dist,
      );
      p.rotation.y += dt * 0.3;
    }
  }

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
    branchGroups.set(b.key, bGroup);

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

  return { group: root, nodes, subNodes, grow, branchGroups, addGrassBlades, animateCosmos, setEarthLocation };
}
