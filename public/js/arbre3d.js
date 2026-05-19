// /js/arbre3d.js — Landing /arbre/ : arbre de vie procédural + croissance + Lya.
// Cf. docs/VISION.md, docs/ARCHITECTURE.md.
//
// v4 — l'arbre POUSSE sous les yeux : sapling → arbre centenaire, tier par
// tier (fondations d'abord, cime en dernier). Animation pilotée par grow(age).

import * as THREE from '/vendor/three/three.module.min.js';
import { createDemoModel, buildTree } from '/js/tree-model.js';

const ORBIT_TARGET = new THREE.Vector3(0, 34, 0);
const GROWTH_SECONDS = 8;

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
    42, canvas.clientWidth / canvas.clientHeight, 0.1, 700);

  scene.add(new THREE.HemisphereLight(0x9ecaff, 0x070e1a, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(26, 52, 32);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x4a90e2, 0.7);
  fill.position.set(-32, 24, -18);
  scene.add(fill);

  const { group, nodes, grow } = buildTree(THREE, createDemoModel());
  scene.add(group);

  return { renderer, scene, camera, treeGroup: group, nodes, grow };
}

// ── Contrôles : orbite (glisser) + zoom borné (molette) ─────────────────────
function initControls(canvas, camera) {
  const s = {
    azimuth: 0.6, polar: 1.04, radius: 96,
    tAz: 0.6, tPo: 1.04, tR: 96,
    minR: 52, maxR: 145, minPo: 0.58, maxPo: 1.44,
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
        ORBIT_TARGET.z + s.radius * sp * Math.cos(s.azimuth));
      camera.lookAt(ORBIT_TARGET);
    },
    wasDrag: () => moved,
  };
}

// ── Labels HTML projetés (style ESP) ────────────────────────────────────────
function initLabels(nodes) {
  const css = document.createElement('style');
  css.textContent = `
    .esp-labels{position:absolute;inset:0;pointer-events:none;z-index:1;
      opacity:0;transition:opacity .8s;}
    .esp-labels.on{opacity:1;}
    .esp-label{position:absolute;transform:translate(-50%,-50%);
      font:600 11px -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.6px;
      text-transform:uppercase;white-space:nowrap;padding:2px 8px;border-radius:6px;
      background:rgba(6,14,26,0.72);border:1px solid rgba(255,255,255,0.14);}
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
    if (m.userData.state === 'dormant') el.style.opacity = '0.55';
    wrap.appendChild(el);
    return { el, mesh: m };
  });
  const v = new THREE.Vector3();
  return {
    reveal: () => wrap.classList.add('on'),
    update(camera, canvas) {
      for (const { el, mesh } of labels) {
        mesh.getWorldPosition(v).project(camera);
        if (v.z > 1) { el.style.visibility = 'hidden'; continue; }
        el.style.visibility = 'visible';
        el.style.left = ((v.x * 0.5 + 0.5) * canvas.clientWidth) + 'px';
        el.style.top = ((-v.y * 0.5 + 0.5) * canvas.clientHeight - 24) + 'px';
      }
    },
  };
}

// ── Lya ─────────────────────────────────────────────────────────────────────
const LYA_LINES = [
  'Bonjour. Je m’appelle Lya.',
  'Regarde — ton arbre pousse. Chaque branche est une dimension de ta vie.',
  'Le voilà adulte. Tourne-le, touche une branche pour l’explorer.',
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
  // les 3 répliques rythmées sur la croissance (~8 s)
  const beats = [400, 3200, GROWTH_SECONDS * 1000 + 200];
  LYA_LINES.forEach((text, i) => {
    setTimeout(() => {
      if (lineEl) { typeLine(lineEl, text); speak(text, voiceOn); }
    }, beats[i]);
  });
  lyaSay = (text) => { if (lineEl) { typeLine(lineEl, text); speak(text, voiceOn); } };
}

// ── Init 3D ─────────────────────────────────────────────────────────────────
function initTree3D(canvas) {
  const { renderer, scene, camera, treeGroup, nodes, grow } = initScene(canvas);
  const controls = initControls(canvas, camera);
  const labels = initLabels(nodes);

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
          ? `${u.label} — cette branche dort encore. Nourris-la pour l’éveiller.`
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
  let grown = false;
  function animate() {
    const t = clock.getElapsedTime();
    const age = Math.min(1, t / GROWTH_SECONDS);

    if (!grown) {
      grow(age);
      if (age >= 1) { grown = true; labels.reveal(); }
    } else {
      // arbre adulte : balancement doux + pulsation des nœuds
      treeGroup.rotation.z = Math.sin(t * 0.32) * 0.018;
      for (const m of nodes) {
        if (m !== selected) {
          m.scale.setScalar(m.userData.baseR * (1 + Math.sin(t * 2 + m.position.y) * 0.09));
        }
      }
    }

    maybeResize();
    controls.apply();
    if (grown) labels.update(camera, canvas);
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
