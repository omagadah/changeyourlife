// /js/arbre3d.js — Page d'accueil : arbre de vie procédural + croissance + Lya.
// Cf. docs/VISION.md, docs/ARCHITECTURE.md.
//
// v5 — la caméra suit la pousse (dézoom progressif pour cadrer l'arbre entier),
// compteur XP qui grimpe avec la croissance, et pop-ups « tâche accomplie »
// qui illustrent : action → XP → l'arbre grandit.

import * as THREE from '/vendor/three/three.module.min.js';
import { createDemoModel, buildTree } from '/js/tree-model.js';

const ORBIT_TARGET = new THREE.Vector3(0, 32, 0);
const GROWTH_SECONDS = 9;
const TOTAL_XP = 24800;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

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
    42, canvas.clientWidth / canvas.clientHeight, 0.1, 800);

  scene.add(new THREE.HemisphereLight(0x9ecaff, 0x070e1a, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(26, 56, 32);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x4a90e2, 0.7);
  fill.position.set(-32, 26, -18);
  scene.add(fill);

  const { group, nodes, grow } = buildTree(THREE, createDemoModel());
  scene.add(group);

  return { renderer, scene, camera, treeGroup: group, nodes, grow };
}

// ── Contrôles : orbite (glisser) + zoom borné (molette) ─────────────────────
function initControls(canvas, camera) {
  const s = {
    azimuth: 0.5, polar: 1.05, radius: 82,
    tAz: 0.5, tPo: 1.05, tR: 82,
    minR: 48, maxR: 155, minPo: 0.55, maxPo: 1.45,
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

// Caméra cinématique pendant la pousse : part près du sapling, dézoome pour
// cadrer l'arbre entier. Finit EXACTEMENT sur la position des contrôles.
function growthCamera(camera, age) {
  const e = easeOut(age);
  const targetY = 10 + e * 22;          // 10 → 32 (= ORBIT_TARGET.y)
  const radius = 54 + e * 28;           // 54 → 82 (= contrôles.radius)
  const az = 0.5, polar = 1.05;
  const sp = Math.sin(polar), cp = Math.cos(polar);
  camera.position.set(
    radius * sp * Math.sin(az),
    targetY + radius * cp,
    radius * sp * Math.cos(az));
  camera.lookAt(0, targetY, 0);
}

// ── HUD : compteur XP + stade + pop-ups « tâche accomplie » ─────────────────
const BEATS = [
  { at: 0.28, icon: '🧘', task: 'Méditation du matin', xp: '+180 XP' },
  { at: 0.52, icon: '🎯', task: 'Objectif atteint', xp: '+420 XP' },
  { at: 0.76, icon: '😴', task: 'Nuit réparatrice', xp: '+150 XP' },
];
function initHud() {
  const xpEl = document.getElementById('xp-value');
  const stageEl = document.getElementById('xp-stage');
  const hud = document.getElementById('hud');
  const pop = document.getElementById('task-pop');
  const fired = BEATS.map(() => false);

  function updateXp(age) {
    if (xpEl) xpEl.textContent = Math.round(easeOut(age) * TOTAL_XP).toLocaleString('fr-FR');
    if (stageEl) {
      stageEl.textContent = age < 0.12 ? 'Sapling'
        : age < 0.42 ? 'Jeune arbre'
        : age < 0.78 ? 'Arbre mature' : 'Arbre centenaire';
    }
  }
  function showBeat(b) {
    if (!pop) return;
    pop.querySelector('.task-icon').textContent = b.icon;
    pop.querySelector('.task-name').textContent = b.task;
    pop.querySelector('.task-xp').textContent = b.xp;
    pop.classList.remove('validated');
    pop.classList.add('show');
    if (hud) { hud.classList.remove('flash'); void hud.offsetWidth; hud.classList.add('flash'); }
    setTimeout(() => pop.classList.add('validated'), 1500);
    setTimeout(() => pop.classList.remove('show'), 2800);
  }
  function checkBeats(age) {
    for (let i = 0; i < BEATS.length; i++) {
      if (!fired[i] && age >= BEATS[i].at) { fired[i] = true; showBeat(BEATS[i]); }
    }
  }
  return { updateXp, checkBeats };
}

// ── Labels HTML projetés (style ESP) ────────────────────────────────────────
function initLabels(nodes) {
  const css = document.createElement('style');
  css.textContent = `
    .esp-labels{position:absolute;inset:0;pointer-events:none;z-index:2;
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
  'Regarde — chaque chose que tu accomplis fait grandir ton arbre.',
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
  const beats = [400, 3600, GROWTH_SECONDS * 1000 + 300];
  LYA_LINES.forEach((text, i) => {
    setTimeout(() => { if (lineEl) { typeLine(lineEl, text); speak(text, voiceOn); } }, beats[i]);
  });
  lyaSay = (text) => { if (lineEl) { typeLine(lineEl, text); speak(text, voiceOn); } };
}

// ── Init 3D ─────────────────────────────────────────────────────────────────
function initTree3D(canvas) {
  const { renderer, scene, camera, treeGroup, nodes, grow } = initScene(canvas);
  const controls = initControls(canvas, camera);
  const labels = initLabels(nodes);
  const hud = initHud();

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
      growthCamera(camera, age);   // la caméra suit la pousse
      hud.updateXp(age);
      hud.checkBeats(age);
      if (age >= 1) { grown = true; labels.reveal(); }
    } else {
      treeGroup.rotation.z = Math.sin(t * 0.32) * 0.018;
      for (const m of nodes) {
        if (m !== selected) {
          m.scale.setScalar(m.userData.baseR * (1 + Math.sin(t * 2 + m.position.y) * 0.09));
        }
      }
      controls.apply();
      labels.update(camera, canvas);
    }

    maybeResize();
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
