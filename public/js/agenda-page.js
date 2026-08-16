// /js/agenda-page.js - L'AGENDA VIVANT.
//
// L'agenda n'est pas un module de plus : c'est la PROJECTION TEMPORELLE de
// tout le reste. Une seule regle de lecture : tout ce qui a une date apparait
// ici, et rien d'autre. Une fiche sans echeance reste dans l'ORGANIZER.
//
// Trois sources, un seul flux d'occurrences :
//   · Google Agenda  -> ce qui est deja pris (jamais modifie ici)
//   · ORGANIZER      -> les fiches qui ont une echeance
//   · Objectifs      -> les jalons datés (ils descendaient nulle part avant)
//
// Trois vues :
//   SEMAINE  grille horaire, 3 jours glissants sur telephone
//   MOIS     la canopee : chaque jour est une feuille, densite = charge
//   RIVIERE  un couloir par branche, un ruban par objectif - la signature
//
// Impression : une feuille de style dediee (@media print) rend la vue courante
// sur papier, sans les commandes ni les couleurs de fond.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { loadBoard, allCards, BRANCHES, BRANCH_BY_KEY, FINISH_ID } from '/js/organizer-data.js';
import { initUserMenu } from '/js/userMenu.js';
import * as gcal from '/js/gcal.js';

let auth, db, uid;
if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }
try { initUserMenu(); } catch (_) {}

const $ = (s, r = document) => r.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtH = (h) => pad(Math.floor(h)) + ':' + pad(Math.round((h % 1) * 60));
function weekStart(base) { const d = new Date(base); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
function toast(m) { const t = $('#ap-toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(t._x); t._x = setTimeout(() => t.classList.remove('show'), 2400); }

// ── État ─────────────────────────────────────────────────────────────────────
let view = 'week';
let anchor = new Date();
let board = null;
let goals = [];
let gEvents = [];          // événements Google du range courant
const hidden = new Set();  // branches masquées

// ── Collecte : les trois sources deviennent des occurrences ──────────────────
function occurrences() {
  const out = [];

  // 1. Google : ce qui est déjà pris. Intouchable depuis cette page.
  gEvents.forEach((ev) => {
    const d = gcal.eventStart(ev);
    if (!d) return;
    out.push({
      kind: 'gcal', date: d, allDay: gcal.isAllDay(ev),
      h: gcal.isAllDay(ev) ? null : d.getHours() + d.getMinutes() / 60,
      dur: 60, title: ev.summary || '(sans titre)', branch: null,
    });
  });

  // 2. ORGANIZER : uniquement les fiches datées.
  if (board) {
    allCards(board).forEach(({ card, col }) => {
      if (col.id === FINISH_ID || !card.due) return;
      const d = new Date(card.due);
      out.push({
        kind: 'card', date: d, allDay: false,
        h: d.getHours() + d.getMinutes() / 60, dur: 45,
        title: card.title, branch: card.branch, done: !!card.done,
        late: !card.done && card.due < Date.now(),
      });
    });
  }

  // 3. Objectifs : les jalons datés. Ils existaient dans /objectifs/ mais ne
  //    descendaient dans aucun planning - c'est le manque le plus visible.
  goals.forEach((g) => {
    (g.subtasks || []).forEach((s) => {
      if (!s.dueAt) return;
      const d = new Date(s.dueAt + 'T00:00');
      if (isNaN(d)) return;
      out.push({
        kind: 'jalon', date: d, allDay: true, h: null, dur: 0,
        title: s.label || s.title || 'Jalon', branch: goalBranch(g),
        done: !!s.done, goal: g.title || '',
      });
    });
  });

  return out;
}

// Les objectifs portent un « domain » 4-axes hérité ; on le ramène aux branches.
const DOMAIN_TO_BRANCH = { body: 'physio', heart: 'appartenance', etre: 'cognitif', mind: 'cognitif', order: 'securite' };
function goalBranch(g) {
  if (g.branch && BRANCH_BY_KEY[g.branch]) return g.branch;
  return DOMAIN_TO_BRANCH[g.domain] || 'accomplissement';
}
const colorOf = (o) => (o.branch && BRANCH_BY_KEY[o.branch] ? BRANCH_BY_KEY[o.branch].color : 'var(--text-3)');
const visible = (o) => !o.branch || !hidden.has(o.branch);

// ── Vue SEMAINE ──────────────────────────────────────────────────────────────
// Sur téléphone : 3 jours glissants. Sept colonnes sur un écran de 390 px,
// c'est illisible, et aucune librairie ne règle ça à ta place.
function renderWeek(all) {
  const nd = window.innerWidth <= 700 ? 3 : 7;
  const s = nd === 7 ? weekStart(anchor) : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const days = [...Array(nd)].map((_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d; });
  const H0 = 7, H1 = 23, PX = 52;
  const now = new Date();

  $('#ap-range').textContent = days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    + ' - ' + days[nd - 1].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  let html = '<div class="ap-weekhd"><div></div>' + days.map((d) => {
    const t = sameDay(d, now);
    const n = all.filter((x) => !x.allDay && sameDay(x.date, d)).length;
    return `<div class="dh${t ? ' today' : ''}">
      <div class="dow">${d.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
      <div class="dnum">${d.getDate()}</div>
      <div class="cap">${n ? n + ' élément' + (n > 1 ? 's' : '') : '-'}</div></div>`;
  }).join('') + '</div>';

  // Bandeau « journée » : les jalons, jamais mélangés aux créneaux horaires.
  html += '<div class="ap-allday"><div class="lb">jalons</div>' + days.map((d) => {
    const js = all.filter((x) => x.allDay && sameDay(x.date, d));
    return '<div class="cell">' + js.map((x) => {
      const c = colorOf(x);
      return `<div class="ap-jal${x.done ? ' done' : ''}" style="color:${c};background:color-mix(in srgb,${c} 14%,transparent)"
        title="${esc(x.goal || '')}">◆ ${esc(x.title)}</div>`;
    }).join('') + '</div>';
  }).join('') + '</div>';

  html += '<div class="ap-weekbody"><div class="ap-hours">'
    + [...Array(H1 - H0)].map((_, i) => `<div class="h">${pad(H0 + i)}:00</div>`).join('') + '</div>';

  days.forEach((d) => {
    const dow = d.getDay();
    html += `<div class="ap-col${dow === 0 || dow === 6 ? ' weekend' : ''}">`
      + [...Array(H1 - H0)].map(() => '<div class="slot"></div>').join('');
    const items = all.filter((x) => !x.allDay && sameDay(x.date, d) && x.h !== null)
      .map((x) => ({ ...x, color: colorOf(x) }));
    layout(items).forEach((it) => { html += block(it, H0, PX); });
    if (sameDay(d, now)) {
      const top = (now.getHours() + now.getMinutes() / 60 - H0) * PX;
      if (top > 0) html += `<div class="ap-now" style="top:${top}px"></div>`;
    }
    html += '</div>';
  });
  html += '</div>';
  $('#ap-view').innerHTML = html;
  $('#ap-view').style.setProperty('--nd', nd);
}

// Répartition des chevauchements en colonnes de largeur égale, comme Google.
function layout(items) {
  items.sort((a, b) => a.h - b.h || b.dur - a.dur);
  let group = [], endMax = -1;
  const flush = () => {
    const lanes = [];
    group.forEach((it) => {
      let k = lanes.findIndex((end) => end <= it.h + 0.001);
      if (k < 0) { k = lanes.length; lanes.push(0); }
      lanes[k] = it.h + it.dur / 60; it.lane = k;
    });
    group.forEach((it) => { it.lanes = lanes.length; });
    group = [];
  };
  items.forEach((it) => {
    if (group.length && it.h >= endMax - 0.001) flush();
    group.push(it); endMax = Math.max(endMax, it.h + it.dur / 60);
  });
  flush();
  return items;
}

function block(it, H0, PX) {
  const n = it.lanes || 1, w = 100 / n, l = it.lane * w;
  const top = (it.h - H0) * PX, hgt = Math.max(24, it.dur / 60 * PX - 3);
  const cls = 'ap-ev ' + it.kind + (it.done ? ' done' : '') + (it.late ? ' late' : '');
  const sub = it.kind === 'gcal' ? 'Google Agenda' : it.late ? 'en retard' : 'fiche';
  const bg = it.kind === 'gcal' ? '' : `background:color-mix(in srgb,${it.color} 16%,transparent);`;
  return `<div class="${cls}" style="top:${top}px;height:${hgt}px;left:calc(${l}% + 3px);width:calc(${w}% - 6px);color:${it.color};${bg}">
    <span class="t">${esc(it.title)}</span><span class="s">${fmtH(it.h)} · ${sub}</span></div>`;
}

// ── Vue MOIS : la canopée ────────────────────────────────────────────────────
// Chaque jour est une feuille. Plus le jour est chargé, plus elle est dense.
// On lit un mois entier sans lire un seul mot.
function renderMonth(all) {
  const m = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const now = new Date();
  $('#ap-range').textContent = m.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const first = weekStart(m);
  let html = '<div class="ap-month">' + ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
    .map((d) => `<div class="mdow">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(first); d.setDate(d.getDate() + i);
    const out = d.getMonth() !== m.getMonth();
    const evs = all.filter((x) => sameDay(x.date, d));
    const timed = evs.filter((x) => !x.allDay);
    const jal = evs.filter((x) => x.allDay);
    const dens = Math.min(1, evs.length * 0.2);
    const main = timed.length ? colorOf(timed[0]) : 'var(--leaf)';
    html += `<div class="ap-mday${out ? ' out' : ''}${sameDay(d, now) ? ' today' : ''}" data-i="${i}">
      <div class="leaf" style="background:${main};opacity:${(0.05 + dens * 0.28).toFixed(2)}"></div>
      <div class="n">${d.getDate()}</div>
      <div class="chips">${timed.slice(0, 3).map((x) => {
        const c = colorOf(x);
        return `<div class="chip" style="color:${c}"><b>${x.h !== null ? fmtH(x.h) : ''}</b> ${esc(String(x.title).slice(0, 16))}</div>`;
      }).join('')}${timed.length > 3 ? `<div class="chip more">+${timed.length - 3} autres</div>` : ''}</div>
      ${jal.length ? `<div class="fruit" title="${esc(jal.map((j) => j.title).join(' · '))}">🍎</div>` : ''}
    </div>`;
  }
  html += '</div>';
  $('#ap-view').innerHTML = html;
  $('#ap-view').querySelectorAll('.ap-mday').forEach((el) => {
    el.onclick = () => {
      const d = new Date(first); d.setDate(d.getDate() + Number(el.dataset.i));
      anchor = d; view = 'week'; syncTabs(); render();
    };
  });
}

// ── Vue RIVIÈRE : la signature ───────────────────────────────────────────────
// Un couloir par branche, un ruban par objectif de son démarrage à son
// échéance, les jalons en losanges. C'est le prolongement des racines de
// l'arbre : on voit sa vie en mois, pas en heures.
function renderRiver() {
  const now = new Date();
  const S = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const E = new Date(now.getFullYear(), now.getMonth() + 5, 0);
  const span = E - S;
  const pos = (d) => Math.max(0, Math.min(100, (d - S) / span * 100));
  $('#ap-range').textContent = S.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    + ' - ' + E.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });

  const dated = goals.filter((g) => g.deadline && !hidden.has(goalBranch(g)));
  if (!dated.length) {
    $('#ap-view').innerHTML = `<div class="ap-empty">
      Aucun objectif avec une échéance pour l'instant.<br>
      <a href="/objectifs/">Pose une date sur un objectif</a> et il apparaîtra ici, avec ses jalons.</div>`;
    return;
  }

  let html = '<div class="ap-river">';
  const months = [];
  for (let d = new Date(S); d <= E; d.setMonth(d.getMonth() + 1)) months.push(new Date(d));
  html += '<div class="ap-rscale"><div></div><div class="ap-rticks">'
    + months.map((d) => `<span style="left:${pos(new Date(d.getFullYear(), d.getMonth(), 15))}%">${d.toLocaleDateString('fr-FR', { month: 'short' })}</span>`).join('')
    + '</div></div>';

  BRANCHES.forEach((b) => {
    const gs = dated.filter((g) => goalBranch(g) === b.key);
    gs.forEach((g, gi) => {
      const start = g.createdAt ? new Date(g.createdAt) : S;
      const end = new Date(g.deadline);
      const L = pos(start), R = pos(end);
      const prog = Math.max(0, Math.min(100, Number(g.progress) || 0));
      html += `<div class="ap-rlane">
        <div class="name"><span class="dot" style="background:${b.color}"></span>${gi ? '' : esc(b.label)}</div>
        <div class="ap-rtrack">
          <div class="ap-rnow" style="left:${pos(now)}%"></div>
          <div class="ap-ribbon" style="left:${L}%;width:${Math.max(3, R - L)}%;
               background:linear-gradient(90deg,${b.color},${b.color}aa)">
            <div class="fill" style="width:${prog}%"></div>
            <span>${esc(g.title || 'Objectif')} · ${prog}%</span>
          </div>
          ${(g.subtasks || []).filter((s) => s.dueAt).map((s) => {
            const d = new Date(s.dueAt + 'T00:00');
            return `<div class="ap-jalon${s.done ? ' done' : ''}" title="${esc(s.label || '')}"
              style="left:${pos(d)}%;background:${s.done ? b.color : 'var(--bg-elevated)'};border-color:${b.color}"></div>`;
          }).join('')}
        </div></div>`;
    });
  });
  html += `<div class="ap-rroots">Sous la ligne d'eau : les racines - la même rivière, remontée jusqu'à ta naissance. À venir.</div></div>`;
  $('#ap-view').innerHTML = html;
}

// ── Rail : branches + charge ─────────────────────────────────────────────────
function renderRail(all) {
  const counts = {};
  all.forEach((o) => { if (o.branch) counts[o.branch] = (counts[o.branch] || 0) + 1; });
  $('#ap-branches').innerHTML = BRANCHES.map((b) => `
    <button class="ap-brow${hidden.has(b.key) ? ' off' : ''}" data-b="${b.key}">
      <span class="dot" style="background:${b.color}"></span>
      <span>${b.emoji} ${esc(b.label)}</span>
      <span class="n">${counts[b.key] || 0}</span>
    </button>`).join('');
  $('#ap-branches').querySelectorAll('[data-b]').forEach((el) => {
    el.onclick = () => { const k = el.dataset.b; hidden.has(k) ? hidden.delete(k) : hidden.add(k); render(); };
  });

  const s = weekStart(anchor), e = new Date(s); e.setDate(e.getDate() + 7);
  const wk = all.filter((x) => !x.allDay && x.date >= s && x.date < e);
  const h = wk.reduce((a, x) => a + x.dur / 60, 0);
  const pct = Math.min(100, Math.round(h / 40 * 100));
  $('#ap-load-txt').textContent = h.toFixed(1).replace('.', ',') + ' h engagées';
  $('#ap-load-bar').style.width = pct + '%';
  $('#ap-load-hint').textContent = pct > 85
    ? "Semaine saturée. Libérer un créneau avant d'en ajouter."
    : 'Il reste de la place cette semaine.';
}

// ── Rendu ────────────────────────────────────────────────────────────────────
function render() {
  const all = occurrences().filter(visible).sort((a, b) => a.date - b.date);
  if (view === 'week') renderWeek(all);
  else if (view === 'month') renderMonth(all);
  else renderRiver();
  renderRail(all);
  document.body.dataset.view = view;
}
function syncTabs() {
  $('#ap-tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
}

// ── Navigation ───────────────────────────────────────────────────────────────
function shift(k) {
  if (view === 'week') anchor.setDate(anchor.getDate() + (window.innerWidth <= 700 ? 3 : 7) * k);
  else if (view === 'month') anchor.setMonth(anchor.getMonth() + k);
  else anchor.setMonth(anchor.getMonth() + k);
  anchor = new Date(anchor);
  loadGoogle().then(render);
}

async function loadGoogle() {
  if (!gcal.isConnected()) { gEvents = []; return; }
  const from = new Date(anchor); from.setDate(from.getDate() - 40);
  const to = new Date(anchor); to.setDate(to.getDate() + 60);
  try { gEvents = await gcal.listRange(from, to, 250); }
  catch (err) {
    gEvents = [];
    if (err && err.code === 'gcal/expired') toast('Connexion Google expirée - reconnecte-toi.');
  }
}

// ── Export / impression ──────────────────────────────────────────────────────
function exportIcs() {
  const all = occurrences().filter((o) => o.kind !== 'gcal');
  if (!all.length) { toast('Rien à exporter pour le moment.'); return; }
  const items = all.map((o) => ({ id: o.title + o.date.getTime(), title: o.title, day: o.date }));
  gcal.downloadIcs(items, 'changeyourlife-agenda.ics');
  toast(`${items.length} élément${items.length > 1 ? 's' : ''} exporté${items.length > 1 ? 's' : ''}`);
}

// ── Boot ─────────────────────────────────────────────────────────────────────
$('#ap-tabs').querySelectorAll('button').forEach((b) => {
  b.onclick = () => { view = b.dataset.v; syncTabs(); render(); };
});
$('#ap-prev').onclick = () => shift(-1);
$('#ap-next').onclick = () => shift(1);
$('#ap-today').onclick = () => { anchor = new Date(); loadGoogle().then(render); };
$('#ap-print').onclick = () => window.print();
$('#ap-export').onclick = exportIcs;
$('#ap-gsync').onclick = async () => {
  if (gcal.isConnected()) { gcal.disconnect(); gEvents = []; render(); toast('Google Agenda déconnecté'); updateSync(); return; }
  try { await gcal.connect({ write: true }); await loadGoogle(); render(); updateSync(); toast('Google Agenda connecté'); }
  catch (err) { toast(gcal.connectErrorMessage(err)); }
};
function updateSync() {
  const b = $('#ap-gsync');
  const on = gcal.isConnected();
  b.textContent = on ? 'Google connecté ✓' : 'Connecter Google Agenda';
  b.classList.toggle('primary', !on);
}
let rz;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(render, 180); });

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  uid = user.uid;
  try { board = await loadBoard(db, uid); } catch (_) { board = null; }
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    goals = (snap.exists() && snap.data().goals) || [];
  } catch (_) { goals = []; }
  updateSync();
  await loadGoogle();
  syncTabs();
  render();
});

document.addEventListener('cyl:gcal-refresh', () => { loadGoogle().then(render); });
