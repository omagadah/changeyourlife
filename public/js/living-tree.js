// /js/living-tree.js - L'arbre vivant du tableau de bord /app/.
// Le bel arbre ez-tree (Chêne ou Frêne au choix) qui GRANDIT physiquement avec
// l'XP de l'utilisateur : jeune pousse à 0 XP -> arbre majestueux quand l'XP monte.

import * as THREE from '/vendor/three/three.module.min.js';
// Le constructeur de l'objet central (arbre OU architecture) est chargé en
// différé selon l'univers choisi (cyl_universe).

const TARGET_XP = 6000;   // XP pour atteindre l'arbre pleinement majestueux
const BRANCH_TARGET = 800; // XP pour qu'une branche Maslow soit pleinement épanouie
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Les 8 branches de Maslow (mêmes clés/couleurs/tiers que tree-model.js).
// azimuth = position angulaire autour de l'arbre · tier = étage (1 bas → 4 cime).
const BRANCHES = [
  { key: 'physio',          label: 'Physiologique',  color: 0x2dd4bf, tier: 1, azimuth: 205 },
  { key: 'securite',        label: 'Sécurité',       color: 0xfbbf24, tier: 1, azimuth:  35 },
  { key: 'appartenance',    label: 'Appartenance',   color: 0xf87171, tier: 2, azimuth: 300 },
  { key: 'estime',          label: 'Estime',         color: 0xfb923c, tier: 2, azimuth: 110 },
  { key: 'cognitif',        label: 'Cognitif',       color: 0xa78bfa, tier: 3, azimuth: 250 },
  { key: 'esthetique',      label: 'Esthétique',     color: 0xe879c7, tier: 3, azimuth: 140 },
  { key: 'accomplissement', label: 'Accomplissement',color: 0x38bdf8, tier: 4, azimuth:  20 },
  { key: 'transcendance',   label: 'Transcendance',  color: 0xc4b5fd, tier: 4, azimuth:   0 },
];
function branchXpOf(userData, key) {
  const b = userData && userData.tree && userData.tree.branches && userData.tree.branches[key];
  return (b && Number(b.xp)) || 0;
}

function totalXpFrom(userData) {
  let xp = 0;
  const lv = (userData && userData.levels) || {};
  for (const k in lv) xp += (lv[k] && lv[k].xp) || 0;
  // si le schéma `tree` existe, on prend le max des deux sources
  const br = userData && userData.tree && userData.tree.branches;
  if (br && typeof br === 'object') {
    let t = 0; for (const k in br) t += (br[k] && br[k].xp) || 0;
    xp = Math.max(xp, t);
  }
  return xp;
}

export function initLivingTree(userData) {
  const stage = document.getElementById('tree-stage');
  if (!stage) return;
  stage.innerHTML = '';

  const totalXp = totalXpFrom(userData);
  let growth = clamp01(totalXp / TARGET_XP);
  let type = (localStorage.getItem('cyl_treeType') === 'frene') ? 'frene' : 'chene';
  const universe = (localStorage.getItem('cyl_universe') === 'archi') ? 'archi' : 'arbre';
  let buildFn = null;   // (growth) => THREE.Group, défini après chargement du module

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  stage.appendChild(canvas);

  // toggle Chêne / Frêne
  const toggle = document.createElement('div');
  toggle.style.cssText = 'position:absolute;top:12px;left:12px;display:flex;gap:6px;z-index:3;';
  toggle.innerHTML =
    `<button data-t="chene">Chêne</button><button data-t="frene">Frêne</button>`;
  toggle.querySelectorAll('button').forEach((b) => {
    b.style.cssText = 'font:700 0.72rem Segoe UI,sans-serif;cursor:pointer;border-radius:99px;padding:5px 11px;' +
      'border:1px solid rgba(255,255,255,0.16);background:rgba(8,16,28,0.7);color:#cdd9ec;backdrop-filter:blur(6px);';
    if (b.dataset.t === type) { b.style.background = 'linear-gradient(135deg,#84c25e,#4a7a3a)'; b.style.color = '#06140a'; }
    b.onclick = () => { type = b.dataset.t; try { localStorage.setItem('cyl_treeType', type); } catch (_) {} buildFn = (g) => _ezMod && _ezMod.buildEzTree(type, { growth: g }); rebuild(); paintToggle(); };
  });
  function paintToggle() {
    toggle.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.t === type;
      b.style.background = on ? 'linear-gradient(135deg,#84c25e,#4a7a3a)' : 'rgba(8,16,28,0.7)';
      b.style.color = on ? '#06140a' : '#cdd9ec';
    });
  }
  if (universe === 'arbre') stage.appendChild(toggle);   // l'essence ne concerne que l'arbre

  // petite légende d'XP / stade
  const tag = document.createElement('div');
  tag.style.cssText = 'position:absolute;bottom:10px;left:12px;font:600 0.72rem Segoe UI,sans-serif;color:#8fb3a0;z-index:3;';
  stage.appendChild(tag);
  function stageName(g) {
    if (universe === 'archi') return g < 0.18 ? 'Fondations' : g < 0.55 ? 'Tour naissante' : g < 0.85 ? 'Gratte-ciel' : 'Tour majestueuse';
    return g < 0.18 ? 'Jeune pousse' : g < 0.55 ? 'Jeune arbre' : g < 0.85 ? 'Arbre mature' : 'Arbre majestueux';
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
  scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x33402e, 1.15));
  const key = new THREE.DirectionalLight(0xfff2d8, 2.0); key.position.set(40, 90, 40); scene.add(key);
  const fill = new THREE.DirectionalLight(0x88b0ff, 0.7); fill.position.set(-40, 40, -30); scene.add(fill);

  // socle translucide (le pilier-repère)
  const baseR = 30;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(baseR, baseR * 0.9, 2, 64),
    new THREE.MeshStandardMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.1, roughness: 0.3, emissive: 0x16315a, emissiveIntensity: 0.4 }));
  disc.position.y = -1; scene.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(baseR, 0.35, 10, 80),
    new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.6 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; scene.add(ring);

  // ── 8 nœuds Maslow (croissance PAR BRANCHE) ──────────────────────────────
  const nodesGroup = new THREE.Group(); scene.add(nodesGroup);
  // Squelette ESP : tronc (base) + 8 lignes vers les nœuds-catégories uniquement.
  const espMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthTest: false });
  const skeletonGroup = new THREE.Group(); skeletonGroup.renderOrder = 9; scene.add(skeletonGroup);
  function drawSkeleton() {
    while (skeletonGroup.children.length) { const c = skeletonGroup.children.pop(); if (c.geometry) c.geometry.dispose(); }
    const pts = [0, 0, 0, 0, treeH * 0.82, 0];   // tronc (base)
    nodeMap.forEach((n) => {
      const p = n.core.position;
      const hubY = Math.min(treeH * 0.5, Math.max(treeH * 0.15, p.y * 0.45));
      pts.push(0, hubY, 0, p.x, p.y, p.z);        // branche-catégorie : tronc -> nœud
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    skeletonGroup.add(new THREE.LineSegments(g, espMat));
  }
  const ballGeo = new THREE.SphereGeometry(1, 18, 14);
  const nodeMap = new Map();   // key → { core, halo, def, xp }
  const nodeMeshes = [];       // pour le raycaster
  let treeH = 60, treeR = 30;  // dimensions courantes de l'objet central

  function nodeGrowth(xp) { return clamp01(xp / BRANCH_TARGET); }
  // rayon visible du cœur d'un nœud selon l'XP de sa branche (dormant → épanoui)
  function nodeRadius(xp) { return 1.5 + nodeGrowth(xp) * 4.2; }

  function buildNodes() {
    BRANCHES.forEach((def, i) => {
      const xp = branchXpOf(userData, def.key);
      const dormant = xp <= 0;
      const col = dormant ? 0x5d6677 : def.color;
      const core = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: dormant ? 0.5 : 0.95 }));
      const halo = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: dormant ? 0.12 : 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(2.3); core.add(halo);
      core.userData = { key: def.key, label: def.label };
      nodesGroup.add(core);
      nodeMap.set(def.key, { core, halo, def, xp, phase: i * 0.7 });
      nodeMeshes.push(core);
    });
    layoutNodes();
  }

  // Positionne et dimensionne les nœuds autour de l'objet central courant.
  function layoutNodes() {
    const ringR = Math.max(treeR * 0.92, 20) + 6;
    nodeMap.forEach(({ core, def, xp }) => {
      const ang = (def.azimuth * Math.PI) / 180;
      const tierFrac = (def.tier - 1) / 3;                 // 0 (base) → 1 (cime)
      const y = treeH * (0.18 + tierFrac * 0.74);
      core.position.set(Math.cos(ang) * ringR, y, Math.sin(ang) * ringR);
      core.scale.setScalar(nodeRadius(xp));
    });
    drawSkeleton();   // squelette tronc + 8 branches-catégories épouse la taille courante
  }

  // Animation d'apparition / de croissance d'un nœud (scale élastique).
  function animateNode(key, fromR, toR) {
    const n = nodeMap.get(key); if (!n) return;
    const t0 = performance.now ? performance.now() : 0, D = 650;
    const tick = () => {
      const e = Math.min(1, ((performance.now ? performance.now() : D) - t0) / D);
      const k = 1 - Math.pow(1 - e, 3);
      n.core.scale.setScalar(fromR + (toR - fromR) * k);
      if (e < 1) requestAnimationFrame(tick);
    };
    tick();
  }

  let tree = null;
  const target = new THREE.Vector3(0, 40, 0);
  function rebuild() {
    if (!buildFn) return;
    if (tree) { scene.remove(tree); tree.traverse((o) => o.geometry?.dispose?.()); tree = null; }
    try {
      tree = buildFn(growth);
      tree.scale.setScalar(1.0);
      const b = new THREE.Box3().setFromObject(tree);
      tree.position.x -= (b.min.x + b.max.x) / 2;
      tree.position.z -= (b.min.z + b.max.z) / 2;
      tree.position.y -= b.min.y;
      scene.add(tree);
      const b2 = new THREE.Box3().setFromObject(tree);
      treeH = b2.max.y - b2.min.y;
      treeR = Math.max(b2.max.x - b2.min.x, b2.max.z - b2.min.z) / 2;
      target.y = treeH * 0.5;
      st.r = treeH * 1.5 + 30; st.tr = st.r;
      tag.textContent = `${stageName(growth)} · ${totalXp.toLocaleString('fr-FR')} XP`;
      layoutNodes();   // les nœuds Maslow épousent la taille courante de l'arbre
    } catch (e) { console.error('[living-tree] build failed', e); }
  }

  // caméra orbitale (360 + par-dessus, jamais sous le socle)
  const st = { az: 0.6, po: 1.05, r: 150, taz: 0.6, tpo: 1.05, tr: 150 };
  const MIN_PO = 0.06, MAX_PO = 1.48, MIN_R = 30, MAX_R = 600;
  let drag = false, moved = false, px = 0, py = 0;
  canvas.addEventListener('pointerdown', (e) => { drag = true; moved = false; px = e.clientX; py = e.clientY; });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return; const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    const SENS = (Math.PI * 0.8) / Math.max(stage.clientWidth, 320);
    st.taz -= dx * SENS; st.tpo = Math.min(MAX_PO, Math.max(MIN_PO, st.tpo - dy * SENS * 0.85));
  });
  addEventListener('pointerup', () => { drag = false; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); st.tr = Math.min(MAX_R, Math.max(MIN_R, st.tr + e.deltaY * 0.0009 * st.tr)); }, { passive: false });

  // ── Interaction nœuds Maslow : survol (tooltip) + clic (page de branche) ──
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;
  const tip = document.createElement('div');
  tip.style.cssText = 'position:absolute;pointer-events:none;z-index:5;display:none;padding:6px 11px;border-radius:10px;' +
    'background:rgba(8,16,28,0.92);border:1px solid rgba(255,255,255,0.16);color:#e5eef8;font:600 0.76rem Segoe UI,sans-serif;' +
    'backdrop-filter:blur(6px);white-space:nowrap;transform:translate(-50%,-130%);box-shadow:0 8px 24px rgba(0,0,0,0.4);';
  stage.appendChild(tip);
  function pickNode(e) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(nodeMeshes, false)[0];
    return hit ? hit.object : null;
  }
  canvas.addEventListener('pointermove', (e) => {
    if (drag) return;
    const obj = pickNode(e);
    canvas.style.cursor = obj ? 'pointer' : '';
    hovered = obj ? obj.userData.key : null;
    if (obj) {
      const n = nodeMap.get(obj.userData.key);
      const lvl = Math.round(nodeGrowth(n.xp) * 100);
      tip.textContent = `${obj.userData.label} · ${n.xp.toLocaleString('fr-FR')} XP · ${lvl}%`;
      tip.style.left = (e.clientX - canvas.getBoundingClientRect().left) + 'px';
      tip.style.top = (e.clientY - canvas.getBoundingClientRect().top) + 'px';
      tip.style.display = 'block';
    } else { tip.style.display = 'none'; }
  });
  canvas.addEventListener('pointerleave', () => { tip.style.display = 'none'; canvas.style.cursor = ''; });
  canvas.addEventListener('pointerup', (e) => {
    if (moved) return;
    const obj = pickNode(e);
    if (obj) { try { window.location.href = '/' + obj.userData.key + '/'; } catch (_) {} }
  });

  let lastW = 0, lastH = 0;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h || (w === lastW && h === lastH)) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    lastW = w; lastH = h;
  }

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(0.1, clock.getDelta());
    if (!drag) st.taz += dt * 0.06;
    st.az += (st.taz - st.az) * 0.07; st.po += (st.tpo - st.po) * 0.08; st.r += (st.tr - st.r) * 0.08;
    const sp = Math.sin(st.po), cp = Math.cos(st.po);
    camera.position.set(target.x + st.r * sp * Math.sin(st.az), target.y + st.r * cp, target.z + st.r * sp * Math.cos(st.az));
    camera.lookAt(target);
    // pulse doux des nœuds actifs (halo qui respire ; plus fort au survol)
    const tEl = clock.elapsedTime;
    nodeMap.forEach((n, key) => {
      if (n.xp <= 0) return;
      const base = 2.3 + Math.sin(tEl * 2 + n.phase) * 0.16;
      n.halo.scale.setScalar(key === hovered ? base + 0.6 : base);
    });
    resize();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  // Chargement différé du bon univers, puis première construction.
  let _ezMod = null;
  (async () => {
    try {
      if (universe === 'archi') {
        const m = await import('/js/archi-build.js');
        buildFn = (g) => m.buildArchi(THREE, { growth: g });
      } else {
        _ezMod = await import('/js/ez-tree-build.js');
        buildFn = (g) => _ezMod.buildEzTree(type, { growth: g });
      }
      rebuild();
    } catch (e) { console.error('[living-tree] load failed', e); }
  })();
  buildNodes();   // les 8 nœuds Maslow apparaissent immédiatement (indépendants du chargement de l'arbre)
  resize();
  frame();

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(stage);
  window.addEventListener('resize', resize);

  // Croissance PAR BRANCHE en temps réel : awardXp() émet cyl:xp-gained -> le nœud
  // concerné grossit (et s'allume s'il était dormant), sans recharger la page.
  function onXpGained(ev) {
    const d = ev.detail || {}; const n = nodeMap.get(d.branch); if (!n) return;
    const fromR = nodeRadius(n.xp);
    n.xp += Number(d.amount) || 0;
    if (n.xp > 0) {
      n.core.material.color.setHex(n.def.color); n.core.material.opacity = 0.95;
      n.halo.material.color.setHex(n.def.color); n.halo.material.opacity = 0.3;
    }
    animateNode(d.branch, fromR, nodeRadius(n.xp));
  }
  document.addEventListener('cyl:xp-gained', onXpGained);

  // permet de mettre à jour la croissance quand l'XP change (sans recharger)
  return {
    setXp(newXp) { growth = clamp01(newXp / TARGET_XP); rebuild(); },
  };
}
