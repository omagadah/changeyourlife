// /js/arbre3d.js — Arbre 3D EZ-Tree + exosquelette ESP + Lya. Landing CYL.
// Cf. docs/VISION.md, docs/ARCHITECTURE.md.
//
// v2 — ajoute :
//   - contrôles : glisser pour orbiter, molette pour zoomer (bornés/cadrés)
//   - feuillage EZ-Tree réduit (on veut voir la structure)
//   - exosquelette ESP : lignes blanches + nœuds lumineux sur les
//     embranchements (1 nœud = 1 dimension CYL), style « bone ESP »,
//     visibles à travers le feuillage, cliquables.

import * as THREE from 'three';
import { Tree } from '@dgreenheck/ez-tree';

// ── Les 7 dimensions = les 7 nœuds de l'exosquelette ────────────────────────
// pos = position 3D du nœud · attach = hauteur d'accroche sur le tronc.
const NODES = [
  { key: 'corps',     label: 'Corps',     color: 0x2dd4bf, pos: [-26, 30, 10], attach: 19 },
  { key: 'mental',    label: 'Mental',    color: 0xa78bfa, pos: [ 24, 35, -6], attach: 22 },
  { key: 'relations', label: 'Relations', color: 0xf87171, pos: [-30, 39, -14], attach: 25 },
  { key: 'finances',  label: 'Finances',  color: 0xfbbf24, pos: [ 30, 27,  16], attach: 20 },
  { key: 'sens',      label: 'Sens',      color: 0x38bdf8, pos: [-14, 46,  20], attach: 28 },
  { key: 'creation',  label: 'Création',  color: 0xfb923c, pos: [ 16, 44, -22], attach: 30 },
  { key: 'heritage',  label: 'Héritage',  color: 0x94a3b8, pos: [  2, 50,  -2], attach: 33 },
];
const TRUNK_BASE = [0, 1, 0];
const ORBIT_TARGET = new THREE.Vector3(0, 26, 0);

// ── Scène Three.js ──────────────────────────────────────────────────────────
function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.8;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    38, canvas.clientWidth / canvas.clientHeight, 0.1, 600);

  scene.add(new THREE.HemisphereLight(0x9ecaff, 0x070e1a, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(20, 40, 30);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x4a90e2, 0.7);
  fill.position.set(-30, 20, -10);
  scene.add(fill);

  // ── Arbre EZ-Tree (graine fixe → rendu stable ; feuillage réduit) ─────────
  const tree = new Tree();
  tree.loadPreset('Oak Medium');
  try {
    if (tree.options) {
      if ('seed' in tree.options) tree.options.seed = 1337;
      if (tree.options.leaves && typeof tree.options.leaves.count === 'number') {
        tree.options.leaves.count = Math.round(tree.options.leaves.count * 0.4);
      }
      tree.generate();
    }
  } catch (e) { console.warn('[arbre3d] tweak options échoué', e); }
  tree.position.y = -2;
  scene.add(tree);

  return { renderer, scene, camera, tree };
}

// ── Exosquelette ESP : lignes + nœuds lumineux ──────────────────────────────
function buildEsp(scene) {
  const group = new THREE.Group();
  const nodeMeshes = [];

  // matériaux ESP : non éclairés, dessinés PAR-DESSUS le feuillage (X-ray)
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.55, depthTest: false,
  });
  const segs = [];
  const addSeg = (a, b) => segs.push(a[0], a[1], a[2], b[0], b[1], b[2]);

  // tronc
  const trunkTop = [0, NODES[0].attach - 2, 0];
  addSeg(TRUNK_BASE, trunkTop);

  // une petite sphère lumineuse réutilisable
  const ballGeo = new THREE.SphereGeometry(1, 16, 12);

  function makeNode(pos, color, radius, key, label) {
    const core = new THREE.Mesh(
      ballGeo,
      new THREE.MeshBasicMaterial({ color, depthTest: false })
    );
    core.scale.setScalar(radius);
    core.position.set(pos[0], pos[1], pos[2]);
    core.renderOrder = 10;
    // halo additif
    const halo = new THREE.Mesh(
      ballGeo,
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthTest: false,
      })
    );
    halo.scale.setScalar(radius * 2.6);
    halo.position.copy(core.position);
    halo.renderOrder = 9;
    group.add(halo, core);
    if (key) {
      core.userData = { key, label, color, baseR: radius };
      nodeMeshes.push(core);
    }
    return core;
  }

  // nœud racine (tronc)
  makeNode(TRUNK_BASE, 0x9ecaff, 1.5);

  // 7 branches + nœuds + 1 rejet chacune
  for (const n of NODES) {
    const from = [0, n.attach, 0];
    addSeg(from, n.pos);
    makeNode(n.pos, n.color, 1.9, n.key, n.label);

    // rejet : petite ramille au milieu de la branche, avec une bille
    const mid = [
      (from[0] + n.pos[0]) / 2,
      (from[1] + n.pos[1]) / 2,
      (from[2] + n.pos[2]) / 2,
    ];
    const off = [mid[0] + (n.pos[2] - from[2]) * 0.18,
                 mid[1] + 4,
                 mid[2] - (n.pos[0] - from[0]) * 0.18];
    addSeg(mid, off);
    makeNode(off, n.color, 0.7);
  }

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.renderOrder = 8;
  group.add(lines);

  scene.add(group);
  return { group, nodeMeshes };
}

// ── Contrôles : orbite (glisser) + zoom borné (molette) ─────────────────────
function initControls(canvas, camera) {
  const state = {
    azimuth: 0.5, polar: 1.04, radius: 88,
    tAzimuth: 0.5, tPolar: 1.04, tRadius: 88,
    minR: 52, maxR: 130, minPolar: 0.62, maxPolar: 1.4,
  };
  let dragging = false, moved = false, px = 0, py = 0;

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = false; px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    px = e.clientX; py = e.clientY;
    state.tAzimuth -= dx * 0.006;
    state.tPolar = Math.min(state.maxPolar,
      Math.max(state.minPolar, state.tPolar - dy * 0.005));
  });
  const endDrag = (e) => {
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.tRadius = Math.min(state.maxR,
      Math.max(state.minR, state.tRadius + e.deltaY * 0.06));
  }, { passive: false });

  function apply() {
    // amortissement
    state.azimuth += (state.tAzimuth - state.azimuth) * 0.12;
    state.polar   += (state.tPolar   - state.polar)   * 0.12;
    state.radius  += (state.tRadius  - state.radius)  * 0.12;
    const sp = Math.sin(state.polar), cp = Math.cos(state.polar);
    camera.position.set(
      ORBIT_TARGET.x + state.radius * sp * Math.sin(state.azimuth),
      ORBIT_TARGET.y + state.radius * cp,
      ORBIT_TARGET.z + state.radius * sp * Math.cos(state.azimuth)
    );
    camera.lookAt(ORBIT_TARGET);
  }
  return { apply, wasDrag: () => moved };
}

// ── Labels HTML projetés (style ESP) ────────────────────────────────────────
function initLabels(nodeMeshes) {
  const css = document.createElement('style');
  css.textContent = `
    .esp-labels{position:absolute;inset:0;pointer-events:none;z-index:1;}
    .esp-label{position:absolute;transform:translate(-50%,-50%);
      font:600 11px -apple-system,Segoe UI,Roboto,sans-serif;
      letter-spacing:.6px;text-transform:uppercase;white-space:nowrap;
      padding:2px 8px;border-radius:6px;background:rgba(6,14,26,0.7);
      border:1px solid rgba(255,255,255,0.14);}
  `;
  document.head.appendChild(css);
  const wrap = document.createElement('div');
  wrap.className = 'esp-labels';
  document.querySelector('.scene')?.appendChild(wrap);

  const labels = nodeMeshes
    .filter((m) => m.userData.label)
    .map((m) => {
      const el = document.createElement('div');
      el.className = 'esp-label';
      el.textContent = m.userData.label;
      el.style.color = '#' + m.userData.color.toString(16).padStart(6, '0');
      wrap.appendChild(el);
      return { el, mesh: m };
    });

  const v = new THREE.Vector3();
  return function update(camera, canvas) {
    for (const { el, mesh } of labels) {
      v.copy(mesh.position).project(camera);
      if (v.z > 1) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.left = ((v.x * 0.5 + 0.5) * canvas.clientWidth) + 'px';
      el.style.top = ((-v.y * 0.5 + 0.5) * canvas.clientHeight - 22) + 'px';
    }
  };
}

// ── Lya — présence + parole ─────────────────────────────────────────────────
const LYA_LINES = [
  'Bonjour. Je m’appelle Lya.',
  'Cet arbre, c’est toi. Chaque nœud est une dimension de ta vie.',
  'Tourne-le, approche. Touche un nœud pour l’explorer.',
];
let lyaSay = null; // remplaçable pour parler au clic

function typeLine(el, text, done) {
  el.textContent = '';
  let i = 0;
  const tick = () => {
    if (i <= text.length) { el.textContent = text.slice(0, i++); setTimeout(tick, 26 + Math.random() * 30); }
    else if (done) done();
  };
  tick();
}
function speak(text, on) {
  if (!on || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR'; u.rate = 0.96; u.pitch = 1.05;
    const fr = speechSynthesis.getVoices().find((x) => x.lang.startsWith('fr'));
    if (fr) u.voice = fr;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}
function initLya() {
  const lineEl = document.getElementById('lya-line');
  const voiceBtn = document.getElementById('lya-voice');
  let voiceOn = false;
  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      voiceOn = !voiceOn;
      voiceBtn.classList.toggle('on', voiceOn);
      voiceBtn.setAttribute('aria-pressed', String(voiceOn));
      voiceBtn.textContent = voiceOn ? '🔊 Voix de Lya' : '🔇 Voix de Lya';
      if (voiceOn && lineEl) speak(lineEl.textContent, true);
    });
  }
  let idx = 0;
  const next = () => {
    if (!lineEl || idx >= LYA_LINES.length) return;
    const text = LYA_LINES[idx++];
    typeLine(lineEl, text, () => setTimeout(next, 1900));
    speak(text, voiceOn);
  };
  if (lineEl) setTimeout(next, 1100);
  lyaSay = (text) => { if (lineEl) { typeLine(lineEl, text); speak(text, voiceOn); } };
}

// ── Init ────────────────────────────────────────────────────────────────────
function initTree3D(canvas) {
  const { renderer, scene, camera, tree } = initScene(canvas);
  const { nodeMeshes } = buildEsp(scene);
  const controls = initControls(canvas, camera);
  const updateLabels = initLabels(nodeMeshes);

  // clic sur un nœud
  const ray = new THREE.Raycaster();
  ray.params.Points = { threshold: 3 };
  const mouse = new THREE.Vector2();
  let selected = null;
  canvas.addEventListener('pointerup', (e) => {
    if (controls.wasDrag()) return; // c'était un glisser, pas un clic
    mouse.x = (e.clientX / canvas.clientWidth) * 2 - 1;
    mouse.y = -(e.clientY / canvas.clientHeight) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(nodeMeshes, false)[0];
    if (hit) {
      if (selected) selected.scale.setScalar(selected.userData.baseR);
      selected = hit.object;
      selected.scale.setScalar(selected.userData.baseR * 1.5);
      if (lyaSay) lyaSay(`${selected.userData.label} — bientôt, tu pourras entrer ici.`);
    }
  });

  let lastW = 0, lastH = 0;
  function maybeResize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w !== lastW || h !== lastH) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      lastW = w; lastH = h;
    }
  }

  const clock = new THREE.Clock();
  function animate() {
    const t = clock.getElapsedTime();
    if (tree && typeof tree.update === 'function') tree.update(t); // vent feuilles
    // pulsation des nœuds
    for (const m of nodeMeshes) {
      if (m !== selected) {
        const p = m.userData.baseR * (1 + Math.sin(t * 2 + m.position.y) * 0.08);
        m.scale.setScalar(p);
      }
    }
    maybeResize();
    controls.apply();
    updateLabels(camera, canvas);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

function init() {
  const canvas = document.getElementById('arbre-canvas');
  if (canvas) {
    try { initTree3D(canvas); }
    catch (e) { console.error('[arbre3d] init failed', e); }
  }
  initLya();
  document.body.classList.add('tree-ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
