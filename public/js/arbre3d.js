// /js/arbre3d.js — Arbre 3D EZ-Tree + Lya. Landing CYL Phase 1.x.
// Remplace arbre.svg.legacy.js. Cf. docs/ARBRE-3D-RECHERCHE.md.
//
// Stack :
//   - three (self-hosté, /vendor/three/three.module.min.js)
//   - @dgreenheck/ez-tree (self-hosté, /vendor/ez-tree/ez-tree.es.js)
//   - Résolution via importmap dans /arbre/index.html
//
// Choix de conception :
//   - Bundle ez-tree self-hosté (3.9 MB, textures bark/leaves inlined). Le SW
//     le cache après le 1er chargement → instantané ensuite.
//   - PAS d'environnement (ground, herbe, rochers, skybox, audio). Seul l'arbre.
//     Le fond du site reste le gradient bleu CSS du body.
//   - Une seule lumière directionnelle + une hémisphérique. Pas d'ombres
//     calculées (coûteuses, peu visibles sur fond sombre).
//   - Tone mapping NeutralToneMapping pour des couleurs respirantes.
//   - Animation : tree.update(t) pour le vent sur les feuilles, sway caméra
//     très subtil (sin), aucun mouvement brusque.

import * as THREE from 'three';
import { Tree } from '@dgreenheck/ez-tree';

// ── Scène Three.js ──────────────────────────────────────────────────────────
function initTree3D(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true, // fond transparent → on voit le gradient CSS du body
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.8;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  // Pas de scene.background → reste transparent → le body CSS apparaît

  const camera = new THREE.PerspectiveCamera(
    38,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    500
  );
  camera.position.set(0, 28, 82);
  camera.lookAt(0, 22, 0);

  // Lumières : ambiance nuit-bleue cohérente avec le CSS body
  const hemi = new THREE.HemisphereLight(0x9ecaff, 0x070e1a, 1.1);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(20, 40, 30);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x4a90e2, 0.7);
  fillLight.position.set(-30, 20, -10);
  scene.add(fillLight);

  // ── Arbre ────────────────────────────────────────────────────────────────
  const tree = new Tree();
  tree.loadPreset('Oak Medium'); // appelle generate() en interne
  // Décale l'arbre vers le bas pour bien centrer la couronne dans le cadre
  tree.position.y = -2;
  scene.add(tree);

  // ── Boucle d'animation ───────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let rafId = 0;
  let lastW = 0;
  let lastH = 0;

  function maybeResize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w !== lastW || h !== lastH) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      lastW = w;
      lastH = h;
    }
  }

  function animate() {
    const t = clock.getElapsedTime();
    tree.update(t); // anime le shader vent sur les feuilles
    // Respiration caméra : très subtil, à peine perceptible
    camera.position.x = Math.sin(t * 0.12) * 1.6;
    camera.lookAt(0, 22, 0);
    maybeResize();
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  }
  animate();

  // Cleanup au cas où la page se ré-monte
  return {
    tree,
    scene,
    camera,
    renderer,
    stop() {
      cancelAnimationFrame(rafId);
      renderer.dispose();
    },
  };
}

// ── Lya — présence + parole d'ouverture ─────────────────────────────────────
// (logique récupérée intacte depuis arbre.svg.legacy.js)
const LYA_LINES = [
  'Bonjour. Je m’appelle Lya.',
  'Cet arbre, c’est toi. Aujourd’hui, il commence.',
  'Chaque chose que tu fais dans la vraie vie le fait pousser. Avance à ton rythme.',
];

function typeLine(el, text, done) {
  el.textContent = '';
  let i = 0;
  const tick = () => {
    if (i <= text.length) {
      el.textContent = text.slice(0, i++);
      setTimeout(tick, 26 + Math.random() * 34);
    } else if (done) {
      done();
    }
  };
  tick();
}

function speak(text, enabled) {
  if (!enabled || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 0.96;
    u.pitch = 1.05;
    const fr = speechSynthesis.getVoices().find((v) => v.lang.startsWith('fr'));
    if (fr) u.voice = fr;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) {
    /* ignore */
  }
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
    typeLine(lineEl, text, () => setTimeout(next, 1700));
    speak(text, voiceOn);
  };
  if (lineEl) setTimeout(next, 1100);
}

// ── Init ────────────────────────────────────────────────────────────────────
function init() {
  const canvas = document.getElementById('arbre-canvas');
  if (canvas) {
    try {
      initTree3D(canvas);
    } catch (e) {
      console.error('[arbre3d] init failed', e);
      // L'utilisateur garde au moins Lya et le bouton « Entrer ».
    }
  }
  initLya();
  // Retire le voile de chargement (remplace l'ancien <script> inline,
  // bloqué par la CSP stricte du site).
  document.body.classList.add('tree-ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
