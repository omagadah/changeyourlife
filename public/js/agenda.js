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
// L'en-tete ENTIER est un onglet vers l'agenda vivant (meme motif que
// l'ORGANIZER) : un lien etire couvre toute la bande, le texte le laisse
// traverser, et seuls les boutons d'action restent interactifs au-dessus.
// Avant, le seul acces a /agenda/ etait une petite fleche qui n'apparaissait
// QU'UNE FOIS Google connecte : la page etait donc inatteignable tant qu'on
// ne s'etait pas connecte, alors qu'elle marche tres bien sans.
function head(extra = '') {
  const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `<div class="ag-head">
      <a class="ag-open-all" href="/agenda/"
         aria-label="Ouvrir l'agenda vivant - semaine, mois et rivière"></a>
      <span class="ag-ic">📅</span>
      <div class="ag-head-txt">
        <div class="ag-title">Ta journée<span class="ag-go" aria-hidden="true">→</span></div>
        <div class="ag-sub" id="ag-date">${esc(d)}</div>
      </div>${extra}</div>`;
}

function renderConnect() {
  const el = host(); if (!el) return;
  el.innerHTML = head() + `
    <div class="ag-tasks-only" id="ag-list"></div>
    <a class="ag-open-btn" href="/agenda/">
      <span class="ag-open-ic">🗓️</span>
      <span><b>Ouvrir l'agenda vivant</b>
        <small>Semaine, mois, rivière - tes fiches datées et les jalons de tes objectifs</small></span>
      <span class="ag-open-arrow" aria-hidden="true">→</span>
    </a>
    <button class="ag-btn" id="ag-connect">Connecter Google Agenda</button>
    <div class="ag-note">L'agenda fonctionne déjà sans Google. Le connecter y ajoute tes
      événements existants, et permet d'y écrire les fiches que tu planifies.</div>`;
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
  // Plus de flèche « ouvrir » : tout l'en-tête est déjà le lien vers /agenda/.
  el.innerHTML = head(
    `<button class="ag-x" id="ag-disc" title="Déconnecter Google Agenda">✕</button>`) + `
    <div id="ag-list" class="ag-events"><div class="ag-empty">Chargement…</div></div>`;
  el.querySelector('#ag-disc').onclick = () => { gcal.disconnect(); renderConnect(); toast('Agenda déconnecté'); };
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
        kind: 'task', at: card.due || 0, time: late ? 'En retard' : 'À faire',
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
    box.innerHTML = `<div class="ag-empty">Rien de prévu aujourd'hui - belle page blanche.</div>`;
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
    .agenda-card{background:linear-gradient(135deg,rgba(111,154,82,0.10),var(--panel));border:1px solid rgba(111,154,82,0.30);border-radius:16px;padding:16px 18px;margin-bottom:18px;}
    /* En-tete = onglet cliquable vers /agenda/ (motif valide sur l'ORGANIZER) */
    .ag-head{position:relative;display:flex;align-items:center;gap:13px;margin-bottom:12px;
      padding-bottom:11px;border-bottom:1px solid rgba(111,154,82,0.16);}
    .ag-open-all{position:absolute;top:-16px;left:-18px;right:-18px;bottom:0;z-index:0;
      border-radius:15px 15px 0 0;text-decoration:none;cursor:pointer;transition:background .18s;}
    .ag-open-all:hover{background:rgba(132,194,94,0.08);}
    .ag-open-all:focus-visible{outline:2px solid rgba(132,194,94,0.7);outline-offset:-3px;}
    .ag-head-txt{position:relative;z-index:1;pointer-events:none;flex:1;min-width:0;}
    .ag-go{font-size:0.9rem;font-weight:700;color:var(--leaf-text);opacity:0;margin-left:7px;
      display:inline-block;transform:translateX(-5px);transition:opacity .2s,transform .2s;}
    .ag-head:hover .ag-go{opacity:1;transform:translateX(0);}
    .ag-ic{font-size:1.5rem;flex-shrink:0;position:relative;z-index:1;pointer-events:none;}
    /* Acces explicite quand Google n'est pas connecte */
    .ag-open-btn{display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:12px;
      text-decoration:none;margin-bottom:9px;
      background:rgba(132,194,94,0.08);border:1px solid rgba(132,194,94,0.28);
      transition:background .18s,border-color .18s,transform .18s;}
    .ag-open-btn:hover{background:rgba(132,194,94,0.16);border-color:rgba(132,194,94,0.5);transform:translateY(-1px);}
    .ag-open-ic{font-size:1.25rem;flex-shrink:0;}
    .ag-open-btn b{display:block;font-size:0.84rem;color:var(--text-1);}
    .ag-open-btn small{display:block;font-size:0.7rem;color:var(--text-3);margin-top:1px;line-height:1.35;}
    .ag-open-arrow{margin-left:auto;color:var(--leaf-text);font-weight:700;flex-shrink:0;}
    .ag-title{font-size:0.98rem;font-weight:800;color:var(--text-1);}
    .ag-sub{font-size:0.8rem;color:var(--text-2);line-height:1.4;margin-top:2px;}
    #ag-date::first-letter{text-transform:uppercase;}
    .ag-x{position:relative;z-index:2;margin-left:auto;width:28px;height:28px;border-radius:50%;border:1px solid var(--line);background:var(--surface-2);color:var(--text-2);cursor:pointer;flex-shrink:0;}
    .ag-x:hover{background:var(--surface-3);color:var(--text-1);}
    .ag-btn{width:100%;padding:11px;border-radius:12px;border:none;cursor:pointer;font-family:inherit;font-weight:800;font-size:0.88rem;
      background:linear-gradient(135deg,#4285f4,#1a73e8);color:#fff;transition:filter .2s,transform .2s;}
    .ag-btn:hover{filter:brightness(1.08);transform:translateY(-1px);}
    .ag-btn:disabled{opacity:.6;cursor:default;transform:none;}
    .ag-note{font-size:0.72rem;color:var(--text-3);margin-top:8px;line-height:1.45;}
    .ag-events,.ag-tasks-only{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}
    .ag-ev{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:10px;background:var(--surface-1);
      border:1px solid var(--line);border-left:3px solid var(--bc,rgba(111,154,82,0.55));}
    .ag-ev.task{background:rgba(132,194,94,0.05);border-left-color:var(--bc,#84c25e);}
    .ag-ev.late{border-left-color:#e0785f;}
    .ag-ev.late .ag-ev-t{color:#c0503a;}
    .ag-ev-t{font-size:0.72rem;font-weight:800;color:var(--leaf-text);min-width:58px;flex-shrink:0;}
    .ag-ev-n{font-size:0.86rem;color:var(--text-1);line-height:1.35;}
    .ag-empty{font-size:0.82rem;color:var(--text-3);padding:8px 4px;}
    .ag-toast{position:fixed;top:22px;left:50%;transform:translate(-50%,-140px);background:rgba(74,122,58,.96);color:var(--text-1);padding:10px 20px;border-radius:10px;font-weight:600;z-index:99999;transition:transform .3s ease;font-size:.86rem;box-shadow:0 8px 28px rgba(0,0,0,.4);max-width:90vw;text-align:center;}
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
