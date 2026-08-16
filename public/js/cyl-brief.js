// /js/cyl-brief.js - Le brief de CYL en tete de /app/.
//
// CYL lit l'ORGANIZER et le Google Agenda, puis rend une lecture de la
// situation + un « profil type ». C'est ce qui la rend centrale : elle ne
// repond plus seulement quand on lui parle, elle regarde l'etat reel du systeme.
//
// Cache d'une demi-journee par utilisateur (l'API est plafonnee a 8 appels/h) :
// le brief se rafraichit tout seul, ou a la demande via le bouton.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { loadBoard, allCards, topPriorities, FINISH_ID, BRANCH_BY_KEY } from '/js/organizer-data.js';
import * as gcal from '/js/gcal.js';

let auth, db, uid;
let board = null;

// ── Ce qui reste, ce qui bouge ──────────────────────────────────────────────
// Les analyses de CYL coutent un appel et valent d'etre relues : elles restent
// EPINGLEES tant que l'IA n'en a pas produit de nouvelles. Seules la phrase
// d'accueil et les 3 priorites se recalculent a chaque geste.
// Sans ca, deplacer une fiche effacait tout le travail d'analyse - c'est
// l'inverse de ce qu'on veut : plus c'est le desordre, plus les conseils
// doivent tenir sous les yeux.
// Declare ICI (et pas plus bas) : `show()` s'en sert, et une `let` reste
// inaccessible tant que sa ligne n'est pas passee.
let pinned = { insights: [], profile: '', nourries: [], jachere: [] };

if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }

const host = () => document.getElementById('cyl-brief');
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const cacheKey = () => 'cyl_brief_' + uid;
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
function paint({ text, profile, loading = false, cta = 'Parler a CYL', focus = [], nourries = [], jachere = [], insights = [], thinking = false }) {
  const el = host(); if (!el) return;
  el.className = 'cyl-brief' + (loading ? ' loading' : '');
  const focusHtml = focus.length ? `<div class="cyl-brief-focus">${focus.map((t, i) =>
    `<span class="sbf"><b>${i + 1}</b>${esc(t)}</span>`).join('')}</div>` : '';
  const balance = [];
  nourries.forEach((k) => { const b = BRANCH_BY_KEY[k]; if (b) balance.push(`<span class="sbb up" title="Nourrie ces temps-ci">${b.emoji} ${esc(b.label)}</span>`); });
  jachere.forEach((k) => { const b = BRANCH_BY_KEY[k]; if (b) balance.push(`<span class="sbb down" title="En jachere">${b.emoji} ${esc(b.label)}</span>`); });
  // Ce que CYL a vu et que l'utilisateur ne voit pas seul : c'est la partie
  // qui a de la valeur. Chaque analyse s'ouvre dans le chat pour creuser.
  const insHtml = insights.length ? `<div class="cyl-ins">${insights.map((x, i) =>
    `<button class="cyl-ins-i" data-ins="${i}">
       <span class="cyl-ins-t">${esc(x.t)}</span>
       <span class="cyl-ins-d">${esc(x.d)}</span>
     </button>`).join('')}</div>` : '';

  el.innerHTML =
    `<div class="cyl-brief-orb"></div>
     <div class="cyl-brief-body">
       <div class="cyl-brief-name">CYL${loading ? ' · elle regarde…' : thinking ? ' · elle relit tes fiches…' : ''}</div>
       <div class="cyl-brief-text">${esc(text)}</div>
       ${focusHtml}
       ${insHtml}
       ${profile ? `<div class="cyl-brief-profile"><span>Ton profil, vu d'ici</span>${esc(profile)}</div>` : ''}
       ${balance.length ? `<div class="cyl-brief-balance">${balance.join('')}</div>` : ''}
     </div>
     <div class="cyl-brief-cta">${esc(cta)}</div>`;

  el.onclick = (e) => {
    const b = e.target.closest('[data-ins]');
    if (b) {
      e.stopPropagation();
      const x = insights[Number(b.dataset.ins)];
      if (x) {
        document.dispatchEvent(new CustomEvent('cyl:chat-open', {
          detail: { prefill: `Tu m'as dit : « ${x.t} - ${x.d} »\n\nDéveloppe : qu'est-ce que tu me proposes concrètement, et pourquoi ?` },
        }));
      }
      return;
    }
    openCyl();
  };
}

function openCyl() {
  try { document.dispatchEvent(new CustomEvent('cyl:chat-open')); } catch (_) {}
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
      distress: !!card.distress,
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

// Titres des fiches mises en avant par CYL (elle renvoie des ids).
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
  const r = await fetch('/api/cyl-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, cards, events }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || 'brief-failed'); e.status = r.status; throw e; }
  return data;
}

function show(data) {
  // Tout ce qui vient de l'IA devient le bloc EPINGLE : il survivra aux
  // repeints locaux jusqu'a la prochaine analyse.
  pinned = {
    insights: data.insights || [],
    profile: data.profile || '',
    nourries: data.nourries || [],
    jachere: data.jachere || [],
  };
  paint({
    text: data.brief,
    profile: pinned.profile,
    focus: focusTitles(data.focus),
    nourries: pinned.nourries,
    jachere: pinned.jachere,
    insights: pinned.insights,
  });
}

// ── Lecture locale de l'etat, recalculee A CHAQUE ACTION ────────────────────
// Le brief de l'IA est fige en cache une demi-journee. Si CYL s'en tenait la,
// elle repeterait la meme phrase pendant que l'utilisateur range ses fiches
// sous ses yeux - ce qui donne l'impression d'un site qui ne regarde rien.
// Des la premiere action, ce moteur local prend la main : il coute 0 appel,
// et il dit toujours quelque chose de VRAI de l'instant present.

function readState() {
  const cards = collectCards();
  const n = (f) => cards.filter(f).length;
  return {
    total: cards.length,
    tri: n((c) => c.col === 'tri'),
    urgent: n((c) => c.col === 'ui'),
    plan: n((c) => c.col === 'ni'),
    quick: n((c) => c.col === 'up'),
    late: n((c) => c.dueDays !== null && c.dueDays < 0),
    today: n((c) => c.dueDays !== null && c.dueDays >= 0 && c.dueDays < 1),
    dated: n((c) => c.dueDays !== null),
    inCal: n((c) => c.inCalendar),
    distress: cards.filter((c) => c.distress),
  };
}

const plural = (n, s, p) => (n > 1 ? p : s);

// Le message tient compte de ce qui vient de CHANGER, pas seulement de l'etat.
// C'est ce qui fait la difference entre un tableau de bord et quelqu'un qui
// suit. Aucune injonction : on decrit, on propose, l'utilisateur tranche.
function localText(s, prev) {
  // 1. Le mal-etre passe avant la logistique.
  if (s.distress.length) {
    const t = s.distress[0].title;
    return `Tu as noté « ${String(t).slice(0, 48)}${t.length > 48 ? '…' : ''} ». Ça passe avant le rangement - on peut en parler quand tu veux.`;
  }
  // 2. Rien du tout.
  if (!s.total) {
    return "Rien de noté pour l'instant. Dépose ce que tu as en tête juste au-dessus, on triera après.";
  }
  // 3. Reaction a l'action qui vient d'avoir lieu.
  if (prev) {
    const sorted = prev.tri - s.tri;
    if (sorted > 0 && s.tri === 0) {
      return `Tout est trié. ${s.dated ? 'Reste à voir ce que tu cales quand.' : "Aucune fiche n'a d'échéance : tu peux en poser une, ou laisser filer."}`;
    }
    if (sorted > 0) {
      return `${sorted} ${plural(sorted, 'fiche rangée', 'fiches rangées')}. Il en reste ${s.tri} à trier - rien ne presse.`;
    }
    if (s.total > prev.total) {
      return `Noté. ${s.tri} ${plural(s.tri, 'fiche attend', 'fiches attendent')} d'être triée${s.tri > 1 ? 's' : ''} - tu peux continuer à déverser, on rangera après.`;
    }
    if (s.dated > prev.dated) {
      return `Échéance posée. ${s.today ? `${s.today} ${plural(s.today, 'chose tombe', 'choses tombent')} aujourd'hui.` : 'Rien ne tombe aujourd\'hui, la journée reste libre.'}`;
    }
    if (s.total < prev.total) {
      return `Une fiche de moins. Il t'en reste ${s.total} en cours.`;
    }
  }
  // 4. Lecture de l'etat au repos.
  if (s.late) {
    return `${s.late} ${plural(s.late, 'fiche a', 'fiches ont')} une échéance passée. Certaines n'ont peut-être plus lieu d'être - à toi de voir.`;
  }
  if (s.today) {
    return `${s.today} ${plural(s.today, 'échéance tombe', 'échéances tombent')} aujourd'hui. Le reste peut attendre si tu le décides.`;
  }
  if (s.tri >= 5) {
    return `${s.tri} fiches attendent d'être triées. Le tri va plus vite que la liste ne le laisse croire.`;
  }
  if (s.tri) {
    return `${s.tri} ${plural(s.tri, 'idée attend', 'idées attendent')} d'être triée${s.tri > 1 ? 's' : ''}. Quand tu veux.`;
  }
  if (s.urgent) {
    return `${s.urgent} ${plural(s.urgent, 'chose est marquée', 'choses sont marquées')} urgente${s.urgent > 1 ? 's' : ''} et importante${s.urgent > 1 ? 's' : ''}. Le reste peut attendre.`;
  }
  if (!s.dated) {
    return `${s.total} ${plural(s.total, 'fiche en cours', 'fiches en cours')}, aucune datée. Rien ne te presse - c'est un choix qui se tient.`;
  }
  return `${s.total} ${plural(s.total, 'fiche en cours', 'fiches en cours')}, rien d'urgent. Journée libre de contraintes.`;
}

let lastState = null;

// `reactive` : appelee apres une action -> on compare a l'etat precedent pour
// que CYL reagisse a CE que l'utilisateur vient de faire.
function localFallback(reactive) {
  const s = readState();
  const text = localText(s, reactive ? lastState : null);
  lastState = s;
  const focus = board ? topPriorities(board, 3).map(({ card }) => String(card.title).slice(0, 70)) : [];
  paint({
    text, focus, cta: 'Parler à CYL',
    insights: pinned.insights,
    profile: pinned.profile,
    nourries: pinned.nourries,
    jachere: pinned.jachere,
  });
}

async function run() {
  // Point de référence pris AVANT tout affichage : sans lui, la toute première
  // action de l'utilisateur n'aurait rien à quoi se comparer et CYL resterait
  // muette au moment précis où elle doit réagir.
  lastState = readState();
  const cached = readCache();
  if (cached) { show(cached); return; }
  paint({ text: 'Je regarde ou tu en es…', loading: true, cta: '' });
  try {
    const data = await fetchBrief();
    if (!data) return localFallback();
    writeCache(data);
    show(data);
  } catch (e) {
    console.warn('[cyl-brief]', e && e.message);
    localFallback();
  }
}

// ── Styles (autonomes : socle + parties dynamiques, palette organique) ──────
// CYL porte son identite de l'accueil : orbe or -> vert, lumiere chaude.
function injectCSS() {
  if (document.getElementById('cyl-brief-css')) return;
  const s = document.createElement('style'); s.id = 'cyl-brief-css';
  s.textContent = `
    .cyl-brief{display:flex;align-items:flex-start;gap:14px;margin-bottom:18px;
      padding:15px 18px;border-radius:16px;cursor:pointer;
      background:linear-gradient(135deg,rgba(231,177,92,0.10),rgba(132,194,94,0.05));
      border:1px solid rgba(231,177,92,0.30);
      transition:border-color .2s, transform .2s;}
    .cyl-brief:hover{border-color:rgba(231,177,92,0.6);transform:translateY(-1px);}
    .cyl-brief-orb{width:34px;height:34px;border-radius:50%;flex-shrink:0;margin-top:1px;
      background:radial-gradient(circle at 35% 30%,#fbe6b0,#e7b15c 45%,#4a7a3a 100%);
      box-shadow:0 0 18px rgba(231,177,92,0.55), inset 0 0 8px rgba(255,255,255,0.25);}
    .cyl-brief-body{flex:1;min-width:0;}
    .cyl-brief-name{font-size:0.66rem;text-transform:uppercase;letter-spacing:.9px;color:var(--gold-text);font-weight:800;}
    .cyl-brief-text{font-size:0.88rem;color:var(--text-1);line-height:1.5;margin-top:3px;}
    .cyl-brief-cta{font-size:0.78rem;font-weight:800;color:var(--gold-text);white-space:nowrap;align-self:center;}
    .cyl-brief.loading .cyl-brief-orb{animation:cylPulse 1.4s ease-in-out infinite;}
    @keyframes cylPulse{0%,100%{transform:scale(1);opacity:.75}50%{transform:scale(1.12);opacity:1}}
    .cyl-brief-focus{display:flex;flex-direction:column;gap:4px;margin-top:9px;}
    .sbf{display:flex;align-items:baseline;gap:8px;font-size:0.8rem;color:var(--text-2);line-height:1.4;}
    .sbf b{flex-shrink:0;width:17px;height:17px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
      font-size:0.62rem;background:rgba(231,177,92,0.28);color:var(--text-1);}
    .cyl-brief-profile{margin-top:10px;font-size:0.78rem;color:var(--text-2);line-height:1.5;
      padding-top:9px;border-top:1px solid rgba(231,177,92,0.18);}
    .cyl-brief-profile span{display:block;font-size:0.6rem;text-transform:uppercase;letter-spacing:.7px;
      color:var(--gold-text);font-weight:800;margin-bottom:3px;}
    /* Les analyses de CYL : ce qu'elle a vu et qu'on ne voit pas seul */
    .cyl-ins{display:flex;flex-direction:column;gap:6px;margin-top:11px;}
    .cyl-ins-i{display:flex;flex-direction:column;gap:2px;text-align:left;width:100%;
      padding:9px 11px;border-radius:11px;cursor:pointer;font:inherit;
      background:rgba(231,177,92,0.07);border:1px solid rgba(231,177,92,0.22);
      transition:background .16s,border-color .16s,transform .16s;}
    .cyl-ins-i:hover{background:rgba(231,177,92,0.14);border-color:rgba(231,177,92,0.45);transform:translateX(2px);}
    .cyl-ins-t{font-size:0.76rem;font-weight:800;color:var(--gold-text);}
    .cyl-ins-d{font-size:0.75rem;color:var(--text-2);line-height:1.45;}
    .cyl-brief-balance{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;}
    .sbb{font-size:0.66rem;font-weight:700;padding:3px 9px;border-radius:99px;
      background:var(--surface-2);color:var(--text-2);border:1px solid transparent;}
    .sbb.up{border-color:rgba(132,194,94,0.4);color:var(--leaf-text);}
    .sbb.down{border-color:rgba(231,177,92,0.4);color:var(--gold-text);}
    @media (prefers-reduced-motion:reduce){ .cyl-brief.loading .cyl-brief-orb{animation:none;} }
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
// ── Boucle vivante ──────────────────────────────────────────────────────────
// Deux temps, pour être à la fois instantané et intelligent :
//  1. L'utilisateur agit -> réponse LOCALE immédiate (0 appel, 0 attente).
//  2. Il s'arrête -> au bout de 20 s de calme, on redemande une vraie lecture
//     à Claude, qui voit ce que le moteur local ne peut pas voir.
// Le délai n'est pas cosmétique : sans lui, déplacer 5 fiches déclencherait 5
// appels et épuiserait le quota (8/h) en une minute.

const IDLE_MS = 20_000;
let idleTimer = null;
let lastSig = '';

// Signature de l'état : évite de rappeler l'IA si rien n'a changé de fond
// (rouvrir une fiche, la refermer, la reposer au même endroit).
function signature(s) {
  return [s.total, s.tri, s.urgent, s.plan, s.quick, s.late, s.dated, s.distress.length].join('|');
}

async function refreshFromAI() {
  const s = readState();
  const sig = signature(s);
  if (sig === lastSig) return;          // rien de significatif n'a bougé
  lastSig = sig;
  try {
    const data = await fetchBrief();
    if (!data) return;
    writeCache(data);
    show(data);
  } catch (err) {
    // Quota atteint ou réseau : on garde la lecture locale, déjà affichée.
    // Silencieux par choix : l'utilisateur n'a rien demandé, il n'a pas à
    // recevoir une erreur pour un rafraîchissement d'arrière-plan.
    if (err && err.status !== 429) console.warn('[cyl-brief] refresh', err.message);
  }
}

document.addEventListener('cyl:organizer-changed', (e) => {
  if (e.detail && e.detail.board) board = e.detail.board;
  localFallback(true);                   // 1. tout de suite
  clearTimeout(idleTimer);
  idleTimer = setTimeout(refreshFromAI, IDLE_MS);   // 2. quand ça se calme
});
