// /js/agenda.js - « Ta journee » : Google Agenda ET fiches ORGANIZER fusionnes
// dans une seule timeline, sur /app/.
//
// C'est le bras droit du cerveau (ORGANIZER) : ce qui est deja pris (evenements)
// et ce que tu as decide de faire (fiches echues) apparaissent au meme endroit,
// dans l'ordre. Connexion et appels API delegues a /js/gcal.js (source unique).

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { loadBoard, dueToday, BRANCH_BY_KEY } from '/js/organizer-data.js';
import * as gcal from '/js/gcal.js';

let auth, db, uid;
let board = null;

if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }

const host = () => document.getElementById('agenda-card');
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function toast(msg, err) {
  let t = document.getElementById('cyl-ag-toast');
  if (!t) { t = document.createElement('div'); t.id = 'cyl-ag-toast'; t.className = 'ag-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'ag-toast show' + (err ? ' err' : '');
  clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 2600);
}

// ── Rendu ────────────────────────────────────────────────────────────────────
function head(extra = '') {
  const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `<div class="ag-head">
      <span class="ag-ic">📅</span>
      <div style="flex:1;min-width:0">
        <div class="ag-title">Ta journee</div>
        <div class="ag-sub" id="ag-date">${esc(d)}</div>
      </div>${extra}</div>`;
}

function renderConnect() {
  const el = host(); if (!el) return;
  el.innerHTML = head() + `
    <div class="ag-tasks-only" id="ag-list"></div>
    <button class="ag-btn" id="ag-connect">Connecter Google Agenda</button>
    <div class="ag-note">Lecture de tes evenements + ecriture des fiches que tu planifies depuis l'ORGANIZER.</div>`;
  renderList([]);
  el.querySelector('#ag-connect').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Connexion…';
    try { await gcal.connect({ write: true }); await renderConnected(); }
    catch (err) {
      console.error('[GCal connect] code:', err && err.code, err && err.message);
      b.disabled = false; b.textContent = 'Connecter Google Agenda';
      toast(gcal.connectErrorMessage(err), true);
    }
  };
}

async function renderConnected() {
  const el = host(); if (!el) return;
  el.innerHTML = head(
    `<a class="ag-open" href="/agenda/" title="Ouvrir mon agenda en grand">⤢</a>` +
    `<button class="ag-x" id="ag-disc" title="Deconnecter">✕</button>`) + `
    <div id="ag-list" class="ag-events"><div class="ag-empty">Chargement…</div></div>`;
  el.querySelector('#ag-disc').onclick = () => { gcal.disconnect(); renderConnect(); toast('Agenda deconnecte'); };
  await refresh();
}

// Fusionne evenements agenda + fiches ORGANIZER echues, tries par heure.
function buildTimeline(events) {
  const items = events.map((ev) => ({
    kind: 'event',
    at: gcal.isAllDay(ev) ? 0 : (gcal.eventStart(ev) ? gcal.eventStart(ev).getTime() : 0),
    time: gcal.fmtEventTime(ev),
    title: ev.summary || '(sans titre)',
  }));
  if (board) {
    // On ne redouble pas les fiches deja poussees dans l'agenda (gcalId).
    const gcalIds = new Set(events.map((e) => e.id));
    dueToday(board).forEach(({ card }) => {
      if (card.gcalId && gcalIds.has(card.gcalId)) return;
      const late = card.due < new Date().setHours(0, 0, 0, 0);
      items.push({
        kind: 'task', at: card.due || 0, time: late ? 'En retard' : 'A faire',
        title: card.title, branch: card.branch, late,
      });
    });
  }
  return items.sort((a, b) => a.at - b.at);
}

function renderList(events) {
  const box = document.getElementById('ag-list'); if (!box) return;
  const items = buildTimeline(events);
  if (!items.length) {
    box.innerHTML = `<div class="ag-empty">Rien de prevu aujourd'hui - belle page blanche.</div>`;
    return;
  }
  box.innerHTML = items.map((it) => {
    const b = it.branch && BRANCH_BY_KEY[it.branch];
    const cls = 'ag-ev' + (it.kind === 'task' ? ' task' : '') + (it.late ? ' late' : '');
    return `<div class="${cls}"${b ? ` style="--bc:${b.color}"` : ''}>` +
      `<span class="ag-ev-t">${esc(it.time)}</span>` +
      `<span class="ag-ev-n">${b ? b.emoji + ' ' : ''}${esc(it.title)}</span></div>`;
  }).join('');
}

async function refresh() {
  const box = document.getElementById('ag-list'); if (!box) return;
  try {
    const items = await gcal.listToday();
    renderList(items);
  } catch (err) {
    if (err && (err.code === 'gcal/expired' || err.code === 'gcal/not-connected')) { renderConnect(); return; }
    renderList([]);
    const note = document.createElement('div');
    note.className = 'ag-empty';
    note.textContent = "Impossible de charger l'agenda pour l'instant.";
    box.appendChild(note);
  }
}

function injectCSS() {
  if (document.getElementById('cyl-ag-css')) return;
  const s = document.createElement('style'); s.id = 'cyl-ag-css';
  s.textContent = `
    .agenda-card{background:linear-gradient(135deg,rgba(111,154,82,0.10),rgba(21,32,19,0.45));border:1px solid rgba(111,154,82,0.30);border-radius:16px;padding:16px 18px;margin-bottom:18px;}
    .ag-head{display:flex;align-items:flex-start;gap:13px;margin-bottom:12px;}
    .ag-ic{font-size:1.5rem;flex-shrink:0;}
    .ag-title{font-size:0.98rem;font-weight:800;color:#f4efe1;}
    .ag-sub{font-size:0.8rem;color:#b4ad94;line-height:1.4;margin-top:2px;}
    #ag-date::first-letter{text-transform:uppercase;}
    .ag-open{margin-left:auto;width:28px;height:28px;border-radius:50%;border:1px solid rgba(221,205,160,0.14);background:rgba(255,255,255,0.05);color:#b4ad94;cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:0.95rem;}
    .ag-open:hover{background:rgba(132,194,94,0.16);color:#f4efe1;}
    .ag-x{width:28px;height:28px;border-radius:50%;border:1px solid rgba(221,205,160,0.14);background:rgba(255,255,255,0.05);color:#b4ad94;cursor:pointer;flex-shrink:0;}
    .ag-x:hover{background:rgba(255,255,255,0.1);color:#f4efe1;}
    .ag-btn{width:100%;padding:11px;border-radius:12px;border:none;cursor:pointer;font-family:inherit;font-weight:800;font-size:0.88rem;
      background:linear-gradient(135deg,#4285f4,#1a73e8);color:#fff;transition:filter .2s,transform .2s;}
    .ag-btn:hover{filter:brightness(1.08);transform:translateY(-1px);}
    .ag-btn:disabled{opacity:.6;cursor:default;transform:none;}
    .ag-note{font-size:0.72rem;color:#7c7660;margin-top:8px;line-height:1.45;}
    .ag-events,.ag-tasks-only{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}
    .ag-ev{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,0.03);
      border:1px solid rgba(221,205,160,0.08);border-left:3px solid var(--bc,rgba(111,154,82,0.55));}
    .ag-ev.task{background:rgba(132,194,94,0.05);border-left-color:var(--bc,#84c25e);}
    .ag-ev.late{border-left-color:#e0785f;}
    .ag-ev.late .ag-ev-t{color:#f0a48d;}
    .ag-ev-t{font-size:0.72rem;font-weight:800;color:#a7d585;min-width:58px;flex-shrink:0;}
    .ag-ev-n{font-size:0.86rem;color:#efe9d6;line-height:1.35;}
    .ag-empty{font-size:0.82rem;color:#7c7660;padding:8px 4px;}
    .ag-toast{position:fixed;top:22px;left:50%;transform:translate(-50%,-140px);background:rgba(74,122,58,.96);color:#f4efe1;padding:10px 20px;border-radius:10px;font-weight:600;z-index:99999;transition:transform .3s ease;font-size:.86rem;box-shadow:0 8px 28px rgba(0,0,0,.4);max-width:90vw;text-align:center;}
    .ag-toast.show{transform:translate(-50%,0);}
    .ag-toast.err{background:rgba(190,60,45,.96);}
  `;
  document.head.appendChild(s);
}

// ── Boot ─────────────────────────────────────────────────────────────────────
injectCSS();
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  uid = user.uid;
  try { board = await loadBoard(db, uid); } catch (_) { board = null; }
  if (gcal.isConnected()) await renderConnected(); else renderConnect();
});

// Le hub ORGANIZER a change (capture, echeance, planification) -> on resynchronise.
document.addEventListener('cyl:organizer-changed', (e) => {
  if (e.detail && e.detail.board) board = e.detail.board;
  if (document.getElementById('ag-list')) {
    if (gcal.isConnected()) refresh(); else renderList([]);
  }
});
document.addEventListener('cyl:gcal-refresh', () => { if (gcal.isConnected()) refresh(); });
