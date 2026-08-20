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
  BRANCHES, BRANCH_BY_KEY, SUBS, reliefOptions, TRI_ID, FINISH_ID, FINISH_XP,
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
const HUB_COLORS = { [TRI_ID]: 'var(--text-2)', ui: '#e0785f', ni: '#e7b15c', up: '#6f9a52', nn: 'var(--text-3)' };

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
    onError: () => toast('Sauvegarde impossible - vérifie ta connexion', 'err'),
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
  // L'ONGLET ENTIER est cliquable : un lien étendu (position absolue) couvre
  // toute la bande d'en-tête, bord à bord, jusque dans le padding du bloc.
  // Le texte est posé PAR-DESSUS mais laisse passer le clic (pointer-events),
  // et seul le bouton CYL reste interactif de son côté.
  host.innerHTML = `
    <div class="hub-head">
      <a class="hub-open" href="/organizer/"
         aria-label="Ouvrir l'ORGANIZER complet - toutes tes idées, triées ou non"></a>
      <div class="hub-brand">
        <span class="hub-dot"></span>
        <div class="hub-brand-txt">
          <div class="hub-title">ORGANIZER<span class="hub-go" aria-hidden="true">→</span></div>
          <div class="hub-sub">Tout ce que tu as en tête. Trie, priorise, planifie.</div>
        </div>
      </div>
      <div class="hub-head-actions">
        <button class="hub-ghost" id="hub-cyl" title="Demander à CYL une proposition de tri">CYL, aide-moi à trier</button>
      </div>
    </div>

    <form class="hub-capture" id="hub-capture" autocomplete="off">
      <input type="text" id="hub-input" maxlength="300"
             placeholder="Qu'est-ce que tu as en tête ? - Entrée pour déposer" />
      <button type="submit" class="hub-add" aria-label="Déposer cette idée">Déposer</button>
    </form>

    <div class="hub-cols" id="hub-cols"></div>
    <a class="hub-foot" id="hub-foot" href="/organizer/" aria-label="Ouvrir l'ORGANIZER"></a>
  `;

  $('#hub-capture').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#hub-input');
    const v = input.value.trim();
    if (!v) return;
    const card = addCard(board, TRI_ID, v);
    input.value = '';
    persist(); render();
    $('#hub-input').focus();   // on enchaîne : vider sa tête sans reprendre la souris
    if (card && card.branch) toast(`Déposée · rangée dans ${BRANCH_BY_KEY[card.branch].label}`);
    else toast('Déposée dans « À trier »');
  });

  const cylBtn = $('#hub-cyl');
  if (cylBtn) cylBtn.addEventListener('click', askCyl);

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
    el.style.setProperty('--cc', HUB_COLORS[c.id] || c.color || 'var(--text-2)');
    el.dataset.col = c.id;
    el.innerHTML =
      `<a class="hub-col-head" href="/organizer/?col=${encodeURIComponent(c.id)}"` +
      ` title="Ouvrir « ${esc(shortTitle(c))} » dans l'ORGANIZER">` +
      `<span class="hub-col-dot"></span>` +
      `<span class="hub-col-title">${esc(shortTitle(c))}</span>` +
      `<span class="hub-col-count">${c.cards.length}</span></a>` +
      `<div class="hub-cards" data-col="${esc(c.id)}"></div>`;
    const cards = el.querySelector('.hub-cards');
    c.cards.slice(0, 40).forEach((card) => cards.appendChild(renderCard(card, c)));
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
const SHORT = { [TRI_ID]: 'À trier', ui: 'Urgent · Important', ni: 'À planifier', up: 'Vite fait / déléguer', nn: 'Plus tard' };
function shortTitle(c) { return SHORT[c.id] || stripEmoji(c.title); }

function renderCard(card, col) {
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
  // sous-categorie (Sommeil, Finances, Projets…) : le rangement fin
  if (card.sub) badges.push(`<span class="hub-badge sub">${esc(card.sub)}</span>`);
  // ampleur : un geste ou un chantier ? (ne s'affiche que si ce n'est pas anodin)
  if (card.complexity === 'complexe') badges.push('<span class="hub-badge big" title="Chantier : plusieurs étapes, à déplier">chantier</span>');
  else if (card.complexity === 'moyen') badges.push('<span class="hub-badge mid" title="Demande un vrai créneau">à caler</span>');

  // Rangement propose : un clic suffit, rien n'est applique d'office.
  const suggest = (col && col.id === TRI_ID && card.suggestCol && card.suggestCol !== TRI_ID)
    ? `<button class="hub-sugg" data-sugg="${esc(card.suggestCol)}" title="Ranger dans « ${esc(SHORT[card.suggestCol] || card.suggestCol)} »">→ ${esc(SHORT[card.suggestCol] || card.suggestCol)}</button>`
    : '';
  // Main tendue de CYL : elle ne sait pas trancher, ou la pensee merite d'etre
  // depliee. L'utilisateur peut refuser - et revenir vers elle plus tard.
  const needs = (card.confidence < 0.5 || card.complexity === 'complexe' || card.altBranch);
  const hand = (needs && !card.cylDismissed)
    ? `<button class="hub-cylhand" data-cyl="1" title="${esc(card.cylReason || 'CYL peut t\'aider à situer cette note')}">CYL peut t'aider ✦</button>`
    : '';

  el.innerHTML =
    (b ? `<span class="hub-card-branch" title="${esc(b.label)}${card.sub ? ' · ' + esc(card.sub) : ''}">${b.emoji}</span>` : '') +
    `<span class="hub-card-title">${esc(card.title)}</span>` +
    (badges.length ? `<span class="hub-card-badges">${badges.join('')}</span>` : '') +
    (suggest || hand ? `<span class="hub-card-actions">${suggest}${hand}</span>` : '') +
    reliefBlock(card);
  // Accessible au clavier : la fiche s'ouvre a Entree/Espace, et la modale
  // permet ensuite priorite/echeance/branche sans souris (drag&drop non requis).
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', card.title);
  el.addEventListener('click', (e) => {
    // Les deux boutons posés sur la fiche agissent sans ouvrir le panneau.
    const s = e.target.closest('[data-sugg]');
    if (s) {
      e.stopPropagation();
      const to = s.dataset.sugg;
      moveCard(board, card.id, to);
      persist(); renderCols(); renderFoot(); initDnd();
      toast(`Rangée dans « ${SHORT[to] || to} »`);
      return;
    }
    if (e.target.closest('[data-relief="cyl"]')) { e.stopPropagation(); askCylAbout(card); return; }
    if (e.target.closest('[data-relief-no]')) {
      // « Je gère » : le bloc se retire de CETTE fiche. Rien n'est efface, et
      // CYL reste joignable - c'est un choix, pas une porte qui se ferme.
      e.stopPropagation();
      card.distress = false;
      logCard(card, 'Panneau d\'aide masqué');
      persist(); renderCols(); renderFoot();
      return;
    }
    if (e.target.closest('[data-cyl]')) { e.stopPropagation(); askCylAbout(card); return; }
    // Le reste du clic est traite par initCardOpen(), qui sait distinguer un
    // clic d'un glisser-deposer. Rien a faire ici.
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToCard(card.id); }
  });
  return el;
}

// CYL se penche sur UNE note précise. Elle demande des précisions, elle ne
// décide pas : l'utilisateur relit et valide avant tout envoi.
function askCylAbout(card) {
  const b = card.branch && BRANCH_BY_KEY[card.branch];
  const lines = [
    `J'ai noté ceci : « ${card.title} »`,
    '',
    card.cylReason ? `Ce que tu en dis : ${card.cylReason}` : '',
    b ? `Tu l'as rattachée à ${b.label}${card.sub ? ' / ' + card.sub : ''}.` : "Tu n'as pas su la rattacher à une part de ma vie.",
    '',
    "Aide-moi à y voir clair : qu'est-ce qu'il y a vraiment derrière, et comment je pourrais la découper ? Pose-moi des questions si tu as besoin d'en savoir plus.",
  ].filter((l) => l !== '');
  try {
    document.dispatchEvent(new CustomEvent('cyl:chat-open', { detail: { prefill: lines.join('\n') } }));
  } catch (_) {}
}

// Le pied n'affichait que des compteurs. Il est devenu la PORTE : une barre
// pleine largeur, visiblement cliquable au repos - pas seulement au survol.
// C'est le geste que tout le monde connait (Stripe, Vercel, GitHub) et il ne
// se devine pas : il se voit.
function renderFoot() {
  const f = $('#hub-foot'); if (!f) return;
  const open = allCards(board).filter(({ card, col }) => !card.done && col.id !== FINISH_ID);
  const late = open.filter(({ card }) => card.due && card.due < Date.now()).length;
  const tri = (getCol(board, TRI_ID) || { cards: [] }).cards.length;
  const done = (getCol(board, FINISH_ID) || { cards: [] }).cards.length;
  const bits = [
    `<b>${open.length}</b> en cours`,
    tri ? `<b>${tri}</b> à trier` : '',
    late ? `<b class="late">${late}</b> en retard` : '',
    done ? `<b>${done}</b> terminées` : '',
  ].filter(Boolean);
  f.innerHTML =
    `<span class="hub-foot-n">${bits.join('<span class="sep">·</span>')}</span>` +
    `<span class="hub-foot-go">Ouvrir l'ORGANIZER <span aria-hidden="true">→</span></span>`;
}


// Cliquer une fiche mene A CETTE FICHE, pas au board en general. Le lien n'est
// pas une balise <a> : la fiche se deplace au glisser, et un lien dans une zone
// de glissement declenche le glisser-deposer natif du navigateur en plus de
// Sortable.
//
// Deux gardes avant d'ouvrir : on ignore ce qui est deja interactif dans la
// fiche (puces, main de CYL), et on ignore un clic qui suit un DEPLACEMENT -
// sinon ranger une fiche d'une colonne a l'autre ouvrirait la page a l'arrivee.
const CLICK_SLOP = 6;
function goToCard(id) {
  window.location.href = '/organizer/?card=' + encodeURIComponent(id);
}
function initCardOpen() {
  const box = $('#hub-cols');
  if (!box || box.dataset.openWired === '1') return;
  box.dataset.openWired = '1';
  let down = null;
  box.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  box.addEventListener('click', (e) => {
    const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP;
    down = null;
    if (moved) return;
    if (e.target.closest('button, a, input, textarea, [data-sugg], [data-cyl], .hub-relief')) return;
    const card = e.target.closest('.hub-card');
    if (!card || !card.dataset.id) return;
    goToCard(card.dataset.id);
  });
}

// ── Drag & drop entre colonnes ───────────────────────────────────────────────
function initDnd() {
  initCardOpen();
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
    logCard(cardRef, `Déplacée : ${stripEmoji(SHORT[from] || from)} -> ${stripEmoji(SHORT[to] || to)}`);
  }
  persist(); renderCols(); renderFoot(); initDnd();
}


// ── Detresse : ce qui passe devant tout le reste ─────────────────────────────
// Rendu A MEME LA FICHE, pas dans une fenetre a ouvrir. On ne demande pas a
// quelqu'un qui va mal de choisir une colonne Eisenhower : on lui ouvre des
// portes, et il prend celle qu'il veut - ou aucune.
function reliefBlock(card) {
  if (!card.distress) return '';
  const opts = reliefOptions(card).map((o) => o.act === 'cyl'
    ? `<button class="hub-relief-b" data-relief="cyl">${esc(o.label)}</button>`
    : `<a class="hub-relief-b${o.tone === 'urgent' ? ' urgent' : ''}" href="${esc(o.href)}">${esc(o.label)}</a>`).join('');
  return `<div class="hub-relief${card.crisis ? ' crisis' : ''}">
    <div class="hub-relief-t">${card.crisis ? 'Tu comptes.' : 'Ça passe devant le reste.'}</div>
    <div class="hub-relief-r">${esc(card.cylReason)}</div>
    <div class="hub-relief-opts">${opts}</div>
    ${card.crisis ? '<div class="hub-relief-num"><b>3114</b> (24h/24, gratuit) · <b>15</b> SAMU · <b>112</b> urgences</div>' : ''}
    <button class="hub-cyl-no" data-relief-no="1">Je gère, range-la normalement</button>
  </div>`;
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
    logCard(card, 'Planifiée dans Google Agenda');
    persist(); renderCols(); renderFoot();
    btn.textContent = '✓ Dans ton agenda';
    toast('Ajoutée à ton Google Agenda');
    document.dispatchEvent(new CustomEvent('cyl:gcal-refresh'));
  } catch (err) {
    console.error('[hub] plan in calendar:', err && err.code, err && err.message);
    btn.disabled = false; btn.textContent = label;
    if (err && err.code === 'gcal/forbidden') {
      toast("Ton accès agenda est en lecture seule - reconnecte-le pour autoriser l'écriture", 'err');
      gcal.disconnect();
    } else {
      toast(gcal.connectErrorMessage(err), 'err');
    }
  }
}

// ── CYL : trier et proposer un plan ──────────────────────────────────────────
// Ouvre le chat CYL avec un contexte pre-rempli (l'utilisateur garde la main :
// CYL propose, il decide - cf. cadre non-directif).
function askCyl() {
  const top = topPriorities(board, 6);
  const due = dueToday(board);
  const lines = top.map(({ card, col }) =>
    `- ${card.title}${card.due ? ` (échéance ${fmtDate(card.due)})` : ''} [${stripEmoji(SHORT[col.id] || col.title)}]`);
  const msg =
    `Voici ce que j'ai en tête aujourd'hui :\n${lines.join('\n') || '(rien de noté)'}\n\n` +
    (due.length ? `${due.length} échéance(s) tombent aujourd'hui ou avant.\n\n` : '') +
    `Aide-moi à y voir clair : par quoi commencer, et qu'est-ce qui peut attendre ?`;
  try {
    document.dispatchEvent(new CustomEvent('cyl:chat-open', { detail: { prefill: msg } }));
  } catch (_) {}
}

// ── Styles ───────────────────────────────────────────────────────────────────
function injectCSS() {
  if (document.getElementById('cyl-hub-css')) return;
  const s = document.createElement('style'); s.id = 'cyl-hub-css';
  s.textContent = `
  #organizer-hub{background:linear-gradient(160deg,rgba(231,177,92,0.09),var(--panel));
    border:1px solid rgba(231,177,92,0.28);border-radius:20px;padding:18px 18px 14px;margin-bottom:18px;
    box-shadow:0 0 0 1px var(--surface-1) inset,0 18px 46px rgba(0,0,0,0.35);}
  /* ── L'ONGLET : toute la bande d'en-tete est une zone de clic ──
     .hub-open est un lien vide etire sur tout l'en-tete (il deborde dans le
     padding du bloc pour aller bord a bord). Le contenu passe au-dessus mais
     est transparent au pointeur, sauf le bouton CYL. */
  .hub-head{position:relative;display:flex;align-items:center;justify-content:space-between;
    gap:12px;flex-wrap:wrap;margin-bottom:12px;padding:4px 0 12px;
    border-bottom:1px solid rgba(231,177,92,0.14);}
  .hub-open{position:absolute;top:-18px;left:-18px;right:-18px;bottom:0;z-index:0;
    border-radius:19px 19px 0 0;text-decoration:none;cursor:pointer;
    transition:background .18s;}
  .hub-open:hover{background:rgba(231,177,92,0.09);}
  .hub-open:focus-visible{outline:2px solid rgba(231,177,92,0.75);outline-offset:-3px;}
  /* le texte est decoratif : il laisse le clic atteindre le lien en dessous */
  .hub-brand{position:relative;z-index:1;pointer-events:none;
    display:flex;align-items:center;gap:11px;min-width:0;}
  .hub-brand-txt{min-width:0;}
  .hub-dot{width:10px;height:10px;border-radius:50%;background:#e7b15c;box-shadow:0 0 14px rgba(231,177,92,0.8);flex-shrink:0;}
  .hub-title{font-size:1.02rem;font-weight:900;letter-spacing:1.4px;color:var(--text-1);display:flex;align-items:center;gap:7px;}
  /* Visible AU REPOS, pas seulement au survol : sur un ecran tactile il n'y a
     pas de survol, donc une fleche qui n'apparait qu'au passage de la souris
     n'existe tout simplement pas pour la moitie des gens. */
  .hub-go{font-size:0.92rem;font-weight:700;color:#e7b15c;opacity:.75;
    transition:opacity .2s,transform .2s;}
  /* Elle etait invisible au repos : la zone cliquable ne se devinait pas. */
  .hub-head:hover .hub-go{opacity:1;transform:translateX(3px);}
  .hub-sub{font-size:0.78rem;color:var(--text-2);margin-top:1px;}
  /* seul element interactif pose au-dessus du lien */
  .hub-head-actions{position:relative;z-index:2;display:flex;gap:8px;flex-wrap:wrap;}
  .hub-ghost{display:inline-flex;align-items:center;padding:7px 13px;border-radius:99px;cursor:pointer;
    border:1px solid var(--line-strong);background:var(--surface-2);color:var(--text-2);
    font:inherit;font-size:0.78rem;font-weight:700;text-decoration:none;transition:background .18s,color .18s;}
  .hub-ghost:hover{background:rgba(231,177,92,0.14);color:var(--text-1);}

  .hub-capture{display:flex;gap:8px;margin-bottom:14px;}
  .hub-capture input{flex:1;min-width:0;padding:13px 16px;border-radius:13px;font:inherit;font-size:0.92rem;
    color:var(--text-1);background:var(--field-bg);border:1px solid rgba(231,177,92,0.26);outline:none;transition:border-color .18s,box-shadow .18s;}
  .hub-capture input::placeholder{color:var(--text-3);}
  .hub-capture input:focus{border-color:rgba(231,177,92,0.65);box-shadow:0 0 0 3px rgba(231,177,92,0.13);}
  .hub-add{padding:0 20px;border-radius:13px;border:none;cursor:pointer;font:inherit;font-weight:800;font-size:0.86rem;
    background:linear-gradient(135deg,#84c25e,#4a7a3a);color:#08130a;transition:filter .18s,transform .18s;}
  .hub-add:hover{filter:brightness(1.1);transform:translateY(-1px);}

  .hub-cols{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
  .hub-col{background:var(--surface-1);border:1px solid var(--line);border-radius:14px;
    padding:10px 9px 8px;display:flex;flex-direction:column;min-width:0;}
  .hub-col-tri{background:linear-gradient(180deg,rgba(180,173,148,0.12),rgba(180,173,148,0.03));border-color:rgba(180,173,148,0.30);}
  .hub-col-head{display:flex;align-items:center;gap:7px;padding:0 3px 8px;}
  .hub-col-dot{width:7px;height:7px;border-radius:50%;background:var(--cc,var(--text-2));box-shadow:0 0 8px var(--cc,var(--text-2));flex-shrink:0;}
  .hub-col-title{flex:1;min-width:0;font-size:0.7rem;font-weight:800;color:var(--text-2);text-transform:uppercase;letter-spacing:.4px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .hub-col-count{font-size:0.68rem;font-weight:800;color:var(--text-2);background:var(--surface-2);padding:1px 7px;border-radius:99px;}
  /* overflow-x:hidden est INDISPENSABLE : avec overflow-y:auto seul, l'axe X
     passe implicitement en auto. Le moindre debordement horizontal (le survol
     decalait la fiche de 2 px) faisait apparaitre une barre horizontale, ce
     qui reduisait la hauteur, decalait le contenu, faisait perdre le survol,
     donc disparaitre la barre... et le texte tremblait a l'infini.
     scrollbar-gutter:stable evite le meme saut sur l'axe vertical. */
  .hub-cards{display:flex;flex-direction:column;gap:6px;min-height:46px;max-height:230px;
    overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;padding:1px;}
  .hub-card{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 10px;border-radius:10px;cursor:pointer;
    background:var(--surface-2);border:1px solid var(--line);
    border-left:3px solid var(--bc,var(--line));transition:background .15s,transform .12s;}
  /* Le survol ne DEPLACE plus la fiche et ne change AUCUNE dimension : il
     l'eclaire. Une ombre ne participe pas a la mise en page, donc elle ne peut
     pas declencher de barre de defilement - contrairement a un transform ou a
     une bordure qui s'epaissit. */
  .hub-card:hover{background:rgba(231,177,92,0.10);
    box-shadow:inset 0 0 0 1px rgba(231,177,92,0.28), 0 2px 10px rgba(0,0,0,0.25);}
  .hub-card.done .hub-card-title{text-decoration:line-through;opacity:.6;}
  .hub-card-branch{font-size:0.86rem;flex-shrink:0;line-height:1;}
  .hub-card-title{flex:1;min-width:0;font-size:0.8rem;color:var(--text-1);line-height:1.35;word-break:break-word;}
  .hub-card-badges{display:flex;gap:4px;flex-wrap:wrap;width:100%;}
  .hub-badge{font-size:0.62rem;font-weight:800;padding:1px 6px;border-radius:99px;background:var(--surface-3);color:var(--text-2);}
  .hub-badge.soon{background:rgba(231,177,92,0.16);color:var(--gold-text);}
  .hub-badge.late{background:rgba(224,120,95,0.18);color:#c0503a;}
  .hub-badge.cal{background:rgba(132,194,94,0.16);color:var(--leaf-text);}
  .hub-badge.sub{background:var(--surface-2);color:var(--text-3);font-weight:700;}
  .hub-badge.mid{background:rgba(231,177,92,0.13);color:var(--gold-text);}
  .hub-badge.big{background:rgba(195,154,107,0.20);color:var(--gold-text);}

  /* Rangement propose + main tendue de CYL, poses au pied de la fiche */
  .hub-card-actions{display:flex;gap:5px;flex-wrap:wrap;width:100%;margin-top:1px;}
  .hub-sugg,.hub-cylhand{border:none;cursor:pointer;font:inherit;font-size:0.63rem;font-weight:800;
    padding:3px 8px;border-radius:99px;transition:filter .15s,background .15s;}
  .hub-sugg{background:rgba(231,177,92,0.18);color:var(--gold-text);border:1px solid rgba(231,177,92,0.32);}
  .hub-sugg:hover{background:rgba(231,177,92,0.34);color:#fff;}
  .hub-cylhand{background:transparent;color:var(--text-2);border:1px dashed var(--line-strong);}
  .hub-cylhand:hover{color:var(--gold-text);border-color:rgba(231,177,92,0.5);background:rgba(231,177,92,0.08);}

  /* Bloc CYL dans le panneau de la fiche */
  .hub-cyl{display:flex;gap:12px;align-items:flex-start;margin:16px 0 2px;padding:13px 14px;border-radius:14px;
    background:linear-gradient(135deg,rgba(231,177,92,0.10),rgba(132,194,94,0.05));
    border:1px solid rgba(231,177,92,0.28);}
  .hub-cyl-orb{width:26px;height:26px;border-radius:50%;flex-shrink:0;margin-top:1px;
    background:radial-gradient(circle at 35% 30%,#fbe6b0,#e7b15c 45%,#4a7a3a 100%);
    box-shadow:0 0 12px rgba(231,177,92,0.45);}
  .hub-cyl-body{flex:1;min-width:0;}
  .hub-cyl-t{font-size:0.78rem;font-weight:800;color:var(--gold-text);}
  .hub-cyl-r{font-size:0.76rem;color:var(--text-2);line-height:1.45;margin-top:3px;}
  .hub-cyl-acts{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px;}
  .hub-cyl-go,.hub-cyl-no{border:none;cursor:pointer;font:inherit;font-size:0.74rem;font-weight:800;
    padding:7px 13px;border-radius:99px;transition:filter .16s,background .16s;}
  .hub-cyl-go{background:linear-gradient(135deg,#f1cd92,#e7b15c);color:#231803;}
  .hub-cyl-go:hover{filter:brightness(1.07);}
  .hub-cyl-no{background:var(--surface-2);color:var(--text-2);border:1px solid var(--line-strong);}
  .hub-cyl-no:hover{background:var(--surface-3);color:var(--text-1);}
  /* Fiche de detresse : le rangement s'efface, les portes de sortie passent devant */
  /* Dessine pour une fenetre large, il vit desormais dans une fiche de colonne :
     marges et espacements resserres, et les boutons passent en pleine largeur
     des que la colonne devient etroite. */
  .hub-relief{margin:9px 0 1px;padding:11px 12px;border-radius:12px;
    background:rgba(224,120,95,0.08);border:1px solid rgba(224,120,95,0.32);}
  .hub-relief.crisis{background:rgba(224,120,95,0.14);border-color:rgba(224,120,95,0.55);}
  .hub-relief-t{font-size:0.86rem;font-weight:800;color:#e58e73;}
  .hub-relief-r{font-size:0.78rem;color:var(--text-2);line-height:1.5;margin-top:4px;}
  .hub-relief-opts{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px;}
  .hub-relief-b{display:inline-flex;align-items:center;border:1px solid var(--line-strong);
    background:var(--surface-2);color:var(--text-1);text-decoration:none;cursor:pointer;
    font:inherit;font-size:0.76rem;font-weight:700;padding:8px 14px;border-radius:99px;
    transition:background .16s,border-color .16s;}
  .hub-relief-b:hover{background:rgba(224,120,95,0.16);border-color:rgba(224,120,95,0.5);}
  .hub-relief-b.urgent{background:linear-gradient(135deg,#e0785f,#c0503a);color:#fff;border-color:transparent;}
  .hub-relief-num{margin-top:11px;font-size:0.76rem;color:var(--text-2);}
  .hub-relief-num b{color:#e58e73;}
  .hub-relief .hub-cyl-no{margin-top:10px;}
  /* Dans une colonne serree, des puces cote a cote deviennent illisibles :
     chacune prend toute la largeur. Un numero d'urgence ne se lit pas a moitie. */
  @media (max-width:1400px){
    .hub-relief-opts{flex-direction:column;gap:5px;}
    .hub-relief-b{width:100%;justify-content:center;}
  }
  .hub-cyl-quiet{margin:14px 0 2px;}
  .hub-cyl-link{background:none;border:none;padding:0;cursor:pointer;font:inherit;font-size:0.74rem;
    color:var(--text-3);text-decoration:underline;text-underline-offset:3px;transition:color .16s;}
  .hub-cyl-link:hover{color:var(--gold-text);}
  .hub-empty{font-size:0.72rem;color:var(--text-3);padding:6px 4px;}
  .hub-ghost-card{opacity:.35;}
  .hub-drag{transform:rotate(2deg);box-shadow:0 14px 30px rgba(0,0,0,.5)!important;}

  /* LE PIED EST LA PORTE. Il porte une bordure et un fond AU REPOS : une zone
     qui ne se revele qu'au survol ne se decouvre jamais sur un ecran tactile,
     et se devine mal ailleurs. */
  .hub-foot{margin-top:12px;padding:10px 14px;border-radius:12px;text-decoration:none;
    font-size:0.76rem;color:var(--text-2);display:flex;gap:10px;flex-wrap:wrap;align-items:center;
    background:rgba(231,177,92,0.06);border:1px solid rgba(231,177,92,0.22);
    transition:background .16s,border-color .16s;}
  .hub-foot:hover{background:rgba(231,177,92,0.13);border-color:rgba(231,177,92,0.45);}
  .hub-foot:focus-visible{outline:2px solid rgba(231,177,92,0.75);outline-offset:2px;}
  .hub-foot b{color:var(--text-1);font-weight:800;} .hub-foot b.late{color:#c0503a;}
  .hub-foot .sep{opacity:.4;margin:0 5px;}
  .hub-foot-n{flex:1;min-width:0;}
  .hub-foot-go{font-weight:800;color:var(--gold-text,#f1cd92);white-space:nowrap;
    display:inline-flex;align-items:center;gap:6px;}
  .hub-foot:hover .hub-foot-go span{transform:translateX(3px);}
  .hub-foot-go span{transition:transform .16s;}

  /* Un en-tete de colonne mene DANS cette colonne. */
  .hub-col-head{text-decoration:none;cursor:pointer;border-radius:8px;
    transition:background .14s;}
  .hub-col-head:hover{background:rgba(255,255,255,0.06);}
  .hub-col-head:focus-visible{outline:2px solid rgba(231,177,92,0.7);outline-offset:1px;}

  /* Une fiche s'ouvre au clic : le curseur doit le dire avant qu'on essaie. */
  .hub-card{cursor:pointer;}
  .hub-card button,.hub-card a{cursor:pointer;}

  /* z-index > 10000 : le logo (.header) et les toasts sont forces a 10000 en
     !important dans main.min.css et passaient au-dessus du voile de la modale. */
  .hub-l{font-size:0.66rem;text-transform:uppercase;letter-spacing:.7px;color:var(--text-3);font-weight:800;margin:16px 0 8px;}
  .hub-branches{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}
  .hub-br{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px;border-radius:11px;cursor:pointer;
    border:1px solid var(--line);background:var(--surface-1);color:var(--text-2);font:inherit;font-size:1rem;transition:all .16s;}
  .hub-br span{font-size:0.56rem;font-weight:700;text-align:center;line-height:1.1;}
  .hub-br:hover{background:var(--surface-3);}
  .hub-br.on{border-color:var(--bc);background:color-mix(in srgb,var(--bc) 18%,transparent);color:#fff;}
  .hub-when{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
  .hub-chip{padding:7px 13px;border-radius:99px;cursor:pointer;font:inherit;font-size:0.76rem;font-weight:700;
    border:1px solid var(--line);background:var(--surface-2);color:var(--text-2);transition:all .16s;}
  .hub-chip:hover{background:rgba(231,177,92,0.14);color:var(--text-1);}
  .hub-chip.on{border-color:rgba(231,177,92,0.55);background:rgba(231,177,92,0.16);color:var(--text-1);}
  .hub-when input[type=date]{padding:6px 10px;border-radius:9px;font:inherit;font-size:0.76rem;
    border:1px solid var(--line);background:var(--surface-2);color:var(--text-2);color-scheme:dark;}
  .hub-b{flex:1;min-width:130px;padding:11px 14px;border-radius:11px;border:none;cursor:pointer;font:inherit;font-weight:800;font-size:0.8rem;transition:filter .18s;}
  .hub-b:disabled{opacity:.6;cursor:default;}
  .hub-b.cal{background:linear-gradient(135deg,#4285f4,#1a73e8);color:#fff;}
  .hub-b.ok{background:linear-gradient(135deg,#84c25e,#4a7a3a);color:#08130a;}
  .hub-b.del{background:rgba(224,120,95,0.12);color:#c0503a;border:1px solid rgba(224,120,95,0.3);flex:0 0 auto;min-width:0;}
  .hub-b:hover{filter:brightness(1.1);}

  .hub-toast{position:fixed;top:22px;left:50%;transform:translate(-50%,-140px);z-index:99999;
    background:rgba(74,122,58,.96);color:var(--text-1);padding:10px 20px;border-radius:10px;font-weight:700;font-size:.86rem;
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
