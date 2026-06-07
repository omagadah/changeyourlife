// /js/branche.js - Espace-dimension d'une branche de l'arbre.
// Une page par branche (body[data-branch]) : ses 5 sous-catégories deviennent
// des actions concrètes → awardXp(branche) → l'arbre grandit. Contenu tiré de
// l'i18n (window.CYL.t) donc traduit automatiquement.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initUserMenu } from '/js/userMenu.js';
import { updateGlobalAvatar } from '/js/common.js';

let auth, db, uid;
let dim = {};   // { "<branch>.<i>": "YYYY-MM-DD" } - sous-catégorie validée ce jour

if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }
try { initUserMenu(); } catch (e) {}
if (!document.getElementById('cyl-emoji-js')) { const _e = document.createElement('script'); _e.id = 'cyl-emoji-js'; _e.src = '/js/emoji.js'; document.head.appendChild(_e); }

const BRANCH_META = {
  physio:          { emoji: '🌱', color: '#2dd4bf' },
  securite:        { emoji: '🛡️', color: '#fbbf24' },
  appartenance:    { emoji: '🤝', color: '#f87171' },
  estime:          { emoji: '🏆', color: '#fb923c' },
  cognitif:        { emoji: '🧠', color: '#a78bfa' },
  esthetique:      { emoji: '🎨', color: '#e879c7' },
  accomplissement: { emoji: '🚀', color: '#38bdf8' },
  transcendance:   { emoji: '✨', color: '#c4b5fd' },
};
const TOOLS = {
  physio:          [{ h: '/sommeil/', i: '🌙', l: 'Sommeil' }, { h: '/habitudes/', i: '✅', l: 'Habitudes' }, { h: '/plan/', i: '🌅', l: "Aujourd'hui" }],
  securite:        [{ h: '/habitudes/', i: '✅', l: 'Habitudes' }, { h: '/plan/', i: '🌅', l: "Aujourd'hui" }],
  appartenance:    [{ h: '/journal/', i: '📔', l: 'Journal' }, { h: '/gratitude/', i: '🌟', l: 'Gratitude' }],
  estime:          [{ h: '/objectifs/', i: '🎯', l: 'Objectifs' }, { h: '/autoevaluation/', i: '🎡', l: 'Autoévaluation' }, { h: '/bilan/', i: '📊', l: 'Bilan' }],
  cognitif:        [{ h: '/codex/', i: '📚', l: 'Codex' }, { h: '/journal/', i: '📔', l: 'Journal' }, { h: '/competences/', i: '🧗', l: 'Compétences' }],
  esthetique:      [{ h: '/competences/', i: '🧗', l: 'Compétences' }, { h: '/journal/', i: '📔', l: 'Journal' }],
  accomplissement: [{ h: '/objectifs/', i: '🎯', l: 'Objectifs' }, { h: '/plan/', i: '🌅', l: "Aujourd'hui" }, { h: '/competences/', i: '🧗', l: 'Compétences' }, { h: '/meditation/', i: '🧘', l: 'Méditation' }],
  transcendance:   [{ h: '/gratitude/', i: '🌟', l: 'Gratitude' }, { h: '/meditation/', i: '🧘', l: 'Méditation' }, { h: '/journal/', i: '📔', l: 'Journal' }],
};
const SUB_XP = 15;
const key = (document.body.getAttribute('data-branch') || 'physio');
const meta = BRANCH_META[key] || BRANCH_META.physio;

const todayStr = () => new Date().toISOString().slice(0, 10);
function T(k, fb) { const v = window.CYL && window.CYL.t && window.CYL.t(k); return (v && v !== k) ? v : (fb != null ? fb : k); }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg, cls) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.className = 'toast' + (cls ? ' ' + cls : ''); t.classList.add('show'); clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 2200); }

injectCSS();

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login/'; return; }
  uid = user.uid;
  try { updateGlobalAvatar((user.email || 'U').charAt(0).toUpperCase()); } catch (e) {}
  try { initUserMenu(); } catch (e) {}
  try { const s = await getDoc(doc(db, 'users', uid)); dim = (s.exists() && s.data().dim && typeof s.data().dim === 'object') ? s.data().dim : {}; } catch (e) { dim = {}; }
  // i18n peut arriver après : on re-render au changement de langue
  window.addEventListener('cyl:langchange', render);
  render();
});

async function doneSub(i) {
  const k = `${key}.${i}`;
  if (dim[k] === todayStr()) { toast('Déjà validé aujourd\'hui ✓'); return; }
  dim[k] = todayStr();
  render();
  try { await setDoc(doc(db, 'users', uid), { dim }, { merge: true }); } catch (e) {}
  try { const fn = window._cyfFirebase && window._cyfFirebase.awardXp; if (fn) await fn(key, SUB_XP); } catch (e) {}
  toast(`+${SUB_XP} XP · ${T('branch.' + key + '.label', key)}`, 'xp');
}

function render() {
  const root = document.getElementById('branche-root');
  if (!root) return;
  const col = meta.color;
  const label = T(`branch.${key}.label`, key);
  const desc = T(`branch.${key}.desc`, '');
  document.title = label + ' - Change Your Life';

  // sous-catégories (s1..s5)
  let subs = '';
  for (let i = 1; i <= 5; i++) {
    const name = T(`branch.${key}.s${i}.name`, '');
    const note = T(`branch.${key}.s${i}.note`, '');
    if (!name) continue;
    const done = dim[`${key}.${i}`] === todayStr();
    subs +=
      `<div class="dim-sub${done ? ' done' : ''}">` +
      `<div class="dim-sub-txt"><div class="dim-sub-name">${escapeHtml(name)}</div><div class="dim-sub-note">${escapeHtml(note)}</div></div>` +
      `<button class="dim-act" data-i="${i}">${done ? '✓ Fait' : "J'y ai consacré du temps"}</button>` +
      `</div>`;
  }

  const tools = (TOOLS[key] || []);
  const toolsHtml = tools.length
    ? tools.map((t) => `<a class="dim-tool" href="${t.h}"><span class="dim-tool-ic">${t.i}</span><span class="dim-tool-l">${t.l}</span><span class="dim-tool-go">Ouvrir →</span></a>`).join('')
    : `<div class="dim-empty">Module dédié à venir - cette dimension grandira bientôt.</div>`;

  root.innerHTML =
    `<div class="dim-head" style="--c:${col}">` +
      `<div class="dim-emoji">${meta.emoji}</div>` +
      `<div><h1 class="dim-title" style="color:${col}">${escapeHtml(label)}</h1>` +
      `<div class="dim-desc">${escapeHtml(desc)}</div></div>` +
    `</div>` +
    `<div class="dim-sec-label">Ce qui fait grandir cette branche</div>` +
    `<div class="dim-subs">${subs}</div>` +
    `<div class="dim-sec-label">Tes outils</div>` +
    `<div class="dim-tools">${toolsHtml}</div>`;

  root.style.setProperty('--c', col);
  root.querySelectorAll('.dim-act').forEach((b) => { b.onclick = () => doneSub(Number(b.dataset.i)); });
}

function injectCSS() {
  if (document.getElementById('dim-css')) return;
  const s = document.createElement('style'); s.id = 'dim-css';
  s.textContent = `
    body{color:var(--text-1,#e5eef8);}
    .page-shell{position:fixed;inset:20px;background:var(--glass-bg);backdrop-filter:blur(15px);border-radius:20px;border:1px solid var(--glass-border);padding:24px;overflow-y:auto;}
    .toast{position:fixed;top:22px;left:50%;transform:translate(-50%,-130px);background:rgba(16,185,129,.92);color:#fff;padding:10px 20px;border-radius:10px;font-weight:600;z-index:99999;transition:transform .3s ease;font-size:.88rem;box-shadow:0 8px 28px rgba(0,0,0,.35);}
    .toast.show{transform:translate(-50%,0);} .toast.xp{background:rgba(59,130,246,.92);}
    .dim-head{display:flex;align-items:center;gap:16px;margin-bottom:6px;}
    .dim-emoji{font-size:2.6rem;filter:drop-shadow(0 0 18px var(--c,#2dd4bf));}
    .dim-title{font-size:1.7rem;font-weight:800;letter-spacing:-.5px;margin:0;}
    .dim-desc{font-size:0.9rem;color:var(--text-2,#aab7cf);line-height:1.5;margin-top:3px;max-width:46rem;}
    .dim-sec-label{font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:var(--text-3,#7e9ab5);margin:24px 0 12px;}
    .dim-subs{display:flex;flex-direction:column;gap:9px;}
    .dim-sub{display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:13px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);position:relative;overflow:hidden;transition:background .18s;}
    .dim-sub::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--c,#2dd4bf);opacity:.7;}
    .dim-sub:hover{background:rgba(255,255,255,0.05);}
    .dim-sub.done{background:rgba(34,197,94,0.06);border-color:rgba(34,197,94,0.2);}
    .dim-sub-txt{flex:1;min-width:0;}
    .dim-sub-name{font-size:0.95rem;font-weight:700;color:var(--text-1,#e5eef8);}
    .dim-sub-note{font-size:0.8rem;color:var(--text-2,#aab7cf);margin-top:2px;}
    .dim-act{flex-shrink:0;padding:8px 15px;border-radius:99px;border:1px solid var(--c,#2dd4bf);background:color-mix(in srgb,var(--c,#2dd4bf) 14%,transparent);color:var(--c,#2dd4bf);font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all .18s;white-space:nowrap;}
    .dim-act:hover{filter:brightness(1.15);transform:translateY(-1px);}
    .dim-sub.done .dim-act{background:rgba(34,197,94,0.18);border-color:#22c55e;color:#86efac;}
    .dim-tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;}
    .dim-tool{display:flex;align-items:center;gap:10px;padding:13px 15px;border-radius:13px;text-decoration:none;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);transition:transform .18s,background .18s,border-color .18s;}
    .dim-tool:hover{transform:translateY(-2px);background:rgba(255,255,255,0.06);border-color:var(--c,#2dd4bf);}
    .dim-tool-ic{font-size:1.4rem;} .dim-tool-l{flex:1;font-size:0.9rem;font-weight:700;color:var(--text-1,#e5eef8);}
    .dim-tool-go{font-size:0.76rem;font-weight:700;color:var(--c,#2dd4bf);white-space:nowrap;}
    .dim-empty{font-size:0.85rem;color:var(--text-3,#7e9ab5);font-style:italic;}
    @media (max-width:600px){ .page-shell{inset:8px;padding:16px 14px;border-radius:16px;} .dim-act{padding:7px 11px;font-size:0.74rem;} }
  `;
  document.head.appendChild(s);
}
