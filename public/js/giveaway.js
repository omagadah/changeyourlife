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
// Retourne true si la participation est REELLEMENT enregistree cote serveur.
// Les rules exigent un email verifie : sans ce retour, l'interface affichait
// « ✓ Tu participes » alors que l'ecriture avait ete refusee en silence.
async function writeFirestoreEntry(cycleId) {
  const uid = currentUid();
  const ref = entryDocRef(cycleId, uid);
  if (!ref) return true; // anonyme / pas de db → localStorage seul, pas d'echec
  try {
    await setDoc(ref, { uid, cycleId, ts: serverTimestamp() });
    return true;
  } catch (e) {
    console.warn('[giveaway] write entry failed', e && e.code, e && e.message);
    return false;
  }
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
      position: relative; overflow: hidden;
      border-radius: 18px; margin-bottom: 22px;
      padding: 20px 22px;
      background:
        radial-gradient(120% 140% at 100% 0%, rgba(241,205,146,0.16), transparent 55%),
        linear-gradient(135deg, rgba(231,177,92,0.16), rgba(21,32,19,0.35));
      border: 1px solid rgba(231,177,92,0.38);
      box-shadow: 0 10px 34px rgba(231,177,92,0.14);
      animation: fadeUp .5s cubic-bezier(.4,0,.2,1) both;
    }
    .gw-card::before {
      content: ''; position: absolute; right: -40px; top: -40px;
      width: 160px; height: 160px; border-radius: 50%;
      background: radial-gradient(circle, rgba(241,205,146,0.22), transparent 70%);
      pointer-events: none;
    }
    .gw-head { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; position: relative; z-index: 1; }
    .gw-emoji { font-size: 1.8rem; filter: drop-shadow(0 2px 8px rgba(231,177,92,0.5)); flex-shrink: 0; }
    .gw-titles { flex: 1; min-width: 0; }
    .gw-title { font-size: 1.05rem; font-weight: 800; color: #f4efe1; letter-spacing: -0.2px; display: flex; align-items: center; gap: 8px; }
    .gw-pill {
      font-size: 0.6rem; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase;
      padding: 3px 8px; border-radius: 999px; color: #f4efe1;
      background: rgba(231,177,92,0.24); border: 1px solid rgba(241,205,146,0.5);
    }
    .gw-prize { font-size: 0.83rem; color: #f1cd92; margin-top: 2px; line-height: 1.4; }

    .gw-timer { display: flex; gap: 10px; margin: 16px 0 4px; position: relative; z-index: 1; flex-wrap: wrap; }
    .gw-seg {
      flex: 1; min-width: 58px;
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      padding: 12px 6px; border-radius: 14px;
      background: rgba(8,13,7,0.5);
      border: 1px solid rgba(231,177,92,0.20);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
    }
    .gw-seg-val {
      font-size: 1.7rem; font-weight: 800; line-height: 1;
      color: #f4efe1; font-variant-numeric: tabular-nums;
      font-family: ui-monospace, "SF Mono", "SFMono-Regular", Menlo, monospace;
      letter-spacing: 0.5px;
    }
    .gw-seg-lbl { font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.8px; color: #c0a672; font-weight: 700; }

    .gw-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; position: relative; z-index: 1; flex-wrap: wrap; }
    .gw-hint { font-size: 0.74rem; color: #b4ad94; }
    .gw-hint strong { color: #f1cd92; }
    .gw-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 22px; border-radius: 12px; border: none; cursor: pointer;
      font-family: inherit; font-size: 0.88rem; font-weight: 800; letter-spacing: -0.1px;
      color: #231803;
      background: linear-gradient(135deg, #e7b15c, #c0873a);
      box-shadow: 0 6px 20px rgba(231,177,92,0.4);
      transition: transform .18s cubic-bezier(.4,0,.2,1), box-shadow .2s, filter .2s;
    }
    .gw-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(231,177,92,0.5); filter: brightness(1.06); }
    .gw-btn:active { transform: translateY(0) scale(0.97); }
    .gw-btn[disabled] {
      cursor: default; background: rgba(231,177,92,0.12);
      color: #f1cd92; box-shadow: none; border: 1px solid rgba(231,177,92,0.3);
    }
    .gw-btn[disabled]:hover { transform: none; filter: none; }
    .gw-entered {
      display: inline-flex; align-items: center; gap: 7px;
      font-size: 0.82rem; font-weight: 700;
      padding: 8px 14px; border-radius: 10px;
      background: rgba(132,194,94,0.1); border: 1px solid rgba(132,194,94,0.35); color: #a7d585;
    }
    body.light-mode .gw-title { color: #4a3510; }
    body.light-mode .gw-prize { color: #8a6526; }
    body.light-mode .gw-seg-val { color: #4a3510; }
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
  // Place la carte juste après l'arbre (l'ordre du DOM est l'ordre visuel
  // depuis la refonte organique - plus de réordonnancement CSS par `order`).
  const tree = container.querySelector('#tree-stage');
  if (tree && tree.parentElement === container) tree.insertAdjacentElement('afterend', card);
  else container.appendChild(card);

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
      btn.addEventListener('click', async () => {
        const cid = currentCycleId(Date.now());
        btn.disabled = true;
        btn.textContent = 'Enregistrement…';
        const ok = await writeFirestoreEntry(cid);
        if (!ok) {
          // Echec serveur (email non verifie, hors fenetre, reseau) : on NE
          // marque PAS la participation, sinon l'utilisateur croit etre inscrit
          // alors que rien n'est enregistre.
          btn.disabled = false;
          btn.textContent = '🎟️ Participer';
          el.hint.innerHTML = `Participation impossible : <strong>vérifie ton email</strong> puis réessaie.`;
          return;
        }
        markEntered(Date.now());
        renderAction();
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

  // Synchro backend : participation (autre appareil) + annonce du gagnant.
  async function syncFromBackend() {
    const cid = currentCycleId(Date.now());
    if (!hasEnteredCurrentCycle(Date.now())) {
      const entered = await checkFirestoreEntry(cid);
      if (entered) { markEntered(Date.now()); renderAction(); }
    }
    checkWinner();
  }
  // Vérifie si l'utilisateur a gagné le tirage du cycle PRÉCÉDENT (déjà tiré).
  async function checkWinner() {
    const uid = currentUid();
    if (!_db || !uid) return;
    const prevId = String(nextDrawDate(Date.now()).getTime() - 7 * 86400000);
    try {
      const s = await getDoc(doc(_db, 'giveaways', prevId));
      if (s.exists() && s.data().winnerUid === uid) showWinnerBanner();
    } catch (_) {}
  }
  function showWinnerBanner() {
    if (el.hint) el.hint.innerHTML = `🎉 <strong>Tu as gagné le dernier tirage !</strong> On te contacte très vite pour ton lot.`;
    card.style.borderColor = 'rgba(250,204,21,0.7)';
    card.style.boxShadow = '0 10px 34px rgba(250,204,21,0.28)';
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
