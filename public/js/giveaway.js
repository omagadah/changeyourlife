// public/js/giveaway.js - v1
// Module Giveaway : compte à rebours façon iOS + cooldown de participation.
// Violet (contraste avec l'app bleutée). Injecté en haut de /app après login.
//
// Fonctionnement :
//  - Un tirage a lieu à cadence fixe (hebdo, dimanche 20:00 heure locale).
//  - Le compte à rebours iOS égrène le temps jusqu'au prochain tirage.
//  - « Participer » enregistre la participation pour le cycle courant (localStorage,
//    clé dépendante de l'UID si connecté) → bouton verrouillé + état "cooldown"
//    jusqu'au tirage suivant.
//
// Backend : les participations sont persistées dans Firestore
// (giveaways/{cycleId}/entries/{uid}) → cross-device, définitives. localStorage
// sert de cache instantané / repli anonyme. Le TIRAGE reste à faire côté serveur
// (Admin SDK) le jour du plan Blaze.

import { doc, getDoc, setDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

let _db = null, _auth = null;
try { if (window._cyfFirebase) { _db = window._cyfFirebase.db; _auth = window._cyfFirebase.auth; } } catch (_) {}
function currentUid() { try { return _auth?.currentUser?.uid || null; } catch (_) { return null; } }

const GIVEAWAY = {
  // Lot mis en jeu (éditable ici en attendant un back-office).
  prize: '1 mois d\'accès Premium + goodies CYL',
  // Jour de tirage : 0=dimanche … 6=samedi. Heure locale.
  drawWeekday: 0,
  drawHour: 20,
};

// ── Prochain tirage (prochaine occurrence du créneau hebdo) ──────────────────
function nextDrawDate(now) {
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(GIVEAWAY.drawHour);
  // Avance jusqu'au bon jour de la semaine
  let delta = (GIVEAWAY.drawWeekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  // Si on est pile le jour mais l'heure est passée → semaine suivante
  if (d.getTime() <= now) d.setDate(d.getDate() + 7);
  return d;
}

// Identifiant du cycle courant = timestamp du prochain tirage (unique par semaine)
function currentCycleId(now) {
  return String(nextDrawDate(now).getTime());
}

function entryKey() {
  let uid = 'anon';
  try { uid = (window._cyfFirebase?.auth?.currentUser?.uid) || 'anon'; } catch (_) {}
  return `cyl_giveaway_entry_${uid}`;
}

function hasEnteredCurrentCycle(now) {
  try {
    const raw = localStorage.getItem(entryKey());
    return raw && raw === currentCycleId(now);
  } catch (_) { return false; }
}

function markEntered(now) {
  try { localStorage.setItem(entryKey(), currentCycleId(now)); } catch (_) {}
}

// ── Persistance Firestore (giveaways/{cycleId}/entries/{uid}) ────────────────
function entryDocRef(cycleId, uid) {
  if (!_db || !uid) return null;
  return doc(_db, 'giveaways', cycleId, 'entries', uid);
}
async function writeFirestoreEntry(cycleId) {
  const uid = currentUid();
  const ref = entryDocRef(cycleId, uid);
  if (!ref) return; // anonyme / pas de db → localStorage seul
  try {
    await setDoc(ref, { uid, cycleId, ts: serverTimestamp() });
  } catch (e) { console.warn('[giveaway] write entry failed', e && e.message); }
}
async function checkFirestoreEntry(cycleId) {
  const uid = currentUid();
  const ref = entryDocRef(cycleId, uid);
  if (!ref) return false;
  try { const s = await getDoc(ref); return s.exists(); }
  catch (e) { console.warn('[giveaway] check entry failed', e && e.message); return false; }
}

// ── Rendu ────────────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('cyl-giveaway-css')) return;
  const s = document.createElement('style');
  s.id = 'cyl-giveaway-css';
  s.textContent = `
    .gw-card {
      order: -7; position: relative; overflow: hidden;
      border-radius: 18px; margin-bottom: 22px;
      padding: 20px 22px;
      background:
        radial-gradient(120% 140% at 100% 0%, rgba(192,132,252,0.20), transparent 55%),
        linear-gradient(135deg, rgba(124,58,237,0.20), rgba(168,85,247,0.08));
      border: 1px solid rgba(168,85,247,0.42);
      box-shadow: 0 10px 34px rgba(124,58,237,0.22);
      animation: fadeUp .5s cubic-bezier(.4,0,.2,1) both;
    }
    .gw-card::before {
      content: ''; position: absolute; right: -40px; top: -40px;
      width: 160px; height: 160px; border-radius: 50%;
      background: radial-gradient(circle, rgba(192,132,252,0.28), transparent 70%);
      pointer-events: none;
    }
    .gw-head { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; position: relative; z-index: 1; }
    .gw-emoji { font-size: 1.8rem; filter: drop-shadow(0 2px 8px rgba(124,58,237,0.5)); flex-shrink: 0; }
    .gw-titles { flex: 1; min-width: 0; }
    .gw-title { font-size: 1.05rem; font-weight: 800; color: #f3e8ff; letter-spacing: -0.2px; display: flex; align-items: center; gap: 8px; }
    .gw-pill {
      font-size: 0.6rem; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase;
      padding: 3px 8px; border-radius: 999px; color: #f3e8ff;
      background: rgba(168,85,247,0.28); border: 1px solid rgba(192,132,252,0.5);
    }
    .gw-prize { font-size: 0.83rem; color: #d8b4fe; margin-top: 2px; line-height: 1.4; }

    .gw-timer { display: flex; gap: 10px; margin: 16px 0 4px; position: relative; z-index: 1; flex-wrap: wrap; }
    .gw-seg {
      flex: 1; min-width: 58px;
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      padding: 12px 6px; border-radius: 14px;
      background: rgba(10,6,22,0.5);
      border: 1px solid rgba(192,132,252,0.22);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
    }
    .gw-seg-val {
      font-size: 1.7rem; font-weight: 800; line-height: 1;
      color: #f5ecff; font-variant-numeric: tabular-nums;
      font-family: ui-monospace, "SF Mono", "SFMono-Regular", Menlo, monospace;
      letter-spacing: 0.5px;
    }
    .gw-seg-lbl { font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.8px; color: #a78bda; font-weight: 700; }

    .gw-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; position: relative; z-index: 1; flex-wrap: wrap; }
    .gw-hint { font-size: 0.74rem; color: #b79be0; }
    .gw-hint strong { color: #e9d5ff; }
    .gw-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 22px; border-radius: 12px; border: none; cursor: pointer;
      font-family: inherit; font-size: 0.88rem; font-weight: 800; letter-spacing: -0.1px;
      color: #fff;
      background: linear-gradient(135deg, #7c3aed, #a855f7);
      box-shadow: 0 6px 20px rgba(124,58,237,0.45);
      transition: transform .18s cubic-bezier(.4,0,.2,1), box-shadow .2s, filter .2s;
    }
    .gw-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(168,85,247,0.55); filter: brightness(1.06); }
    .gw-btn:active { transform: translateY(0) scale(0.97); }
    .gw-btn[disabled] {
      cursor: default; background: rgba(168,85,247,0.14);
      color: #c4b5fd; box-shadow: none; border: 1px solid rgba(168,85,247,0.3);
    }
    .gw-btn[disabled]:hover { transform: none; filter: none; }
    .gw-entered {
      display: inline-flex; align-items: center; gap: 7px;
      font-size: 0.82rem; font-weight: 700; color: #d8b4fe;
      padding: 8px 14px; border-radius: 10px;
      background: rgba(34,197,94,0.1); border: 1px solid rgba(134,239,172,0.35); color: #bbf7d0;
    }
    body.light-mode .gw-title { color: #4c1d95; }
    body.light-mode .gw-prize { color: #6d28d9; }
    body.light-mode .gw-seg-val { color: #4c1d95; }
    body.light-mode .gw-seg { background: rgba(255,255,255,0.55); }
    @media (prefers-reduced-motion: reduce) { .gw-card { animation: none; } }
  `;
  document.head.appendChild(s);
}

function pad(n) { return String(n).padStart(2, '0'); }

export function initGiveaway() {
  const container = document.querySelector('.app-container');
  if (!container || document.getElementById('giveaway-card')) return;

  injectStyles();

  const card = document.createElement('div');
  card.id = 'giveaway-card';
  card.className = 'gw-card';
  card.innerHTML = `
    <div class="gw-head">
      <span class="gw-emoji">🎁</span>
      <div class="gw-titles">
        <div class="gw-title">Giveaway de la semaine <span class="gw-pill">Gratuit</span></div>
        <div class="gw-prize">À gagner : <strong>${GIVEAWAY.prize}</strong></div>
      </div>
    </div>
    <div class="gw-timer" id="gw-timer" role="timer" aria-label="Temps avant le prochain tirage">
      <div class="gw-seg"><span class="gw-seg-val" id="gw-d">00</span><span class="gw-seg-lbl">Jours</span></div>
      <div class="gw-seg"><span class="gw-seg-val" id="gw-h">00</span><span class="gw-seg-lbl">Heures</span></div>
      <div class="gw-seg"><span class="gw-seg-val" id="gw-m">00</span><span class="gw-seg-lbl">Min</span></div>
      <div class="gw-seg"><span class="gw-seg-val" id="gw-s">00</span><span class="gw-seg-lbl">Sec</span></div>
    </div>
    <div class="gw-foot">
      <div class="gw-hint" id="gw-hint">Participe avant la fin du compte à rebours.</div>
      <div id="gw-action"></div>
    </div>
  `;
  container.appendChild(card);

  const el = {
    d: card.querySelector('#gw-d'), h: card.querySelector('#gw-h'),
    m: card.querySelector('#gw-m'), s: card.querySelector('#gw-s'),
    hint: card.querySelector('#gw-hint'), action: card.querySelector('#gw-action'),
  };

  function renderAction() {
    const now = Date.now();
    if (hasEnteredCurrentCycle(now)) {
      el.action.innerHTML = `<span class="gw-entered">✓ Tu participes</span>`;
      el.hint.innerHTML = `Tu es <strong>inscrit</strong> pour ce tirage. Prochaine participation après le prochain tirage.`;
    } else {
      el.action.innerHTML = `<button class="gw-btn" id="gw-participate" type="button">🎟️ Participer</button>`;
      el.hint.innerHTML = `Participe avant la fin du compte à rebours.`;
      const btn = el.action.querySelector('#gw-participate');
      btn.addEventListener('click', () => {
        const cid = currentCycleId(Date.now());
        markEntered(Date.now());          // cache instantané
        renderAction();
        writeFirestoreEntry(cid);         // persistance backend (async)
        try { window.dispatchEvent(new CustomEvent('cyf:giveaway-entered')); } catch (_) {}
      });
    }
  }

  function tick() {
    const now = Date.now();
    let diff = Math.max(0, nextDrawDate(now).getTime() - now);
    const days = Math.floor(diff / 86400000); diff -= days * 86400000;
    const hrs = Math.floor(diff / 3600000);  diff -= hrs * 3600000;
    const mins = Math.floor(diff / 60000);    diff -= mins * 60000;
    const secs = Math.floor(diff / 1000);
    el.d.textContent = pad(days);
    el.h.textContent = pad(hrs);
    el.m.textContent = pad(mins);
    el.s.textContent = pad(secs);
    // Nouveau cycle atteint → réafficher le bouton de participation
    if (days === 0 && hrs === 0 && mins === 0 && secs === 0) renderAction();
  }

  renderAction();
  tick();
  setInterval(tick, 1000);

  // Synchro backend : si l'utilisateur a déjà participé sur un autre appareil,
  // on reflète l'état (une fois l'auth prête).
  async function syncFromBackend() {
    const cid = currentCycleId(Date.now());
    if (hasEnteredCurrentCycle(Date.now())) return; // déjà connu localement
    const entered = await checkFirestoreEntry(cid);
    if (entered) { markEntered(Date.now()); renderAction(); }
  }
  if (currentUid()) syncFromBackend();
  else if (_auth) {
    // attend que l'auth soit prête (une seule fois)
    const stop = onAuthStateChanged(_auth, (u) => { if (u) { try { stop && stop(); } catch (_) {} syncFromBackend(); } });
  }
}

// Auto-init (chargé en <script type="module" src> ; l'inline est bloqué par la CSP).
function boot() { try { initGiveaway(); } catch (e) { console.warn('giveaway', e); } }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

export default { initGiveaway };
