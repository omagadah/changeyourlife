// /js/login-bg.js - Fond 3D de la page de connexion : la MÊME scène arbre/Terre
// que la landing (moteur tree-model.js), mais non interactive et en rotation
// lente. Objectif : continuité visuelle parfaite entre l'accueil et le login.

import * as THREE from '/vendor/three/three.module.min.js';
import { createDemoModel, buildTree } from '/js/tree-model.js';

const canvas = document.getElementById('arbre-canvas');
if (canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    logarithmicDepthBuffer: true, // anti-clignotement Terre (far plane énorme)
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.6;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    42, canvas.clientWidth / canvas.clientHeight, 0.1, 24000);
  scene.add(new THREE.HemisphereLight(0x9ecaff, 0x070e1a, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(30, 70, 36); scene.add(key);
  const fill = new THREE.DirectionalLight(0x4a90e2, 0.7);
  fill.position.set(-36, 30, -20); scene.add(fill);

  const { group, grow, animateCosmos, setEarthLocation } = buildTree(THREE, createDemoModel(), { floating: true });
  scene.add(group);

  // Géoloc : repli France immédiat (jamais bloqué au pôle nord), affiné par IP.
  (function geolocate() {
    let applied = false;
    try {
      const c = JSON.parse(localStorage.getItem('cyl_geo') || 'null');
      if (c && typeof c.lat === 'number') { setEarthLocation(c.lat, c.lon); applied = true; }
    } catch (_) {}
    if (!applied) setEarthLocation(46.6, 2.2);
    fetch('https://ipwho.is/').then((r) => r.json()).then((d) => {
      if (d && d.success && typeof d.latitude === 'number') {
        setEarthLocation(d.latitude, d.longitude);
        try { localStorage.setItem('cyl_geo', JSON.stringify({ lat: d.latitude, lon: d.longitude })); } catch (_) {}
      }
    }).catch(() => {});
  })();

  // Caméra : on se connecte "dans l'arbre" - vue rapprochée, l'arbre flotte en
  // grand derrière la carte, base (socle translucide) basse, branches qui débordent.
  const target = new THREE.Vector3(0, 56, 0);
  const radius = 108, polar = 1.12;
  let az = 0.5;
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let lastW = 0, lastH = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === lastW && h === lastH)) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    lastW = w; lastH = h;
  }

  const clock = new THREE.Clock();
  let lastT = 0;
  function frame() {
    const t = clock.getElapsedTime();
    const dt = Math.min(0.1, t - lastT); lastT = t;
    grow(Math.min(1, t / 7));                 // l'arbre pousse à l'arrivée
    if (!reduceMotion) az += dt * 0.018;       // rotation d'orbite très douce
    const sp = Math.sin(polar), cp = Math.cos(polar);
    camera.position.set(
      target.x + radius * sp * Math.sin(az),
      target.y + radius * cp,
      target.z + radius * sp * Math.cos(az));
    camera.lookAt(target.x, target.y, target.z);
    animateCosmos(dt);
    resize();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  resize();
  frame();
  document.body.classList.add('tree-ready');

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  window.addEventListener('resize', resize);
}
