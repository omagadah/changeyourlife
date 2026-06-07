// /js/organizer.js — ORGANIZER : board type Trello (matrice d'Eisenhower).
// Colonnes + fiches déplaçables (drag & drop), échéances, étapes (checklist),
// logs d'activité par fiche. Fiche → Terminé = XP sur la branche Accomplissement.
// Données : users/{uid}.organizer.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initUserMenu } from '/js/userMenu.js';
import { updateGlobalAvatar } from '/js/common.js';

let auth, db, uid;
let board = null;
let dragId = null;

if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }
try { initUserMenu(); } catch (e) {}
if (!document.getElementById('cyl-emoji-js')) { const _e = document.createElement('script'); _e.id = 'cyl-emoji-js'; _e.src = '/js/emoji.js'; document.head.appendChild(_e); }

const FINISH_ID = 'finish';
const FINISH_XP = 50;
const DEFAULT_COLUMNS = [
  { id: 'tri',    title: 'Idées à trier',                              color: '#8aa0bf' },
  { id: 'ui',     title: 'Urgent · Important — à faire',               color: '#f87171' },
  { id: 'ni',     title: 'Important, non urgent — à planifier',        color: '#38bdf8' },
  { id: 'up',     title: 'Urgent, peu important — vite fait / déléguer',color: '#fbbf24' },
  { id: 'nn',     title: 'Non urgent · non important — plus tard',     color: '#7e9ab5' },
  { id: FINISH_ID, title: 'Terminé ✅',                                 color: '#4ade80' },
];

const now = () => Date.now();
const uid6 = (p) => (p || 'c') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg, cls) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.className = 'toast' + (cls ? ' ' + cls : ''); t.classList.add('show'); clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 2200); }
function fmtDate(ts) { try { return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); } catch (_) { return ''; } }
function fmtLogTime(ts) { try { return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } }

// ── Données ──────────────────────────────────────────────────────────────────
function col(id) { return board.columns.find((c) => c.id === id); }
function findCard(id) {
  for (const c of board.columns) { const k = c.cards.find((x) => x.id === id); if (k) return { card: k, col: c }; }
  return null;
}
function log(card, m) { card.logs = card.logs || []; card.logs.unshift({ at: now(), m }); if (card.logs.length > 60) card.logs.length = 60; }

async function load() {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const o = snap.exists() && snap.data().organizer;
    board = (o && Array.isArray(o.columns)) ? o : null;
  } catch (e) { board = null; }
  if (!board) board = { v: 1, columns: DEFAULT_COLUMNS.map((c) => ({ ...c, cards: [] })) };
  board.columns.forEach((c) => { if (!Array.isArray(c.cards)) c.cards = []; });
}
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { setDoc(doc(db, 'users', uid), { organizer: board }, { merge: true }).catch(() => {}); }, 250); }

// ── Rendu du board ───────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById('org-board'); if (!root) return;
  root.innerHTML = '';
  board.columns.forEach((c) => root.appendChild(renderColumn(c)));
}

function renderColumn(c) {
  const el = document.createElement('div');
  el.className = 'org-col'; el.style.setProperty('--cc', c.color || '#8aa0bf'); el.dataset.col = c.id;
  const head = document.createElement('div'); head.className = 'org-col-head';
  head.innerHTML = `<span class="org-col-dot"></span><div class="org-col-title">${escapeHtml(c.title)}</div>` +
    `<span class="org-col-count">${c.cards.length}</span><button class="org-col-menu" title="Options">⋯</button>`;
  head.querySelector('.org-col-title').onclick = () => renameColumn(c);
  head.querySelector('.org-col-menu').onclick = () => columnMenu(c);
  el.appendChild(head);

  const cards = document.createElement('div'); cards.className = 'org-cards'; cards.dataset.col = c.id;
  c.cards.forEach((card) => cards.appendChild(renderCard(card, c)));
  // drop zone
  cards.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag-over'); });
  cards.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  cards.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('drag-over'); if (dragId) moveCard(dragId, c.id); });
  el.appendChild(cards);

  const add = document.createElement('button'); add.className = 'org-add'; add.textContent = '+ Ajouter une fiche';
  add.onclick = () => openAdd(c, add);
  el.appendChild(add);
  return el;
}

function renderCard(card, c) {
  const el = document.createElement('div');
  el.className = 'org-card' + (card.done ? ' done' : '');
  el.draggable = true; el.dataset.id = card.id;
  const title = document.createElement('div'); title.className = 'org-card-title'; title.textContent = card.title;
  el.appendChild(title);
  // badges
  const checked = (card.checklist || []).filter((s) => s.done).length;
  const total = (card.checklist || []).length;
  const badges = [];
  if (card.due) {
    const days = Math.ceil((card.due - now()) / 86400000);
    const cls = days < 0 ? 'due-late' : days <= 2 ? 'due-soon' : '';
    badges.push(`<span class="org-badge ${cls}">🗓 ${escapeHtml(fmtDate(card.due))}</span>`);
  }
  if (total) badges.push(`<span class="org-badge">☑ ${checked}/${total}</span>`);
  if (badges.length) { const b = document.createElement('div'); b.className = 'org-card-badges'; b.innerHTML = badges.join(''); el.appendChild(b); }
  el.addEventListener('dragstart', (e) => { dragId = card.id; el.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', card.id); } catch (_) {} });
  el.addEventListener('dragend', () => { dragId = null; el.classList.remove('dragging'); });
  el.addEventListener('click', () => openCard(card.id));
  return el;
}

// ── Ajout de fiche ───────────────────────────────────────────────────────────
function openAdd(c, btn) {
  const wrap = document.createElement('div'); wrap.className = 'org-add-input';
  wrap.innerHTML = `<textarea placeholder="Une idée, une tâche…"></textarea>` +
    `<div class="org-add-row"><button class="org-add-ok">Ajouter</button><button class="org-add-cancel">Annuler</button></div>`;
  btn.replaceWith(wrap);
  const ta = wrap.querySelector('textarea'); ta.focus();
  const commit = () => {
    const v = ta.value.trim();
    if (v) {
      const card = { id: uid6(), title: v, desc: '', due: null, checklist: [], logs: [], done: c.id === FINISH_ID, createdAt: now() };
      log(card, 'Fiche créée');
      c.cards.push(card); save(); render();
    } else { render(); }
  };
  wrap.querySelector('.org-add-ok').onclick = commit;
  wrap.querySelector('.org-add-cancel').onclick = () => render();
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } });
}

// ── Déplacement ──────────────────────────────────────────────────────────────
function moveCard(cardId, toColId) {
  const f = findCard(cardId); if (!f || f.col.id === toColId) return;
  const dest = col(toColId); if (!dest) return;
  f.col.cards = f.col.cards.filter((x) => x.id !== cardId);
  dest.cards.push(f.card);
  log(f.card, `Déplacée : ${stripEmoji(f.col.title)} → ${stripEmoji(dest.title)}`);
  if (toColId === FINISH_ID && !f.card.done) {
    f.card.done = true; log(f.card, 'Terminé 🎉');
    awardXp(); toast(`Fiche terminée · +${FINISH_XP} XP`, 'xp');
  } else if (toColId !== FINISH_ID && f.card.done) {
    f.card.done = false;
  }
  save(); render();
}
function stripEmoji(s) { return String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}✅✔️]/gu, '').trim(); }
async function awardXp() { try { const fn = window._cyfFirebase && window._cyfFirebase.awardXp; if (fn) await fn('accomplissement', FINISH_XP); } catch (e) {} }

// ── Colonnes ─────────────────────────────────────────────────────────────────
function renameColumn(c) {
  const t = prompt('Renommer la colonne :', c.title);
  if (t && t.trim()) { c.title = t.trim(); save(); render(); }
}
function columnMenu(c) {
  if (c.cards.length) { if (!confirm(`Supprimer « ${stripEmoji(c.title)} » et ses ${c.cards.length} fiche(s) ?`)) return; }
  else if (!confirm(`Supprimer la colonne « ${stripEmoji(c.title)} » ?`)) return;
  board.columns = board.columns.filter((x) => x.id !== c.id); save(); render();
}
function addColumn() {
  const t = prompt('Nom de la nouvelle colonne :', 'Nouvelle colonne');
  if (!t || !t.trim()) return;
  const colors = ['#a78bfa', '#34d399', '#f472b6', '#22d3ee', '#fb923c'];
  board.columns.push({ id: uid6('col'), title: t.trim(), color: colors[board.columns.length % colors.length], cards: [] });
  save(); render();
}

// ── Détail d'une fiche (modal) ───────────────────────────────────────────────
function openCard(cardId) {
  const f = findCard(cardId); if (!f) return;
  const card = f.card;
  const m = document.getElementById('org-modal');
  const checked = (card.checklist || []).filter((s) => s.done).length;
  const total = (card.checklist || []).length;
  const pct = total ? Math.round((checked / total) * 100) : 0;
  const dueVal = card.due ? new Date(card.due).toISOString().slice(0, 10) : '';
  m.innerHTML = `
    <div class="org-card-detail">
      <textarea class="org-d-title" id="d-title" rows="1">${escapeHtml(card.title)}</textarea>
      <div class="org-d-label">Description</div>
      <textarea class="org-d-input" id="d-desc" placeholder="Détaille cette idée…">${escapeHtml(card.desc || '')}</textarea>
      <div class="org-d-label">Échéance</div>
      <input type="date" class="org-d-input" id="d-due" value="${dueVal}" />
      <div class="org-d-label">Étapes ${total ? `· ${checked}/${total}` : ''}</div>
      <div class="org-prog"><div style="width:${pct}%"></div></div>
      <div id="d-checks"></div>
      <input type="text" class="org-d-input" id="d-newstep" placeholder="Ajouter une étape + Entrée" style="margin-top:6px" />
      <div class="org-d-label">Déplacer vers</div>
      <select class="org-d-move" id="d-move">${board.columns.map((c) => `<option value="${c.id}"${c.id === f.col.id ? ' selected' : ''}>${escapeHtml(stripEmoji(c.title))}</option>`).join('')}</select>
      <div class="org-d-label">Activité</div>
      <div class="org-logs" id="d-logs"></div>
      <div class="org-d-actions">
        <button class="org-btn cal" id="d-cal">↗ Ajouter à l'Agenda</button>
        <button class="org-btn del" id="d-del">Supprimer</button>
        <button class="org-btn close" id="d-close">Fermer</button>
      </div>
    </div>`;
  m.classList.remove('hidden');

  const titleEl = m.querySelector('#d-title');
  const autoGrow = (e) => { e.style.height = 'auto'; e.style.height = e.scrollHeight + 'px'; };
  autoGrow(titleEl);
  titleEl.oninput = () => autoGrow(titleEl);
  titleEl.onblur = () => { const v = titleEl.value.trim(); if (v && v !== card.title) { card.title = v; log(card, 'Titre modifié'); save(); render(); } };
  m.querySelector('#d-desc').onblur = (e) => { if ((e.target.value || '') !== (card.desc || '')) { card.desc = e.target.value; save(); } };
  m.querySelector('#d-due').onchange = (e) => {
    card.due = e.target.value ? new Date(e.target.value + 'T09:00:00').getTime() : null;
    log(card, card.due ? 'Échéance ' + fmtDate(card.due) : 'Échéance retirée'); save(); render();
  };
  const newStep = m.querySelector('#d-newstep');
  newStep.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && newStep.value.trim()) {
      card.checklist = card.checklist || [];
      card.checklist.push({ id: uid6('s'), t: newStep.value.trim(), done: false });
      newStep.value = ''; save(); openCard(cardId); render();
    }
  });
  m.querySelector('#d-move').onchange = (e) => { closeModal(); moveCard(cardId, e.target.value); };
  m.querySelector('#d-cal').onclick = () => addToAgenda(card);
  m.querySelector('#d-del').onclick = () => { if (confirm('Supprimer cette fiche ?')) { f.col.cards = f.col.cards.filter((x) => x.id !== cardId); closeModal(); save(); render(); } };
  m.querySelector('#d-close').onclick = closeModal;
  m.onclick = (e) => { if (e.target === m) closeModal(); };
  renderChecks(card, cardId);
  renderLogs(card);
}
function renderChecks(card, cardId) {
  const box = document.getElementById('d-checks'); if (!box) return;
  box.innerHTML = '';
  (card.checklist || []).forEach((s) => {
    const row = document.createElement('div'); row.className = 'org-check';
    row.innerHTML = `<input type="checkbox"${s.done ? ' checked' : ''}><span class="${s.done ? 'done' : ''}">${escapeHtml(s.t)}</span><button class="del">✕</button>`;
    row.querySelector('input').onchange = (e) => { s.done = e.target.checked; if (s.done) log(card, 'Étape : ' + s.t); save(); openCard(cardId); render(); };
    row.querySelector('.del').onclick = () => { card.checklist = card.checklist.filter((x) => x.id !== s.id); save(); openCard(cardId); render(); };
    box.appendChild(row);
  });
}
function renderLogs(card) {
  const box = document.getElementById('d-logs'); if (!box) return;
  const logs = card.logs || [];
  box.innerHTML = logs.length ? logs.map((l) => `<div class="org-log"><span class="t">${escapeHtml(fmtLogTime(l.at))}</span><span>${escapeHtml(l.m)}</span></div>`).join('') : '<div class="org-log">Aucune activité.</div>';
}
function closeModal() { const m = document.getElementById('org-modal'); if (m) m.classList.add('hidden'); }

// ── Agenda (réutilise le jeton du connecteur Google Agenda) ─────────────────
async function addToAgenda(card) {
  let tok = null;
  try { const x = JSON.parse(localStorage.getItem('cyl_gcal_token') || 'null'); if (x && x.t && x.exp > now()) tok = x.t; } catch (_) {}
  if (!tok) { toast("Connecte d'abord Google Agenda (depuis Mon espace)"); return; }
  const day = (card.due ? new Date(card.due) : new Date());
  const d = day.toISOString().slice(0, 10);
  const dn = new Date(day.getTime() + 86400000).toISOString().slice(0, 10);
  try {
    const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: '🗂 ' + card.title, start: { date: d }, end: { date: dn }, description: 'ORGANIZER — ChangeYourLife.ai' }),
    });
    if (!r.ok) throw new Error('http');
    log(card, 'Ajoutée à Google Agenda'); save(); toast('Ajoutée à ton Agenda ✓');
  } catch (e) { toast("Échec de l'ajout à l'Agenda"); }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
document.getElementById('org-add-col').onclick = addColumn;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login/'; return; }
  uid = user.uid;
  try { updateGlobalAvatar((user.email || 'U').charAt(0).toUpperCase()); } catch (e) {}
  try { initUserMenu(); } catch (e) {}
  await load();
  render();
});
