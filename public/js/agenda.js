// /js/agenda.js - Connecteur Google Agenda (encart central de /app/).
// OAuth via Firebase Google provider (scope LECTURE SEULE calendar.events.readonly)
// → lit les événements du jour. Les tâches du jour (module /plan/) sont exportées
// en fichier .ics téléchargeable : aucun accès en écriture au calendrier.

import { onAuthStateChanged, GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let auth, db, uid;
if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }

const TKEY = 'cyl_gcal_token';
const CAL = 'https://www.googleapis.com/calendar/v3';

// Token OAuth GCal en sessionStorage (efface a la fermeture de l'onglet) plutot
// que localStorage (persistant) : reduit la fenetre de vol par XSS. Expire ~55 min.
function getToken() {
  try { const x = JSON.parse(sessionStorage.getItem(TKEY) || 'null'); if (x && x.t && x.exp > Date.now()) return x.t; } catch (_) {}
  return null;
}
function setToken(t) { try { sessionStorage.setItem(TKEY, JSON.stringify({ t, exp: Date.now() + 3300 * 1000 })); } catch (_) {} }
function clearToken() { try { sessionStorage.removeItem(TKEY); } catch (_) {} }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Codes d'erreur popup pour lesquels un repli signInWithPopup est légitime.
const POPUP_RETRYABLE = new Set([
  'auth/user-mismatch', 'auth/requires-recent-login', 'auth/user-token-expired',
  'auth/operation-not-supported-in-this-environment',
]);

async function connect() {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/calendar.events.readonly');
  provider.setCustomParameters({ prompt: 'consent' });
  let result;
  try {
    result = auth.currentUser
      ? await reauthenticateWithPopup(auth.currentUser, provider)
      : await signInWithPopup(auth, provider);
  } catch (e) {
    const code = e && e.code;
    // Popup fermée / bloquée / annulée par l'utilisateur : ne PAS relancer un
    // 2e popup (Chrome le bloquerait) → on remonte l'erreur telle quelle.
    if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/popup-blocked'].includes(code)) {
      throw e;
    }
    // Repli légitime (recent-login, env non supporté…) : une seule tentative.
    if (POPUP_RETRYABLE.has(code) || auth.currentUser) {
      result = await signInWithPopup(auth, provider);
    } else {
      throw e;
    }
  }
  const cred = GoogleAuthProvider.credentialFromResult(result);
  const token = cred && cred.accessToken;
  if (!token) { const err = new Error('no-token'); err.code = 'gcal/no-token'; throw err; }
  setToken(token);
  return token;
}

// Traduit un code d'erreur en message utilisateur clair (aide au diagnostic).
function connectErrorMessage(err) {
  const code = (err && err.code) || '';
  switch (code) {
    case 'auth/popup-blocked':
      return 'Popup bloquée par le navigateur/VPN. Autorise les popups pour changeyourlife.ai puis réessaie.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Connexion annulée (fenêtre fermée).';
    case 'auth/unauthorized-domain':
      return 'Domaine non autorisé dans Firebase (Authorized domains).';
    case 'gcal/no-token':
      return 'Accès à l\'agenda refusé : autorise la lecture du calendrier lors de la connexion.';
    case 'auth/internal-error':
      return 'Erreur OAuth Google. Vérifie les popups (navigateur/VPN) et réessaie.';
    default:
      return 'Connexion impossible.' + (code ? ' (' + code + ')' : '');
  }
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
// Export .ics : aucun scope d'ecriture. On genere un fichier telechargeable que
// l'utilisateur importe dans l'agenda de son choix (Google, Apple, Outlook...).
function icsEsc(s) { return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function icsDay(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function icsStamp(d) {
  return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0') +
    'T' + String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes()).padStart(2, '0') + String(d.getUTCSeconds()).padStart(2, '0') + 'Z';
}
async function exportTasks() {
  const tasks = await planTasks();
  if (!tasks.length) return 0;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const stamp = icsStamp(new Date());
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ChangeYourLife.ai//Taches//FR', 'CALSCALE:GREGORIAN'];
  for (const t of tasks) {
    const id = (crypto.randomUUID ? crypto.randomUUID() : stamp + '-' + L.length) + '@changeyourlife.ai';
    L.push('BEGIN:VEVENT', 'UID:' + id, 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + icsDay(start), 'DTEND;VALUE=DATE:' + icsDay(end),
      'SUMMARY:' + icsEsc('✓ ' + (t.title || 'Tâche')),
      'DESCRIPTION:' + icsEsc('Tâche — ChangeYourLife.ai'), 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  const blob = new Blob([L.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'taches-changeyourlife.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return tasks.length;
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
      <div class="ag-sub">Connecte ton agenda pour voir ta journée d'un coup d'œil.</div></div></div>
    <button class="ag-btn ag-connect" id="ag-connect">Connecter Google Agenda</button>`;
  el.querySelector('#ag-connect').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Connexion…';
    try { await connect(); await renderConnected(); }
    catch (err) {
      console.error('[GCal connect] code:', err && err.code, 'message:', err && err.message, err);
      b.disabled = false; b.textContent = 'Connecter Google Agenda';
      toast(connectErrorMessage(err));
    }
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
    <button class="ag-btn" id="ag-export">↓ Ajouter mes tâches du jour à mon agenda</button>`;
  const dEl = el.querySelector('#ag-date');
  if (dEl) dEl.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  el.querySelector('#ag-disc').onclick = () => { clearToken(); renderConnect(); toast('Agenda déconnecté'); };
  el.querySelector('#ag-export').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Préparation…';
    try { const n = await exportTasks(); toast(n ? `${n} tâche(s) exportée(s) — ouvre le fichier pour les ajouter` : 'Aucune tâche à exporter'); }
    catch (err) { toast("Erreur lors de l'export"); }
    finally { b.disabled = false; b.textContent = '↓ Ajouter mes tâches du jour à mon agenda'; }
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
