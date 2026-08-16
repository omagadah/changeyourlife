// /js/syl-brief.js - Le brief de SYL en tete de /app/.
//
// SYL lit l'ORGANIZER et le Google Agenda, puis rend une lecture de la
// situation + un « profil type ». C'est ce qui la rend centrale : elle ne
// repond plus seulement quand on lui parle, elle regarde l'etat reel du systeme.
//
// Cache d'une demi-journee par utilisateur (l'API est plafonnee a 8 appels/h) :
// le brief se rafraichit tout seul, ou a la demande via le bouton.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { loadBoard, allCards, FINISH_ID, BRANCH_BY_KEY } from '/js/organizer-data.js';
import * as gcal from '/js/gcal.js';

let auth, db, uid;
let board = null;

if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }

const host = () => document.getElementById('syl-brief');
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const cacheKey = () => 'cyl_syl_brief_' + uid;
const halfDay = () => Math.floor(Date.now() / 43_200_000);   // ~12 h

function readCache() {
  try {
    const x = JSON.parse(localStorage.getItem(cacheKey()) || 'null');
    return (x && x.slot === halfDay()) ? x.data : null;
  } catch (_) { return null; }
}
function writeCache(data) {
  try { localStorage.setItem(cacheKey(), JSON.stringify({ slot: halfDay(), data })); } catch (_) {}
}

// ── Rendu ────────────────────────────────────────────────────────────────────
function paint({ text, profile, loading = false, cta = 'Parler a SYL', focus = [], nourries = [], jachere = [] }) {
  const el = host(); if (!el) return;
  el.className = 'syl-brief' + (loading ? ' loading' : '');
  const focusHtml = focus.length ? `<div class="syl-brief-focus">${focus.map((t, i) =>
    `<span class="sbf"><b>${i + 1}</b>${esc(t)}</span>`).join('')}</div>` : '';
  const balance = [];
  nourries.forEach((k) => { const b = BRANCH_BY_KEY[k]; if (b) balance.push(`<span class="sbb up" title="Nourrie ces temps-ci">${b.emoji} ${esc(b.label)}</span>`); });
  jachere.forEach((k) => { const b = BRANCH_BY_KEY[k]; if (b) balance.push(`<span class="sbb down" title="En jachere">${b.emoji} ${esc(b.label)}</span>`); });
  el.innerHTML =
    `<div class="syl-brief-orb"></div>
     <div class="syl-brief-body">
       <div class="syl-brief-name">SYL${loading ? ' · elle regarde…' : ''}</div>
       <div class="syl-brief-text">${esc(text)}</div>
       ${focusHtml}
       ${profile ? `<div class="syl-brief-profile"><span>Ton profil, vu d'ici</span>${esc(profile)}</div>` : ''}
       ${balance.length ? `<div class="syl-brief-balance">${balance.join('')}</div>` : ''}
     </div>
     <div class="syl-brief-cta">${esc(cta)}</div>`;
  el.onclick = openSyl;
}

function openSyl() {
  try { document.dispatchEvent(new CustomEvent('cyl:syl-open')); } catch (_) {}
}

// ── Collecte de l'etat reel ──────────────────────────────────────────────────
function collectCards() {
  if (!board) return [];
  const ref = Date.now();
  return allCards(board)
    .filter(({ card, col }) => !card.done && col.id !== FINISH_ID)
    .slice(0, 40)
    .map(({ card, col }) => ({
      id: card.id,
      title: String(card.title || '').slice(0, 160),
      col: col.id,
      branch: card.branch || null,
      dueDays: card.due ? (card.due - ref) / 86400000 : null,
      inCalendar: !!card.gcalId,
    }));
}

async function collectEvents() {
  if (!gcal.isConnected()) return [];
  try {
    const items = await gcal.listUpcoming(3, 30);
    return items.map((ev) => {
      const d = gcal.eventStart(ev);
      let when = '';
      try {
        when = d ? d.toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      } catch (_) {}
      if (gcal.isAllDay(ev) && d) { try { when = d.toLocaleDateString('fr-FR', { weekday: 'short' }) + ' (journee)'; } catch (_) {} }
      return { when, title: ev.summary || '(sans titre)' };
    });
  } catch (_) { return []; }
}

// Titres des fiches mises en avant par SYL (elle renvoie des ids).
function focusTitles(ids) {
  if (!board || !ids || !ids.length) return [];
  const byId = {};
  allCards(board).forEach(({ card }) => { byId[card.id] = card.title; });
  return ids.map((id) => byId[id]).filter(Boolean).map((t) => String(t).slice(0, 70));
}

// ── Appel API ────────────────────────────────────────────────────────────────
async function fetchBrief() {
  const user = auth.currentUser;
  if (!user) return null;
  const idToken = await user.getIdToken();
  const [cards, events] = [collectCards(), await collectEvents()];
  const r = await fetch('/api/syl-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, cards, events }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || 'brief-failed'); e.status = r.status; throw e; }
  return data;
}

function show(data) {
  paint({
    text: data.brief,
    profile: data.profile,
    focus: focusTitles(data.focus),
    nourries: data.nourries || [],
    jachere: data.jachere || [],
  });
}

// Repli 100 % local : meme sans IA, la page dit quelque chose d'utile.
function localFallback() {
  const cards = collectCards();
  const late = cards.filter((c) => c.dueDays !== null && c.dueDays < 0).length;
  const today = cards.filter((c) => c.dueDays !== null && c.dueDays >= 0 && c.dueDays < 1).length;
  const tri = cards.filter((c) => c.col === 'tri').length;
  let text;
  if (!cards.length) text = "Rien de note pour l'instant. Depose ce que tu as en tete juste au-dessus, on triera apres.";
  else if (late) text = `${late} fiche${late > 1 ? 's ont' : ' a'} une echeance passee. Certaines n'ont peut-etre plus lieu d'etre - a toi de voir.`;
  else if (today) text = `${today} echeance${today > 1 ? 's tombent' : ' tombe'} aujourd'hui. Le reste peut attendre si tu le decides.`;
  else if (tri) text = `${tri} idee${tri > 1 ? 's attendent' : ' attend'} d'etre triee${tri > 1 ? 's' : ''}. Quand tu veux.`;
  else text = `${cards.length} fiche${cards.length > 1 ? 's' : ''} en cours, rien d'urgent. Journee libre de contraintes.`;
  paint({ text, cta: 'Parler a SYL' });
}

async function run() {
  const cached = readCache();
  if (cached) { show(cached); return; }
  paint({ text: 'Je regarde ou tu en es…', loading: true, cta: '' });
  try {
    const data = await fetchBrief();
    if (!data) return localFallback();
    writeCache(data);
    show(data);
  } catch (e) {
    console.warn('[syl-brief]', e && e.message);
    localFallback();
  }
}

// ── Styles (autonomes : socle + parties dynamiques, palette organique) ──────
// SYL porte son identite de l'accueil : orbe or -> vert, lumiere chaude.
function injectCSS() {
  if (document.getElementById('cyl-sylbrief-css')) return;
  const s = document.createElement('style'); s.id = 'cyl-sylbrief-css';
  s.textContent = `
    .syl-brief{display:flex;align-items:flex-start;gap:14px;margin-bottom:18px;
      padding:15px 18px;border-radius:16px;cursor:pointer;
      background:linear-gradient(135deg,rgba(231,177,92,0.10),rgba(132,194,94,0.05));
      border:1px solid rgba(231,177,92,0.30);
      transition:border-color .2s, transform .2s;}
    .syl-brief:hover{border-color:rgba(231,177,92,0.6);transform:translateY(-1px);}
    .syl-brief-orb{width:34px;height:34px;border-radius:50%;flex-shrink:0;margin-top:1px;
      background:radial-gradient(circle at 35% 30%,#fbe6b0,#e7b15c 45%,#4a7a3a 100%);
      box-shadow:0 0 18px rgba(231,177,92,0.55), inset 0 0 8px rgba(255,255,255,0.25);}
    .syl-brief-body{flex:1;min-width:0;}
    .syl-brief-name{font-size:0.66rem;text-transform:uppercase;letter-spacing:.9px;color:#f1cd92;font-weight:800;}
    .syl-brief-text{font-size:0.88rem;color:#f4efe1;line-height:1.5;margin-top:3px;}
    .syl-brief-cta{font-size:0.78rem;font-weight:800;color:#f1cd92;white-space:nowrap;align-self:center;}
    .syl-brief.loading .syl-brief-orb{animation:sylPulse 1.4s ease-in-out infinite;}
    @keyframes sylPulse{0%,100%{transform:scale(1);opacity:.75}50%{transform:scale(1.12);opacity:1}}
    .syl-brief-focus{display:flex;flex-direction:column;gap:4px;margin-top:9px;}
    .sbf{display:flex;align-items:baseline;gap:8px;font-size:0.8rem;color:#e6dfc8;line-height:1.4;}
    .sbf b{flex-shrink:0;width:17px;height:17px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
      font-size:0.62rem;background:rgba(231,177,92,0.28);color:#f4efe1;}
    .syl-brief-profile{margin-top:10px;font-size:0.78rem;color:#b4ad94;line-height:1.5;
      padding-top:9px;border-top:1px solid rgba(231,177,92,0.18);}
    .syl-brief-profile span{display:block;font-size:0.6rem;text-transform:uppercase;letter-spacing:.7px;
      color:#c0a672;font-weight:800;margin-bottom:3px;}
    .syl-brief-balance{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;}
    .sbb{font-size:0.66rem;font-weight:700;padding:3px 9px;border-radius:99px;
      background:rgba(255,255,255,0.05);color:#b4ad94;border:1px solid transparent;}
    .sbb.up{border-color:rgba(132,194,94,0.4);color:#a7d585;}
    .sbb.down{border-color:rgba(231,177,92,0.4);color:#f1cd92;}
    @media (prefers-reduced-motion:reduce){ .syl-brief.loading .syl-brief-orb{animation:none;} }
  `;
  document.head.appendChild(s);
}

// ── Boot ─────────────────────────────────────────────────────────────────────
injectCSS();
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  uid = user.uid;
  try { board = await loadBoard(db, uid); } catch (_) { board = null; }
  run();
});

// Le hub a change : on rafraichit l'etat local sans rappeler l'IA (le brief
// reste celui du cache jusqu'a expiration - pas d'appel a chaque clic).
document.addEventListener('cyl:organizer-changed', (e) => {
  if (e.detail && e.detail.board) board = e.detail.board;
  if (!readCache()) localFallback();
});
