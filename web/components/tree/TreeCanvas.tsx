'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createDemoModel, buildTree } from '@/lib/tree/tree-model';

const ORBIT_TARGET = new THREE.Vector3(0, 40, 0);
const GROWTH_SECONDS = 9;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

/**
 * Arbre de vie 3D — port direct du moteur vanilla (Sprint 0 du PLAN-V2).
 * Three.js piloté impérativement dans un effet React. Sera réécrit en R3F
 * idiomatique en Phase 1 (étape 2), mais le rendu est déjà identique.
 */
export function TreeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.7;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
    scene.add(new THREE.HemisphereLight(0x9ecaff, 0x070e1a, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(30, 70, 36); scene.add(key);
    const fill = new THREE.DirectionalLight(0x4a90e2, 0.7);
    fill.position.set(-36, 30, -20); scene.add(fill);

    const { group, grow, animateCosmos } = buildTree(THREE, createDemoModel());
    scene.add(group);

    // ── Orbite : drag 1:1 + zoom log (mêmes réglages que le site actuel) ────
    const s = { az: 0.6, po: 1.04, r: 150, tAz: 0.6, tPo: 1.04, tR: 150 };
    let dragging = false, px = 0, py = 0;
    const onDown = (e: PointerEvent) => { dragging = true; px = e.clientX; py = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch {} };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
      const dim = Math.max(canvas.clientWidth, 320);
      const SENS = (Math.PI * 0.75) / dim;
      s.tAz = s.az = s.tAz - dx * SENS;
      s.tPo = s.po = Math.min(1.4, Math.max(0.5, s.tPo - dy * SENS * 0.85));
    };
    const onUp = (e: PointerEvent) => { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch {} };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); s.tR = Math.min(1800, Math.max(60, s.tR + e.deltaY * 0.0018 * s.tR)); };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    function applyCamera() {
      s.az += (s.tAz - s.az) * 0.055;
      s.po += (s.tPo - s.po) * 0.055;
      s.r += (s.tR - s.r) * 0.055;
      const sp = Math.sin(s.po), cp = Math.cos(s.po);
      camera.position.set(
        ORBIT_TARGET.x + s.r * sp * Math.sin(s.az),
        ORBIT_TARGET.y + s.r * cp,
        ORBIT_TARGET.z + s.r * sp * Math.cos(s.az));
      camera.lookAt(ORBIT_TARGET);
    }

    let lastW = 0, lastH = 0;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h || (w === lastW && h === lastH)) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      lastW = w; lastH = h;
    }

    const clock = new THREE.Clock();
    let lastT = 0, raf = 0, alive = true;
    function frame() {
      if (!alive) return;
      const t = clock.getElapsedTime();
      const dt = Math.min(0.1, t - lastT); lastT = t;
      const age = Math.min(1, t / GROWTH_SECONDS);
      grow(age);
      if (age >= 1) group.rotation.z = Math.sin(t * 0.2) * 0.012; // léger souffle
      animateCosmos(dt);
      applyCamera();
      resize();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    resize();
    frame();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full block touch-none" aria-label="Ton arbre de vie" />;
}
