'use client';

import { motion } from 'motion/react';
import { TreeCanvas } from '@/components/tree/TreeCanvas';
import { LyaIntro } from '@/components/lya/LyaIntro';
import { DIMENSIONS } from '@/lib/tree/tree-model';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] } }),
};

const hex = (c: number) => '#' + (c >>> 0).toString(16).padStart(6, '0');

export default function Home() {
  return (
    <main className="relative">
      {/* ── HERO plein écran : arbre en fond ─────────────────────────────── */}
      <section className="relative h-screen w-full overflow-hidden">
        <div className="absolute inset-0 z-0">
          <TreeCanvas />
        </div>

        {/* bandeau */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-[clamp(20px,5vw,64px)] py-4"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[1.05rem] font-extrabold tracking-tight">
              ChangeYourLife<span className="text-accent-soft">.ai</span>
            </span>
          </div>
          <a
            href="/login"
            className="rounded-[10px] border border-white/12 px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-ink"
          >
            Se connecter
          </a>
        </motion.header>

        {/* titre */}
        <div className="pointer-events-none absolute left-[clamp(20px,5vw,64px)] top-[clamp(96px,15vh,150px)] z-10 max-w-[min(34rem,54vw)]">
          <motion.h1
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="text-gradient text-[clamp(2rem,4.8vw,3.6rem)] font-extrabold leading-[1.08] tracking-tight"
          >
            Construis la meilleure version de toi-même.
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="show"
            custom={1.5}
            variants={fadeUp}
            className="mt-4 max-w-[28rem] text-[clamp(0.95rem,1.5vw,1.1rem)] leading-relaxed text-muted"
          >
            Ta vie devient un arbre vivant, inspiré de la <strong className="text-ink/90">pyramide de Maslow</strong> —
            de tes besoins vitaux, à la base, jusqu’à l’accomplissement de soi, tout en haut.
          </motion.p>
        </div>

        {/* bas : Lya + CTA */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#060e1a]/95 from-30% to-transparent px-[clamp(20px,5vw,64px)] pb-7 pt-10">
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
            <LyaIntro />
            <motion.a
              href="/onboarding"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.8 }}
              whileHover={{ y: -2, filter: 'brightness(1.1)' }}
              className="shrink-0 rounded-2xl bg-accent px-7 py-3.5 text-center text-[0.95rem] font-bold text-white shadow-[0_6px_24px_rgba(0,112,243,0.4)]"
            >
              Commencer l’aventure
            </motion.a>
          </div>
        </div>

        {/* indice scroll */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ delay: 2, duration: 2.4, repeat: Infinity }}
          className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2 text-xs uppercase tracking-[2px] text-faint"
        >
          défile pour explorer
        </motion.div>
      </section>

      {/* ── SECTION : les 8 branches ─────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-28">
        <motion.h2
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="text-gradient text-center text-[clamp(1.6rem,3.4vw,2.6rem)] font-extrabold tracking-tight"
        >
          Huit branches. Une seule vie qui grandit.
        </motion.h2>
        <motion.p
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          custom={1}
          variants={fadeUp}
          className="mx-auto mt-4 max-w-2xl text-center text-muted"
        >
          Chaque dimension de Maslow est une branche. Tes actions réelles la nourrissent,
          elle pousse, ton arbre prend forme — et toi avec.
        </motion.p>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {DIMENSIONS.map((d, i) => (
            <motion.div
              key={d.key}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-40px' }}
              custom={i}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 backdrop-blur-sm"
              style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04)` }}
            >
              <span
                className="mb-3 block h-3 w-3 rounded-full"
                style={{ background: hex(d.color), boxShadow: `0 0 14px ${hex(d.color)}` }}
              />
              <div className="text-sm font-bold text-ink">{d.label}</div>
              <div className="mt-1 text-xs leading-relaxed text-faint">{d.sub.slice(0, 3).join(' · ')}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 pb-32 pt-8 text-center">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mx-auto max-w-2xl"
        >
          <h3 className="text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-tight text-ink">
            Plante ta première branche aujourd’hui.
          </h3>
          <p className="mt-3 text-muted">Gratuit. Guidé par Lya. Une question pour commencer.</p>
          <a
            href="/onboarding"
            className="mt-8 inline-block rounded-2xl bg-accent px-8 py-4 text-base font-bold text-white shadow-[0_6px_24px_rgba(0,112,243,0.4)] transition-transform hover:-translate-y-0.5"
          >
            Commencer l’aventure
          </a>
        </motion.div>
      </section>
    </main>
  );
}
