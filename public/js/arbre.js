// /js/arbre.js — Composant Arbre procédural + landing Phase 1.1
// L'arbre EST l'interface (cf. docs/VISION.md §5, docs/ARCHITECTURE.md).
// Rendu SVG procédural, data-driven : chaque branche dérive de 2 signaux —
//   dev (développement, cumulatif → longueur/épaisseur)
//   vitality (vitalité, décroît si négligé → couleur/feuilles)

// ── Les 7 branches (cf. ARCHITECTURE.md §2) ──────────────────────────────────
export const BRANCHES = [
  { key: 'corps',     label: 'Corps',     color: '#2dd4bf', attach: 0.46, angle: -64 },
  { key: 'mental',    label: 'Mental',    color: '#a78bfa', attach: 0.57, angle:  61 },
  { key: 'relations', label: 'Relations', color: '#f87171', attach: 0.67, angle: -46 },
  { key: 'finances',  label: 'Finances',  color: '#fbbf24', attach: 0.75, angle:  43 },
  { key: 'sens',      label: 'Sens',      color: '#38bdf8', attach: 0.85, angle: -27 },
  { key: 'creation',  label: 'Création',  color: '#fb923c', attach: 0.92, angle:  26 },
  { key: 'heritage',  label: 'Héritage',  color: '#94a3b8', attach: 1.00, angle:   4 },
];

const STAGE_TRUNK = { sapling: 330, jeune: 430, mature: 540, chene: 620 };

// ── Géométrie ────────────────────────────────────────────────────────────────
const VB = { w: 1000, h: 920, groundY: 850, baseX: 500 };

// point sur une courbe de Bézier quadratique
function qpoint(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

// ── Tronc (path rempli, large à la base, fuselé en haut) ────────────────────
function trunkPath(trunkH) {
  const { baseX, groundY } = VB;
  const topX = baseX + 14;            // léger penché
  const topY = groundY - trunkH;
  const baseHW = 32, topHW = 12;
  return `M ${baseX - baseHW},${groundY}
    C ${baseX - baseHW * 0.7},${groundY - trunkH * 0.4}
      ${topX - topHW * 2},${topY + trunkH * 0.42}
      ${topX - topHW},${topY}
    L ${topX + topHW},${topY}
    C ${topX + topHW * 2},${topY + trunkH * 0.42}
      ${baseX + baseHW * 0.7},${groundY - trunkH * 0.4}
      ${baseX + baseHW},${groundY} Z`;
}

// centre du tronc à la fraction f (0 = base, 1 = sommet)
function trunkCenter(trunkH, f) {
  const { baseX, groundY } = VB;
  const topX = baseX + 14, topY = groundY - trunkH;
  return { x: baseX + (topX - baseX) * f, y: groundY + (topY - groundY) * f };
}

// ── Une branche : limbe + feuilles + label ──────────────────────────────────
function branchSVG(b, st, trunkH) {
  const dev = Math.max(0, Math.min(100, st.dev || 0));
  const vit = Math.max(0, Math.min(100, st.vitality || 0));
  const dormant = dev < 3;

  const Pa = trunkCenter(trunkH, b.attach);
  const rad = (b.angle * Math.PI) / 180;
  const dir = { x: Math.sin(rad), y: -Math.cos(rad) };
  const len = 150 + (dev / 100) * 240 + trunkH * 0.15;
  const tip = { x: Pa.x + dir.x * len, y: Pa.y + dir.y * len };
  // point de contrôle : arc organique qui relève le bout de la branche
  const ctrl = {
    x: Pa.x + dir.x * len * 0.5,
    y: Pa.y + dir.y * len * 0.5 - len * 0.16,
  };
  const width = 5 + (dev / 100) * 17;

  // limbe — couleur bois, légèrement teintée vers la couleur de branche
  let svg = `<path d="M ${Pa.x},${Pa.y} Q ${ctrl.x},${ctrl.y} ${tip.x},${tip.y}"
    fill="none" stroke="${dormant ? '#3d4657' : '#5a4636'}"
    stroke-width="${width}" stroke-linecap="round" opacity="${dormant ? 0.7 : 1}"/>`;

  // feuilles — densité ∝ vitalité, le long de la moitié haute de la branche
  if (vit > 6 && !dormant) {
    const clusters = Math.round(1 + (vit / 100) * 4);
    const leafOp = 0.35 + (vit / 100) * 0.55;
    for (let i = 0; i < clusters; i++) {
      const t = 0.55 + (i / Math.max(1, clusters - 1)) * 0.42;
      const c = qpoint(Pa, ctrl, tip, t);
      const n = 3 + Math.round((vit / 100) * 3);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + i;
        const r = 9 + (dev / 100) * 9;
        const lx = c.x + Math.cos(a) * r * (0.6 + (j % 2) * 0.5);
        const ly = c.y + Math.sin(a) * r * (0.6 + (j % 2) * 0.5);
        const rr = 7 + (vit / 100) * 7;
        svg += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="${rr.toFixed(1)}"
          fill="${b.color}" opacity="${(leafOp * (0.6 + (j % 3) * 0.2)).toFixed(2)}"
          filter="url(#leafGlow)"/>`;
      }
    }
  } else if (dormant) {
    // branche dormante : un seul petit bourgeon pâle au bout
    svg += `<circle cx="${tip.x.toFixed(1)}" cy="${tip.y.toFixed(1)}" r="6"
      fill="${b.color}" opacity="0.28"/>`;
  }

  // label de la dimension, au bout de la branche
  const side = b.angle < 0 ? -1 : 1;
  const lx = tip.x + side * 30, ly = tip.y - 6;
  svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}"
    text-anchor="${side < 0 ? 'end' : 'start'}"
    font-family="-apple-system,Segoe UI,Roboto,sans-serif"
    font-size="26" font-weight="700"
    fill="${b.color}" opacity="${dormant ? 0.4 : 0.92}">${b.label}</text>`;
  if (dormant) {
    svg += `<text x="${lx.toFixed(1)}" y="${(ly + 22).toFixed(1)}"
      text-anchor="${side < 0 ? 'end' : 'start'}"
      font-family="-apple-system,Segoe UI,Roboto,sans-serif"
      font-size="13" fill="#5a6b82" opacity="0.8">en sommeil</text>`;
  }
  return svg;
}

/**
 * Génère l'arbre dans un conteneur.
 * @param {HTMLElement} el - conteneur
 * @param {object} state  - { stage, branches: { <key>: {dev, vitality} } }
 */
export function renderTree(el, state) {
  const stage = state.stage || 'sapling';
  const trunkH = STAGE_TRUNK[stage] || STAGE_TRUNK.sapling;

  let crown = '';
  // branches du bas vers le haut pour un empilement naturel
  for (const b of BRANCHES) {
    crown += branchSVG(b, state.branches?.[b.key] || {}, trunkH);
  }

  el.innerHTML = `
<svg viewBox="0 0 ${VB.w} ${VB.h}" class="arbre-svg" aria-label="Ton arbre de vie">
  <defs>
    <radialGradient id="dawn" cx="50%" cy="18%" r="75%">
      <stop offset="0%" stop-color="#1a3a5c" stop-opacity="0.9"/>
      <stop offset="55%" stop-color="#0b1829" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#060e1a" stop-opacity="0"/>
    </radialGradient>
    <filter id="leafGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
  </defs>

  <ellipse cx="${VB.baseX}" cy="120" rx="520" ry="300" fill="url(#dawn)"/>

  <!-- sol + lueur des racines -->
  <ellipse cx="${VB.baseX}" cy="${VB.groundY + 6}" rx="240" ry="34"
    fill="#0070f3" opacity="0.10" filter="url(#soft)"/>
  <ellipse cx="${VB.baseX}" cy="${VB.groundY + 4}" rx="150" ry="18"
    fill="#000" opacity="0.5" filter="url(#soft)"/>

  <g class="arbre-crown">
    <path d="${trunkPath(trunkH)}" fill="#4a3a2c"/>
    <path d="${trunkPath(trunkH)}" fill="none" stroke="#5d4a38" stroke-width="2" opacity="0.6"/>
    ${crown}
  </g>
</svg>`;
}

// ── État de démo — un jeune arbre (sapling) plein de potentiel ──────────────
// Phase 1.1 : état statique. Le câblage aux données réelles viendra plus tard.
export const DEMO_STATE = {
  stage: 'sapling',
  branches: {
    corps:     { dev: 15, vitality: 55 },
    mental:    { dev: 17, vitality: 62 },
    relations: { dev: 8,  vitality: 33 },
    finances:  { dev: 5,  vitality: 20 },
    sens:      { dev: 10, vitality: 42 },
    creation:  { dev: 12, vitality: 46 },
    heritage:  { dev: 0,  vitality: 6  },
  },
};

// ── Lya — présence + parole d'ouverture ─────────────────────────────────────
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
  } catch (e) { /* ignore */ }
}

// ── Init de la page /arbre/ ─────────────────────────────────────────────────
export function initArbrePage() {
  const treeEl = document.getElementById('arbre');
  const lineEl = document.getElementById('lya-line');
  const voiceBtn = document.getElementById('lya-voice');
  if (treeEl) renderTree(treeEl, DEMO_STATE);

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

  // déroulé des lignes de Lya
  let idx = 0;
  const next = () => {
    if (!lineEl || idx >= LYA_LINES.length) return;
    const text = LYA_LINES[idx++];
    typeLine(lineEl, text, () => setTimeout(next, 1700));
    speak(text, voiceOn);
  };
  if (lineEl) setTimeout(next, 700);
}

// ── Auto-init sur la page /arbre/ ───────────────────────────────────────────
if (typeof document !== 'undefined' && document.getElementById('arbre')) {
  initArbrePage();
} else if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('arbre')) initArbrePage();
  });
}
