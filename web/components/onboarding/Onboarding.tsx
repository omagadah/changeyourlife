'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { createDemoModel, buildTree } from '@/lib/tree/tree-model';

const ORBIT_TARGET = new THREE.Vector3(0, 40, 0);
const ONBOARD_XP = 250;
const hex = (c: number) => '#' + (c >>> 0).toString(16).padStart(6, '0');

type Step = 'greeting' | 'question' | 'answered' | 'explore';

const QUESTION = {
  branch: 'physio',
  q: 'Commençons par la base : ton corps. Comment te sens-tu physiquement en ce moment ?',
  chips: ['En pleine forme', 'Ça va', 'Plutôt fatigué·e'],
};

/**
 * Onboarding conversationnel (Phase 1 du PLAN-V2).
 * Lya accueille, pose UNE question, plante la 1re branche en direct (l'arbre
 * grandit), récompense XP, puis invite à explorer les autres branches.
 */
export function Onboarding() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetAge = useRef(0.12);
  const celebrate = useRef<{ t: number | null; key: string }>({ t: null, key: '' });
  // demande de célébration depuis React (résolue dans le loop avec l'horloge Three)
  const pendingCelebrate = useRef<string | null>(null);

  const [step, setStep] = useState<Step>('greeting');
  const [line, setLine] = useState('');
  const [reward, setReward] = useState<{ label: string; color: string } | null>(null);
  const [picked, setProbe] = useState<{ label: string; color: string } | null>(null);
  const typeTok = useRef(0);

  // Lya « parle » en machine à écrire
  const say = useCallback((text: string) => {
    const tok = ++typeTok.current;
    let i = 0;
    setLine('');
    const tick = () => {
      if (tok !== typeTok.current) return;
      i += 1;
      setLine(text.slice(0, i));
      if (i < text.length) setTimeout(tick, 22);
    };
    tick();
  }, []);

  // ── Scène 3D ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.7;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
    scene.add(new THREE.HemisphereLight(0x9ecaff, 0x070e1a, 1.15));
    const k = new THREE.DirectionalLight(0xffffff, 1.5); k.position.set(30, 70, 36); scene.add(k);
    const f = new THREE.DirectionalLight(0x4a90e2, 0.7); f.position.set(-36, 30, -20); scene.add(f);

    const { group, grow, nodes, animateCosmos } = buildTree(THREE, createDemoModel());
    scene.add(group);
    const nodeByKey = new Map<string, any>();
    for (const n of nodes) if (n.userData?.key) nodeByKey.set(n.userData.key, n);

    // orbite 1:1
    const s = { az: 0.6, po: 1.04, r: 150, tAz: 0.6, tPo: 1.04, tR: 150 };
    let dragging = false, moved = false, px = 0, py = 0;
    const onDown = (e: PointerEvent) => { dragging = true; moved = false; px = e.clientX; py = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch {} };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - px, dy = e.clientY - py;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      px = e.clientX; py = e.clientY;
      const dim = Math.max(canvas.clientWidth, 320);
      const SENS = (Math.PI * 0.75) / dim;
      s.tAz = s.az = s.tAz - dx * SENS;
      s.tPo = s.po = Math.min(1.4, Math.max(0.5, s.tPo - dy * SENS * 0.85));
    };
    const onUp = (e: PointerEvent) => {
      dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch {}
      if (moved) return;
      // clic sur une branche (raycast sur les nœuds) → révèle son nom
      const rect = canvas.getBoundingClientRect();
      const v = new THREE.Vector3(); let best: any = null, bestD = 70;
      for (const n of nodes) {
        n.getWorldPosition(v).project(camera);
        if (v.z > 1) continue;
        const sx = rect.left + (v.x * 0.5 + 0.5) * rect.width;
        const sy = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
        const d = Math.hypot(sx - e.clientX, sy - e.clientY);
        if (d < bestD && n.userData?.label) { bestD = d; best = n; }
      }
      if (best) {
        celebrate.current = { t: clock.getElapsedTime(), key: best.userData.key };
        setProbe({ label: best.userData.label, color: hex(best.userData.color) });
      }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); s.tR = Math.min(1800, Math.max(60, s.tR + e.deltaY * 0.0018 * s.tR)); };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    let lastW = 0, lastH = 0;
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h || (w === lastW && h === lastH)) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      lastW = w; lastH = h;
    };

    const clock = new THREE.Clock();
    let curAge = 0.12, lastT = 0, raf = 0, alive = true;
    const frame = () => {
      if (!alive) return;
      const t = clock.getElapsedTime();
      const dt = Math.min(0.1, t - lastT); lastT = t;
      curAge += (Math.min(1, targetAge.current) - curAge) * 0.04;
      grow(Math.min(1, curAge));
      // une demande de célébration venue de React → on l'ancre sur l'horloge Three
      if (pendingCelebrate.current) {
        celebrate.current = { t, key: pendingCelebrate.current };
        pendingCelebrate.current = null;
      }
      // pulsation festive sur la branche célébrée
      const cel = celebrate.current;
      if (cel.t != null) {
        const node = nodeByKey.get(cel.key);
        if (node) {
          const e = t - cel.t;
          const base = node.userData.baseR || 1;
          const mult = e < 3 ? 1 + (1 - e / 3) * (0.6 + 0.4 * Math.sin(e * 9)) : 1;
          node.scale.setScalar(base * mult);
        }
      }
      animateCosmos(dt);
      s.az += (s.tAz - s.az) * 0.055; s.po += (s.tPo - s.po) * 0.055; s.r += (s.tR - s.r) * 0.055;
      const sp = Math.sin(s.po), cp = Math.cos(s.po);
      camera.position.set(s.r * sp * Math.sin(s.az), ORBIT_TARGET.y + s.r * cp, s.r * sp * Math.cos(s.az));
      camera.lookAt(ORBIT_TARGET);
      resize();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    resize(); frame();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    return () => {
      alive = false; cancelAnimationFrame(raf); ro?.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, []);

  // ── Déroulé de la conversation ──────────────────────────────────────────
  useEffect(() => {
    if (step === 'greeting') say('Bonjour. Je m’appelle Lya. Plantons ensemble la première branche de ton arbre — il grandira au fil de tes actions. Une question pour commencer.');
    if (step === 'question') say(QUESTION.q);
  }, [step, say]);

  const answer = () => {
    setStep('answered');
    targetAge.current = 1;
    pendingCelebrate.current = QUESTION.branch;  // ancré sur l'horloge Three dans le loop
    const b = createDemoModel().branches.find((x) => x.key === QUESTION.branch)!;
    setReward({ label: b.label, color: hex(b.color) });
    setTimeout(() => setReward(null), 4200);
    say(`+${ONBOARD_XP} XP ✨ Ta branche ${b.label} vient de pousser. Regarde la carte en haut à droite — c'est ta récompense. Chaque action sur le site fera pareil.`);
    setTimeout(() => {
      setStep('explore');
      say('À toi maintenant : clique sur les autres branches de l’arbre pour découvrir ce qu’elles contiennent. Les outils que tu utiliseras feront pousser leur branche, comme à l’instant.');
    }, 3600);
  };

  return (
    <main className="relative h-screen w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block h-full w-full touch-none" />

      {/* HUD haut-gauche */}
      <div className="pointer-events-none absolute left-6 top-6 z-10">
        <div className="text-[0.66rem] font-bold uppercase tracking-[1.2px] text-accent-soft">
          {step === 'explore' ? 'Jeune arbre' : 'Plantation'}
        </div>
      </div>

      {/* Carte de récompense */}
      <AnimatePresence>
        {reward && (
          <motion.div
            initial={{ x: 140, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 140, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="absolute right-5 top-5 z-20 flex min-w-[210px] items-center gap-3 rounded-2xl border bg-[#0b1829]/95 px-4 py-3 shadow-2xl"
            style={{ borderColor: reward.color, borderLeftWidth: 4 }}
          >
            <span className="text-2xl">🌱</span>
            <span className="flex flex-col">
              <span className="text-[0.68rem] font-bold uppercase tracking-wide" style={{ color: reward.color }}>
                {reward.label} a poussé
              </span>
              <span className="text-base font-extrabold text-ink">+{ONBOARD_XP} XP</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* étiquette de branche cliquée (étape explore) */}
      <AnimatePresence>
        {picked && step === 'explore' && (
          <motion.div
            key={picked.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 top-24 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-[#0b1829]/85 px-4 py-1.5 text-sm font-bold"
            style={{ color: picked.color }}
          >
            {picked.label}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lya + chips en bas */}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#060e1a]/95 from-30% to-transparent px-[clamp(20px,5vw,64px)] pb-8 pt-12">
        <div className="flex items-end gap-4">
          <span
            className="h-14 w-14 shrink-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at 38% 34%, #8fc2ff 0%, #2f7ef0 42%, #1a3a8c 100%)',
              boxShadow: '0 0 32px rgba(47,126,240,0.6), inset 0 0 18px rgba(255,255,255,0.25)',
              animation: 'breathe 4.6s ease-in-out infinite',
            }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="text-[0.66rem] font-bold uppercase tracking-[1.4px] text-accent-soft">Lya</div>
            <p className="min-h-[2.4em] max-w-2xl text-base leading-snug text-ink sm:text-lg">{line}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {step === 'greeting' && (
                <Chip onClick={() => setStep('question')}>C’est parti 🌱</Chip>
              )}
              {step === 'question' &&
                QUESTION.chips.map((c) => <Chip key={c} onClick={answer}>{c}</Chip>)}
              {step === 'explore' && (
                <a
                  href="/login"
                  className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(0,112,243,0.4)] transition-transform hover:-translate-y-0.5"
                >
                  Entrer dans mon espace →
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
    </main>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-white/14 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-ink backdrop-blur-sm transition-colors hover:border-accent/50 hover:bg-accent/15"
    >
      {children}
    </motion.button>
  );
}
