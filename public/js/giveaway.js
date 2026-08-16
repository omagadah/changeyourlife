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
    /* ── Bandeau d'annonce, tout en haut du site ──
       Modèle : la barre d'annonce de GitHub. Fine, pleine largeur, contenu
       centré dans une gouttière, séparée par un filet, et refermable. Elle
       s'annonce sans occuper la place d'un module. */
    .gw-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9500;
      height: 34px; display: flex; align-items: center; justify-content: center;
      padding: 0 46px;
      background: linear-gradient(90deg,
        rgba(231,177,92,0.09) 0%, rgba(231,177,92,0.17) 50%, rgba(231,177,92,0.09) 100%);
      border-bottom: 1px solid rgba(231,177,92,0.22);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      font-family: inherit;
      animation: gwDown .5s cubic-bezier(.4,0,.2,1) both;
    }
    @keyframes gwDown { from { transform: translateY(-100%); } to { transform: none; } }
    .gw-in {
      display: flex; align-items: center; gap: 10px;
      max-width: 1180px; width: 100%; justify-content: center;
      font-size: 0.775rem; line-height: 1; color: var(--text-2); min-width: 0;
    }
    .gw-ic { font-size: 0.9rem; flex-shrink: 0; }
    .gw-txt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gw-txt b { color: var(--text-1); font-weight: 700; }
    .gw-sep { color: rgba(231,177,92,0.45); flex-shrink: 0; }
    .gw-time {
      flex-shrink: 0; font-variant-numeric: tabular-nums; letter-spacing: 0.4px;
      font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace;
      font-size: 0.75rem; font-weight: 700; color: #f1cd92;
    }
    .gw-cta {
      flex-shrink: 0; margin-left: 2px;
      padding: 4px 12px; border-radius: 99px; border: 1px solid rgba(231,177,92,0.45);
      background: rgba(231,177,92,0.16); color: var(--text-1);
      font-family: inherit; font-size: 0.73rem; font-weight: 700; cursor: pointer;
      transition: background .18s, border-color .18s, color .18s;
    }
    .gw-cta:hover { background: rgba(231,177,92,0.3); border-color: rgba(231,177,92,0.7); color: #fff; }
    .gw-cta:disabled { opacity: .6; cursor: default; }
    .gw-done { flex-shrink: 0; font-size: 0.73rem; font-weight: 700; color: #a7d585; }
    .gw-x {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      width: 24px; height: 24px; border-radius: 6px; border: none; cursor: pointer;
      background: transparent; color: var(--text-2); font-size: 0.82rem; line-height: 1;
      transition: background .18s, color .18s;
    }
    .gw-x:hover { background: var(--surface-3); color: var(--text-1); }
    .gw-bar :focus-visible { outline: 2px solid rgba(231,177,92,0.8); outline-offset: 2px; }

    /* En dessous de 720 px : on garde l'essentiel (compte à rebours + action) */
    @media (max-width: 720px) {
      .gw-bar { padding: 0 38px 0 10px; }
      .gw-in { gap: 8px; font-size: 0.72rem; }
      .gw-prize-txt, .gw-sep-2 { display: none; }
    }
    @media (max-width: 420px) {
      .gw-txt { display: none; }
    }
    body.light-mode .gw-in { color: var(--text-2); }
    @media (prefers-reduced-motion: reduce) { .gw-bar { animation: none; } }
  `;
  document.head.appendChild(s);
}

function pad(n) { return String(n).padStart(2, '0'); }

// Bandeau masqué à la main : on le retient POUR CE CYCLE seulement, il
// réapparaît au tirage suivant (sinon on perd l'annonce définitivement).
const dismissKey = () => `cyl_gw_dismissed_${currentCycleId(Date.now())}`;
function isDismissed() { try { return localStorage.getItem(dismissKey()) === '1'; } catch (_) { return false; } }
function dismiss() { try { localStorage.setItem(dismissKey(), '1'); } catch (_) {} }

export function initGiveaway() {
  if (!document.querySelector('.app-container')) return;   // /app/ uniquement
  if (document.getElementById('giveaway-bar') || isDismissed()) return;

  injectStyles();

  const bar = document.createElement('div');
  bar.id = 'giveaway-bar';
  bar.className = 'gw-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Giveaway de la semaine');
  bar.innerHTML = `
    <div class="gw-in">
      <span class="gw-ic" aria-hidden="true">🎁</span>
      <span class="gw-txt"><b>Giveaway de la semaine</b><span class="gw-prize-txt"> · ${GIVEAWAY.prize}</span></span>
      <span class="gw-sep gw-sep-2" aria-hidden="true">·</span>
      <span class="gw-time" id="gw-time" role="timer" aria-label="Temps restant avant le tirage">--</span>
      <span id="gw-action"></span>
    </div>
    <button class="gw-x" id="gw-dismiss" type="button" aria-label="Masquer cette annonce">✕</button>
  `;
  // Tout en haut du document, au-dessus de l'espace de travail.
  document.body.insertBefore(bar, document.body.firstChild);
  document.body.classList.add('has-gw-bar');

  bar.querySelector('#gw-dismiss').addEventListener('click', () => {
    dismiss();
    bar.remove();
    document.body.classList.remove('has-gw-bar');
  });

  const el = { time: bar.querySelector('#gw-time'), action: bar.querySelector('#gw-action') };

  function renderAction() {
    if (hasEnteredCurrentCycle(Date.now())) {
      el.action.innerHTML = `<span class="gw-done">✓ Tu participes</span>`;
      return;
    }
    el.action.innerHTML = `<button class="gw-cta" id="gw-participate" type="button">Participer</button>`;
    const btn = el.action.querySelector('#gw-participate');
    btn.addEventListener('click', async () => {
      const cid = currentCycleId(Date.now());
      btn.disabled = true; btn.textContent = 'Enregistrement…';
      const ok = await writeFirestoreEntry(cid);
      if (!ok) {
        // Echec serveur (email non verifie, hors fenetre, reseau) : on NE marque
        // PAS la participation, sinon l'utilisateur se croit inscrit pour rien.
        btn.disabled = false; btn.textContent = 'Participer';
        btn.title = "Participation impossible - vérifie ton email puis réessaie.";
        el.action.insertAdjacentHTML('afterbegin',
          '<span class="gw-done" style="color:#f0a48d">Vérifie ton email</span> ');
        return;
      }
      markEntered(Date.now());
      renderAction();
      try { window.dispatchEvent(new CustomEvent('cyf:giveaway-entered')); } catch (_) {}
    });
  }

  // Compte à rebours compact : « 3 j 06:12 » puis « 06:56:49 » le dernier jour.
  function tick() {
    const now = Date.now();
    let diff = Math.max(0, nextDrawDate(now).getTime() - now);
    const days = Math.floor(diff / 86400000); diff -= days * 86400000;
    const hrs = Math.floor(diff / 3600000);   diff -= hrs * 3600000;
    const mins = Math.floor(diff / 60000);    diff -= mins * 60000;
    const secs = Math.floor(diff / 1000);
    el.time.textContent = days > 0
      ? `${days} j ${pad(hrs)}:${pad(mins)}`
      : `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    if (!days && !hrs && !mins && !secs) renderAction();
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
