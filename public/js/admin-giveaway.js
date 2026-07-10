// public/js/admin-giveaway.js - Logique du back-office giveaway (admin).
// Vérifie le rôle admin (custom claim), affiche le statut du cycle et déclenche
// le tirage serveur via /api/giveaway-draw.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initUserMenu } from '/js/userMenu.js';

let auth;
if (window._cyfFirebase) { ({ auth } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth } = window._cyfFirebase); }

try { initUserMenu(); } catch (_) {}

// ── Cycle hebdo (mêmes règles que giveaway.js : dimanche 20:00 local) ────────
const DRAW_WEEKDAY = 0, DRAW_HOUR = 20;
function nextDrawDate(now) {
  const d = new Date(now); d.setSeconds(0, 0); d.setMinutes(0); d.setHours(DRAW_HOUR);
  let delta = (DRAW_WEEKDAY - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  if (d.getTime() <= now) d.setDate(d.getDate() + 7);
  return d;
}
function currentCycleId() { return String(nextDrawDate(Date.now()).getTime()); }

const $ = (id) => document.getElementById(id);
const gate = $('adm-gate'), panel = $('adm-panel');
const msgEl = $('adm-msg');
let cycleId = currentCycleId();

function showMsg(text, kind) {
  msgEl.textContent = text;
  msgEl.className = 'adm-msg show ' + (kind || 'ok');
}
function fmtDate(ts) {
  try { return new Date(ts).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); }
  catch (_) { return '-'; }
}

async function callApi(action) {
  const user = auth.currentUser;
  if (!user) throw new Error('not-signed-in');
  const idToken = await user.getIdToken();
  const r = await fetch('/api/giveaway-draw', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, cycleId, action }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
  return data;
}

function renderStatus(d) {
  $('adm-cycle').textContent = cycleId;
  $('adm-nextdraw').textContent = fmtDate(Number(cycleId));
  $('adm-count').textContent = d.count != null ? d.count : '-';
  if (d.winnerUid) {
    $('adm-winner').textContent = '🎉 ' + d.winnerUid;
    $('adm-draw').disabled = true;
    $('adm-draw').textContent = '✓ Tirage effectué';
  } else {
    $('adm-winner').textContent = 'Pas encore tiré';
  }
}

async function refresh() {
  try { renderStatus(await callApi('status')); }
  catch (e) { showMsg('Erreur : ' + e.message, 'err'); }
}

async function draw() {
  const btn = $('adm-draw');
  if (!confirm('Tirer au sort le gagnant du cycle courant ? Action définitive.')) return;
  btn.disabled = true; btn.textContent = 'Tirage…';
  try {
    const d = await callApi('draw');
    if (d.empty) { showMsg('Aucun participant pour ce cycle.', 'err'); btn.disabled = false; btn.textContent = '🎲 Tirer au sort'; return; }
    renderStatus(d);
    showMsg(d.alreadyDrawn ? 'Ce cycle avait déjà un gagnant.' : '🎉 Gagnant tiré au sort !', 'ok');
  } catch (e) {
    showMsg('Erreur : ' + e.message, 'err');
    btn.disabled = false; btn.textContent = '🎲 Tirer au sort';
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { gate.style.display = 'block'; panel.style.display = 'none'; return; }
  // Contrôle admin via custom claim
  let isAdmin = false;
  try { const tok = await user.getIdTokenResult(); isAdmin = tok.claims.role === 'admin'; } catch (_) {}
  if (!isAdmin) { gate.style.display = 'block'; panel.style.display = 'none'; return; }
  gate.style.display = 'none'; panel.style.display = 'block';
  $('adm-refresh').addEventListener('click', refresh);
  $('adm-draw').addEventListener('click', draw);
  refresh();
});
