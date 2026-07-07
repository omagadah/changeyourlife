// /js/agenda-page.js - Page Agenda en grand (/agenda/).
// Vue semaine de ton Google Agenda. Mêmes identifiants que l'encart de /app/
// (token OAuth en localStorage). Les événements sont lus directement depuis
// l'API Google, côté navigateur : rien ne transite par nos serveurs.

import { onAuthStateChanged, GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initUserMenu } from '/js/userMenu.js';
import { updateGlobalAvatar } from '/js/common.js';

let auth, db, uid;
if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }

const TKEY = 'cyl_gcal_token';
const CAL = 'https://www.googleapis.com/calendar/v3';
let weekOffset = 0; // 0 = semaine courante

// Token OAuth GCal en sessionStorage (efface a la fermeture de l'onglet) plutot
// que localStorage (persistant) : reduit la fenetre de vol par XSS. Expire ~55 min.
function getToken() {
  try { const x = JSON.parse(sessionStorage.getItem(TKEY) || 'null'); if (x && x.t && x.exp > Date.now()) return x.t; } catch (_) {}
  return null;
}
function setToken(t) { try { sessionStorage.setItem(TKEY, JSON.stringify({ t, exp: Date.now() + 3300 * 1000 })); } catch (_) {} }
function clearToken() { try { sessionStorage.removeItem(TKEY); } catch (_) {} }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function connect() {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
  provider.setCustomParameters({ prompt: 'consent' });
  let result;
  try {
    result = auth.currentUser
      ? await reauthenticateWithPopup(auth.currentUser, provider)
      : await signInWithPopup(auth, provider);
  } catch (e) { result = await signInWithPopup(auth, provider); }
  const cred = GoogleAuthProvider.credentialFromResult(result);
  const token = cred && cred.accessToken;
  if (!token) throw new Error('no-token');
  setToken(token);
  return token;
}

async function api(path, opts) {
  const token = getToken();
  if (!token) throw new Error('not-connected');
  const r = await fetch(CAL + path, {
    method: (opts && opts.method) || 'GET',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: opts && opts.body,
  });
  if (r.status === 401 || r.status === 403) { clearToken(); throw new Error('expired'); }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// Lundi 00:00 de la semaine ciblée par weekOffset.
function weekStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - dow + weekOffset * 7);
  return d;
}
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

async function listWeek() {
  const s = weekStart();
  const e = new Date(s); e.setDate(e.getDate() + 7);
  const data = await api(`/calendars/primary/events?timeMin=${encodeURIComponent(s.toISOString())}&timeMax=${encodeURIComponent(e.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=250`);
  return data.items || [];
}

async function planTasks() {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const p = snap.exists() && snap.data().plan;
    return (p && Array.isArray(p.tasks)) ? p.tasks.filter((t) => !t.done) : [];
  } catch (_) { return []; }
}
async function pushTasks() {
  const tasks = await planTasks();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let n = 0;
  for (const t of tasks) {
    await api('/calendars/primary/events', {
      method: 'POST',
      body: JSON.stringify({ summary: '✓ ' + t.title, start: { date: today }, end: { date: tomorrow }, description: 'Tâche - ChangeYourLife.ai' }),
    });
    n++;
  }
  return n;
}

function evStart(ev) { return ev.start && (ev.start.dateTime || ev.start.date); }
function isAllDay(ev) { return !!(ev.start && ev.start.date && !ev.start.dateTime); }
function fmtTime(ev) {
  if (isAllDay(ev)) return 'Journée';
  const d = evStart(ev); if (!d) return '';
  try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; }
}

const root = () => document.getElementById('agenda-root');

function renderConnect() {
  const el = root(); if (!el) return;
  el.innerHTML = `
    <div class="ap-connect">
      <div class="ap-connect-ic">📅</div>
      <h2>Connecte ton Google Agenda</h2>
      <p>Tu verras toute ta semaine ici, en grand. La connexion se fait avec ton
      compte Google : <strong>tes événements sont lus directement depuis Google,
      dans ton navigateur. Rien ne passe par nos serveurs.</strong></p>
      <button class="ap-btn ap-primary" id="ap-connect">Connecter Google Agenda</button>
    </div>`;
  el.querySelector('#ap-connect').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Connexion…';
    try { await connect(); renderWeek(); }
    catch (err) { b.disabled = false; b.textContent = 'Connecter Google Agenda'; toast('Connexion annulée ou refusée'); }
  };
}

async function renderWeek() {
  const el = root(); if (!el) return;
  const s = weekStart();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d; });
  const e = new Date(s); e.setDate(e.getDate() + 6);
  const label = s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' - ' +
                e.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  el.innerHTML = `
    <div class="ap-bar">
      <div class="ap-nav">
        <button class="ap-arrow" id="ap-prev" title="Semaine précédente">‹</button>
        <button class="ap-today" id="ap-today">Cette semaine</button>
        <button class="ap-arrow" id="ap-next" title="Semaine suivante">›</button>
      </div>
      <div class="ap-range" id="ap-range">${escapeHtml(label)}</div>
      <div class="ap-tools">
        <button class="ap-btn ap-ghost" id="ap-push">Envoyer mes tâches du jour</button>
        <button class="ap-btn ap-x" id="ap-disc" title="Déconnecter">Déconnecter</button>
      </div>
    </div>
    <div class="ap-grid" id="ap-grid">
      ${days.map((d) => {
        const today = sameDay(d, new Date());
        return `<div class="ap-day${today ? ' is-today' : ''}">
          <div class="ap-day-h">
            <span class="ap-dow">${d.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
            <span class="ap-dnum">${d.getDate()}</span>
          </div>
          <div class="ap-evs" data-day="${d.toISOString().slice(0, 10)}">
            <div class="ap-loading">…</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  el.querySelector('#ap-prev').onclick = () => { weekOffset--; renderWeek(); };
  el.querySelector('#ap-next').onclick = () => { weekOffset++; renderWeek(); };
  el.querySelector('#ap-today').onclick = () => { weekOffset = 0; renderWeek(); };
  el.querySelector('#ap-disc').onclick = () => { clearToken(); renderConnect(); toast('Agenda déconnecté'); };
  el.querySelector('#ap-push').onclick = async (ev) => {
    const b = ev.currentTarget; b.disabled = true; b.textContent = 'Envoi…';
    try { const n = await pushTasks(); toast(n ? `${n} tâche(s) ajoutée(s)` : 'Aucune tâche à envoyer'); renderWeek(); }
    catch (err) { if (err.message === 'expired') { renderConnect(); toast('Reconnecte ton agenda'); return; } toast("Erreur lors de l'envoi"); }
    finally { b.disabled = false; b.textContent = 'Envoyer mes tâches du jour'; }
  };

  // remplit les événements
  try {
    const items = await listWeek();
    const byDay = {};
    for (const it of items) {
      const sd = evStart(it); if (!sd) continue;
      const key = new Date(sd).toISOString().slice(0, 10);
      (byDay[key] = byDay[key] || []).push(it);
    }
    el.querySelectorAll('.ap-evs').forEach((box) => {
      const key = box.dataset.day;
      const evs = byDay[key] || [];
      if (!evs.length) { box.innerHTML = `<div class="ap-empty">-</div>`; return; }
      box.innerHTML = evs.map((it) =>
        `<div class="ap-ev${isAllDay(it) ? ' all-day' : ''}">
          <span class="ap-ev-t">${escapeHtml(fmtTime(it))}</span>
          <span class="ap-ev-n">${escapeHtml(it.summary || '(sans titre)')}</span>
        </div>`).join('');
    });
  } catch (err) {
    if (err.message === 'expired') { renderConnect(); toast('Reconnecte ton agenda'); return; }
    el.querySelectorAll('.ap-evs').forEach((box) => { box.innerHTML = `<div class="ap-empty">!</div>`; });
    toast("Impossible de charger l'agenda");
  }
}

function toast(msg) {
  let t = document.getElementById('cyl-ap-toast');
  if (!t) { t = document.createElement('div'); t.id = 'cyl-ap-toast'; t.className = 'ap-toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 2400);
}

if (!document.getElementById('cyl-emoji-js')) { const _e = document.createElement('script'); _e.id = 'cyl-emoji-js'; _e.src = '/js/emoji.js'; document.head.appendChild(_e); }
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = '/login/'; return; }
  uid = user.uid;
  try { updateGlobalAvatar((user.email || 'U').charAt(0).toUpperCase()); } catch (e) {}
  try { initUserMenu(); } catch (e) {}
  if (getToken()) renderWeek(); else renderConnect();
});
