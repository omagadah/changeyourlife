// /js/branche.js - Espace-dimension d'une branche de l'arbre.
// Une page par branche (body[data-branch]) : ses 5 sous-catégories deviennent
// des actions concrètes → awardXp(branche) → l'arbre grandit. Contenu tiré de
// l'i18n (window.CYL.t) donc traduit automatiquement.
//
// Le HTML de chaque page est minimal (un <main id="branche-root" class="page-shell">) :
// ce module y rend l'en-tête v3 (.page-head) et le corps (.page-body). Les
// libellés, icônes et couleurs des branches viennent d'organizer-data.js,
// la même source que l'ORGANIZER, l'agenda et « Aujourd'hui ».

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initUserMenu } from '/js/userMenu.js';
import { updateGlobalAvatar, setContext, toast, escapeHtml } from '/js/common.js';
import { icon, ROUTE_ICON } from '/js/icons.js';
import { BRANCH_BY_KEY } from '/js/organizer-data.js';

let auth, db, uid;
let dim = {};   // { "<branch>.<i>": "YYYY-MM-DD" } - sous-catégorie validée ce jour

if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }
try { initUserMenu(); } catch (e) {}

// Les outils d'une branche : des pages du site, donc l'icône est celle de la
// barre latérale (ROUTE_ICON), pour que la même page porte la même icône partout.
const TOOLS = {
  physio:          [{ h: '/sommeil/', l: 'Sommeil' }, { h: '/habitudes/', l: 'Habitudes' }, { h: '/plan/', l: "Aujourd'hui" }],
  securite:        [{ h: '/habitudes/', l: 'Habitudes' }, { h: '/plan/', l: "Aujourd'hui" }],
  appartenance:    [{ h: '/journal/', l: 'Journal' }, { h: '/gratitude/', l: 'Gratitude' }],
  estime:          [{ h: '/objectifs/', l: 'Objectifs' }, { h: '/autoevaluation/', l: 'Roue de vie' }, { h: '/bilan/', l: 'Bilan' }],
  cognitif:        [{ h: '/codex/', l: 'Codex' }, { h: '/journal/', l: 'Journal' }, { h: '/competences/', l: 'Compétences' }],
  esthetique:      [{ h: '/competences/', l: 'Compétences' }, { h: '/journal/', l: 'Journal' }],
  accomplissement: [{ h: '/objectifs/', l: 'Objectifs' }, { h: '/plan/', l: "Aujourd'hui" }, { h: '/competences/', l: 'Compétences' }, { h: '/meditation/', l: 'Méditation' }],
  transcendance:   [{ h: '/gratitude/', l: 'Gratitude' }, { h: '/meditation/', l: 'Méditation' }, { h: '/journal/', l: 'Journal' }],
};
const SUB_XP = 15;
const key = (document.body.getAttribute('data-branch') || 'physio');
const meta = BRANCH_BY_KEY[key] || BRANCH_BY_KEY.physio;

const todayStr = () => new Date().toISOString().slice(0, 10);
function T(k, fb) { const v = window.CYL && window.CYL.t && window.CYL.t(k); return (v && v !== k) ? v : (fb != null ? fb : k); }

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
  if (dim[k] === todayStr()) { toast('Déjà validé aujourd\'hui', { duration: 2200 }); return; }
  dim[k] = todayStr();
  render();
  try { await setDoc(doc(db, 'users', uid), { dim }, { merge: true }); } catch (e) {}
  try { const fn = window._cyfFirebase && window._cyfFirebase.awardXp; if (fn) await fn(key, SUB_XP); } catch (e) {}
  toast(`+${SUB_XP} XP · ${T('branch.' + key + '.label', meta.label)}`, { type: 'success', duration: 2200 });
}

function render() {
  const root = document.getElementById('branche-root');
  if (!root) return;
  const col = meta.color;
  const label = T(`branch.${key}.label`, meta.label);
  const desc = T(`branch.${key}.desc`, '');
  document.title = label + ' - Change Your Life';

  // sous-catégories (s1..s5)
  // La même passe alimente l'affichage ET le contexte de CYL : un seul module
  // sert les huit pages de branche, et `key` (venu de data-branch sur le body)
  // est aussi la clé de page attendue par CYL - physio, securite, etc.
  let subs = '';
  const faitesAuj = [];
  const restantes = [];
  for (let i = 1; i <= 5; i++) {
    const name = T(`branch.${key}.s${i}.name`, '');
    const note = T(`branch.${key}.s${i}.note`, '');
    if (!name) continue;
    const done = dim[`${key}.${i}`] === todayStr();
    (done ? faitesAuj : restantes).push(name);
    subs +=
      `<div class="dim-sub${done ? ' done' : ''}">` +
      `<div class="dim-sub-txt"><div class="dim-sub-name">${escapeHtml(name)}</div><div class="dim-sub-note">${escapeHtml(note)}</div></div>` +
      `<button type="button" class="btn sm dim-act" data-i="${i}" aria-pressed="${done ? 'true' : 'false'}">` +
      (done ? `${icon('check', { size: 14 })}Fait` : "J'y ai consacré du temps") +
      `</button>` +
      `</div>`;
  }

  setContext(key, {
    'branche affichee': label,
    'sous-categories nourries aujourd hui': faitesAuj.length ? faitesAuj : 'aucune pour le moment',
    'sous-categories en attente': restantes,
  });

  const tools = (TOOLS[key] || []);
  const toolsHtml = tools.length
    ? tools.map((t) => `<a class="dim-tool" href="${t.h}"><span class="dim-tool-ic">${icon(ROUTE_ICON[t.h] || 'dot')}</span><span class="dim-tool-l">${escapeHtml(t.l)}</span><span class="dim-tool-go">${icon('arrowRight', { size: 14 })}</span></a>`).join('')
    : `<div class="empty"><span class="empty-ic">${icon('sapling')}</span><h3>Module dédié à venir</h3><p>Cette dimension grandira bientôt avec ses propres outils.</p></div>`;

  root.innerHTML =
    `<header class="page-head">` +
      `<div class="page-head-id">` +
        `<h1 id="page-title"><span class="ic dim-ic">${icon(meta.ic || 'leaf', { size: 22 })}</span>${escapeHtml(label)}</h1>` +
        (desc ? `<p class="page-sub">${escapeHtml(desc)}</p>` : '') +
      `</div>` +
    `</header>` +
    `<div class="page-body">` +
      `<div class="sec-label">Ce qui fait grandir cette branche</div>` +
      `<div class="dim-subs">${subs || `<div class="empty"><p>Les sous-catégories de cette branche arrivent avec la traduction.</p></div>`}</div>` +
      `<div class="sec-label">Tes outils</div>` +
      `<div class="dim-tools">${toolsHtml}</div>` +
    `</div>`;

  root.style.setProperty('--c', col);
  root.setAttribute('aria-labelledby', 'page-title');
  root.querySelectorAll('.dim-act').forEach((b) => { b.onclick = () => doneSub(Number(b.dataset.i)); });
}

function injectCSS() {
  if (document.getElementById('dim-css')) return;
  const s = document.createElement('style'); s.id = 'dim-css';
  // Uniquement ce qui est propre au contenu : le cadre, l'en-tête, les
  // boutons et les états vides viennent de main.min.css. La couleur de la
  // branche vit dans --c, posée sur le cadre par render().
  s.textContent = `
    .page-head h1 .dim-ic { color:var(--c, var(--leaf-text)); }
    .dim-subs { display:flex; flex-direction:column; gap:9px; }
    .dim-sub { display:flex; align-items:center; gap:14px; padding:13px 16px; border-radius:var(--r); background:var(--surface-1); border:1px solid var(--line); position:relative; overflow:hidden; }
    .dim-sub::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--c, var(--leaf)); }
    .dim-sub:hover { background:var(--surface-2); }
    .dim-sub.done { background:rgba(132,194,94,.08); border-color:rgba(132,194,94,.3); }
    .dim-sub-txt { flex:1; min-width:0; }
    .dim-sub-name { font-size:.95rem; font-weight:600; color:var(--text-1); }
    .dim-sub-note { font-size:.82rem; color:var(--text-2); margin-top:2px; }
    .dim-act { flex-shrink:0; min-height:36px; border-color:color-mix(in srgb, var(--c, var(--leaf)) 55%, transparent); color:var(--c, var(--leaf-text)); white-space:nowrap; }
    .dim-act:hover { background:color-mix(in srgb, var(--c, var(--leaf)) 14%, transparent); }
    .dim-sub.done .dim-act { background:rgba(132,194,94,.14); border-color:rgba(132,194,94,.4); color:var(--leaf-text); }
    .dim-tools { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }
    .dim-tool { display:flex; align-items:center; gap:10px; min-height:44px; padding:12px 15px; border-radius:var(--r); text-decoration:none; background:var(--surface-1); border:1px solid var(--line); color:var(--text-1); transition:background var(--duration), border-color var(--duration); }
    .dim-tool:hover { background:var(--surface-2); border-color:var(--c, var(--line-strong)); }
    .dim-tool-ic { display:inline-flex; color:var(--c, var(--leaf-text)); }
    .dim-tool-l { flex:1; font-size:.9rem; font-weight:600; }
    .dim-tool-go { display:inline-flex; color:var(--text-3); }
    @media (max-width:640px) { .dim-sub { flex-wrap:wrap; } .dim-act { width:100%; } }
  `;
  document.head.appendChild(s);
}
