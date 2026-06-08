// /js/tree-model.js - Arbre de vie procédural CYL.
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
 *   grow(age) - age ∈ [0,1] : anime la pousse, sapling → centenaire.
 */
export function buildTree(THREE, model, opts) {
  const root = new THREE.Group();
  const rnd = rng(0x4c594c);
  opts = opts || {};
  // bonus d'herbe persisté entre sessions (chaque récompense XP ajoute des brins)
  const extraGrass = Math.max(0, Math.min(1500, Math.floor(opts.extraGrass || 0)));
  // Mode « flottant » : l'arbre ne pousse plus sur le sol/la Terre, il flotte
  // dans l'espace sur une plateforme cylindrique translucide ; la Terre devient
  // une planète du système solaire. (Page d'accueil.)
  const floating = !!opts.floating;
  // Mode ez-tree : on ne dessine PAS l'arbre procédural (tronc/branches/feuillage)
  // mais on garde les groupes + les 8 nœuds cliquables + plateforme + cosmos.
  // Le bel arbre ez-tree est ajouté par-dessus côté arbre3d.js.
  const ezTree = !!opts.ezTree;

  // Tronc en chêne clair plutôt qu'en chocolat sombre : se voit nettement sur
  // fond marine #060e1a, et la grille ESP blanche par-dessus ne « grille » plus
  // le tronc par contraste - on lit enfin l'arbre comme un arbre.
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
  // Teintées vers le vert (55%) pour qu'on lise un feuillage d'arbre - sans
  // perdre l'identité couleur de la branche (qui reste discernable).
  const _e = new THREE.Euler();
  const _foliageGreen = new THREE.Color(0x4a7a3a);
  function scatterLeaves(worldPos, count, color, spread, birth) {
    if (ezTree) return;   // feuillage fourni par l'ez-tree
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
  // Disque légèrement bosselé (relief organique) sous l'arbre. Texture en
  // dégradé radial : cœur vert herbe opaque → bords transparents, pour que le
  // sol se FONDE dans la surface de la Terre au lieu de faire une tache nette.
  const groundGeo = new THREE.CircleGeometry(105, 56);
  const gp = groundGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    // displacement en Z avant rotation = Y après → micro-relief du sol
    gp.setZ(i, gp.getZ(i) + (rnd() - 0.5) * 0.7);
  }
  groundGeo.computeVertexNormals();
  const groundTex = (() => {
    try {
      const cnv = document.createElement('canvas');
      cnv.width = cnv.height = 256;
      const ctx = cnv.getContext('2d');
      const g = ctx.createRadialGradient(128, 128, 6, 128, 128, 128);
      g.addColorStop(0.0,  'rgba(74,116,58,0.95)');  // cœur vert herbe
      g.addColorStop(0.45, 'rgba(58,92,44,0.82)');
      g.addColorStop(0.72, 'rgba(46,72,34,0.40)');
      g.addColorStop(0.90, 'rgba(40,62,30,0.12)');
      g.addColorStop(1.0,  'rgba(40,62,30,0.0)');    // bord fondu/transparent
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
      const t = new THREE.CanvasTexture(cnv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    } catch (_) { return null; }
  })();
  const ground = new THREE.Mesh(
    groundGeo,
    groundTex
      ? new THREE.MeshStandardMaterial({ map: groundTex, transparent: true, depthWrite: false, roughness: 1, metalness: 0 })
      : new THREE.MeshStandardMaterial({ color: 0x2e4d22, roughness: 0.95, metalness: 0, transparent: true, opacity: 0.85 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.renderOrder = 1;        // dessiné après la Terre → blend propre
  ground.receiveShadow = false;
  if (!floating) root.add(ground);

  // ── Plateforme cylindrique translucide (mode flottant) ──────────────────────
  // Un « bloc » de verre presque invisible sur lequel l'arbre tient au milieu de
  // l'espace : on voit les étoiles à travers, seul un fin liseré lumineux sur le
  // rebord en révèle la forme.
  if (floating) {
    const plat = new THREE.Group();
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4ecff, transparent: true, opacity: 0.06, roughness: 0.06, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide, depthWrite: false,
    });
    // corps cylindrique
    const body = new THREE.Mesh(new THREE.CylinderGeometry(44, 48, 7, 80, 1, true), glassMat);
    body.position.y = -3.6;
    plat.add(body);
    // face supérieure (verre à peine teinté)
    const top = new THREE.Mesh(new THREE.CircleGeometry(44, 80), glassMat);
    top.rotation.x = -Math.PI / 2;
    plat.add(top);
    // liseré lumineux sur le rebord supérieur → donne la forme sans casser la transparence
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(44, 0.5, 12, 110),
      new THREE.MeshBasicMaterial({ color: 0x9ed9ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    rim.rotation.x = Math.PI / 2;
    plat.add(rim);
    // liseré inférieur, plus discret
    const rimB = new THREE.Mesh(
      new THREE.TorusGeometry(48, 0.35, 12, 110),
      new THREE.MeshBasicMaterial({ color: 0x6fb6e8, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    rimB.rotation.x = Math.PI / 2; rimB.position.y = -7;
    plat.add(rimB);
    // halo doux sous l'arbre
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(42, 64),
      new THREE.MeshBasicMaterial({ color: 0x8fd4ff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06;
    plat.add(glow);
    plat.renderOrder = 2;
    root.add(plat);
  }

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
  if (!floating) root.add(grassMesh);

  // Fonction exposée : ajoute n brins d'herbe live (chaque récompense en
  // pousse quelques-uns). On crée un petit InstancedMesh par appel - c'est
  // léger pour le GPU et ça évite de re-créer le mesh global.
  function addGrassBlades(n) {
    if (floating) return null;   // pas d'herbe quand l'arbre flotte dans l'espace
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

  // Champ d'étoiles - 2200 points sur une coquille lointaine
  const STAR_COUNT = 3000;
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

  // Ciel : nébuleuse PROCÉDURALE (canvas lisse) au lieu d'une photo JPEG dont les
  // blocs de compression devenaient visibles (« Minecraft ») une fois amplifiés
  // par le tone mapping. Dégradés doux + fine poussière d'étoiles -> crisp.
  function makeNebulaTexture() {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#04060c'; g.fillRect(0, 0, 2048, 1024);
    const blobs = [
      [430, 360, 380, 'rgba(70,46,130,0.22)'], [1320, 300, 430, 'rgba(28,64,128,0.18)'],
      [950, 720, 410, 'rgba(96,34,104,0.16)'], [1700, 780, 350, 'rgba(40,78,120,0.16)'],
      [220, 820, 330, 'rgba(54,44,112,0.15)'], [1500, 540, 300, 'rgba(36,60,118,0.14)'],
    ];
    for (const b of blobs) {
      const grad = g.createRadialGradient(b[0], b[1], 0, b[0], b[1], b[2]);
      grad.addColorStop(0, b[3]); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 2048, 1024);
    }
    for (let i = 0; i < 1600; i++) {
      const x = rnd() * 2048, y = rnd() * 1024, a = 0.25 + rnd() * 0.6, s = rnd() < 0.08 ? 2 : 1;
      g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x, y, s, s);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    return tex;
  }
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, map: makeNebulaTexture() });
  root.add(new THREE.Mesh(new THREE.SphereGeometry(9000, 64, 40), skyMat));

  // Soleil - loin et haut dans l'espace (hors de la Terre), halos + lumière warm
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
    // ESP : anneau d'orbite - relie visuellement la planète au soleil
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

  // ── La Terre ────────────────────────────────────────────────────────────────
  let earth = null, clouds = null;   // mode planté : Terre « sol » géante
  let earthFloat = null;             // mode flottant : Terre planète

  if (!floating) {
    // L'arbre pousse au pôle nord d'une vraie planète. Énorme sphère sous le sol
    // (pôle nord = y 0). Au zoom normal la surface paraît plate (« le sol ») ;
    // au dézoom la courbure puis la planète entière se révèlent.
    const EARTH_R = 2400;
    const earthGroup = new THREE.Group();
    earthGroup.position.set(0, -EARTH_R - 8, 0);
    root.add(earthGroup);
    const earthMat = new THREE.MeshStandardMaterial({ color: 0x24405e, roughness: 1, metalness: 0 });
    new THREE.TextureLoader().load(
      '/textures/earth-day.jpg',
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; earthMat.map = tex; earthMat.color.set(0xffffff); earthMat.needsUpdate = true; },
      undefined,
      () => { earthMat.map = makeEarthTexture(THREE); earthMat.color.set(0xffffff); earthMat.needsUpdate = true; }
    );
    earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 64), earthMat);
    earthGroup.add(earth);
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    applyTexture(cloudMat, '/textures/earth-clouds.jpg', 'alpha');
    clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.006, 96, 64), cloudMat);
    earthGroup.add(clouds);
    earthGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.018, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x6db3ff, transparent: true, opacity: 0.10, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
    ));
    // Orbite de la Terre reliée au Soleil, dans le plan le plus horizontal possible.
    const earthLocal = earthGroup.position.clone().sub(sunGroup.position);
    const Re = earthLocal.length();
    const u = earthLocal.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    let normal = up.clone().addScaledVector(u, -up.dot(u));
    if (normal.lengthSq() < 1e-4) normal = new THREE.Vector3(1, 0, 0);
    normal.normalize();
    const yAxis = new THREE.Vector3().crossVectors(normal, u).normalize();
    const basis = new THREE.Matrix4().makeBasis(u, yAxis, normal);
    const orbitE = new THREE.Mesh(
      new THREE.RingGeometry(Re - 6, Re + 6, 256),
      new THREE.MeshBasicMaterial({ color: 0x9ec5ff, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
    );
    orbitE.quaternion.setFromRotationMatrix(basis);
    sunGroup.add(orbitE);
  } else {
    // Mode flottant : la Terre est une planète à part entière qui orbite le
    // Soleil, parmi les autres - l'arbre flotte ailleurs, dans l'espace.
    const ER = 17;
    const eMat = new THREE.MeshStandardMaterial({ color: 0x24405e, roughness: 1, metalness: 0 });
    new THREE.TextureLoader().load(
      '/textures/earth-day.jpg',
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; eMat.map = tex; eMat.color.set(0xffffff); eMat.needsUpdate = true; },
      undefined,
      () => { eMat.map = makeEarthTexture(THREE); eMat.color.set(0xffffff); eMat.needsUpdate = true; }
    );
    const eMesh = new THREE.Mesh(new THREE.SphereGeometry(ER, 48, 32), eMat);
    const ecMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    applyTexture(ecMat, '/textures/earth-clouds.jpg', 'alpha');
    eMesh.add(new THREE.Mesh(new THREE.SphereGeometry(ER * 1.01, 48, 32), ecMat));
    eMesh.add(new THREE.Mesh(
      new THREE.SphereGeometry(ER * 1.06, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0x6db3ff, transparent: true, opacity: 0.18, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
    ));
    eMesh.scale.setScalar(1.8);
    const dist = 470, speed = 0.05, tilt = 0.03, ang = rnd() * Math.PI * 2;
    eMesh.userData = { dist, speed, tilt, angle: ang };
    eMesh.position.set(Math.cos(ang) * dist, tilt * dist, Math.sin(ang) * dist);
    sunGroup.add(eMesh);
    const orbit = new THREE.Mesh(
      new THREE.RingGeometry(dist - 1.6, dist + 1.6, 128),
      new THREE.MeshBasicMaterial({ color: 0x9ec5ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    orbit.rotation.x = Math.PI / 2; orbit.position.y = tilt * dist;
    sunGroup.add(orbit);
    planets.push(eMesh);
    earthFloat = eMesh;
  }

  // ── Satellites + étoiles filantes ─────────────────────────────────────────
  // Trafic discret dans le ciel de l'accueil : quelques satellites qui croisent
  // lentement en orbite autour de l'arbre, et des étoiles filantes occasionnelles
  // (élégantes, pas clignotantes). Visibles au zoom normal, derrière l'arbre.
  // Coût négligeable (quelques meshes + blending additif, textures procédurales).

  // Texture procédurale d'une traînée de comète (dégradé queue→tête, sans asset).
  function makeStreakTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 16;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0.0,  'rgba(255,255,255,0)');
    grad.addColorStop(0.65, 'rgba(160,200,255,0.25)');
    grad.addColorStop(0.92, 'rgba(220,235,255,0.85)');
    grad.addColorStop(1.0,  'rgba(255,255,255,1)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 16);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Glint additif radial réutilisable pour faire briller les satellites de loin.
  const glintTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const rad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rad.addColorStop(0,   'rgba(255,255,255,1)');
    rad.addColorStop(0.4, 'rgba(200,225,255,0.5)');
    rad.addColorStop(1,   'rgba(200,225,255,0)');
    g.fillStyle = rad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  // Construit un petit satellite : corps + 2 panneaux solaires + antenne + glint.
  function makeSatellite() {
    const sat = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.2, 3.2),
      new THREE.MeshStandardMaterial({ color: 0xdfe7f0, roughness: 0.5, metalness: 0.6 })
    );
    sat.add(body);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x2b3f6b, roughness: 0.4, metalness: 0.3, emissive: 0x10306a, emissiveIntensity: 0.4,
    });
    const pL = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.15, 2.6), panelMat);
    pL.position.x = -4.6; sat.add(pL);
    const pR = pL.clone(); pR.position.x = 4.6; sat.add(pR);
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: 0xcfd8e6, roughness: 0.6 })
    );
    ant.position.y = 1.8; sat.add(ant);
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glintTex, color: 0xbfe0ff, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glint.scale.setScalar(7);
    sat.add(glint);
    sat.userData.glint = glint;
    return sat;
  }

  // Satellites en mouvement d'ATOME : 3 plans orbitaux inclinés qui se croisent
  // au niveau de l'arbre (le « noyau »), 2 « électrons » par plan (phases
  // opposées), orbites ELLIPTIQUES, sens de rotation différents d'un plan à
  // l'autre. Restent dans le périmètre de l'arbre -> visibles une fois dézoomé.
  // Vrai ATOME : un tracé HORIZONTAL, un VERTICAL, et des DIAGONALES (pas une
  // sphère/ballon de basket). Des satellites (électrons) circulent dessus.
  const PI = Math.PI;
  const SAT_CENTER = new THREE.Vector3(0, 40, 0);
  // EXACTEMENT 3 ellipses allongées, tournées de 120° autour de l'axe vertical et
  // inclinées : c'est LE symbole de l'atome. Pas plus (sinon ça fait un ballon).
  const ORB_A = 78, ORB_B = 190;   // A = petit axe (ax) · B = grand axe (ay) -> ellipse allongée
  // 3 ellipses dont les NORMALES sont réparties sur un cône autour de l'axe
  // vertical (120° d'écart). Leurs plans sont tous différents -> elles se croisent
  // au CENTRE sans se rejoindre aux pôles : c'est le vrai symbole de l'atome.
  const UP = new THREE.Vector3(0, 1, 0);
  // Azimuts / inclinaisons LÉGÈREMENT irréguliers (la nature est imparfaite). Le
  // 3e plan (satellite 'open' = Gratuit & open source) est davantage décalé pour
  // qu'un cercle paraisse ~centré sans être pile symétrique avec les deux autres.
  const planeCfg = [
    { az: 0.00, tilt: 1.16, speed:  0.110 },
    { az: 2.02, tilt: 1.20, speed: -0.105 },
    { az: 4.34, tilt: 1.06, speed:  0.115 },   // 'open' : décalé + un poil moins incliné
  ];
  const planes = planeCfg.map((c) => {
    const n = new THREE.Vector3(Math.sin(c.tilt) * Math.cos(c.az), Math.cos(c.tilt), Math.sin(c.tilt) * Math.sin(c.az));
    const ax = new THREE.Vector3().crossVectors(n, UP).normalize();
    const ay = new THREE.Vector3().crossVectors(n, ax).normalize();
    return { ax, ay, speed: c.speed };
  });

  const satellites = [];
  const infoSats = [];
  // Électrons sur l'atome (le PRIMORDIAL « 100% transparent » sur la verticale
  // avant = bien visible et le plus gros).
  const satDefs = [
    { plane: 0, phase: 0.0,      scale: 1.7, info: 'transp' },   // PRIMORDIAL (le + gros)
    { plane: 1, phase: 2.1,      scale: 0.9, info: 'connect' },
    { plane: 2, phase: 4.0,      scale: 0.9, info: 'open' },
    { plane: 0, phase: PI,       scale: 0.55 },
    { plane: 1, phase: 2.1 + PI, scale: 0.5 },
    { plane: 2, phase: 4.0 + PI, scale: 0.5 },
  ];
  for (const d of satDefs) {
    const p = planes[d.plane];
    const s = makeSatellite();
    s.userData.ax = p.ax; s.userData.ay = p.ay;
    s.userData.A = ORB_A; s.userData.B = ORB_B; s.userData.speed = p.speed;
    s.userData.center = SAT_CENTER;
    s.userData.angle = d.phase;
    s.scale.setScalar(d.scale || 1);
    if (d.info) { s.userData.info = d.info; s.userData.primordial = d.info === 'transp'; infoSats.push(s); }
    root.add(s);
    satellites.push(s);
  }
  // SYL : quasi-immobile, EN BAS (tout repose sur lui). Petite orbite lente, démarre
  // au point le plus bas.
  {
    const s = makeSatellite();
    s.userData.ax = new THREE.Vector3(1, 0, 0);
    s.userData.ay = new THREE.Vector3(0, 1, 0);
    s.userData.A = 44; s.userData.B = 30;
    s.userData.center = new THREE.Vector3(0, 8, 0);
    s.userData.angle = -PI / 2;     // commence en bas
    s.userData.speed = 0.012;       // vitesse minimale (quasi géostationnaire)
    s.userData.info = 'syl';
    s.scale.setScalar(1.0);
    root.add(s);
    satellites.push(s); infoSats.push(s);
  }

  // Tracés des orbites = la forme de l'atome (1 ellipse par PLAN). Dessinées
  // progressivement (drawRange), pilotées par arbre3d via `orbits`.
  const orbitLines = [];
  for (const p of planes) {
    const N = 176, pts = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * PI * 2;
      pts.push(SAT_CENTER.clone()
        .addScaledVector(p.ax, Math.cos(t) * ORB_A)
        .addScaledVector(p.ay, Math.sin(t) * ORB_B));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setDrawRange(0, 0);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0x9fd0ff, transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    line.userData.total = N + 1;
    line.visible = false;
    root.add(line);
    orbitLines.push(line);
  }
  const orbits = {
    // p (0..1) : avancement global ; les orbites se révèlent l'une après l'autre.
    setProgress(p) {
      const n = orbitLines.length, seg = 1 / n;
      for (let i = 0; i < n; i++) {
        const ln = orbitLines[i];
        const local = Math.max(0, Math.min(1, (p - i * seg) / seg));
        if (local <= 0) { ln.visible = false; ln.geometry.setDrawRange(0, 0); continue; }
        ln.visible = true;
        const e = 1 - Math.pow(1 - local, 2);   // easeOut
        ln.geometry.setDrawRange(0, Math.max(2, Math.ceil(e * ln.userData.total)));
      }
    },
    hide() { for (const ln of orbitLines) { ln.visible = false; ln.geometry.setDrawRange(0, 0); } },
  };

  // Pool d'étoiles filantes réutilisées (≈ une visible à la fois).
  const streakTex = makeStreakTexture();
  const shooters = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: streakTex, color: 0xdbe8ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.visible = false;
    root.add(m);
    shooters.push({ mesh: m, mat, active: false, t: 0, dur: 1, len: 0, vel: new THREE.Vector3() });
  }
  let nextShooter = 1.5 + rnd() * 2;   // 1ère étoile filante après ~1.5-3.5 s
  const _qx = new THREE.Vector3(1, 0, 0);

  function launchShooter(s) {
    // Départ haut dans le ciel, à distance moyenne, direction « tombante » +
    // latérale, vitesse rapide. Orientation : +X local = sens de déplacement,
    // tête lumineuse en avant (cohérent avec le dégradé de la texture).
    const dist = 700 + rnd() * 700;
    const az = rnd() * Math.PI * 2;
    const el = 0.55 + rnd() * 0.6;
    const start = new THREE.Vector3(
      Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)
    ).multiplyScalar(dist).add(new THREE.Vector3(0, 40, 0));
    const dir = new THREE.Vector3(-Math.sin(az), -0.5 - rnd() * 0.5, Math.cos(az)).normalize();
    const len = 110 + rnd() * 170;
    const speed = 650 + rnd() * 550;
    s.len = len;
    s.vel.copy(dir).multiplyScalar(speed);
    s.dur = 0.7 + rnd() * 0.8;
    s.t = 0; s.active = true;
    s.mesh.position.copy(start);
    s.mesh.scale.set(len, 2.2 + rnd() * 1.8, 1);
    s.mesh.quaternion.setFromUnitVectors(_qx, dir);
    s.mesh.visible = true;
  }

  function updateSkyTraffic(dt) {
    // satellites : avancent sur leur orbite inclinée + léger spin + glint pulsé
    for (const s of satellites) {
      s.userData.angle += s.userData.speed * dt;
      const a = s.userData.angle;
      s.position.copy(s.userData.center || SAT_CENTER)
        .addScaledVector(s.userData.ax, Math.cos(a) * s.userData.A)
        .addScaledVector(s.userData.ay, Math.sin(a) * s.userData.B);
      s.rotation.y += dt * 0.25;
      const gl = s.userData.glint;
      if (gl) gl.material.opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(a * 3.0));
    }
    // étoiles filantes : déclenchement espacé, fondu in/out, pas de clignotement
    nextShooter -= dt;
    if (nextShooter <= 0) {
      const free = shooters.find((x) => !x.active);
      if (free) launchShooter(free);
      nextShooter = 3 + rnd() * 5;   // une toutes les ~3-8 s
    }
    for (const s of shooters) {
      if (!s.active) continue;
      s.t += dt;
      const k = s.t / s.dur;
      if (k >= 1) { s.active = false; s.mesh.visible = false; s.mat.opacity = 0; continue; }
      s.mesh.position.addScaledVector(s.vel, dt);
      const fadeIn = Math.min(1, k / 0.12);
      const fadeOut = k > 0.6 ? Math.max(0, 1 - (k - 0.6) / 0.4) : 1;
      s.mat.opacity = fadeIn * fadeOut * 0.95;
    }
  }

  // Géolocalisation : place le PAYS de l'utilisateur sous l'arbre (au sommet),
  // au lieu du pôle nord. On oriente la Terre + nuages pour amener (lat,lon)
  // en haut, et on fige l'auto-rotation pour que le pays reste sous l'arbre.
  let geoLocked = false;
  function setEarthLocation(lat, lon) {
    if (floating || !earth) return;   // arbre flottant : pas de Terre-sol à orienter
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return;
    // Formule équirectangulaire standard Three.js : (lat,lon) → point sur la
    // sphère, cohérente avec le mapping UV d'une SphereGeometry texturée.
    // phi = angle polaire depuis le pôle nord (+Y), theta = longitude.
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    const d = new THREE.Vector3(
      -Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta)
    ).normalize();
    // On amène ce point au sommet (+Y), sous l'arbre, puis on fige la rotation.
    const q = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(0, 1, 0));
    earth.quaternion.copy(q);
    clouds.quaternion.copy(q);
    geoLocked = true;
  }

  // Animation des orbites (appelée chaque frame par l'orchestrateur).
  // Lente exprès : ce n'est pas un écran de veille, c'est un repère mental.
  function animateCosmos(dt) {
    if (!dt || dt > 0.5) dt = 0.016; // garde-fou (onglet en veille…)
    if (!geoLocked && earth) {        // sans géoloc, la Terre tourne lentement sur elle-même
      earth.rotation.y += dt * 0.006;
      clouds.rotation.y += dt * 0.009;
    }
    // (earthFloat est dans `planets` → déjà animée par la boucle ci-dessous)
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
    updateSkyTraffic(dt);
  }

  // ── Tronc ─────────────────────────────────────────────────────────────────
  const trunkH = 48;
  const trunkGroup = new THREE.Group();
  trunkGroup.scale.setScalar(0.0001);
  root.add(trunkGroup);
  const trunkCurve = localCurve(THREE, new THREE.Vector3(0.05, 1, 0.03), trunkH, rnd);
  if (!ezTree) {
    trunkGroup.add(new THREE.Mesh(taperedTube(THREE, trunkCurve, 3.4, 1.0, 30, 12), barkActive));
    trunkGroup.add(espLine(trunkCurve, 9));
  }
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
    if (!ezTree) {
      bGroup.add(new THREE.Mesh(taperedTube(THREE, curve, r0, r1, 16, 8), barkOf(b.state)));
      bGroup.add(espLine(curve, 6));
    }
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
    // active - c'est ce qui fait qu'on lit un arbre et non un schéma.
    if (b.state === 'active' && !ezTree) {
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
      if (!ezTree) {
        sGroup.add(new THREE.Mesh(taperedTube(THREE, sCurve, r1 * 1.1, r1 * 0.4, 10, 6), barkOf(b.state)));
        sGroup.add(espLine(sCurve, 4));
      }
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
        if (!ezTree) {
          twGroup.add(new THREE.Mesh(
            taperedTube(THREE, twCurve, r1 * 0.45, r1 * 0.16, 8, 5), barkOf(b.state)));
          twGroup.add(espLine(twCurve, 3));
        }
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

  // ── grow(age) - applique l'état de croissance ────────────────────────────
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

  return { group: root, nodes, subNodes, grow, branchGroups, addGrassBlades, animateCosmos, setEarthLocation, infoSats, orbits };
}
