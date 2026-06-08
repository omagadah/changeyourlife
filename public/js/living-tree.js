// /js/living-tree.js - L'arbre vivant du tableau de bord /app/.
// Le bel arbre ez-tree (Chêne ou Frêne au choix) qui GRANDIT physiquement avec
// l'XP de l'utilisateur : jeune pousse à 0 XP -> arbre majestueux quand l'XP monte.

import * as THREE from '/vendor/three/three.module.min.js';
import { buildEzTree, getTreeType, setTreeType } from '/js/ez-tree-build.js';

const TARGET_XP = 6000;   // XP pour atteindre l'arbre pleinement majestueux
const clamp01 = (x) => Math.max(0, Math.min(1, x));

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
  let type = getTreeType();

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
    b.onclick = () => { type = b.dataset.t; setTreeType(type); rebuild(); paintToggle(); };
  });
  function paintToggle() {
    toggle.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.t === type;
      b.style.background = on ? 'linear-gradient(135deg,#84c25e,#4a7a3a)' : 'rgba(8,16,28,0.7)';
      b.style.color = on ? '#06140a' : '#cdd9ec';
    });
  }
  stage.appendChild(toggle);

  // petite légende d'XP / stade
  const tag = document.createElement('div');
  tag.style.cssText = 'position:absolute;bottom:10px;left:12px;font:600 0.72rem Segoe UI,sans-serif;color:#8fb3a0;z-index:3;';
  stage.appendChild(tag);
  function stageName(g) { return g < 0.18 ? 'Jeune pousse' : g < 0.55 ? 'Jeune arbre' : g < 0.85 ? 'Arbre mature' : 'Arbre majestueux'; }

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

  let tree = null;
  const target = new THREE.Vector3(0, 40, 0);
  function rebuild() {
    if (tree) { scene.remove(tree); tree.traverse((o) => o.geometry?.dispose?.()); tree = null; }
    try {
      tree = buildEzTree(type, { growth });
      tree.scale.setScalar(1.0);
      const b = new THREE.Box3().setFromObject(tree);
      tree.position.x -= (b.min.x + b.max.x) / 2;
      tree.position.z -= (b.min.z + b.max.z) / 2;
      tree.position.y -= b.min.y;
      scene.add(tree);
      const b2 = new THREE.Box3().setFromObject(tree);
      target.y = (b2.max.y - b2.min.y) * 0.5;
      st.r = (b2.max.y - b2.min.y) * 1.5 + 30; st.tr = st.r;
      tag.textContent = `${stageName(growth)} · ${totalXp.toLocaleString('fr-FR')} XP`;
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
    resize();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  rebuild();
  resize();
  frame();

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(stage);
  window.addEventListener('resize', resize);

  // permet de mettre à jour la croissance quand l'XP change (sans recharger)
  return {
    setXp(newXp) { growth = clamp01(newXp / TARGET_XP); rebuild(); },
  };
}
