// /js/arbre3d.js — Landing /arbre/ : arbre de vie procédural maison + Lya.
// Cf. docs/VISION.md, docs/ARCHITECTURE.md.
//
// v3 — arbre 100 % procédural (plus d'EZ-Tree). Le corps organique ET
// l'exosquelette ESP sont générés depuis le même graphe (tree-model.js)
// → l'exosquelette colle parfaitement aux branches, par construction.

import * as THREE from '/vendor/three/three.module.min.js';
import { createDemoModel, buildTree } from '/js/tree-model.js';

const ORBIT_TARGET = new THREE.Vector3(0, 26, 0);

// ── Scène ───────────────────────────────────────────────────────────────────
function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.7;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    40, canvas.clientWidth / canvas.clientHeight, 0.1, 600);

  scene.add(new THREE.HemisphereLight(0x9ecaff, 0x070e1a, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(24, 46, 30);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x4a90e2, 0.7);
  fill.position.set(-30, 22, -16);
  scene.add(fill);

  const { group, nodes } = buildTree(THREE, createDemoModel());
  scene.add(group);

  return { renderer, scene, camera, treeGroup: group, nodes };
}

// ── Contrôles : orbite (glisser) + zoom borné (molette) ─────────────────────
function initControls(canvas, camera) {
  const s = {
    azimuth: 0.6, polar: 1.06, radius: 78,
    tAz: 0.6, tPo: 1.06, tR: 78,
    minR: 46, maxR: 122, minPo: 0.6, maxPo: 1.42,
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
    s.tAz -= dx * 0.006;
    s.tPo = Math.min(s.maxPo, Math.max(s.minPo, s.tPo - dy * 0.005));
  });
  const end = (e) => {
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    s.tR = Math.min(s.maxR, Math.max(s.minR, s.tR + e.deltaY * 0.05));
  }, { passive: false });

  return {
    apply() {
      s.azimuth += (s.tAz - s.azimuth) * 0.12;
      s.polar += (s.tPo - s.polar) * 0.12;
      s.radius += (s.tR - s.radius) * 0.12;
      const sp = Math.sin(s.polar), cp = Math.cos(s.polar);
      camera.position.set(
        ORBIT_TARGET.x + s.radius * sp * Math.sin(s.azimuth),
        ORBIT_TARGET.y + s.radius * cp,
        ORBIT_TARGET.z + s.radius * sp * Math.cos(s.azimuth)
      );
      camera.lookAt(ORBIT_TARGET);
    },
    wasDrag: () => moved,
  };
}

// ── Labels HTML projetés (style ESP) ────────────────────────────────────────
function initLabels(nodes) {
  const css = document.createElement('style');
  css.textContent = `
    .esp-labels{position:absolute;inset:0;pointer-events:none;z-index:1;}
    .esp-label{position:absolute;transform:translate(-50%,-50%);
      font:600 11px -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.6px;
      text-transform:uppercase;white-space:nowrap;padding:2px 8px;border-radius:6px;
      background:rgba(6,14,26,0.72);border:1px solid rgba(255,255,255,0.14);
      transition:opacity .2s;}
  `;
  document.head.appendChild(css);
  const wrap = document.createElement('div');
  wrap.className = 'esp-labels';
  document.querySelector('.scene')?.appendChild(wrap);

  const labels = nodes.map((m) => {
    const el = document.createElement('div');
    el.className = 'esp-label';
    el.textContent = m.userData.label;
    el.style.color = '#' + m.userData.color.toString(16).padStart(6, '0');
    if (m.userData.state === 'dormant') el.style.opacity = '0.5';
    wrap.appendChild(el);
    return { el, mesh: m };
  });
  const v = new THREE.Vector3();
  return (camera, canvas) => {
    for (const { el, mesh } of labels) {
      mesh.getWorldPosition(v).project(camera);
      if (v.z > 1) { el.style.visibility = 'hidden'; continue; }
      el.style.visibility = 'visible';
      el.style.left = ((v.x * 0.5 + 0.5) * canvas.clientWidth) + 'px';
      el.style.top = ((-v.y * 0.5 + 0.5) * canvas.clientHeight - 24) + 'px';
    }
  };
}

// ── Lya ─────────────────────────────────────────────────────────────────────
const LYA_LINES = [
  'Bonjour. Je m’appelle Lya.',
  'Cet arbre, c’est toi. Chaque branche est une dimension de ta vie.',
  'Tourne-le, approche. Touche une branche pour l’explorer.',
];
let lyaSay = null;

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

// ── Init 3D ─────────────────────────────────────────────────────────────────
function initTree3D(canvas) {
  const { renderer, scene, camera, treeGroup, nodes } = initScene(canvas);
  const controls = initControls(canvas, camera);
  const updateLabels = initLabels(nodes);

  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let selected = null;
  canvas.addEventListener('pointerup', (e) => {
    if (controls.wasDrag()) return;
    mouse.x = (e.clientX / canvas.clientWidth) * 2 - 1;
    mouse.y = -(e.clientY / canvas.clientHeight) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(nodes, false)[0];
    if (hit) {
      if (selected) selected.scale.setScalar(selected.userData.baseR);
      selected = hit.object;
      selected.scale.setScalar(selected.userData.baseR * 1.5);
      const u = selected.userData;
      if (lyaSay) {
        lyaSay(u.state === 'dormant'
          ? `${u.label} — cette branche dort encore. Elle s’éveillera quand tu la nourriras.`
          : `${u.label} — bientôt, tu pourras entrer dans cette dimension.`);
      }
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
    treeGroup.rotation.z = Math.sin(t * 0.32) * 0.022; // balancement doux
    for (const m of nodes) {
      if (m !== selected) {
        m.scale.setScalar(m.userData.baseR * (1 + Math.sin(t * 2 + m.position.y) * 0.09));
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
