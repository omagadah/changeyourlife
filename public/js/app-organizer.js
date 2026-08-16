// /js/app-organizer.js - Le CERVEAU en tete de /app/.
//
// L'ORGANIZER n'est plus un lien vers une autre page : il EST la page d'arrivee.
// Tout ce qui te passe par la tete se depose ici, se trie par priorite
// (Eisenhower), se rattache a une branche de ta vie (Maslow) et part dans ton
// Google Agenda. Meme document Firestore que /organizer/ (users/{uid}.organizer).

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  loadBoard, saveBoard, getCol, findCard, moveCard, addCard, logCard,
  allCards, dueToday, topPriorities, stripEmoji,
  BRANCHES, BRANCH_BY_KEY, TRI_ID, FINISH_ID, FINISH_XP,
} from '/js/organizer-data.js';
import * as gcal from '/js/gcal.js';

let auth, db, uid;
let board = null;
let sortables = [];

if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }

// Colonnes affichees dans le hub (le board complet reste sur /organizer/).
const HUB_COLS = [TRI_ID, 'ui', 'ni', 'up'];

// Couleurs des colonnes COTE HUB : palette organique (les couleurs stockees
// dans le board datent de la palette navy v2 - override purement visuel ici).
const HUB_COLORS = { [TRI_ID]: '#b4ad94', ui: '#e0785f', ni: '#e7b15c', up: '#6f9a52', nn: '#7c7660' };

const $ = (s, r = document) => r.querySelector(s);
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmtDate(ts) { try { return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); } catch (_) { return ''; } }

function toast(msg, cls) {
  let t = document.getElementById('cyl-hub-toast');
  if (!t) { t = document.createElement('div'); t.id = 'cyl-hub-toast'; t.className = 'hub-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'hub-toast show' + (cls ? ' ' + cls : '');
  clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 2400);
}

function persist() {
  saveBoard(db, uid, board, {
    onError: () => toast('Sauvegarde impossible - verifie ta connexion', 'err'),
  });
  try { document.dispatchEvent(new CustomEvent('cyl:organizer-changed', { detail: { board } })); } catch (_) {}
}

async function award(branchKey, amount, label) {
  try {
    const fn = window._cyfFirebase && window._cyfFirebase.awardXp;
    if (fn) await fn(branchKey || 'accomplissement', amount);
    toast(`+${amount} XP · ${label}`, 'xp');
  } catch (_) {}
}

// ── Rendu ────────────────────────────────────────────────────────────────────
function render() {
  const host = $('#organizer-hub');
  if (!host || !board) return;
  host.innerHTML = `
    <div class="hub-head">
      <div class="hub-brand">
        <span class="hub-dot"></span>
        <div>
          <div class="hub-title">ORGANIZER</div>
          <div class="hub-sub">Tout ce que tu as en tete. Trie, priorise, planifie.</div>
        </div>
      </div>
      <div class="hub-head-actions">
        <button class="hub-ghost" id="hub-syl" title="Demander a SYL de trier et de proposer un plan">SYL, aide-moi a trier</button>
        <a class="hub-ghost" href="/organizer/" title="Ouvrir le board complet (canvas, colonnes, liens)">Ouvrir en grand ⤢</a>
      </div>
    </div>

    <form class="hub-capture" id="hub-capture" autocomplete="off">
      <input type="text" id="hub-input" maxlength="300"
             placeholder="Deverse une idee, une tache, une pensee - Entree pour capturer" />
      <button type="submit" class="hub-add" aria-label="Capturer">Capturer</button>
    </form>

    <div class="hub-cols" id="hub-cols"></div>
    <div class="hub-foot" id="hub-foot"></div>
    <div class="hub-sheet hidden" id="hub-sheet"></div>
  `;

  $('#hub-capture').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#hub-input');
    const v = input.value.trim();
    if (!v) return;
    const card = addCard(board, TRI_ID, v);
    input.value = '';
    persist(); render();
    if (card && card.branch) toast(`Capture · rangee dans ${BRANCH_BY_KEY[card.branch].label}`);
    else toast('Capture dans « Idees a trier »');
  });

  const sylBtn = $('#hub-syl');
  if (sylBtn) sylBtn.addEventListener('click', askSyl);

  renderCols();
  renderFoot();
  initDnd();
}

function renderCols() {
  const box = $('#hub-cols'); if (!box) return;
  box.innerHTML = '';
  HUB_COLS.forEach((id) => {
    const c = getCol(board, id); if (!c) return;
    const el = document.createElement('div');
    el.className = 'hub-col' + (id === TRI_ID ? ' hub-col-tri' : '');
    el.style.setProperty('--cc', HUB_COLORS[c.id] || c.color || '#b4ad94');
    el.dataset.col = c.id;
    el.innerHTML =
      `<div class="hub-col-head"><span class="hub-col-dot"></span>` +
      `<span class="hub-col-title">${esc(shortTitle(c))}</span>` +
      `<span class="hub-col-count">${c.cards.length}</span></div>` +
      `<div class="hub-cards" data-col="${esc(c.id)}"></div>`;
    const cards = el.querySelector('.hub-cards');
    c.cards.slice(0, 40).forEach((card) => cards.appendChild(renderCard(card)));
    if (!c.cards.length) {
      const e = document.createElement('div');
      e.className = 'hub-empty';
      e.textContent = id === TRI_ID ? 'Rien en attente de tri.' : 'Vide.';
      cards.appendChild(e);
    }
    box.appendChild(el);
  });
}

// Titres courts pour les colonnes du hub (le titre long reste sur /organizer/).
const SHORT = { [TRI_ID]: 'A trier', ui: 'Urgent · Important', ni: 'A planifier', up: 'Vite fait / deleguer', nn: 'Plus tard' };
function shortTitle(c) { return SHORT[c.id] || stripEmoji(c.title); }

function renderCard(card) {
  const el = document.createElement('div');
  el.className = 'hub-card' + (card.done ? ' done' : '');
  el.dataset.id = card.id;
  const b = card.branch && BRANCH_BY_KEY[card.branch];
  if (b) el.style.setProperty('--bc', b.color);
  const badges = [];
  if (card.due) {
    const days = Math.ceil((card.due - Date.now()) / 86400000);
    const cls = days < 0 ? ' late' : days <= 1 ? ' soon' : '';
    badges.push(`<span class="hub-badge${cls}">${esc(fmtDate(card.due))}</span>`);
  }
  if (card.gcalId) badges.push('<span class="hub-badge cal" title="Dans ton Google Agenda">agenda</span>');
  const total = (card.checklist || []).length;
  if (total) badges.push(`<span class="hub-badge">${(card.checklist || []).filter((s) => s.done).length}/${total}</span>`);
  el.innerHTML =
    (b ? `<span class="hub-card-branch" title="${esc(b.label)}">${b.emoji}</span>` : '') +
    `<span class="hub-card-title">${esc(card.title)}</span>` +
    (badges.length ? `<span class="hub-card-badges">${badges.join('')}</span>` : '');
  // Accessible au clavier : la fiche s'ouvre a Entree/Espace, et la modale
  // permet ensuite priorite/echeance/branche sans souris (drag&drop non requis).
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', card.title);
  el.addEventListener('click', () => openSheet(card.id));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(card.id); }
  });
  return el;
}

function renderFoot() {
  const f = $('#hub-foot'); if (!f) return;
  const open = allCards(board).filter(({ card, col }) => !card.done && col.id !== FINISH_ID);
  const late = open.filter(({ card }) => card.due && card.due < Date.now()).length;
  const tri = (getCol(board, TRI_ID) || { cards: [] }).cards.length;
  const done = (getCol(board, FINISH_ID) || { cards: [] }).cards.length;
  const bits = [
    `<b>${open.length}</b> en cours`,
    tri ? `<b>${tri}</b> a trier` : '',
    late ? `<b class="late">${late}</b> en retard` : '',
    done ? `<b>${done}</b> terminees` : '',
  ].filter(Boolean);
  f.innerHTML = bits.join('<span class="sep">·</span>');
}

// ── Drag & drop entre colonnes ───────────────────────────────────────────────
function initDnd() {
  if (!window.Sortable) return;
  sortables.forEach((s) => { try { s.destroy(); } catch (_) {} });
  sortables = [];
  document.querySelectorAll('#hub-cols .hub-cards').forEach((cc) => {
    sortables.push(window.Sortable.create(cc, {
      group: 'hub-cards', animation: 150, ghostClass: 'hub-ghost-card', dragClass: 'hub-drag',
      delay: 80, delayOnTouchOnly: true, filter: '.hub-empty',
      onEnd: onDragEnd,
    }));
  });
}

function syncFromDom() {
  const all = {};
  board.columns.forEach((c) => c.cards.forEach((k) => { all[k.id] = k; }));
  document.querySelectorAll('#hub-cols .hub-cards').forEach((cc) => {
    const c = getCol(board, cc.dataset.col); if (!c) return;
    const ids = Array.from(cc.querySelectorAll(':scope > .hub-card')).map((x) => x.dataset.id);
    c.cards = ids.map((id) => all[id]).filter(Boolean);
  });
}

function onDragEnd(evt) {
  const from = evt.from.dataset.col, to = evt.to.dataset.col;
  const id = evt.item.dataset.id;
  const before = findCard(board, id);
  const cardRef = before && before.card;
  syncFromDom();
  if (from !== to && cardRef) {
    logCard(cardRef, `Deplacee : ${stripEmoji(SHORT[from] || from)} -> ${stripEmoji(SHORT[to] || to)}`);
  }
  persist(); renderCols(); renderFoot(); initDnd();
}

// ── Fiche : panneau d'action rapide ──────────────────────────────────────────
function openSheet(cardId) {
  const f = findCard(board, cardId); if (!f) return;
  const card = f.card;
  const s = $('#hub-sheet'); if (!s) return;
  const wasHidden = s.classList.contains('hidden');
  const dueVal = card.due ? new Date(card.due).toISOString().slice(0, 10) : '';
  s.innerHTML = `
    <div class="hub-sheet-in" role="dialog" aria-modal="true" aria-label="${esc(card.title)}">
      <button class="hub-sheet-x" id="hs-x" aria-label="Fermer">✕</button>
      <textarea class="hub-sheet-title" id="hs-title" rows="1">${esc(card.title)}</textarea>

      <div class="hub-l">Quelle part de ta vie ca nourrit</div>
      <div class="hub-branches" id="hs-branches">
        ${BRANCHES.map((b) => `<button class="hub-br${card.branch === b.key ? ' on' : ''}" data-b="${b.key}" style="--bc:${b.color}" title="${esc(b.label)}">${b.emoji}<span>${esc(b.label)}</span></button>`).join('')}
      </div>

      <div class="hub-l">Quand</div>
      <div class="hub-when">
        <button class="hub-chip" data-when="0">Aujourd'hui</button>
        <button class="hub-chip" data-when="1">Demain</button>
        <button class="hub-chip" data-when="7">Dans 7 j</button>
        <input type="date" id="hs-due" value="${dueVal}" />
      </div>

      <div class="hub-l">Priorite</div>
      <div class="hub-when" id="hs-move">
        ${['ui', 'ni', 'up', 'nn'].map((id) => `<button class="hub-chip${f.col.id === id ? ' on' : ''}" data-move="${id}">${esc(SHORT[id] || id)}</button>`).join('')}
      </div>

      <div class="hub-sheet-actions">
        <button class="hub-b cal" id="hs-cal">${card.gcalId ? '✓ Dans ton agenda' : '↗ Planifier dans Google Agenda'}</button>
        <button class="hub-b ok" id="hs-done">Terminee (+${FINISH_XP} XP)</button>
        <button class="hub-b del" id="hs-del">Supprimer</button>
      </div>
    </div>`;
  s.classList.remove('hidden');

  const close = () => { s.classList.add('hidden'); document.removeEventListener('keydown', onEsc); };
  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  // openSheet est re-appele au sein de la meme modale (choix de branche,
  // echeance...) : on remplace le handler au lieu de l'empiler.
  if (s._onEsc) document.removeEventListener('keydown', s._onEsc);
  s._onEsc = onEsc;
  document.addEventListener('keydown', onEsc);
  s.onclick = (e) => { if (e.target === s) close(); };
  $('#hs-x').onclick = close;
  if (wasHidden) $('#hs-x').focus();

  const ta = $('#hs-title');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  grow(); ta.oninput = grow;
  ta.onblur = () => {
    const v = ta.value.trim();
    if (v && v !== card.title) { card.title = v; logCard(card, 'Titre modifie'); persist(); renderCols(); }
  };

  s.querySelectorAll('#hs-branches .hub-br').forEach((btn) => {
    btn.onclick = () => {
      const k = btn.dataset.b;
      card.branch = card.branch === k ? null : k;
      logCard(card, card.branch ? 'Branche : ' + BRANCH_BY_KEY[k].label : 'Branche retiree');
      persist(); openSheet(cardId); renderCols();
    };
  });

  const setDue = (ts) => {
    card.due = ts;
    logCard(card, ts ? 'Echeance ' + fmtDate(ts) : 'Echeance retiree');
    persist(); openSheet(cardId); renderCols(); renderFoot();
  };
  s.querySelectorAll('[data-when]').forEach((btn) => {
    btn.onclick = () => {
      const d = new Date(); d.setHours(9, 0, 0, 0);
      d.setDate(d.getDate() + Number(btn.dataset.when));
      setDue(d.getTime());
    };
  });
  $('#hs-due').onchange = (e) => setDue(e.target.value ? new Date(e.target.value + 'T09:00:00').getTime() : null);

  s.querySelectorAll('[data-move]').forEach((btn) => {
    btn.onclick = () => {
      moveCard(board, cardId, btn.dataset.move);
      persist(); close(); renderCols(); renderFoot(); initDnd();
      toast('Priorite : ' + (SHORT[btn.dataset.move] || btn.dataset.move));
    };
  });

  $('#hs-cal').onclick = (e) => planInCalendar(card, e.currentTarget);

  $('#hs-done').onclick = async () => {
    const r = moveCard(board, cardId, FINISH_ID);
    persist(); close(); renderCols(); renderFoot(); initDnd();
    if (r.finished) await award(card.branch, FINISH_XP, 'fiche terminee');
  };

  $('#hs-del').onclick = () => {
    if (!confirm('Supprimer cette fiche ?')) return;
    f.col.cards = f.col.cards.filter((x) => x.id !== cardId);
    persist(); close(); renderCols(); renderFoot(); initDnd();
    toast('Fiche supprimee');
  };
}

// ── Planification dans Google Agenda ─────────────────────────────────────────
async function planInCalendar(card, btn) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Connexion…';
  try {
    if (!gcal.isConnected() || !gcal.canWrite()) await gcal.connect({ write: true });
    btn.textContent = 'Ajout…';
    const ev = await gcal.createEvent({
      summary: card.title,
      description: 'ORGANIZER - changeyourlife.ai',
      day: card.due ? new Date(card.due) : new Date(),
    });
    card.gcalId = (ev && ev.id) || null;
    if (!card.due) card.due = Date.now();
    logCard(card, 'Planifiee dans Google Agenda');
    persist(); renderCols(); renderFoot();
    btn.textContent = '✓ Dans ton agenda';
    toast('Ajoutee a ton Google Agenda');
    document.dispatchEvent(new CustomEvent('cyl:gcal-refresh'));
  } catch (err) {
    console.error('[hub] plan in calendar:', err && err.code, err && err.message);
    btn.disabled = false; btn.textContent = label;
    if (err && err.code === 'gcal/forbidden') {
      toast("Ton acces agenda est en lecture seule - reconnecte-le pour autoriser l'ecriture", 'err');
      gcal.disconnect();
    } else {
      toast(gcal.connectErrorMessage(err), 'err');
    }
  }
}

// ── SYL : trier et proposer un plan ──────────────────────────────────────────
// Ouvre le chat SYL avec un contexte pre-rempli (l'utilisateur garde la main :
// SYL propose, il decide - cf. cadre non-directif).
function askSyl() {
  const top = topPriorities(board, 6);
  const due = dueToday(board);
  const lines = top.map(({ card, col }) =>
    `- ${card.title}${card.due ? ` (echeance ${fmtDate(card.due)})` : ''} [${stripEmoji(SHORT[col.id] || col.title)}]`);
  const msg =
    `Voici ce que j'ai en tete aujourd'hui :\n${lines.join('\n') || '(rien de note)'}\n\n` +
    (due.length ? `${due.length} echeance(s) tombent aujourd'hui ou avant.\n\n` : '') +
    `Aide-moi a y voir clair : par quoi commencer, et qu'est-ce qui peut attendre ?`;
  try {
    document.dispatchEvent(new CustomEvent('cyl:syl-open', { detail: { prefill: msg } }));
  } catch (_) {}
}

// ── Styles ───────────────────────────────────────────────────────────────────
function injectCSS() {
  if (document.getElementById('cyl-hub-css')) return;
  const s = document.createElement('style'); s.id = 'cyl-hub-css';
  s.textContent = `
  #organizer-hub{background:linear-gradient(160deg,rgba(231,177,92,0.09),rgba(21,32,19,0.55));
    border:1px solid rgba(231,177,92,0.28);border-radius:20px;padding:18px 18px 14px;margin-bottom:18px;
    box-shadow:0 0 0 1px rgba(255,255,255,0.02) inset,0 18px 46px rgba(0,0,0,0.35);}
  .hub-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
  .hub-brand{display:flex;align-items:center;gap:11px;min-width:0;}
  .hub-dot{width:10px;height:10px;border-radius:50%;background:#e7b15c;box-shadow:0 0 14px rgba(231,177,92,0.8);flex-shrink:0;}
  .hub-title{font-size:1.02rem;font-weight:900;letter-spacing:1.4px;color:#f4efe1;}
  .hub-sub{font-size:0.78rem;color:#b4ad94;margin-top:1px;}
  .hub-head-actions{display:flex;gap:8px;flex-wrap:wrap;}
  .hub-ghost{display:inline-flex;align-items:center;padding:7px 13px;border-radius:99px;cursor:pointer;
    border:1px solid rgba(221,205,160,0.16);background:rgba(255,255,255,0.04);color:#b4ad94;
    font:inherit;font-size:0.78rem;font-weight:700;text-decoration:none;transition:background .18s,color .18s;}
  .hub-ghost:hover{background:rgba(231,177,92,0.14);color:#f4efe1;}

  .hub-capture{display:flex;gap:8px;margin-bottom:14px;}
  .hub-capture input{flex:1;min-width:0;padding:13px 16px;border-radius:13px;font:inherit;font-size:0.92rem;
    color:#f4efe1;background:rgba(8,13,7,0.55);border:1px solid rgba(231,177,92,0.26);outline:none;transition:border-color .18s,box-shadow .18s;}
  .hub-capture input::placeholder{color:#7c7660;}
  .hub-capture input:focus{border-color:rgba(231,177,92,0.65);box-shadow:0 0 0 3px rgba(231,177,92,0.13);}
  .hub-add{padding:0 20px;border-radius:13px;border:none;cursor:pointer;font:inherit;font-weight:800;font-size:0.86rem;
    background:linear-gradient(135deg,#84c25e,#4a7a3a);color:#08130a;transition:filter .18s,transform .18s;}
  .hub-add:hover{filter:brightness(1.1);transform:translateY(-1px);}

  .hub-cols{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
  .hub-col{background:rgba(255,255,255,0.02);border:1px solid rgba(221,205,160,0.10);border-radius:14px;
    padding:10px 9px 8px;display:flex;flex-direction:column;min-width:0;}
  .hub-col-tri{background:linear-gradient(180deg,rgba(180,173,148,0.12),rgba(180,173,148,0.03));border-color:rgba(180,173,148,0.30);}
  .hub-col-head{display:flex;align-items:center;gap:7px;padding:0 3px 8px;}
  .hub-col-dot{width:7px;height:7px;border-radius:50%;background:var(--cc,#b4ad94);box-shadow:0 0 8px var(--cc,#b4ad94);flex-shrink:0;}
  .hub-col-title{flex:1;min-width:0;font-size:0.7rem;font-weight:800;color:#d8d2bd;text-transform:uppercase;letter-spacing:.4px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .hub-col-count{font-size:0.68rem;font-weight:800;color:#b4ad94;background:rgba(255,255,255,0.06);padding:1px 7px;border-radius:99px;}
  .hub-cards{display:flex;flex-direction:column;gap:6px;min-height:46px;max-height:230px;overflow-y:auto;padding:1px;}
  .hub-card{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 10px;border-radius:10px;cursor:pointer;
    background:rgba(255,255,255,0.04);border:1px solid rgba(221,205,160,0.09);
    border-left:3px solid var(--bc,rgba(221,205,160,0.14));transition:background .15s,transform .12s;}
  .hub-card:hover{background:rgba(231,177,92,0.08);transform:translateX(2px);}
  .hub-card.done .hub-card-title{text-decoration:line-through;opacity:.6;}
  .hub-card-branch{font-size:0.86rem;flex-shrink:0;line-height:1;}
  .hub-card-title{flex:1;min-width:0;font-size:0.8rem;color:#efe9d6;line-height:1.35;word-break:break-word;}
  .hub-card-badges{display:flex;gap:4px;flex-wrap:wrap;width:100%;}
  .hub-badge{font-size:0.62rem;font-weight:800;padding:1px 6px;border-radius:99px;background:rgba(255,255,255,0.07);color:#b4ad94;}
  .hub-badge.soon{background:rgba(231,177,92,0.16);color:#f1cd92;}
  .hub-badge.late{background:rgba(224,120,95,0.18);color:#f0a48d;}
  .hub-badge.cal{background:rgba(132,194,94,0.16);color:#a7d585;}
  .hub-empty{font-size:0.72rem;color:#7c7660;padding:6px 4px;}
  .hub-ghost-card{opacity:.35;}
  .hub-drag{transform:rotate(2deg);box-shadow:0 14px 30px rgba(0,0,0,.5)!important;}

  .hub-foot{margin-top:11px;font-size:0.76rem;color:#b4ad94;display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
  .hub-foot b{color:#f4efe1;font-weight:800;} .hub-foot b.late{color:#f0a48d;}
  .hub-foot .sep{opacity:.4;}

  /* z-index > 10000 : le logo (.header) et les toasts sont forces a 10000 en
     !important dans main.min.css et passaient au-dessus du voile de la modale. */
  .hub-sheet{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:18px;
    background:rgba(5,8,4,0.66);backdrop-filter:blur(8px);}
  .hub-sheet.hidden{display:none;}
  .hub-sheet-in{position:relative;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;padding:22px;
    background:rgba(15,23,16,0.98);border:1px solid rgba(221,205,160,0.13);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.6);}
  .hub-sheet-x{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;cursor:pointer;
    border:1px solid rgba(221,205,160,0.14);background:rgba(255,255,255,0.05);color:#b4ad94;font-size:0.9rem;}
  .hub-sheet-x:hover{background:rgba(255,255,255,0.12);color:#f4efe1;}
  .hub-sheet-title{width:100%;resize:none;overflow:hidden;border:none;outline:none;background:transparent;
    color:#f4efe1;font:inherit;font-size:1.08rem;font-weight:800;line-height:1.4;padding:0 34px 6px 0;}
  .hub-l{font-size:0.66rem;text-transform:uppercase;letter-spacing:.7px;color:#7c7660;font-weight:800;margin:16px 0 8px;}
  .hub-branches{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}
  .hub-br{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px;border-radius:11px;cursor:pointer;
    border:1px solid rgba(221,205,160,0.10);background:rgba(255,255,255,0.03);color:#b4ad94;font:inherit;font-size:1rem;transition:all .16s;}
  .hub-br span{font-size:0.56rem;font-weight:700;text-align:center;line-height:1.1;}
  .hub-br:hover{background:rgba(255,255,255,0.07);}
  .hub-br.on{border-color:var(--bc);background:color-mix(in srgb,var(--bc) 18%,transparent);color:#fff;}
  .hub-when{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
  .hub-chip{padding:7px 13px;border-radius:99px;cursor:pointer;font:inherit;font-size:0.76rem;font-weight:700;
    border:1px solid rgba(221,205,160,0.14);background:rgba(255,255,255,0.04);color:#b4ad94;transition:all .16s;}
  .hub-chip:hover{background:rgba(231,177,92,0.14);color:#f4efe1;}
  .hub-chip.on{border-color:rgba(231,177,92,0.55);background:rgba(231,177,92,0.16);color:#f4efe1;}
  .hub-when input[type=date]{padding:6px 10px;border-radius:9px;font:inherit;font-size:0.76rem;
    border:1px solid rgba(221,205,160,0.14);background:rgba(255,255,255,0.04);color:#b4ad94;color-scheme:dark;}
  .hub-sheet-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px;}
  .hub-b{flex:1;min-width:130px;padding:11px 14px;border-radius:11px;border:none;cursor:pointer;font:inherit;font-weight:800;font-size:0.8rem;transition:filter .18s;}
  .hub-b:disabled{opacity:.6;cursor:default;}
  .hub-b.cal{background:linear-gradient(135deg,#4285f4,#1a73e8);color:#fff;}
  .hub-b.ok{background:linear-gradient(135deg,#84c25e,#4a7a3a);color:#08130a;}
  .hub-b.del{background:rgba(224,120,95,0.12);color:#f0a48d;border:1px solid rgba(224,120,95,0.3);flex:0 0 auto;min-width:0;}
  .hub-b:hover{filter:brightness(1.1);}

  .hub-toast{position:fixed;top:22px;left:50%;transform:translate(-50%,-140px);z-index:99999;
    background:rgba(74,122,58,.96);color:#f4efe1;padding:10px 20px;border-radius:10px;font-weight:700;font-size:.86rem;
    transition:transform .3s ease;box-shadow:0 8px 28px rgba(0,0,0,.45);max-width:90vw;text-align:center;}
  .hub-toast.show{transform:translate(-50%,0);}
  .hub-toast.xp{background:rgba(231,177,92,.96);color:#231803;} .hub-toast.err{background:rgba(190,60,45,.96);}

  @media (max-width:900px){ .hub-cols{grid-template-columns:repeat(2,1fr);} }
  @media (max-width:560px){
    .hub-cols{grid-template-columns:1fr;}
    .hub-cards{max-height:160px;}
    .hub-branches{grid-template-columns:repeat(4,1fr);}
    .hub-capture{flex-direction:column;} .hub-add{padding:12px;}
  }
  body.light-mode #organizer-hub{background:linear-gradient(160deg,rgba(231,177,92,0.10),rgba(255,255,255,0.6));border-color:rgba(163,120,52,0.28);}
  body.light-mode .hub-title,body.light-mode .hub-card-title{color:#2c2a1c;}
  body.light-mode .hub-capture input{background:rgba(255,255,255,0.8);color:#2c2a1c;}
  `;
  document.head.appendChild(s);
}

// SortableJS (drag & drop) - meme version que /organizer/.
function loadSortable() {
  if (window.Sortable || document.getElementById('cyl-sortable-js')) return;
  const s = document.createElement('script');
  s.id = 'cyl-sortable-js';
  s.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js';
  s.onload = () => { if (board) initDnd(); };
  document.head.appendChild(s);
}

// ── Boot ─────────────────────────────────────────────────────────────────────
injectCSS();
loadSortable();
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  uid = user.uid;
  board = await loadBoard(db, uid);
  render();
});

export function getBoard() { return board; }
