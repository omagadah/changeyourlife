// public/js/id-badge.js - v1
// Badge d'identité interactif façon « lanyard de conférence » (réf. Vercel Ship '26).
// La carte pend d'un cordon, se balance avec une physique de pendule quand on la
// tire à la souris/au doigt, puis revient se stabiliser (ressort + amortissement).
// Léger tilt 3D + reflet. Données tirées de la fiche profil (nom, titre, XP, avatar).

const CLAMP = (v, a, b) => Math.min(b, Math.max(a, v));

function injectStyles() {
  if (document.getElementById('cyl-idbadge-css')) return;
  const s = document.createElement('style');
  s.id = 'cyl-idbadge-css';
  s.textContent = `
    .idb-stage { position: relative; width: 100%; height: 400px; display: flex; justify-content: center; overflow: visible; user-select: none; -webkit-user-select: none; }
    .idb-pivot { position: absolute; top: 0; left: 50%; transform: translateX(-50%); transform-origin: top center; will-change: transform; }
    /* Cordon (lanyard) */
    .idb-strap {
      width: 26px; height: 118px; margin: 0 auto;
      background:
        repeating-linear-gradient(180deg, #7c3aed 0 9px, #6d28d9 9px 18px);
      border-radius: 4px;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12), 0 2px 6px rgba(0,0,0,0.4);
      position: relative;
    }
    .idb-strap::after {
      content: 'CYL'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 0.5rem; font-weight: 900; letter-spacing: 1px; color: rgba(255,255,255,0.75);
      writing-mode: vertical-rl; text-orientation: upright;
    }
    /* Attache métallique */
    .idb-clip { width: 40px; height: 20px; margin: -3px auto 0; border-radius: 5px;
      background: linear-gradient(180deg, #e8e8ee, #9a9aa4 60%, #6e6e78);
      box-shadow: 0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.6); position: relative; z-index: 2; }
    .idb-hole { width: 34px; height: 9px; margin: 4px auto -4px; border-radius: 999px; background: #0b0e14;
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.8); position: relative; z-index: 3; }

    /* Carte */
    .idb-card {
      width: 250px; margin: 6px auto 0; padding: 18px 18px 16px;
      border-radius: 16px; cursor: grab; position: relative; overflow: hidden;
      background: linear-gradient(160deg, #14121f 0%, #1c1830 55%, #241a3d 100%);
      border: 1px solid rgba(168,85,247,0.4);
      box-shadow: 0 22px 46px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08);
      transform-style: preserve-3d;
    }
    .idb-card:active { cursor: grabbing; }
    .idb-card::after { /* reflet mobile */
      content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: 16px;
      background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.14) var(--glare,50%), transparent 70%);
      mix-blend-mode: screen; transition: background .05s linear;
    }
    .idb-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .idb-brand { display: flex; align-items: center; gap: 7px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.4px; color: #d8b4fe; }
    .idb-brand b { color: #fff; }
    .idb-live { font-size: 0.56rem; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: #86efac;
      display: inline-flex; align-items: center; gap: 4px; }
    .idb-live::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 6px #22c55e; }
    .idb-photo {
      width: 96px; height: 96px; border-radius: 14px; margin: 0 auto 12px;
      background: #2a2340 center/cover no-repeat;
      display: flex; align-items: center; justify-content: center;
      font-size: 2.4rem; font-weight: 800; color: #e9d5ff;
      border: 2px solid rgba(230,230,235,0.45);
      box-shadow: 0 8px 20px rgba(0,0,0,0.45);
    }
    .idb-name { text-align: center; font-size: 1.12rem; font-weight: 800; color: #f5ecff; letter-spacing: -0.3px; line-height: 1.15; }
    .idb-title { text-align: center; font-size: 0.76rem; color: #c4b5fd; font-style: italic; margin-top: 2px; min-height: 14px; }
    .idb-meta { display: flex; justify-content: space-between; gap: 10px; margin-top: 13px; padding-top: 12px; border-top: 1px dashed rgba(168,85,247,0.28); }
    .idb-meta-i { text-align: left; }
    .idb-meta-l { font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.7px; color: #9a86c4; font-weight: 700; }
    .idb-meta-v { font-size: 0.86rem; font-weight: 800; color: #ede9fe; font-variant-numeric: tabular-nums; margin-top: 1px; }
    .idb-barcode { margin-top: 13px; height: 30px; border-radius: 5px;
      background-image: repeating-linear-gradient(90deg, #e9e6f2 0 2px, transparent 2px 4px, #e9e6f2 4px 5px, transparent 5px 9px, #e9e6f2 9px 12px, transparent 12px 14px);
      background-color: transparent; opacity: 0.85; }
    .idb-hint { text-align: center; font-size: 0.68rem; color: #7c6ba0; margin-top: 12px; }
    body.light-mode .idb-hint { color: #8b7bb0; }
    @media (max-width: 420px) { .idb-card { width: 220px; } }
  `;
  document.head.appendChild(s);
}

function readProfile() {
  const txt = (id, d) => { const e = document.getElementById(id); const v = e && e.textContent && e.textContent.trim(); return (v && v !== '-') ? v : d; };
  let avatar = '';
  try { avatar = localStorage.getItem('userAvatarUrl') || ''; } catch (_) {}
  return {
    name: txt('username-display', 'Membre CYL'),
    title: txt('title-display', ''),
    player: txt('player-id', 'Player #—'),
    xp: txt('hero-stat-xp', '0'),
    avatar,
  };
}

export function initIdBadge(mount) {
  const host = mount || document.getElementById('id-badge-mount');
  if (!host || host.dataset.ready === '1') return;
  host.dataset.ready = '1';
  injectStyles();

  host.classList.add('idb-stage');
  host.innerHTML = `
    <div class="idb-pivot" id="idb-pivot">
      <div class="idb-strap"></div>
      <div class="idb-clip"></div>
      <div class="idb-hole"></div>
      <div class="idb-card" id="idb-card">
        <div class="idb-top">
          <span class="idb-brand">🌳 <b>ChangeYourLife</b></span>
          <span class="idb-live">Live</span>
        </div>
        <div class="idb-photo" id="idb-photo"></div>
        <div class="idb-name" id="idb-name">Membre CYL</div>
        <div class="idb-title" id="idb-title"></div>
        <div class="idb-meta">
          <div class="idb-meta-i"><div class="idb-meta-l">Identifiant</div><div class="idb-meta-v" id="idb-player">Player #—</div></div>
          <div class="idb-meta-i" style="text-align:right"><div class="idb-meta-l">XP total</div><div class="idb-meta-v" id="idb-xp">0</div></div>
        </div>
        <div class="idb-barcode"></div>
        <div class="idb-hint">Attrape le badge et fais-le balancer ✋</div>
      </div>
    </div>
  `;

  const pivot = host.querySelector('#idb-pivot');
  const card = host.querySelector('#idb-card');
  const photo = host.querySelector('#idb-photo');

  // ── Remplissage des données (et MAJ live via observer) ─────────────────────
  function fill() {
    const p = readProfile();
    host.querySelector('#idb-name').textContent = p.name;
    host.querySelector('#idb-title').textContent = p.title;
    host.querySelector('#idb-player').textContent = p.player;
    host.querySelector('#idb-xp').textContent = p.xp;
    if (p.avatar) { photo.style.backgroundImage = `url("${p.avatar}")`; photo.textContent = ''; }
    else { photo.style.backgroundImage = ''; photo.textContent = (p.name[0] || 'M').toUpperCase(); }
  }
  fill();
  try {
    const obs = new MutationObserver(fill);
    ['username-display', 'title-display', 'player-id', 'hero-stat-xp'].forEach(id => {
      const e = document.getElementById(id); if (e) obs.observe(e, { childList: true, characterData: true, subtree: true });
    });
  } catch (_) {}

  // ── Physique de pendule ────────────────────────────────────────────────────
  let angle = 0;        // radians, 0 = vertical
  let vel = 0;          // vitesse angulaire
  const GRAV = 0.012;   // rappel vers 0
  const DAMP = 0.94;    // amortissement
  let dragging = false, raf = 0, lastPointerAngle = 0;

  function pivotPoint() {
    const r = pivot.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 6 };
  }
  function angleFromPointer(px, py) {
    const p = pivotPoint();
    return Math.atan2(px - p.x, py - p.y); // 0 quand pile en dessous
  }

  function render() {
    pivot.style.transform = `translateX(-50%) rotate(${angle}rad)`;
    // reflet + léger tilt 3D en fonction de l'inclinaison
    const deg = angle * 180 / Math.PI;
    card.style.transform = `rotateY(${CLAMP(-deg * 0.6, -16, 16)}deg)`;
    card.style.setProperty('--glare', `${CLAMP(50 + deg * 2.2, 8, 92)}%`);
  }

  function loop() {
    if (!dragging) {
      vel += -GRAV * Math.sin(angle);   // gravité (rappel)
      vel *= DAMP;
      angle += vel;
      // repos : on stoppe la boucle pour économiser le CPU
      if (Math.abs(vel) < 0.0004 && Math.abs(angle) < 0.0025) { angle = 0; render(); raf = 0; return; }
    }
    render();
    raf = requestAnimationFrame(loop);
  }
  function ensureLoop() { if (!raf) raf = requestAnimationFrame(loop); }

  function onDown(e) {
    dragging = true;
    card.setPointerCapture && e.pointerId != null && card.setPointerCapture(e.pointerId);
    lastPointerAngle = angleFromPointer(e.clientX, e.clientY);
    vel = 0;
    ensureLoop();
  }
  function onMove(e) {
    if (!dragging) return;
    const a = angleFromPointer(e.clientX, e.clientY);
    vel = (a - lastPointerAngle);          // vitesse = delta pour l'élan au lâcher
    angle = CLAMP(a, -1.3, 1.3);
    lastPointerAngle = a;
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    vel = CLAMP(vel, -0.28, 0.28);         // conserve l'élan
    ensureLoop();
  }

  card.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  // petite impulsion d'accueil pour montrer que ça bouge
  setTimeout(() => { if (!dragging) { vel = 0.16; ensureLoop(); } }, 500);

  render();
}

// Auto-init (chargé en <script type="module" src> ; l'inline est bloqué par la CSP).
function boot() { try { initIdBadge(); } catch (e) { console.warn('id-badge', e); } }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

export default { initIdBadge };
