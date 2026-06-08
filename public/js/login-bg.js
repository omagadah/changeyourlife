// /js/login-bg.js - Fond 3D de la page de connexion.
// Le bel arbre ez-tree (tree-hd.glb) flotte sur un socle translucide, dans
// l'espace. Caméra : on peut faire le tour ET passer PAR-DESSUS la cime, jamais
// en dessous (le socle reste le repère/pilier). On se connecte "dans l'arbre".

import * as THREE from '/vendor/three/three.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('arbre-canvas');
if (canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.55;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, canvas.clientWidth / canvas.clientHeight, 0.1, 6000);

  scene.add(new THREE.HemisphereLight(0x9ecaff, 0x0a1422, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(40, 90, 50); scene.add(key);
  const fill = new THREE.DirectionalLight(0x5aa0ff, 0.8); fill.position.set(-46, 40, -30); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffd9a0, 0.6); rim.position.set(0, 30, -60); scene.add(rim);

  const TREE_H = 92;            // hauteur cible de l'arbre (unités scène)
  const root = new THREE.Group(); scene.add(root);

  // ── Socle translucide (le "pilier"/repère, sous l'arbre) ───────────────────
  const baseR = 46;
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(baseR, baseR * 0.9, 3, 80),
    new THREE.MeshStandardMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.12,
      roughness: 0.2, metalness: 0.1, emissive: 0x1b3a66, emissiveIntensity: 0.4 })
  );
  disc.position.y = -1.5; root.add(disc);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(baseR, 0.5, 12, 90),
    new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.7 })
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; root.add(ring);

  // ── Étoiles ────────────────────────────────────────────────────────────────
  (function stars() {
    const N = 700, pos = new Float32Array(N * 3);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < N; i++) {
      const r = 800 + rnd() * 2200, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.75 })));
  })();

  // ── Arbre ez-tree (GLB) ─────────────────────────────────────────────────────
  let treeObj = null;
  new GLTFLoader().load('/models/tree-hd.glb', (gltf) => {
    const m = gltf.scene;
    const box = new THREE.Box3().setFromObject(m);
    const size = new THREE.Vector3(); box.getSize(size);
    const s = TREE_H / (size.y || 1);
    m.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(m);
    m.position.x -= (box2.min.x + box2.max.x) / 2;
    m.position.z -= (box2.min.z + box2.max.z) / 2;
    m.position.y -= box2.min.y;                 // base posée sur le socle (y=0)
    m.traverse((o) => { if (o.isMesh && o.material) { o.material.side = THREE.DoubleSide; } });
    treeObj = m; root.add(m);
  }, undefined, (err) => { console.error('[login-bg] GLB load error', err); });

  document.body.classList.add('tree-ready');

  // ── Caméra orbitale : tour complet + par-dessus, jamais sous le socle ───────
  const target = new THREE.Vector3(0, TREE_H * 0.52, 0);
  const st = { az: 0.5, po: 1.04, r: 150, taz: 0.5, tpo: 1.04, tr: 150 };
  const MIN_PO = 0.06, MAX_PO = 1.46, MIN_R = 70, MAX_R = 420;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let dragging = false, moved = false, px = 0, py = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; moved = false; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    const dim = Math.max(canvas.clientWidth, 320), SENS = (Math.PI * 0.8) / dim;
    st.taz -= dx * SENS;
    st.tpo = Math.min(MAX_PO, Math.max(MIN_PO, st.tpo - dy * SENS * 0.85));
  });
  const end = (e) => { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch (_) {} };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); st.tr = Math.min(MAX_R, Math.max(MIN_R, st.tr + e.deltaY * 0.0009 * st.tr)); }, { passive: false });

  let lastW = 0, lastH = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === lastW && h === lastH)) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    lastW = w; lastH = h;
  }

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(0.1, clock.getDelta());
    if (!dragging && !reduceMotion) st.taz += dt * 0.05;   // rotation douce
    st.az += (st.taz - st.az) * 0.06;
    st.po += (st.tpo - st.po) * 0.08;
    st.r += (st.tr - st.r) * 0.08;
    const sp = Math.sin(st.po), cp = Math.cos(st.po);
    camera.position.set(
      target.x + st.r * sp * Math.sin(st.az),
      target.y + st.r * cp,
      target.z + st.r * sp * Math.cos(st.az));
    camera.lookAt(target);
    if (treeObj) treeObj.rotation.y += dt * 0.04;   // léger tournoiement de l'arbre
    resize();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  resize();
  frame();

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  window.addEventListener('resize', resize);
}
