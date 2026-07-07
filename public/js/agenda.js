// /js/agenda.js - Connecteur Google Agenda (encart central de /app/).
// OAuth via Firebase Google provider (scopes calendar) → lit les événements du
// jour et envoie les tâches du jour (module /plan/) vers l'agenda.

import { onAuthStateChanged, GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let auth, db, uid;
if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }

const TKEY = 'cyl_gcal_token';
const CAL = 'https://www.googleapis.com/calendar/v3';

function getToken() {
  try { const x = JSON.parse(localStorage.getItem(TKEY) || 'null'); if (x && x.t && x.exp > Date.now()) return x.t; } catch (_) {}
  return null;
}
function setToken(t) { try { localStorage.setItem(TKEY, JSON.stringify({ t, exp: Date.now() + 3300 * 1000 })); } catch (_) {} }
function clearToken() { try { localStorage.removeItem(TKEY); } catch (_) {} }
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
  } catch (e) {
    // repli si la ré-authentification échoue (popup, recent-login…)
    result = await signInWithPopup(auth, provider);
  }
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

async function listToday() {
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const e = new Date(s); e.setDate(e.getDate() + 1);
  const data = await api(`/calendars/primary/events?timeMin=${encodeURIComponent(s.toISOString())}&timeMax=${encodeURIComponent(e.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=25`);
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

function fmtTime(ev) {
  const d = ev.start && (ev.start.dateTime || ev.start.date);
  if (!d) return '';
  if (ev.start.date && !ev.start.dateTime) return 'Journée';
  try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; }
}

const host = () => document.getElementById('agenda-card');

function renderConnect() {
  const el = host(); if (!el) return;
  el.innerHTML = `
    <div class="ag-head"><span class="ag-ic">📅</span><div><div class="ag-title">Google Agenda</div>
      <div class="ag-sub">Connecte ton agenda pour voir ta journée et y envoyer tes tâches.</div></div></div>
    <button class="ag-btn ag-connect" id="ag-connect">Connecter Google Agenda</button>`;
  el.querySelector('#ag-connect').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Connexion…';
    try { await connect(); await renderConnected(); }
    catch (err) { b.disabled = false; b.textContent = 'Connecter Google Agenda'; toast('Connexion annulée ou refusée'); }
  };
}

async function renderConnected() {
  const el = host(); if (!el) return;
  el.innerHTML = `
    <div class="ag-head"><span class="ag-ic">📅</span><div style="flex:1"><div class="ag-title">Aujourd'hui · Agenda</div>
      <div class="ag-sub" id="ag-date"></div></div>
      <a class="ag-open" href="/agenda/" title="Ouvrir mon agenda en grand">⤢</a>
      <button class="ag-x" id="ag-disc" title="Déconnecter">✕</button></div>
    <div id="ag-events" class="ag-events"><div class="ag-empty">Chargement…</div></div>
    <button class="ag-btn" id="ag-push">↗ Envoyer mes tâches du jour vers l'Agenda</button>`;
  const dEl = el.querySelector('#ag-date');
  if (dEl) dEl.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  el.querySelector('#ag-disc').onclick = () => { clearToken(); renderConnect(); toast('Agenda déconnecté'); };
  el.querySelector('#ag-push').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Envoi…';
    try { const n = await pushTasks(); toast(n ? `${n} tâche(s) ajoutée(s) à l'Agenda` : 'Aucune tâche à envoyer'); await refreshEvents(); }
    catch (err) { if (err.message === 'expired') { renderConnect(); toast('Reconnecte ton agenda'); return; } toast('Erreur lors de l\'envoi'); }
    finally { b.disabled = false; b.textContent = "↗ Envoyer mes tâches du jour vers l'Agenda"; }
  };
  await refreshEvents();
}

async function refreshEvents() {
  const box = document.getElementById('ag-events'); if (!box) return;
  try {
    const items = await listToday();
    if (!items.length) { box.innerHTML = `<div class="ag-empty">Aucun événement aujourd'hui - belle page blanche</div>`; return; }
    box.innerHTML = items.map((ev) =>
      `<div class="ag-ev"><span class="ag-ev-t">${escapeHtml(fmtTime(ev))}</span>` +
      `<span class="ag-ev-n">${escapeHtml(ev.summary || '(sans titre)')}</span></div>`).join('');
  } catch (err) {
    if (err.message === 'expired') { renderConnect(); return; }
    box.innerHTML = `<div class="ag-empty">Impossible de charger l'agenda.</div>`;
  }
}

function toast(msg) {
  let t = document.getElementById('cyl-ag-toast');
  if (!t) { t = document.createElement('div'); t.id = 'cyl-ag-toast'; t.className = 'ag-toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 2400);
}

function injectCSS() {
  if (document.getElementById('cyl-ag-css')) return;
  const s = document.createElement('style'); s.id = 'cyl-ag-css';
  s.textContent = `
    .agenda-card{background:linear-gradient(135deg,rgba(66,133,244,0.12),rgba(52,168,83,0.06));border:1px solid rgba(66,133,244,0.28);border-radius:16px;padding:16px 18px;margin-bottom:18px;}
    .ag-head{display:flex;align-items:flex-start;gap:13px;margin-bottom:12px;}
    .ag-ic{font-size:1.7rem;flex-shrink:0;}
    .ag-title{font-size:1rem;font-weight:800;color:#eef4ff;}
    .ag-sub{font-size:0.82rem;color:#9db8e8;line-height:1.4;margin-top:2px;}
    #ag-date::first-letter{text-transform:uppercase;}
    .ag-open{margin-left:auto;width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#9db8e8;cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:0.95rem;}
    .ag-open:hover{background:rgba(66,133,244,0.18);color:#fff;}
    .ag-x{width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#9db8e8;cursor:pointer;flex-shrink:0;}
    .ag-x:hover{background:rgba(255,255,255,0.1);color:#fff;}
    .ag-btn{width:100%;padding:11px;border-radius:12px;border:none;cursor:pointer;font-family:inherit;font-weight:800;font-size:0.88rem;
      background:linear-gradient(135deg,#4285f4,#1a73e8);color:#fff;transition:filter .2s,transform .2s;}
    .ag-btn:hover{filter:brightness(1.08);transform:translateY(-1px);}
    .ag-btn:disabled{opacity:.6;cursor:default;transform:none;}
    .ag-events{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}
    .ag-ev{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);}
    .ag-ev-t{font-size:0.76rem;font-weight:800;color:#8ab4f8;min-width:54px;}
    .ag-ev-n{font-size:0.88rem;color:#e5eef8;}
    .ag-empty{font-size:0.84rem;color:#7e9ab5;padding:10px 4px;}
    .ag-toast{position:fixed;top:22px;left:50%;transform:translate(-50%,-130px);background:rgba(26,115,232,.95);color:#fff;padding:10px 20px;border-radius:10px;font-weight:600;z-index:99999;transition:transform .3s ease;font-size:.88rem;box-shadow:0 8px 28px rgba(0,0,0,.4);}
    .ag-toast.show{transform:translate(-50%,0);}
  `;
  document.head.appendChild(s);
}

injectCSS();
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  uid = user.uid;
  if (getToken()) renderConnected(); else renderConnect();
});
