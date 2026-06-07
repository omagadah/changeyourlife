// /js/lya-overlay.js - SYL « addossée » à toutes les interfaces.
//
// Orb flottant + panneau de chat, présent sur toutes les pages
// authentifiées. SYL reçoit en contexte la page courante + l'état réel de
// l'arbre, donc elle peut répondre avec connaissance de cause.
//
// Auto-import depuis common.js sur toutes les pages SAUF la landing, login,
// signup, verify-email. Le module est self-contained (CSS injectée, DOM créé).
//
// Cf. ROADMAP.md → « SYL overlay sur TOUTES les interfaces ».

import { auth, db } from '/js/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { treeFromUserDoc, toVisualModel } from '/js/tree-data.js';

// ── Libellés humains pour le contexte de page ───────────────────────────────
const PAGE_LABELS = {
  '/app/':            'tableau de bord (arbre)',
  '/journal/':        'journal',
  '/meditation/':     'méditation',
  '/habitudes/':      'habitudes',
  '/sommeil/':        'sommeil',
  '/humeur/':         'humeur',
  '/gratitude/':      'gratitude',
  '/objectifs/':      'objectifs',
  '/codex/':          'codex',
  '/autoevaluation/': 'autoévaluation (Roue de Vie)',
  '/bilan/':          'bilan hebdomadaire',
  '/profile/':        'profil',
  '/settings/':       'paramètres',
  '/yourlife/':       'pyramide de Maslow (legacy)',
  '/coach/':          'coach IA',
};
function pageContext() {
  let p = window.location.pathname;
  if (!p.endsWith('/')) p += '/';
  return { url: p, page: PAGE_LABELS[p] || p };
}

// ── État global du module ───────────────────────────────────────────────────
let ready = false;
let orb, panel, msgsEl, inputEl, sendBtn;
let chatOpen = false;
let busy = false;
let userTreeCache = null;
let displayName = '';
const history = [];

// ── CSS (injectée - style-src 'self' autorisé sur toutes les pages) ─────────
function injectCss() {
  if (document.getElementById('lya-overlay-css')) return;
  const css = document.createElement('style');
  css.id = 'lya-overlay-css';
  css.textContent = `
  .lyaov-orb{position:fixed;bottom:18px;right:18px;width:54px;height:54px;
    border-radius:50%;cursor:pointer;border:none;display:none;z-index:9500;
    background:radial-gradient(circle at 38% 34%,#8fc2ff 0%,#2f7ef0 44%,#1a3a8c 100%);
    box-shadow:0 0 30px rgba(47,126,240,0.55),inset 0 0 16px rgba(255,255,255,0.25);
    animation:lyaovBreathe 4.6s ease-in-out infinite;
    transition:transform .2s, box-shadow .2s;}
  .lyaov-orb.on{display:block;}
  .lyaov-orb:hover{transform:scale(1.08);box-shadow:0 0 38px rgba(47,126,240,0.85);}
  .lyaov-orb::after{content:'';position:absolute;inset:0;border-radius:50%;
    background:radial-gradient(circle at 64% 70%,rgba(255,255,255,0.32),transparent 45%);
    pointer-events:none;}
  @keyframes lyaovBreathe{0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}

  .lyaov-panel{position:fixed;bottom:84px;right:18px;width:360px;
    max-width:calc(100vw - 28px);height:480px;max-height:calc(100vh - 110px);
    border-radius:18px;z-index:9499;display:none;flex-direction:column;overflow:hidden;
    background:rgba(8,17,30,0.97);
    border:1px solid rgba(0,112,243,0.32);
    box-shadow:0 20px 60px rgba(0,0,0,0.55);
    opacity:0;transform:translateY(12px) scale(.96);transform-origin:bottom right;
    transition:opacity .25s, transform .25s cubic-bezier(.22,1,.36,1);}
  .lyaov-panel.on{display:flex;}
  .lyaov-panel.in{opacity:1;transform:translateY(0) scale(1);}

  .lyaov-head{display:flex;align-items:center;gap:10px;padding:14px 16px;
    border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;}
  .lyaov-head-orb{width:30px;height:30px;border-radius:50%;flex-shrink:0;
    background:radial-gradient(circle at 38% 34%,#8fc2ff,#2f7ef0 60%,#1a3a8c);
    box-shadow:0 0 14px rgba(47,126,240,0.5);}
  .lyaov-head-name{font:700 0.94rem -apple-system,Segoe UI,Roboto,sans-serif;color:#eef4ff;flex:1;letter-spacing:.3px;}
  .lyaov-head-close{width:30px;height:30px;border-radius:50%;cursor:pointer;
    background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
    color:#8ba4c8;font-size:0.85rem;display:flex;align-items:center;justify-content:center;}
  .lyaov-head-close:hover{background:rgba(255,255,255,0.13);color:#fff;}

  .lyaov-msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;}
  .lyaov-msg{max-width:88%;padding:9px 13px;border-radius:13px;
    font:500 0.88rem -apple-system,Segoe UI,Roboto,sans-serif;line-height:1.45;
    word-wrap:break-word;}
  .lyaov-msg.lya{background:rgba(255,255,255,0.06);color:#eef4ff;align-self:flex-start;
    border-bottom-left-radius:4px;}
  .lyaov-msg.user{background:rgba(0,112,243,0.85);color:#fff;align-self:flex-end;
    border-bottom-right-radius:4px;}
  .lyaov-msg.thinking{opacity:0.7;font-style:italic;}

  .lyaov-form{display:flex;gap:8px;padding:12px 14px;
    border-top:1px solid rgba(255,255,255,0.08);flex-shrink:0;}
  .lyaov-input{flex:1;min-width:0;padding:9px 13px;border-radius:11px;
    background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);
    color:#eef4ff;font:500 0.88rem inherit;outline:none;
    transition:border-color .2s;}
  .lyaov-input:focus{border-color:rgba(0,112,243,0.55);}
  .lyaov-input::placeholder{color:#5d7895;}
  .lyaov-send{flex-shrink:0;width:42px;border-radius:11px;cursor:pointer;
    background:#0070f3;color:#fff;border:none;font-size:0.95rem;
    transition:filter .2s,transform .2s;}
  .lyaov-send:hover{filter:brightness(1.12);}
  .lyaov-send:active{transform:scale(0.94);}
  .lyaov-send:disabled{opacity:.5;cursor:default;}

  @media (max-width:520px){
    .lyaov-panel{right:10px;left:10px;width:auto;bottom:78px;}
    .lyaov-orb{bottom:14px;right:14px;}
  }
  `;
  document.head.appendChild(css);
}

// ── Chargement (cache) du résumé de l'arbre de l'utilisateur ────────────────
async function fetchUserTree() {
  if (userTreeCache) return userTreeCache;
  try {
    const u = auth.currentUser;
    if (!u) return null;
    const snap = await getDoc(doc(db, 'users', u.uid));
    const data = snap.exists() ? snap.data() : {};
    displayName = (data.displayName || data.username || '').trim();
    const tree = treeFromUserDoc(data);
    const model = toVisualModel(tree);
    userTreeCache = {
      stade: model.stage,
      xpTotal: model.branches.reduce((s, b) => s + (b.xp || 0), 0),
      branches: model.branches.map((b) => ({
        nom: b.label, niveau: b.level, dev: b.dev,
        vitalite: b.vitality, etat: b.state,
      })),
    };
    return userTreeCache;
  } catch (_) { return null; }
}

// ── Affichage d'un message dans la liste ────────────────────────────────────
function appendMsg(role, text, isThinking) {
  const el = document.createElement('div');
  el.className = 'lyaov-msg ' + role + (isThinking ? ' thinking' : '');
  el.textContent = text;
  msgsEl.appendChild(el);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return el;
}

// ── Envoi d'un message à SYL via /api/coach ─────────────────────────────────
async function sendMessage(text) {
  const msg = (text || '').trim();
  if (!msg || busy) return;
  busy = true;
  sendBtn.disabled = true;
  inputEl.value = '';
  appendMsg('user', msg);
  history.push({ role: 'user', content: msg });
  const thinking = appendMsg('lya', 'SYL réfléchit…', true);
  try {
    const u = auth.currentUser;
    if (!u) throw new Error('not-signed-in');
    const idToken = await u.getIdToken();
    const arbre = await fetchUserTree();
    const userProfile = {
      prenom: displayName || undefined,
      page: pageContext(),
      arbre,
    };
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, messages: history, userProfile }),
    });
    thinking.remove();
    if (!res.ok) {
      history.pop();
      let detail = '';
      try {
        const j = await res.json();
        if (j && (j.error || j.details)) {
          const provider = j.geminiStatus ? ` · Gemini ${j.geminiStatus}` : (j.groqStatus ? ` · Groq ${j.groqStatus}` : '');
          detail = ` (${j.error || ''}${provider})`;
        }
      } catch (_) {}
      appendMsg('lya', res.status === 429
        ? `SYL a besoin d’une minute - réessaie.${detail}`
        : (res.status === 401 || res.status === 403)
          ? `Reconnecte-toi pour parler à SYL.${detail}`
          : `SYL est indisponible pour l’instant${detail}`);
      return;
    }
    const data = await res.json();
    const reply = (data && data.reply) ? String(data.reply) : 'Je n’ai pas su répondre - reformule ?';
    history.push({ role: 'assistant', content: reply });
    appendMsg('lya', reply);
  } catch (e) {
    thinking.remove();
    history.pop();
    appendMsg('lya', 'SYL est hors ligne pour l’instant.');
  } finally {
    busy = false;
    sendBtn.disabled = false;
    if (chatOpen) inputEl.focus();
  }
}

// ── Open / close du panneau ─────────────────────────────────────────────────
function openChat() {
  if (chatOpen) return;
  chatOpen = true;
  panel.classList.add('on');
  requestAnimationFrame(() => panel.classList.add('in'));
  if (!history.length) {
    const ctx = pageContext();
    appendMsg('lya', `Bonjour. Tu es sur la page « ${ctx.page} ». Je vois ton arbre - pose-moi une question, ou dis-moi par quoi je peux t’aider ici.`);
  }
  setTimeout(() => { try { inputEl.focus(); } catch (_) {} }, 240);
}
function closeChat() {
  if (!chatOpen) return;
  chatOpen = false;
  panel.classList.remove('in');
  setTimeout(() => panel.classList.remove('on'), 240);
  // Cache invalidée à la fermeture : prochain chat = arbre frais (l'utilisateur
  // a peut-être gagné de l'XP entre temps).
  userTreeCache = null;
}

// ── Construction du DOM ─────────────────────────────────────────────────────
function buildUI() {
  injectCss();

  orb = document.createElement('button');
  orb.className = 'lyaov-orb';
  orb.type = 'button';
  orb.title = 'Parler à SYL';
  orb.setAttribute('aria-label', 'Ouvrir la conversation avec SYL');
  orb.addEventListener('click', (e) => {
    e.stopPropagation();
    if (chatOpen) closeChat(); else openChat();
  });
  document.body.appendChild(orb);

  panel = document.createElement('div');
  panel.className = 'lyaov-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Conversation avec SYL');
  panel.innerHTML =
    '<div class="lyaov-head">' +
      '<div class="lyaov-head-orb" aria-hidden="true"></div>' +
      '<div class="lyaov-head-name">SYL</div>' +
      '<button class="lyaov-head-close" type="button" aria-label="Fermer">✕</button>' +
    '</div>' +
    '<div class="lyaov-msgs"></div>' +
    '<form class="lyaov-form">' +
      '<input class="lyaov-input" type="text" autocomplete="off" placeholder="Demande à SYL…" />' +
      '<button class="lyaov-send" type="submit" aria-label="Envoyer">➤</button>' +
    '</form>';
  document.body.appendChild(panel);

  msgsEl  = panel.querySelector('.lyaov-msgs');
  inputEl = panel.querySelector('.lyaov-input');
  sendBtn = panel.querySelector('.lyaov-send');
  const form     = panel.querySelector('.lyaov-form');
  const closeBtn = panel.querySelector('.lyaov-head-close');

  closeBtn.addEventListener('click', closeChat);
  form.addEventListener('submit', (e) => { e.preventDefault(); sendMessage(inputEl.value); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && chatOpen) closeChat(); });
  // Click hors panneau / orb → ferme
  document.addEventListener('pointerdown', (e) => {
    if (!chatOpen) return;
    if (panel.contains(e.target) || orb.contains(e.target)) return;
    closeChat();
  });

  // Cache l'orb quand l'arbre est en plein écran (le tree-widget a sa propre SYL).
  function syncWithTree() {
    const stage = document.getElementById('tree-stage');
    const fullscreen = stage && stage.classList.contains('expanded');
    orb.style.opacity = fullscreen ? '0' : '';
    orb.style.pointerEvents = fullscreen ? 'none' : '';
    if (fullscreen && chatOpen) closeChat();
  }
  document.addEventListener('cyl:tree-expand', syncWithTree);
  document.addEventListener('cyl:tree-collapse', syncWithTree);
  syncWithTree();
}

// ── Init ────────────────────────────────────────────────────────────────────
function init() {
  if (ready) return;
  ready = true;
  buildUI();
  onAuthStateChanged(auth, (user) => {
    if (user) orb.classList.add('on');
    else { orb.classList.remove('on'); if (chatOpen) closeChat(); }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
