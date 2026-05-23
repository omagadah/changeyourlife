'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

const LINES = [
  'Bonjour. Je m’appelle Lya.',
  'Chaque chose que tu accomplis fait grandir ton arbre.',
  'Touche une branche pour l’explorer — ou commence l’aventure.',
];

/** Lya version landing : orbe qui respire + réplique tapée à la machine. */
export function LyaIntro() {
  const [line, setLine] = useState('');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const full = LINES[idx];
    let i = 0;
    setLine('');
    const type = setInterval(() => {
      i += 1;
      setLine(full.slice(0, i));
      if (i >= full.length) clearInterval(type);
    }, 28);
    const next = setTimeout(() => setIdx((p) => (p + 1) % LINES.length), 5200);
    return () => { clearInterval(type); clearTimeout(next); };
  }, [idx]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.9, ease: 'easeOut' }}
      className="flex items-center gap-4"
    >
      <span
        className="relative h-14 w-14 shrink-0 rounded-full"
        style={{
          background: 'radial-gradient(circle at 38% 34%, #8fc2ff 0%, #2f7ef0 42%, #1a3a8c 100%)',
          boxShadow: '0 0 32px rgba(47,126,240,0.6), inset 0 0 18px rgba(255,255,255,0.25)',
          animation: 'breathe 4.6s ease-in-out infinite',
        }}
        aria-hidden
      />
      <div className="min-w-0">
        <div className="text-[0.72rem] font-bold uppercase tracking-[1.4px] text-accent-soft">Lya</div>
        <p className="min-h-[1.6em] text-base leading-snug text-ink sm:text-lg">
          {line}
          <span className="ml-0.5 inline-block w-px animate-pulse text-accent-soft">▌</span>
        </p>
      </div>
      <style>{`@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
    </motion.div>
  );
}
