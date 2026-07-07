// /js/organizer.js - ORGANIZER : board type Trello (matrice d'Eisenhower).
// Colonnes + fiches déplaçables (drag & drop via SortableJS), échéances, étapes
// (checklist), logs d'activité par fiche. Fiche -> Terminé = XP (Accomplissement).
// "Idées à trier" est figée à gauche ; les autres colonnes sont réordonnables.
// Données : users/{uid}.organizer.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initUserMenu } from '/js/userMenu.js';
import { updateGlobalAvatar, saveWithFeedback } from '/js/common.js';

let auth, db, uid;
let board = null;
let sortables = [];
let cv = { x: 20, y: 20, z: 1 };   // état de la vue Canvas (pan x/y, zoom z)
const SVGNS = 'http://www.w3.org/2000/svg';
const nodeEls = new Map();         // id fiche → élément .org-node (pour tracer les liens)
let linking = null;                // liaison en cours { from } pendant un drag de port

if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }
try { initUserMenu(); } catch (e) {}
if (!document.getElementById('cyl-emoji-js')) { const _e = document.createElement('script'); _e.id = 'cyl-emoji-js'; _e.src = '/js/emoji.js'; document.head.appendChild(_e); }

const TRI_ID = 'tri';
const FINISH_ID = 'finish';
const FINISH_XP = 50;
const DEFAULT_COLUMNS = [
  { id: TRI_ID,   title: 'Idées à trier',                               color: '#8aa0bf' },
  { id: 'ui',     title: 'Urgent · Important - à faire',                color: '#f87171' },
  { id: 'ni',     title: 'Important, non urgent - à planifier',         color: '#38bdf8' },
  { id: 'up',     title: 'Urgent, peu important - vite fait / déléguer',color: '#fbbf24' },
  { id: 'nn',     title: 'Non urgent · non important - plus tard',      color: '#7e9ab5' },
  { id: FINISH_ID, title: 'Terminé ✅',                                  color: '#4ade80' },
];

const now = () => Date.now();
const uid6 = (p) => (p || 'c') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg, cls) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.className = 'toast' + (cls ? ' ' + cls : ''); t.classList.add('show'); clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 2200); }
function fmtDate(ts) { try { return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); } catch (_) { return ''; } }
function fmtLogTime(ts) { try { return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } }
function stripEmoji(s) { return String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}✅✔️]/gu, '').trim(); }

// ── Données ──────────────────────────────────────────────────────────────────
function col(id) { return board.columns.find((c) => c.id === id); }
function colTitle(id) { const c = col(id); return c ? c.title : ''; }
function findCard(id) {
  for (const c of board.columns) { const k = c.cards.find((x) => x.id === id); if (k) return { card: k, col: c }; }
  return null;
}
function log(card, m) { card.logs = card.logs || []; card.logs.unshift({ at: now(), m }); if (card.logs.length > 60) card.logs.length = 60; }
async function awardXp() { try { const fn = window._cyfFirebase && window._cyfFirebase.awardXp; if (fn) await fn('accomplissement', FINISH_XP); } catch (e) {} }

async function load() {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const o = snap.exists() && snap.data().organizer;
    board = (o && Array.isArray(o.columns)) ? o : null;
  } catch (e) { board = null; }
  if (!board) board = { v: 1, columns: DEFAULT_COLUMNS.map((c) => ({ ...c, cards: [] })) };
  board.columns.forEach((c) => { if (!Array.isArray(c.cards)) c.cards = []; });
  board.lockCols = !!board.lockCols;   // verrou colonnes (déplacement/édition/suppression)
  board.lockCards = !!board.lockCards; // verrou fiches (déplacement/ajout)
  board.view = board.view === 'canvas' ? 'canvas' : 'board';
  if (!board.canvas || typeof board.canvas.z !== 'number') board.canvas = { x: 20, y: 20, z: 1 };
  cv = board.canvas;                   // même référence -> save() persiste pan/zoom
  if (!Array.isArray(board.links)) board.links = [];   // connecteurs entre fiches (canvas)
  // garantit que 'tri' existe et passe en tête
  if (!col(TRI_ID)) board.columns.unshift({ ...DEFAULT_COLUMNS[0], cards: [] });
  board.columns.sort((a, b) => (a.id === TRI_ID ? -1 : b.id === TRI_ID ? 1 : 0));
}
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { saveWithFeedback(() => setDoc(doc(db, 'users', uid), { organizer: board }, { merge: true })); }, 250); }

// ── Rendu ────────────────────────────────────────────────────────────────────
function render() {
  if (board.view === 'canvas') { renderCanvas(); updateLockUI(); return; }
  const triHost = document.getElementById('org-tri');
  const boardEl = document.getElementById('org-board');
  if (!boardEl) return;
  if (triHost) renderColumn(col(TRI_ID), triHost);
  boardEl.innerHTML = '';
  board.columns.filter((c) => c.id !== TRI_ID).forEach((c) => boardEl.appendChild(renderColumn(c)));
  initSortables();
  updateLockUI();
}

// Reflète l'état des deux verrous sur les boutons (cadenas ouvert/fermé + libellé).
function updateLockUI() {
  const set = (id, locked, nom) => {
    const b = document.getElementById(id); if (!b) return;
    b.classList.toggle('locked', locked);
    b.setAttribute('aria-pressed', locked ? 'true' : 'false');
    b.title = (locked ? 'Déverrouiller' : 'Verrouiller') + ' ' + nom;
    const ic = b.querySelector('.org-lock-ic'); if (ic) ic.textContent = locked ? '🔒' : '🔓';
  };
  set('org-lock-cols', board.lockCols, 'les colonnes');
  set('org-lock-cards', board.lockCards, 'les fiches');
}

function renderColumn(c, into) {
  const el = into || document.createElement('div');
  if (!into) el.className = 'org-col';
  el.style.setProperty('--cc', c.color || '#8aa0bf');
  el.dataset.col = c.id;
  el.innerHTML =
    `<div class="org-col-head">` +
      `<span class="org-col-dot"></span>` +
      `<div class="org-col-title" spellcheck="false">${escapeHtml(c.title)}</div>` +
      `<span class="org-col-count">${c.cards.length}</span>` +
      (c.id === TRI_ID || c.id === FINISH_ID || board.lockCols ? '' : `<button class="org-col-menu" title="Supprimer la colonne">⋯</button>`) +
    `</div>` +
    `<div class="org-cards" data-col="${c.id}"></div>` +
    (board.lockCards ? '' : `<button class="org-add">+ Ajouter une fiche</button>`);
  // titre éditable en direct (sauf si colonnes verrouillées)
  const titleEl = el.querySelector('.org-col-title');
  titleEl.setAttribute('contenteditable', board.lockCols ? 'false' : 'true');
  if (!board.lockCols) {
    titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } });
    titleEl.addEventListener('blur', () => {
      const v = titleEl.textContent.trim();
      if (v && v !== c.title) { c.title = v; save(); }
      else if (!v) titleEl.textContent = c.title;
    });
  }
  const menu = el.querySelector('.org-col-menu'); if (menu) menu.onclick = () => deleteColumn(c);
  const cardsBox = el.querySelector('.org-cards');
  c.cards.forEach((card) => cardsBox.appendChild(renderCard(card)));
  const addBtn = el.querySelector('.org-add'); if (addBtn) addBtn.onclick = (ev) => openAdd(c, ev.currentTarget);
  return el;
}

function badgesHtml(card) {
  const checked = (card.checklist || []).filter((s) => s.done).length;
  const total = (card.checklist || []).length;
  const out = [];
  if (card.due) {
    const days = Math.ceil((card.due - now()) / 86400000);
    const cls = days < 0 ? 'due-late' : days <= 2 ? 'due-soon' : '';
    out.push(`<span class="org-badge ${cls}">🗓 ${escapeHtml(fmtDate(card.due))}</span>`);
  }
  if (total) out.push(`<span class="org-badge">☑ ${checked}/${total}</span>`);
  return out;
}

function renderCard(card) {
  const el = document.createElement('div');
  el.className = 'org-card' + (card.done ? ' done' : '');
  el.dataset.id = card.id;
  const title = document.createElement('div'); title.className = 'org-card-title'; title.textContent = card.title;
  el.appendChild(title);
  const badges = badgesHtml(card);
  if (badges.length) { const b = document.createElement('div'); b.className = 'org-card-badges'; b.innerHTML = badges.join(''); el.appendChild(b); }
  el.addEventListener('click', () => openCard(card.id));
  return el;
}

// ── Vue Canvas (toile infinie, mêmes données que le board) ───────────────────
const NODE_W = 230, NODE_H = 116, GAP_X = 60, GAP_Y = 22, ORIG_X = 40, ORIG_Y = 40;

function ensurePositions() {
  board.columns.forEach((c, ci) => {
    c.cards.forEach((card, ki) => {
      if (typeof card.cx !== 'number') card.cx = ORIG_X + ci * (NODE_W + GAP_X);
      if (typeof card.cy !== 'number') card.cy = ORIG_Y + ki * (NODE_H + GAP_Y);
    });
  });
}

function buildNode(card, c) {
  const el = document.createElement('div');
  el.className = 'org-node' + (card.done ? ' done' : '');
  el.dataset.id = card.id;
  el.style.setProperty('--nc', c.color || '#8aa0bf');
  el.style.left = card.cx + 'px'; el.style.top = card.cy + 'px';
  const badges = badgesHtml(card);
  el.innerHTML =
    `<div class="org-node-col"><i></i>${escapeHtml(stripEmoji(c.title))}</div>` +
    `<div class="org-node-title">${escapeHtml(card.title)}</div>` +
    (badges.length ? `<div class="org-node-badges">${badges.join('')}</div>` : '');
  // port de liaison (tirer une flèche vers une autre fiche)
  const port = document.createElement('span'); port.className = 'org-node-port'; port.title = 'Relier à une autre fiche';
  port.addEventListener('pointerdown', (ev) => startLink(card.id, ev));
  el.appendChild(port);
  attachNodeDrag(el, card);
  nodeEls.set(card.id, el);
  return el;
}

// Drag d'un nœud (met à jour cx/cy). Distingue clic (ouvre la fiche) et déplacement.
function attachNodeDrag(el, card) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();   // n'entraîne pas le pan du fond
    const sx = e.clientX, sy = e.clientY, ox = card.cx, oy = card.cy;
    let moved = false;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing'; el.style.zIndex = '20';
    const mv = (ev) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) moved = true;
      card.cx = ox + (ev.clientX - sx) / cv.z;
      card.cy = oy + (ev.clientY - sy) / cv.z;
      el.style.left = card.cx + 'px'; el.style.top = card.cy + 'px';
      drawLinks();   // les flèches suivent la fiche déplacée
    };
    const up = () => {
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up);
      el.style.cursor = 'grab'; el.style.zIndex = '';
      if (moved) save(); else openCard(card.id);
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  });
}

function renderCanvas() {
  const world = document.getElementById('org-canvas-world'); if (!world) return;
  ensurePositions();
  world.innerHTML = '';
  nodeEls.clear();
  // couche SVG des connecteurs, SOUS les fiches (insérée en premier)
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'org-links'); svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
  svg.innerHTML = `<defs><marker id="org-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="rgba(159,197,255,0.75)"/></marker></defs>`;
  world.appendChild(svg);
  board.columns.forEach((c) => c.cards.forEach((card) => world.appendChild(buildNode(card, c))));
  applyTransform();
  drawLinks();
}

// ── Connecteurs entre fiches (flèches, façon workflow IA) ────────────────────
function nodeCenter(id) {
  const el = nodeEls.get(id); if (!el) return null;
  return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 };
}
function linkPath(a, b) {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}
function drawLinks() {
  const world = document.getElementById('org-canvas-world'); if (!world) return;
  const svg = world.querySelector('.org-links'); if (!svg) return;
  // purge les liens dont une extrémité n'existe plus
  board.links = (board.links || []).filter((l) => nodeEls.has(l.from) && nodeEls.has(l.to));
  svg.querySelectorAll('.org-link-g').forEach((n) => n.remove());
  board.links.forEach((l) => {
    const a = nodeCenter(l.from), b = nodeCenter(l.to); if (!a || !b) return;
    const d = linkPath(a, b);
    const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'org-link-g');
    const hit = document.createElementNS(SVGNS, 'path'); hit.setAttribute('class', 'org-link-hit'); hit.setAttribute('d', d);
    const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('class', 'org-link'); p.setAttribute('d', d); p.setAttribute('marker-end', 'url(#org-arrow)');
    hit.addEventListener('click', (e) => { e.stopPropagation(); board.links = board.links.filter((x) => x.id !== l.id); save(); drawLinks(); toast('Lien supprimé'); });
    hit.setAttribute('title', 'Cliquer pour supprimer le lien');
    g.appendChild(hit); g.appendChild(p); svg.appendChild(g);
  });
}
function screenToWorld(e) {
  const wrap = document.getElementById('org-canvas-wrap'); const r = wrap.getBoundingClientRect();
  return { x: (e.clientX - r.left - cv.x) / cv.z, y: (e.clientY - r.top - cv.y) / cv.z };
}
function startLink(fromId, ev) {
  ev.stopPropagation();   // n'entraîne ni le drag de la fiche ni le pan
  const wrap = document.getElementById('org-canvas-wrap');
  const svg = document.querySelector('#org-canvas-world .org-links'); if (!svg) return;
  linking = { from: fromId };
  wrap.classList.add('linking');
  const temp = document.createElementNS(SVGNS, 'path'); temp.setAttribute('class', 'org-link temp'); svg.appendChild(temp);
  const move = (e) => { const a = nodeCenter(fromId), w = screenToWorld(e); if (a) temp.setAttribute('d', linkPath(a, w)); };
  const up = (e) => {
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
    wrap.classList.remove('linking'); temp.remove(); linking = null;
    const tgtEl = document.elementFromPoint(e.clientX, e.clientY);
    const node = tgtEl && tgtEl.closest && tgtEl.closest('.org-node');
    const toId = node && node.dataset.id;
    if (toId && toId !== fromId && !board.links.some((l) => l.from === fromId && l.to === toId)) {
      board.links.push({ id: uid6('lnk'), from: fromId, to: toId });
      save(); drawLinks();
    }
  };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
}

function applyTransform() {
  const world = document.getElementById('org-canvas-world');
  const wrap = document.getElementById('org-canvas-wrap');
  if (world) world.style.transform = `translate(${cv.x}px,${cv.y}px) scale(${cv.z})`;
  if (wrap) { wrap.style.backgroundSize = (24 * cv.z) + 'px ' + (24 * cv.z) + 'px'; wrap.style.backgroundPosition = cv.x + 'px ' + cv.y + 'px'; }
}

function initCanvasInteractions() {
  const wrap = document.getElementById('org-canvas-wrap'); if (!wrap || wrap._init) return; wrap._init = true;
  // Pan (glisser le fond)
  wrap.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.org-node') || e.target.closest('.org-canvas-toolbar')) return;
    wrap.classList.add('panning');
    const sx = e.clientX, sy = e.clientY, ox = cv.x, oy = cv.y;
    wrap.setPointerCapture(e.pointerId);
    const mv = (ev) => { cv.x = ox + (ev.clientX - sx); cv.y = oy + (ev.clientY - sy); applyTransform(); };
    const up = () => { wrap.removeEventListener('pointermove', mv); wrap.removeEventListener('pointerup', up); wrap.classList.remove('panning'); save(); };
    wrap.addEventListener('pointermove', mv); wrap.addEventListener('pointerup', up);
  });
  // Zoom (molette, vers le curseur)
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const old = cv.z;
    cv.z = Math.min(2.2, Math.max(0.3, old * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    cv.x = mx - (mx - cv.x) * (cv.z / old);
    cv.y = my - (my - cv.y) * (cv.z / old);
    applyTransform(); save();
  }, { passive: false });
}

function reorganizeCanvas() {
  board.columns.forEach((c, ci) => c.cards.forEach((card, ki) => {
    card.cx = ORIG_X + ci * (NODE_W + GAP_X); card.cy = ORIG_Y + ki * (NODE_H + GAP_Y);
  }));
  fitCanvas(); renderCanvas(); save();
}
function fitCanvas() { cv.x = 20; cv.y = 20; cv.z = 1; applyTransform(); save(); }

function setView(v) {
  board.view = v === 'canvas' ? 'canvas' : 'board';
  const wrap = document.getElementById('org-wrap');
  const cwrap = document.getElementById('org-canvas-wrap');
  document.querySelectorAll('#org-viewtoggle button').forEach((b) => {
    const on = b.dataset.view === board.view;
    b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  ['org-lock-cols', 'org-lock-cards', 'org-add-col'].forEach((id) => {
    const el = document.getElementById(id); if (el) el.style.display = board.view === 'canvas' ? 'none' : '';
  });
  if (board.view === 'canvas') {
    if (wrap) wrap.hidden = true; if (cwrap) cwrap.hidden = false;
    renderCanvas(); initCanvasInteractions();
  } else {
    if (cwrap) cwrap.hidden = true; if (wrap) wrap.hidden = false;
    render();
  }
  save();
}

// ── Drag & drop (SortableJS) ─────────────────────────────────────────────────
function initSortables() {
  if (!window.Sortable) return;
  sortables.forEach((s) => { try { s.destroy(); } catch (e) {} });
  sortables = [];
  document.querySelectorAll('.org-cards').forEach((cc) => {
    sortables.push(window.Sortable.create(cc, {
      group: 'cards', animation: 160, ghostClass: 'org-ghost', dragClass: 'org-drag',
      delay: 60, delayOnTouchOnly: true, disabled: board.lockCards,
      onEnd: handleCardEnd,
    }));
  });
  const b = document.getElementById('org-board');
  if (b) sortables.push(window.Sortable.create(b, {
    group: 'cols', handle: '.org-col-head', draggable: '.org-col', filter: '.org-col-title,.org-col-menu',
    preventOnFilter: false, animation: 160, ghostClass: 'org-col-ghost', disabled: board.lockCols, onEnd: reorderColumns,
  }));
}

function syncFromDom() {
  const all = {}; board.columns.forEach((c) => c.cards.forEach((k) => { all[k.id] = k; }));
  document.querySelectorAll('.org-cards').forEach((cc) => {
    const c = col(cc.dataset.col); if (!c) return;
    const ids = Array.from(cc.querySelectorAll(':scope > .org-card')).map((x) => x.dataset.id);
    c.cards = ids.map((id) => all[id]).filter(Boolean);
  });
}
function refreshCounts() {
  document.querySelectorAll('[data-col]').forEach((el) => {
    const c = col(el.dataset.col); const n = el.querySelector(':scope > .org-col-head > .org-col-count');
    if (c && n) n.textContent = c.cards.length;
  });
}
function handleCardEnd(evt) {
  const cardId = evt.item.dataset.id;
  const fromCol = evt.from.dataset.col, toCol = evt.to.dataset.col;
  syncFromDom();
  if (fromCol !== toCol) {
    const f = findCard(cardId);
    if (f) {
      log(f.card, `Déplacée : ${stripEmoji(colTitle(fromCol))} → ${stripEmoji(colTitle(toCol))}`);
      if (toCol === FINISH_ID && !f.card.done) { f.card.done = true; log(f.card, 'Terminé 🎉'); awardXp(); toast(`Fiche terminée · +${FINISH_XP} XP`, 'xp'); }
      else if (toCol !== FINISH_ID && f.card.done) { f.card.done = false; }
      evt.item.classList.toggle('done', !!f.card.done);
    }
  }
  save(); refreshCounts();
}
function reorderColumns() {
  const order = Array.from(document.querySelectorAll('#org-board > .org-col')).map((e) => e.dataset.col);
  const tri = col(TRI_ID);
  const rest = order.map((id) => col(id)).filter(Boolean);
  board.columns = [tri].filter(Boolean).concat(rest);
  save();
}

// ── Ajout de fiche ───────────────────────────────────────────────────────────
function openAdd(c, btn) {
  const wrap = document.createElement('div'); wrap.className = 'org-add-input';
  wrap.innerHTML = `<textarea placeholder="Une idée, une tâche..."></textarea>` +
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

// ── Colonnes ─────────────────────────────────────────────────────────────────
function deleteColumn(c) {
  if (c.id === TRI_ID || c.id === FINISH_ID) return;
  if (c.cards.length && !confirm(`Supprimer « ${stripEmoji(c.title)} » et ses ${c.cards.length} fiche(s) ?`)) return;
  board.columns = board.columns.filter((x) => x.id !== c.id); save(); render();
}
function addColumn() {
  if (board.lockCols) return;
  const colors = ['#a78bfa', '#34d399', '#f472b6', '#22d3ee', '#fb923c'];
  const c = { id: uid6('col'), title: 'Nouvelle colonne', color: colors[board.columns.length % colors.length], cards: [] };
  // insère avant 'Terminé' si présent, sinon à la fin
  const fi = board.columns.findIndex((x) => x.id === FINISH_ID);
  if (fi >= 0) board.columns.splice(fi, 0, c); else board.columns.push(c);
  save(); render();
  setTimeout(() => {
    const el = document.querySelector(`#org-board > .org-col[data-col="${c.id}"] .org-col-title`);
    if (el) { el.focus(); try { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (_) {} }
  }, 60);
}

// ── Détail d'une fiche (modal) ───────────────────────────────────────────────
function moveCard(cardId, toColId) {
  const f = findCard(cardId); if (!f || f.col.id === toColId) return;
  const dest = col(toColId); if (!dest) return;
  f.col.cards = f.col.cards.filter((x) => x.id !== cardId);
  dest.cards.push(f.card);
  log(f.card, `Déplacée : ${stripEmoji(f.col.title)} → ${stripEmoji(dest.title)}`);
  if (toColId === FINISH_ID && !f.card.done) { f.card.done = true; log(f.card, 'Terminé 🎉'); awardXp(); toast(`Fiche terminée · +${FINISH_XP} XP`, 'xp'); }
  else if (toColId !== FINISH_ID && f.card.done) { f.card.done = false; }
  save(); render();
}

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
      <textarea class="org-d-input" id="d-desc" placeholder="Détaille cette idée...">${escapeHtml(card.desc || '')}</textarea>
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
      body: JSON.stringify({ summary: '🗂 ' + card.title, start: { date: d }, end: { date: dn }, description: 'ORGANIZER - ChangeYourLife.ai' }),
    });
    if (!r.ok) throw new Error('http');
    log(card, 'Ajoutée à Google Agenda'); save(); toast('Ajoutée à ton Agenda');
  } catch (e) { toast("Échec de l'ajout à l'Agenda"); }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
document.getElementById('org-add-col').onclick = addColumn;
const _lockCols = document.getElementById('org-lock-cols');
if (_lockCols) _lockCols.onclick = () => {
  board.lockCols = !board.lockCols; save(); render();
  toast(board.lockCols ? 'Colonnes verrouillées' : 'Colonnes déverrouillées');
};
const _lockCards = document.getElementById('org-lock-cards');
if (_lockCards) _lockCards.onclick = () => {
  board.lockCards = !board.lockCards; save(); render();
  toast(board.lockCards ? 'Fiches verrouillées' : 'Fiches déverrouillées');
};
document.querySelectorAll('#org-viewtoggle button').forEach((b) => { b.onclick = () => setView(b.dataset.view); });
const _reorg = document.getElementById('org-canvas-reorg'); if (_reorg) _reorg.onclick = reorganizeCanvas;
const _fit = document.getElementById('org-canvas-fit'); if (_fit) _fit.onclick = fitCanvas;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login/'; return; }
  uid = user.uid;
  try { updateGlobalAvatar((user.email || 'U').charAt(0).toUpperCase()); } catch (e) {}
  try { initUserMenu(); } catch (e) {}
  await load();
  setView(board.view);
});
