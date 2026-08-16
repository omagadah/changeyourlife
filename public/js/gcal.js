// /js/gcal.js - Connecteur Google Agenda UNIFIE (source de verite unique).
//
// Avant : agenda.js ecrivait le jeton en sessionStorage avec un scope LECTURE
// SEULE, organizer.js le relisait en localStorage avec un scope ECRITURE ->
// « Ajouter a l'Agenda » ne pouvait pas fonctionner. Tout passe desormais ici.
//
// Scope : calendar.events (lecture ET ecriture). L'ORGANIZER est le cerveau,
// l'agenda en est le bras : une fiche planifiee devient un vrai evenement.
//
// Jeton en sessionStorage (efface a la fermeture de l'onglet) : reduit la
// fenetre de vol par XSS. Duree de vie ~55 min, refresh par re-consentement.

import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

let auth;
if (window._cyfFirebase) { ({ auth } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth } = window._cyfFirebase); }

const TKEY = 'cyl_gcal_token';
const CAL = 'https://www.googleapis.com/calendar/v3';

export const SCOPE_RW = 'https://www.googleapis.com/auth/calendar.events';
export const SCOPE_RO = 'https://www.googleapis.com/auth/calendar.events.readonly';

// ── Jeton ────────────────────────────────────────────────────────────────────
function readToken() {
  // sessionStorage d'abord ; on tolere un ancien jeton localStorage (migration).
  for (const store of [sessionStorage, localStorage]) {
    try {
      const x = JSON.parse(store.getItem(TKEY) || 'null');
      if (x && x.t && x.exp > Date.now()) return x;
    } catch (_) {}
  }
  return null;
}
export function getToken() { const x = readToken(); return x ? x.t : null; }
export function isConnected() { return !!getToken(); }
// true si le jeton courant autorise l'ECRITURE (creation d'evenements).
export function canWrite() { const x = readToken(); return !!x && x.rw === true; }

function setToken(t, rw) {
  try { sessionStorage.setItem(TKEY, JSON.stringify({ t, rw: !!rw, exp: Date.now() + 3300 * 1000 })); } catch (_) {}
  try { localStorage.removeItem(TKEY); } catch (_) {}   // purge l'ancien emplacement
  emit();
}
export function disconnect() {
  try { sessionStorage.removeItem(TKEY); } catch (_) {}
  try { localStorage.removeItem(TKEY); } catch (_) {}
  emit();
}
function emit() {
  try { document.dispatchEvent(new CustomEvent('cyl:gcal-changed', { detail: { connected: isConnected(), write: canWrite() } })); } catch (_) {}
}

// ── Connexion OAuth ──────────────────────────────────────────────────────────
// Codes pour lesquels un repli signInWithPopup est legitime.
const POPUP_RETRYABLE = new Set([
  'auth/user-mismatch', 'auth/requires-recent-login', 'auth/user-token-expired',
  'auth/operation-not-supported-in-this-environment',
]);

export async function connect({ write = true } = {}) {
  const provider = new GoogleAuthProvider();
  provider.addScope(write ? SCOPE_RW : SCOPE_RO);
  provider.setCustomParameters({ prompt: 'consent' });
  let result;
  try {
    result = auth.currentUser
      ? await reauthenticateWithPopup(auth.currentUser, provider)
      : await signInWithPopup(auth, provider);
  } catch (e) {
    const code = e && e.code;
    // Popup fermee / bloquee / annulee : ne PAS relancer un 2e popup (Chrome le
    // bloquerait) -> on remonte l'erreur telle quelle.
    if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/popup-blocked'].includes(code)) throw e;
    if (POPUP_RETRYABLE.has(code) || auth.currentUser) result = await signInWithPopup(auth, provider);
    else throw e;
  }
  const cred = GoogleAuthProvider.credentialFromResult(result);
  const token = cred && cred.accessToken;
  if (!token) { const err = new Error('no-token'); err.code = 'gcal/no-token'; throw err; }
  setToken(token, write);
  return token;
}

// Traduit un code d'erreur en message utilisateur clair.
export function connectErrorMessage(err) {
  const code = (err && err.code) || '';
  switch (code) {
    case 'auth/popup-blocked':
      return 'Popup bloquee par le navigateur/VPN. Autorise les popups pour changeyourlife.ai puis reessaie.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Connexion annulee (fenetre fermee).';
    case 'auth/unauthorized-domain':
      return 'Domaine non autorise dans Firebase (Authorized domains).';
    case 'gcal/no-token':
      return "Acces a l'agenda refuse : autorise la lecture ET l'ecriture du calendrier lors de la connexion.";
    case 'auth/internal-error':
      return 'Erreur OAuth Google. Verifie les popups (navigateur/VPN) et reessaie.';
    default:
      return 'Connexion impossible.' + (code ? ' (' + code + ')' : '');
  }
}

// ── Appels API ───────────────────────────────────────────────────────────────
async function api(path, opts) {
  const token = getToken();
  if (!token) { const e = new Error('not-connected'); e.code = 'gcal/not-connected'; throw e; }
  const r = await fetch(CAL + path, {
    method: (opts && opts.method) || 'GET',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 401) { disconnect(); const e = new Error('expired'); e.code = 'gcal/expired'; throw e; }
  if (r.status === 403) {
    // 403 = jeton valide mais scope insuffisant (lecture seule) OU quota.
    const e = new Error('forbidden'); e.code = 'gcal/forbidden'; throw e;
  }
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.code = 'gcal/http-' + r.status; throw e; }
  if (r.status === 204) return null;
  return r.json();
}

export async function listRange(from, to, max = 50) {
  const data = await api(`/calendars/primary/events?timeMin=${encodeURIComponent(from.toISOString())}` +
    `&timeMax=${encodeURIComponent(to.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=${max}`);
  return (data && data.items) || [];
}

export async function listToday() {
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const e = new Date(s); e.setDate(e.getDate() + 1);
  return listRange(s, e, 25);
}

// Les N prochains jours (aujourd'hui inclus) - sert au brief de CYL.
export async function listUpcoming(days = 3, max = 50) {
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const e = new Date(s); e.setDate(e.getDate() + Math.max(1, days));
  return listRange(s, e, max);
}

// Cree un evenement. `day` = Date -> evenement sur la journee entiere.
// `start`/`end` = Date -> creneau horaire.
export async function createEvent({ summary, description, day, start, end, colorId }) {
  const body = { summary: String(summary || 'Sans titre').slice(0, 300) };
  if (description) body.description = String(description).slice(0, 4000);
  if (colorId) body.colorId = String(colorId);
  if (day) {
    const d = new Date(day); d.setHours(0, 0, 0, 0);
    const n = new Date(d.getTime() + 86400000);
    body.start = { date: isoDay(d) };
    body.end = { date: isoDay(n) };
  } else {
    const s = start ? new Date(start) : new Date();
    const e = end ? new Date(end) : new Date(s.getTime() + 3600000);
    body.start = { dateTime: s.toISOString() };
    body.end = { dateTime: e.toISOString() };
  }
  return api('/calendars/primary/events', { method: 'POST', body });
}

export async function deleteEvent(id) {
  if (!id) return null;
  return api('/calendars/primary/events/' + encodeURIComponent(id), { method: 'DELETE' });
}

// Date -> 'YYYY-MM-DD' en heure LOCALE (toISOString decalerait d'un jour).
function isoDay(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ── Formatage ────────────────────────────────────────────────────────────────
export function isAllDay(ev) { return !!(ev && ev.start && ev.start.date && !ev.start.dateTime); }
export function eventStart(ev) {
  const d = ev && ev.start && (ev.start.dateTime || ev.start.date);
  return d ? new Date(d) : null;
}
export function fmtEventTime(ev) {
  if (isAllDay(ev)) return 'Journee';
  const d = eventStart(ev);
  if (!d) return '';
  try { return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; }
}

// ── Export .ics (repli sans connexion : aucun scope requis) ──────────────────
function icsEsc(s) { return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function icsDay(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function icsStamp(d) {
  return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0') +
    'T' + String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes()).padStart(2, '0') + String(d.getUTCSeconds()).padStart(2, '0') + 'Z';
}
// items : [{ title, day? }] -> telecharge un .ics importable partout.
export function downloadIcs(items, filename = 'taches-changeyourlife.ics') {
  if (!items || !items.length) return 0;
  const stamp = icsStamp(new Date());
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ChangeYourLife.ai//Taches//FR', 'CALSCALE:GREGORIAN'];
  for (const it of items) {
    const start = it.day ? new Date(it.day) : new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86400000);
    const id = (crypto.randomUUID ? crypto.randomUUID() : stamp + '-' + L.length) + '@changeyourlife.ai';
    L.push('BEGIN:VEVENT', 'UID:' + id, 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + icsDay(start), 'DTEND;VALUE=DATE:' + icsDay(end),
      'SUMMARY:' + icsEsc(it.title || 'Tache'),
      'DESCRIPTION:' + icsEsc('ChangeYourLife.ai'), 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  const blob = new Blob([L.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return items.length;
}
