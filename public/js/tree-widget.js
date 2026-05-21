// /js/tree-widget.js — L'arbre de vie de l'utilisateur, sur le dashboard /app/.
//
// Affiche le VRAI arbre (données Firestore `users/{uid}.tree`, sinon migration
// du legacy `levels`). L'arbre est évolutif : chaque branche pousse selon son XP.
//
// Widget compact dans le dashboard → clic → plein écran interactif (orbite,
// clic sur une branche = sa progression réelle + ses outils). Lya contextuelle.
//
// Cf. docs/VISION.md, docs/ARCHITECTURE.md §6.

import * as THREE from '/vendor/three/three.module.min.js';
import { buildTree, DIMENSIONS } from '/js/tree-model.js';
import { treeFromUserDoc, toVisualModel } from '/js/tree-data.js';

// ── Contenu éditorial des 8 branches (desc + outils qui les nourrissent) ─────
const BRANCH_DESC = {
  physio: 'Le besoin vital — sommeil, énergie, mouvement. La base de tout.',
  securite: 'Se sentir à l’abri — logement, stabilité, finances, santé.',
  appartenance: 'Aimer et être aimé — famille, amis, communauté.',
  estime: 'Être reconnu, et d’abord se reconnaître de la valeur.',
  cognitif: 'Le besoin de savoir, de comprendre, d’explorer.',
  esthetique: 'Le besoin de beauté, d’harmonie et d’ordre.',
  accomplissement: 'Devenir pleinement soi — réaliser son potentiel.',
  transcendance: 'Aller au-delà de soi — sens, contribution, transmission.',
};
// Les outils existants rangés sous leur branche Maslow (cf. ARCHITECTURE §3).
const BRANCH_TOOLS = {
  physio: [
    { icon: '🌙', label: 'Sommeil', href: '/sommeil/' },
    { icon: '✅', label: 'Habitudes', href: '/habitudes/' },
    { icon: '🧘', label: 'Méditation', href: '/meditation/' },
  ],
  securite: [],
  appartenance: [
    { icon: '😌', label: 'Humeur', href: '/humeur/' },
  ],
  estime: [
    { icon: '🎯', label: 'Autoévaluation', href: '/autoevaluation/' },
    { icon: '📊', label: 'Bilan', href: '/bilan/' },
  ],
  cognitif: [
    { icon: '📚', label: 'Codex', href: '/codex/' },
    { icon: '📔', label: 'Journal', href: '/journal/' },
  ],
  esthetique: [],
  accomplissement: [
    { icon: '🎯', label: 'Objectifs', href: '/objectifs/' },
  ],
  transcendance: [
    { icon: '🌟', label: 'Gratitude', href: '/gratitude/' },
  ],
};
const STAGE_LABEL = {
  sapling: 'Jeune pousse', jeune: 'Jeune arbre',
  mature: 'Arbre mature', centenaire: 'Arbre centenaire',
};

// ── Onboarding conversationnel : Lya plante les 8 branches en discutant ─────
const ONBOARD_XP = 250;   // XP « de plantation » par branche (1 question = 1 branche)
// Une seule question pour planter la première branche et faire comprendre le
// mécanisme (action → branche pousse). Les 7 autres grandiront naturellement
// au fil de l'utilisation des modules (Sommeil, Journal, Méditation…).
const ONBOARDING = [
  { branch: 'physio', q: 'Commençons par la base : ton corps. Comment te sens-tu physiquement en ce moment ?',
    chips: ['En pleine forme', 'Ça va', 'Plutôt fatigué·e'] },
];
const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');

// progression XP à l'intérieur du niveau courant (seuil k = 100 + k*20)
function levelProgress(xp) {
  let level = 0, need = 100, acc = 0;
  while (acc + need <= xp) { acc += need; level += 1; need = 100 + level * 20; }
  return { level, inLevel: xp - acc, need, pct: Math.round(((xp - acc) / need) * 100) };
}

// ── CSS (injecté — CSP-safe : style-src autorise l'inline sur /app/) ─────────
function injectCss() {
  if (document.getElementById('tree-widget-css')) return;
  const css = document.createElement('style');
  css.id = 'tree-widget-css';
  css.textContent = `
  .tree-stage{position:relative;width:100%;height:340px;border-radius:20px;
    overflow:hidden;margin-bottom:22px;cursor:pointer;
    background:radial-gradient(ellipse 70% 60% at 50% 20%,rgba(0,112,243,0.16),transparent 70%),rgba(7,16,30,0.55);
    border:1px solid rgba(255,255,255,0.07);transition:border-color .2s;}
  .tree-stage:not(.expanded):hover{border-color:rgba(0,112,243,0.4);}
  .tree-stage.expanded{position:fixed;inset:0;width:auto;height:auto;
    border-radius:0;margin:0;z-index:9000;cursor:default;
    background:radial-gradient(ellipse 70% 50% at 50% 0%,rgba(0,112,243,0.16),transparent 70%),#060e1a;}
  .tree-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
  .tw-hint{position:absolute;left:0;right:0;bottom:0;z-index:3;
    display:flex;align-items:center;justify-content:space-between;
    padding:14px 18px;pointer-events:none;
    background:linear-gradient(0deg,rgba(6,14,26,0.9),transparent);}
  .tree-stage.expanded .tw-hint{display:none;}
  .tw-hint-l{display:flex;flex-direction:column;gap:1px;}
  .tw-hint-stage{font-size:0.92rem;font-weight:800;color:#eef4ff;}
  .tw-hint-xp{font-size:0.74rem;color:#7e9ab5;font-weight:600;}
  .tw-hint-cta{font-size:0.78rem;color:#60a5fa;font-weight:700;}
  .tw-close{position:absolute;top:18px;right:18px;z-index:7;display:none;
    width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:0.95rem;
    background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14);color:#cdd9ea;}
  .tree-stage.expanded .tw-close{display:flex;align-items:center;justify-content:center;}
  .tw-close:hover{background:rgba(255,255,255,0.14);color:#fff;}
  .tw-hud{position:absolute;top:20px;left:22px;z-index:4;display:none;pointer-events:none;}
  .tree-stage.expanded .tw-hud{display:block;}
  .tw-hud-stage{font-size:0.66rem;font-weight:700;letter-spacing:1.2px;
    text-transform:uppercase;color:#60a5fa;}
  .tw-hud-xp{font-size:1.6rem;font-weight:800;color:#eef4ff;letter-spacing:-.5px;}
  .tw-hud-xp small{font-size:0.42em;color:#7e9ab5;font-weight:700;margin-left:4px;}
  /* labels projetés */
  .tw-labels{position:absolute;inset:0;z-index:2;pointer-events:none;
    opacity:0;transition:opacity .5s;}
  .tree-stage.expanded .tw-labels{opacity:1;}
  .tw-label{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;
    font:700 10.5px -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.5px;
    text-transform:uppercase;padding:2px 8px;border-radius:6px;
    background:rgba(6,14,26,0.74);border:1px solid rgba(255,255,255,0.14);}
  .tw-label.sub{font-size:8.5px;padding:1px 6px;opacity:.82;
    background:rgba(6,14,26,0.58);border-color:rgba(255,255,255,0.09);}
  /* panneau de branche */
  .tw-panel{position:absolute;top:0;right:0;bottom:0;z-index:8;
    width:clamp(290px,33vw,400px);transform:translateX(100%);
    transition:transform .45s cubic-bezier(.22,1,.36,1);overflow-y:auto;
    background:rgba(8,17,30,0.97);backdrop-filter:blur(18px);
    border-left:1px solid rgba(255,255,255,0.1);
    box-shadow:-20px 0 60px rgba(0,0,0,0.5);padding:28px 26px;}
  .tw-panel.open{transform:translateX(0);}
  .tw-p-close{position:absolute;top:16px;right:16px;width:32px;height:32px;
    border-radius:50%;cursor:pointer;font-size:0.8rem;
    background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#8ba4c8;}
  .tw-p-close:hover{background:rgba(255,255,255,0.13);color:#fff;}
  .tw-p-head{display:flex;align-items:center;gap:11px;margin:6px 0 8px;}
  .tw-p-dot{width:15px;height:15px;border-radius:50%;flex-shrink:0;box-shadow:0 0 14px currentColor;}
  .tw-p-title{font-size:1.5rem;font-weight:800;letter-spacing:-.4px;}
  .tw-p-desc{font-size:0.88rem;line-height:1.55;color:#aebccf;margin-bottom:16px;}
  .tw-p-lvl{font-size:0.78rem;font-weight:700;color:#9fb5cf;margin-bottom:14px;}
  .tw-bar{margin-bottom:12px;}
  .tw-bar-top{display:flex;justify-content:space-between;font-size:0.72rem;
    font-weight:700;color:#7e9ab5;margin-bottom:4px;}
  .tw-bar-bg{height:7px;border-radius:5px;background:rgba(255,255,255,0.06);overflow:hidden;}
  .tw-bar-fill{height:100%;border-radius:5px;width:0;transition:width 1s cubic-bezier(.4,0,.2,1);}
  .tw-sec-label{font-size:0.66rem;font-weight:700;letter-spacing:.7px;
    text-transform:uppercase;color:#5d7895;margin:18px 0 8px;}
  .tw-sub{display:flex;align-items:center;gap:9px;padding:6px 0;
    border-top:1px solid rgba(255,255,255,0.05);font-size:0.84rem;color:#cdd9ea;}
  .tw-sub-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .tw-tool{display:flex;align-items:center;gap:11px;padding:11px 13px;
    border-radius:12px;text-decoration:none;margin-bottom:8px;
    background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);
    transition:background .18s,border-color .18s,transform .18s;}
  .tw-tool:hover{background:rgba(0,112,243,0.12);border-color:rgba(0,112,243,0.35);transform:translateX(3px);}
  .tw-tool-ic{font-size:1.25rem;}
  .tw-tool-nm{font-size:0.86rem;font-weight:700;color:#eef4ff;flex:1;}
  .tw-tool-go{font-size:0.78rem;font-weight:700;color:#60a5fa;}
  .tw-empty{font-size:0.82rem;color:#7e9ab5;font-style:italic;
    padding:11px 13px;border-radius:12px;border:1px dashed rgba(255,255,255,0.1);}
  /* Lya */
  .tw-lya{position:absolute;left:0;right:0;bottom:0;z-index:6;
    display:none;align-items:flex-end;gap:14px;
    padding:20px clamp(20px,4vw,40px) 24px;
    transition:right .45s cubic-bezier(.22,1,.36,1);
    background:linear-gradient(0deg,rgba(6,14,26,0.94) 36%,transparent);}
  .tree-stage.expanded .tw-lya{display:flex;}
  .tw-lya.shifted{right:clamp(290px,33vw,400px);}
  .tw-lya-orb{width:50px;height:50px;flex-shrink:0;border-radius:50%;
    background:radial-gradient(circle at 38% 34%,#8fc2ff,#2f7ef0 44%,#1a3a8c);
    box-shadow:0 0 26px rgba(47,126,240,0.6),inset 0 0 14px rgba(255,255,255,0.25);}
  .tw-lya-body{flex:1;min-width:0;}
  .tw-lya-name{font-size:0.66rem;font-weight:700;letter-spacing:1.3px;
    text-transform:uppercase;color:#60a5fa;margin-bottom:3px;}
  .tw-lya-line{font-size:clamp(0.92rem,1.6vw,1.1rem);line-height:1.5;color:#eef4ff;}
  .tw-lya-form{display:flex;gap:8px;margin-top:9px;}
  .tw-lya-input{flex:1;min-width:0;padding:9px 13px;border-radius:11px;
    background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);
    color:#eef4ff;font:500 0.88rem inherit;outline:none;transition:border-color .2s;}
  .tw-lya-input:focus{border-color:rgba(0,112,243,0.55);}
  .tw-lya-input::placeholder{color:#5d7895;}
  .tw-lya-send{flex-shrink:0;width:42px;border-radius:11px;cursor:pointer;
    background:#0070f3;color:#fff;border:none;font-size:0.95rem;
    transition:filter .2s,transform .2s;}
  .tw-lya-send:hover{filter:brightness(1.12);}
  .tw-lya-send:active{transform:scale(0.94);}
  .tw-lya-send:disabled{opacity:.5;cursor:default;}
  .tw-lya.thinking .tw-lya-input{opacity:.6;}
  .tw-lya.thinking .tw-lya-orb{animation:twPulse 1s ease-in-out infinite;}
  @keyframes twPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.12);}}
  /* onboarding — chips de réponse */
  .tw-onb{display:none;flex-wrap:wrap;gap:8px;margin-top:10px;}
  .tw-onb.on{display:flex;}
  .tw-onb-chip{padding:9px 16px;border-radius:11px;cursor:pointer;
    background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.18);
    color:#dce7f5;font:600 0.86rem inherit;
    transition:background .16s,border-color .16s,transform .16s,color .16s;}
  .tw-onb-chip:hover{background:rgba(0,112,243,0.2);border-color:rgba(0,112,243,0.55);
    color:#fff;transform:translateY(-2px);}
  .tw-onb-chip:active{transform:translateY(0);}
  .tw-lya.onb .tw-lya-form{display:none;}
  @media (max-width:640px){
    .tw-panel{width:100%;}
    .tw-lya{right:0;}
  }`;
  document.head.appendChild(css);
}

// ── Orbite (glisser / molette), active seulement en plein écran ──────────────
function makeControls(el, camera, target) {
  const s = { az: 0.6, po: 1.04, r: 150, tAz: 0.6, tPo: 1.04, tR: 150 };
  let dragging = false, moved = false, px = 0, py = 0;
  const enabled = () => el.classList.contains('expanded');
  el.addEventListener('pointerdown', (e) => {
    if (!enabled()) return;
    dragging = true; moved = false; px = e.clientX; py = e.clientY;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    px = e.clientX; py = e.clientY;
    // Sensibilité encore baissée : rotation vraiment posée, qui « pèse ».
    s.tAz -= dx * 0.002;
    s.tPo = Math.min(1.4, Math.max(0.5, s.tPo - dy * 0.0016));
  });
  const end = () => { dragging = false; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', (e) => {
    if (!enabled()) return;
    e.preventDefault();
    s.tR = Math.min(240, Math.max(80, s.tR + e.deltaY * 0.07));
  }, { passive: false });
  return {
    isDragging: () => dragging,
    wasDrag: () => moved,
    setTargetRadius: (r) => { s.tR = r; },
    apply() {
      // Lerp encore plus doux : le mouvement « inertie », arrive en douceur.
      s.az += (s.tAz - s.az) * 0.055;
      s.po += (s.tPo - s.po) * 0.055;
      s.r += (s.tR - s.r) * 0.055;
      const sp = Math.sin(s.po), cp = Math.cos(s.po);
      camera.position.set(
        target.x + s.r * sp * Math.sin(s.az),
        target.y + s.r * cp,
        target.z + s.r * sp * Math.cos(s.az));
      camera.lookAt(target);
    },
  };
}

// ── Lya — message contextuel depuis l'état réel de l'arbre ──────────────────
function lyaMessage(model, name) {
  const greet = name ? `Bonjour ${name}.` : 'Bonjour.';
  if (model.branches.every((b) => (b.xp || 0) === 0)) {
    return `${greet} Ton arbre vient de prendre racine. Chaque action validée le fera grandir — choisis une branche pour commencer.`;
  }
  const active = model.branches.filter((b) => b.state === 'active');
  const weak = active.slice().sort((a, b) => a.vitality - b.vitality)[0];
  if (weak && weak.vitality < 40) {
    return `${greet} Ta branche ${weak.label} faiblit — rien depuis un moment. On lui redonne de la sève aujourd'hui ?`;
  }
  const dormant = model.branches.filter((b) => b.state === 'dormant');
  if (dormant.length) {
    const n = dormant.length;
    return `${greet} ${n > 1 ? `${n} branches dorment` : '1 branche dort'} encore. Un seul geste suffit à ${n > 1 ? 'les' : 'la'} réveiller.`;
  }
  return `${greet} Ton arbre est vivant et bien équilibré. Continue — la régularité fait le chêne.`;
}

// ── Entrée publique ─────────────────────────────────────────────────────────
export function initTreeWidget(userData, opts) {
  const stage = document.getElementById('tree-stage');
  if (!stage) return;
  injectCss();
  opts = opts || {};
  const needsOnboarding = !!opts.needsOnboarding;
  const onOnboardingComplete = opts.onOnboardingComplete;
  // Diagnostic : visible dans la console pour vérifier que la nouvelle version
  // tourne et que l'onboarding est bien attendu pour ce compte.
  try { console.log('[CYL] tree-widget v47 — needsOnboarding:', needsOnboarding); } catch (_) {}

  const realTree = treeFromUserDoc(userData || {});
  // En onboarding, on bâtit l'arbre « destination » (8 branches plantées) ;
  // la croissance est ensuite révélée réponse par réponse.
  let srcTree = realTree;
  if (needsOnboarding) {
    // Seules les branches qu'on va planter dans l'onboarding sont seedées.
    // Les autres restent dormantes — elles grandiront avec l'usage du site.
    const seededBranches = new Set(ONBOARDING.map((o) => o.branch));
    srcTree = { v: realTree.v, createdAt: realTree.createdAt, branches: {} };
    for (const k of Object.keys(realTree.branches)) {
      const b = realTree.branches[k];
      const seed = seededBranches.has(k) ? ONBOARD_XP : 0;
      srcTree.branches[k] = { xp: (b.xp || 0) + seed, lastActionAt: Date.now() };
    }
  }
  const model = toVisualModel(srcTree);
  const name = (userData && (userData.displayName || userData.username) || '').trim();
  const totalXp = model.branches.reduce((s, b) => s + (b.xp || 0), 0);

  // « Qu'est-ce qui a poussé depuis la dernière visite ? » — diff localStorage.
  const SEEN_KEY = 'cyl_tree_seen_xp';
  let grownBranches = [];
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw !== null && !needsOnboarding) {
      const seen = JSON.parse(raw) || {};
      grownBranches = model.branches
        .filter((b) => (b.xp || 0) > (seen[b.key] || 0))
        .map((b) => ({ key: b.key, label: b.label, delta: (b.xp || 0) - (seen[b.key] || 0) }));
    }
    const snap = {};
    model.branches.forEach((b) => { snap[b.key] = b.xp || 0; });
    localStorage.setItem(SEEN_KEY, JSON.stringify(snap));
  } catch (_) { /* localStorage indisponible — sans gravité */ }

  // ── Chrome (créé en JS — index.html ne fournit qu'un <div> vide) ──────────
  const canvas = document.createElement('canvas');
  stage.appendChild(canvas);

  const labelsWrap = document.createElement('div');
  labelsWrap.className = 'tw-labels';
  stage.appendChild(labelsWrap);

  stage.insertAdjacentHTML('beforeend', `
    <div class="tw-hud">
      <div class="tw-hud-stage">${STAGE_LABEL[model.stage] || 'Ton arbre'}</div>
      <div class="tw-hud-xp"><span id="tw-xpv">${totalXp.toLocaleString('fr-FR')}</span><small>XP</small></div>
    </div>
    <div class="tw-hint">
      <div class="tw-hint-l">
        <span class="tw-hint-stage">🌳 Ton arbre de vie — ${STAGE_LABEL[model.stage] || ''}</span>
        <span class="tw-hint-xp">${totalXp.toLocaleString('fr-FR')} XP cumulés · 8 branches</span>
      </div>
      <span class="tw-hint-cta">Clique pour explorer →</span>
    </div>
    <button class="tw-close" type="button" aria-label="Fermer">✕</button>
    <aside class="tw-panel" id="tw-panel"></aside>
    <section class="tw-lya">
      <div class="tw-lya-orb" aria-hidden="true"></div>
      <div class="tw-lya-body">
        <div class="tw-lya-name">Lya</div>
        <div class="tw-lya-line" id="tw-lya-line"></div>
        <form class="tw-lya-form" id="tw-lya-form">
          <input class="tw-lya-input" id="tw-lya-input" type="text" autocomplete="off"
                 placeholder="Parle à Lya — pose-lui une question sur ton arbre…" />
          <button class="tw-lya-send" id="tw-lya-send" type="submit" aria-label="Envoyer">➤</button>
        </form>
        <div class="tw-onb" id="tw-onb"></div>
      </div>
    </section>
  `);
  const panel = stage.querySelector('#tw-panel');
  const lyaSection = stage.querySelector('.tw-lya');
  const lyaLine = stage.querySelector('#tw-lya-line');
  const lyaForm = stage.querySelector('#tw-lya-form');
  const lyaInput = stage.querySelector('#tw-lya-input');
  const lyaSend = stage.querySelector('#tw-lya-send');
  const onbBox = stage.querySelector('#tw-onb');

  // Le panneau et la zone de Lya ne doivent pas déclencher l'orbite / le clic
  // sur une branche — on isole leurs événements pointeur de la scène.
  ['pointerdown', 'pointerup', 'pointermove', 'wheel', 'click'].forEach((ev) => {
    lyaSection.addEventListener(ev, (e) => e.stopPropagation());
    panel.addEventListener(ev, (e) => e.stopPropagation());
  });

  // ── Lya parle (machine à écrire) ──────────────────────────────────────────
  let lyaTypeTok = 0;
  function lyaSay(text) {
    const tok = ++lyaTypeTok;
    let i = 0;
    lyaLine.textContent = '';
    (function tick() {
      if (tok !== lyaTypeTok) return;
      if (i <= text.length) { lyaLine.textContent = text.slice(0, i++); setTimeout(tick, 16); }
    })();
  }
  if (!needsOnboarding) lyaSay(lyaMessage(model, name));

  // ── Lya en conversation libre (Gemini via /api/coach) ─────────────────────
  const lyaHistory = [];
  let lyaBusy = false;
  async function sendToLya(text) {
    const msg = (text || '').trim();
    if (!msg || lyaBusy) return;
    lyaBusy = true;
    lyaSend.disabled = true;
    lyaInput.value = '';
    lyaSection.classList.add('thinking');
    lyaSay('Lya réfléchit…');
    lyaHistory.push({ role: 'user', content: msg });
    try {
      const fb = window._cyfFirebase;
      const user = fb && fb.auth && fb.auth.currentUser;
      if (!user) throw new Error('not-signed-in');
      const idToken = await user.getIdToken();
      // contexte : l'état réel de l'arbre → Lya « voit » l'arbre
      const userProfile = {
        prenom: name || undefined,
        arbre: {
          stade: model.stage,
          xpTotal: totalXp,
          branches: model.branches.map((b) => ({
            nom: b.label, niveau: b.level, dev: b.dev,
            vitalite: b.vitality, etat: b.state,
          })),
        },
      };
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, messages: lyaHistory, userProfile }),
      });
      if (!res.ok) {
        lyaHistory.pop();
        let detail = '';
        try { const j = await res.json(); detail = j && (j.error || j.details) ? ` (${(j.error || '') + (j.geminiStatus ? ' · Gemini ' + j.geminiStatus : '')})` : ''; } catch (_) {}
        lyaSay(res.status === 429
          ? `Lya a besoin d’une minute — réessaie dans un instant.${detail}`
          : (res.status === 401 || res.status === 403)
            ? `Reconnecte-toi pour parler à Lya.${detail}`
            : `Lya est indisponible pour l’instant${detail}`);
        return;
      }
      const data = await res.json();
      const reply = (data && data.reply)
        ? String(data.reply) : 'Je n’ai pas su quoi répondre — reformule ?';
      lyaHistory.push({ role: 'assistant', content: reply });
      lyaSay(reply);
    } catch (e) {
      lyaHistory.pop();
      lyaSay('Lya est hors ligne pour l’instant.');
    } finally {
      lyaBusy = false;
      lyaSend.disabled = false;
      lyaSection.classList.remove('thinking');
    }
  }
  lyaForm.addEventListener('submit', (e) => { e.preventDefault(); sendToLya(lyaInput.value); });

  // ── Onboarding conversationnel — Lya plante l'arbre avec l'utilisateur ────
  // mode : 'intro' (pousse auto) · 'onboarding' (pousse pilotée) · 'live'
  let mode = needsOnboarding ? 'onboarding' : 'intro';
  let curAge = needsOnboarding ? 0.10 : 0;
  let targetAge = 0.10;
  let onbActive = needsOnboarding;
  let celebrateStart = null;
  let celebrateKeys = new Set();

  function celebrate(branchKey) {
    celebrateStart = clock.getElapsedTime();
    celebrateKeys = new Set([branchKey]);
  }
  function showChips(items, onPick) {
    onbBox.innerHTML = '';
    items.forEach((label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tw-onb-chip';
      b.textContent = label;
      b.addEventListener('click', () => onPick(label));
      onbBox.appendChild(b);
    });
    onbBox.classList.add('on');
  }
  function clearChips() { onbBox.innerHTML = ''; onbBox.classList.remove('on'); }
  function endOnboarding(completed) {
    onbActive = false;
    targetAge = 1;
    clearChips();
    lyaSection.classList.remove('onb');
    if (completed && typeof onOnboardingComplete === 'function') {
      try { onOnboardingComplete(); } catch (_) { /* non bloquant */ }
    }
  }
  function runOnboarding() {
    lyaSection.classList.add('onb');
    const greet = name ? `Bonjour ${name}.` : 'Bonjour.';
    lyaSay(`${greet} Je suis Lya. Plantons ensemble la première branche de ton arbre — il grandira au fil de tes actions. Une question pour commencer.`);
    showChips(['C’est parti 🌱'], () => askQuestion(0));

    function askQuestion(i) {
      if (i >= ONBOARDING.length) {
        clearChips();
        lyaSay('Voilà — la première branche est plantée. Les 7 autres sont là, dormantes : elles s’éveilleront au fil de tes actions vraies sur ce site. Tu médites → Physiologique pousse. Tu journales → Cognitif pousse. Tu atteins un objectif → Accomplissement pousse. Pas d’XP creux, on agit dans le réel et l’arbre le voit. Je reste là — parle-moi quand tu veux.');
        endOnboarding(true);
        return;
      }
      const o = ONBOARDING[i];
      lyaSay(o.q);
      showChips(o.chips, () => {
        clearChips();
        targetAge = 0.12 + ((i + 1) / ONBOARDING.length) * 0.88;
        celebrate(o.branch);
        const b = model.branches.find((x) => x.key === o.branch);
        lyaSay(`${b ? b.label : 'Cette branche'} prend racine 🌱`);
        try {
          if (window._cyfFirebase && window._cyfFirebase.awardXp) {
            window._cyfFirebase.awardXp(o.branch, ONBOARD_XP);
          }
        } catch (_) { /* l'XP est non bloquant pour le déroulé */ }
        setTimeout(() => askQuestion(i + 1), 1600);
      });
    }
  }

  // ── Three.js ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.6;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);
  scene.add(new THREE.HemisphereLight(0x9ecaff, 0x070e1a, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(30, 70, 36); scene.add(key);
  const fill = new THREE.DirectionalLight(0x4a90e2, 0.7);
  fill.position.set(-36, 30, -20); scene.add(fill);

  const { group, nodes, subNodes, grow } = buildTree(THREE, model);
  scene.add(group);

  const target = new THREE.Vector3(0, 40, 0);
  const controls = makeControls(stage, camera, target);

  // ── Labels projetés (8 branches + sous-éléments de la branche ouverte) ────
  function makeLabel(mesh, sub) {
    const el = document.createElement('div');
    el.className = sub ? 'tw-label sub' : 'tw-label';
    el.textContent = mesh.userData.label || '';
    el.style.color = hex(mesh.userData.color || 0xffffff);
    if (!sub && mesh.userData.state === 'dormant') el.style.opacity = '0.55';
    labelsWrap.appendChild(el);
    return { el, mesh, sub };
  }
  const labels = nodes.map((m) => makeLabel(m, false)).concat(
    (subNodes || []).filter((m) => m.userData && m.userData.label).map((m) => makeLabel(m, true)));
  let activeSubKey = null;
  const _v = new THREE.Vector3();
  function updateLabels() {
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const { el, mesh, sub } of labels) {
      if (sub && mesh.userData.key !== activeSubKey) { el.style.visibility = 'hidden'; continue; }
      mesh.getWorldPosition(_v).project(camera);
      if (_v.z > 1) { el.style.visibility = 'hidden'; continue; }
      el.style.visibility = 'visible';
      el.style.left = ((_v.x * 0.5 + 0.5) * w) + 'px';
      el.style.top = ((-_v.y * 0.5 + 0.5) * h - (sub ? 15 : 22)) + 'px';
    }
  }

  // ── Panneau de branche : progression réelle + outils ──────────────────────
  function openBranch(branchKey) {
    const b = model.branches.find((x) => x.key === branchKey);
    if (!b) return;
    activeSubKey = branchKey;
    const col = hex(b.color);
    const prog = levelProgress(b.xp || 0);
    const vitColor = b.vitality >= 60 ? '#4ade80' : b.vitality >= 30 ? '#fbbf24' : '#94a3b8';
    const tools = BRANCH_TOOLS[branchKey] || [];
    panel.innerHTML = `
      <button class="tw-p-close" type="button" aria-label="Fermer">✕</button>
      <div class="tw-p-head">
        <span class="tw-p-dot" style="background:${col};color:${col}"></span>
        <span class="tw-p-title" style="color:${col}">${b.label}</span>
      </div>
      <div class="tw-p-desc">${BRANCH_DESC[branchKey] || ''}</div>
      <div class="tw-p-lvl">Niveau ${prog.level} · ${(b.xp || 0).toLocaleString('fr-FR')} XP cumulés${b.state === 'dormant' ? ' · branche dormante' : ''}</div>
      <div class="tw-bar">
        <div class="tw-bar-top"><span>Niveau ${prog.level} → ${prog.level + 1}</span><span>${prog.inLevel}/${prog.need} XP</span></div>
        <div class="tw-bar-bg"><div class="tw-bar-fill" data-w="${prog.pct}" style="background:${col}"></div></div>
      </div>
      <div class="tw-bar">
        <div class="tw-bar-top"><span>Développement</span><span>${b.dev}/100</span></div>
        <div class="tw-bar-bg"><div class="tw-bar-fill" data-w="${b.dev}" style="background:${col}"></div></div>
      </div>
      <div class="tw-bar">
        <div class="tw-bar-top"><span>Vitalité</span><span>${b.vitality}/100</span></div>
        <div class="tw-bar-bg"><div class="tw-bar-fill" data-w="${b.vitality}" style="background:${vitColor}"></div></div>
      </div>
      <div class="tw-sec-label">Ce qui fait grandir cette branche</div>
      ${(b.sub || []).map((s) => `<div class="tw-sub"><span class="tw-sub-dot" style="background:${col}"></span>${s}</div>`).join('')}
      <div class="tw-sec-label">Tes outils</div>
      ${tools.length
        ? tools.map((t) => `<a class="tw-tool" href="${t.href}"><span class="tw-tool-ic">${t.icon}</span><span class="tw-tool-nm">${t.label}</span><span class="tw-tool-go">Ouvrir →</span></a>`).join('')
        : '<div class="tw-empty">Module dédié à venir — cette branche grandira bientôt.</div>'}
    `;
    panel.classList.add('open');
    lyaSection.classList.add('shifted');
    panel.querySelector('.tw-p-close').addEventListener('click', (e) => {
      e.stopPropagation(); closeBranch();
    });
    requestAnimationFrame(() => {
      panel.querySelectorAll('.tw-bar-fill').forEach((f) => { f.style.width = (f.dataset.w || 0) + '%'; });
    });
    lyaSay(`${b.label} — voici sa progression réelle et les outils pour la nourrir.`);
  }
  function closeBranch() {
    panel.classList.remove('open');
    lyaSection.classList.remove('shifted');
    activeSubKey = null;
  }

  // ── Plein écran / fermeture ───────────────────────────────────────────────
  // En plein écran on déplace le conteneur dans <body> : il échappe au
  // contexte d'empilement du dashboard et passe vraiment au-dessus de tout.
  let homeParent = null, homeNext = null;
  function expand() {
    if (stage.classList.contains('expanded')) return;
    if (stage.parentNode && stage.parentNode !== document.body) {
      homeParent = stage.parentNode;
      homeNext = stage.nextSibling;
      document.body.appendChild(stage);
    }
    stage.classList.add('expanded');
    controls.setTargetRadius(150);
    document.body.style.overflow = 'hidden';
    resize();
    try { document.dispatchEvent(new CustomEvent('cyl:tree-expand')); } catch (_) {}
  }
  function collapse() {
    stage.classList.remove('expanded');
    closeBranch();
    if (homeParent) {
      homeParent.insertBefore(stage, homeNext);
      homeParent = null; homeNext = null;
    }
    controls.setTargetRadius(118);
    document.body.style.overflow = '';
    resize();
    try { document.dispatchEvent(new CustomEvent('cyl:tree-collapse')); } catch (_) {}
  }
  const closeBtn = stage.querySelector('.tw-close');
  // Isole la croix du handler global de la scène (sinon le clic compte
  // aussi comme « clic dans le vide » et déclenche un double collapse).
  ['pointerdown', 'pointerup'].forEach((ev) => closeBtn.addEventListener(ev, (e) => e.stopPropagation()));
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onbActive) endOnboarding(true);   // ✕ pendant l'onboarding = passer
    collapse();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (panel.classList.contains('open')) closeBranch();
    else if (stage.classList.contains('expanded')) {
      if (onbActive) endOnboarding(true);
      collapse();
    }
  });

  // ── Clic : widget → expand · plein écran → branche la plus proche ─────────
  const _p = new THREE.Vector3();
  function nearestNode(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    let best = null, bestD = 999;
    for (const m of nodes) {
      m.getWorldPosition(_p).project(camera);
      if (_p.z > 1) continue;
      const sx = rect.left + (_p.x * 0.5 + 0.5) * rect.width;
      const sy = rect.top + (-_p.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(sx - clientX, sy - clientY);
      if (d < bestD) { bestD = d; best = m; }
    }
    return bestD < 70 ? best : null;
  }
  stage.addEventListener('pointerup', (e) => {
    if (controls.wasDrag()) return;
    if (!stage.classList.contains('expanded')) { expand(); return; }
    if (onbActive) return;            // pendant l'onboarding, on garde le focus
    const hit = nearestNode(e.clientX, e.clientY);
    if (hit) { openBranch(hit.userData.key); return; }
    // Clic dans le vide en plein écran → ferme l'arbre (UX standard, plus
    // besoin d'attraper la croix ou de presser Échap).
    collapse();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!stage.classList.contains('expanded') || controls.isDragging() || onbActive) return;
    // Curseur : pointer sur une branche, zoom-out ailleurs (indique « cliquer
    // ferme »). Standard sur les lightboxes / Google Maps fullscreen.
    stage.style.cursor = nearestNode(e.clientX, e.clientY) ? 'pointer' : 'zoom-out';
  });
  stage.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !stage.classList.contains('expanded')) {
      e.preventDefault(); expand();
    }
  });

  // ── Redimensionnement ─────────────────────────────────────────────────────
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);
  resize();

  // ── Boucle : croissance (intro / onboarding) puis vie ─────────────────────
  controls.setTargetRadius(118);
  const clock = new THREE.Clock();
  function frame() {
    const t = clock.getElapsedTime();
    if (mode === 'intro') {
      curAge = Math.min(1, t / 2.6);
      grow(curAge);
      if (curAge >= 1) {
        mode = 'live'; grow(1);
        // pousse depuis la dernière visite : pulsation festive + bilan de Lya
        if (grownBranches.length) {
          celebrateStart = t;
          celebrateKeys = new Set(grownBranches.map((g) => g.key));
          const top = grownBranches.slice().sort((a, b) => b.delta - a.delta).slice(0, 3);
          lyaSay(`Depuis ta dernière visite, ton arbre a poussé : ${top.map((g) => `${g.label} +${g.delta} XP`).join(' · ')} 🌱`);
        }
      }
    } else if (mode === 'onboarding') {
      // l'âge de croissance suit la progression des réponses
      curAge += (Math.min(1, targetAge) - curAge) * 0.045;
      grow(Math.min(1, curAge));
      if (!onbActive && curAge > 0.999) { grow(1); mode = 'live'; }
    }
    if (!controls.isDragging() && !panel.classList.contains('open')) {
      group.rotation.y += 0.0018;
    }
    for (const m of nodes) {
      let pulse = 1 + Math.sin(t * 2 + m.position.y) * 0.08;
      if (celebrateStart != null && celebrateKeys.has(m.userData.key)) {
        const e = t - celebrateStart;
        if (e < 3.2) pulse *= 1 + (1 - e / 3.2) * (0.55 + 0.35 * Math.sin(e * 10));
      }
      m.scale.setScalar((m.userData.baseR || 1) * pulse);
    }
    controls.apply();
    updateLabels();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();

  // un nouvel utilisateur : Lya l'accueille et plante l'arbre avec lui
  if (needsOnboarding) { expand(); runOnboarding(); }
}
