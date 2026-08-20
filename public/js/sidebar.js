// /js/sidebar.js - La barre de navigation verticale du site.
//
// Modele : Vercel, GitHub. Une colonne fixe a gauche, toujours la, qui repond
// a deux questions en permanence : OU SUIS-JE, et OU PUIS-JE ALLER.
// Avant, la navigation tenait dans trois pastilles flottantes en haut a droite
// (langue, theme, avatar) qui ne disaient ni l'un ni l'autre.
//
// Principe d'implementation : la barre n'invente rien, elle ADOPTE.
// Le selecteur de langue (i18n.js), le bouton de theme et le menu utilisateur
// (userMenu.js) continuent d'etre crees par leurs modules ; la barre les
// deplace dans son pied de page quand ils apparaissent. Aucun doublon, aucune
// logique dupliquee, et les autres pages continuent de fonctionner sans elle.

// La navigation suit le PARCOURS, pas l'ordre de construction des modules :
//   ce que j'ai en tete -> quand -> ou je vais -> ce que ca donne de moi.
const NAV = [
  { href: '/app/',          icon: '🌳', label: 'Mon espace',   note: 'Vue d\'ensemble' },
  { href: '/organizer/',    icon: '🗂️', label: 'ORGANIZER',    note: 'Tes idées, triées' },
  { href: '/agenda/',       icon: '🗓️', label: 'Agenda',       note: 'Ce qui a une date' },
  { href: '/plan/',         icon: '🌅', label: "Aujourd'hui",  note: 'Rythme du jour' },
  { href: '/objectifs/',    icon: '🎯', label: 'Objectifs',    note: 'Où tu vas' },
];
// Ce que le site conclut de toi. On ne s'y modifie pas : on s'y lit.
const NAV_LECTURE = [
  { href: '/yourlife/',    icon: '🪜', label: 'Où j\'en suis', note: 'Ta position, vue par CYL' },
  { href: '/frise/',       icon: '🌊', label: 'Frise chronologique', note: 'D\'où tu viens, où tu vas' },
  { href: '/competences/', icon: '🧗', label: 'Compétences',  note: 'Ce que tu sais faire' },
  { href: '/bilan/',       icon: '📊', label: 'Bilan',        note: 'Ta semaine, résumée' },
];
const NAV_MORE = [
  { href: '/journal/',        icon: '📔', label: 'Journal' },
  { href: '/habitudes/',      icon: '✅', label: 'Habitudes' },
  { href: '/meditation/',     icon: '🧘', label: 'Méditation' },
  { href: '/humeur/',         icon: '😌', label: 'Humeur' },
  { href: '/sommeil/',        icon: '🌙', label: 'Sommeil' },
  { href: '/gratitude/',      icon: '🌟', label: 'Gratitude' },
  { href: '/codex/',          icon: '📚', label: 'Codex' },
  { href: '/autoevaluation/', icon: '🎡', label: 'Roue de vie' },
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LOGO = `<svg viewBox="0 0 200 120" aria-hidden="true" focusable="false">
  <g stroke-width="3">
    <circle cx="60" cy="60" r="40" fill="black" stroke="#84c25e" stroke-width="8"/>
    <line x1="100" y1="60" x2="130" y2="30" stroke="white"/>
    <line x1="100" y1="60" x2="130" y2="60" stroke="white"/>
    <line x1="100" y1="60" x2="130" y2="90" stroke="white"/>
    <circle cx="150" cy="30" r="18" fill="none" stroke="white"/>
    <circle cx="150" cy="60" r="18" fill="none" stroke="white"/>
    <circle cx="150" cy="90" r="18" fill="none" stroke="white"/>
  </g></svg>`;

function currentPath() {
  let p = window.location.pathname;
  if (!p.endsWith('/')) p += '/';
  return p;
}

function injectCSS() {
  if (document.getElementById('cyl-sb-css')) return;
  const s = document.createElement('style');
  s.id = 'cyl-sb-css';
  s.textContent = `
  :root { --sb-w: 232px; }
  .cyl-sb {
    position:fixed; top:0; left:0; bottom:0; width:var(--sb-w); z-index:9800;
    display:flex; flex-direction:column;
    background:var(--bg-surface,#0f1710); border-right:1px solid var(--line,rgba(221,205,160,.12));
    font-family:inherit;
  }
  .cyl-sb-top { display:flex; align-items:center; gap:10px; padding:14px 14px 12px; }
  .cyl-sb-logo { width:32px; height:32px; flex-shrink:0; }
  .cyl-sb-logo svg { width:100%; height:100%; display:block; border-radius:7px; }
  .cyl-sb-name { font-size:.9rem; font-weight:800; letter-spacing:-.2px; color:var(--text-1,#f4efe1); line-height:1.1; }
  .cyl-sb-name small { display:block; font-size:.62rem; font-weight:600; letter-spacing:.07em;
    text-transform:uppercase; color:var(--text-3,#7c7660); margin-top:2px; }

  /* overflow-x:hidden : sans lui, un libellé un peu long ferait apparaître une
     barre horizontale et le même tremblement que dans l'ORGANIZER. */
  .cyl-sb-nav { flex:1; overflow-y:auto; overflow-x:hidden;
    overscroll-behavior:contain; scrollbar-gutter:stable; padding:4px 8px 8px; }
  .cyl-sb-sec { font-size:.6rem; font-weight:800; letter-spacing:.09em; text-transform:uppercase;
    color:var(--text-3,#7c7660); padding:12px 8px 5px; }
  .cyl-sb-i { display:flex; align-items:center; gap:10px; padding:8px 9px; border-radius:10px;
    text-decoration:none; color:var(--text-2,#b4ad94); transition:background .16s,color .16s; }
  .cyl-sb-i:hover { background:var(--surface-2,rgba(255,255,255,.05)); color:var(--text-1,#f4efe1); }
  .cyl-sb-i.on { background:rgba(132,194,94,.14); color:var(--leaf,#84c25e);
    box-shadow:inset 0 0 0 1px rgba(132,194,94,.26); }
  .cyl-sb-i.on .cyl-sb-l { font-weight:800; }
  .cyl-sb-ic { font-size:1.02rem; width:20px; text-align:center; flex-shrink:0; }
  .cyl-sb-txt { min-width:0; flex:1; }
  .cyl-sb-l { display:block; font-size:.83rem; font-weight:600; line-height:1.2;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cyl-sb-n { display:block; font-size:.66rem; color:var(--text-3,#7c7660); margin-top:1px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cyl-sb-i.on .cyl-sb-n { color:rgba(132,194,94,.7); }

  /* Pied : XP + les controles adoptes (langue, theme, compte) */
  .cyl-sb-foot { border-top:1px solid var(--line,rgba(221,205,160,.12)); padding:10px 12px 12px;
    display:flex; flex-direction:column; gap:9px; }
  .cyl-sb-xp { display:flex; align-items:center; gap:7px; padding:7px 10px; border-radius:10px;
    background:rgba(231,177,92,.10); border:1px solid rgba(231,177,92,.28);
    font-size:.8rem; font-weight:800; color:var(--gold-soft,#f1cd92); }
  .cyl-sb-xp small { margin-left:auto; font-size:.62rem; font-weight:600; color:var(--text-3,#7c7660);
    text-transform:uppercase; letter-spacing:.06em; }
  .cyl-sb-ctl { display:flex; align-items:center; gap:8px; }

  /* Les modules posent leurs elements en position:fixed. Une fois adoptes par
     la barre, ils redeviennent des elements de flux normal. */
  .cyl-sb-ctl > * { position:static !important; top:auto !important; right:auto !important;
    left:auto !important; margin:0 !important; }
  .cyl-sb-ctl .lang-pop { position:absolute !important; bottom:calc(100% + 10px); top:auto !important;
    left:0 !important; right:auto !important; }

  /* Le contenu des pages se decale d'autant.
     La barre horizontale des pages internes (.site-nav) et le logo flottant
     (.header) faisaient exactement le meme travail que la barre : on ne garde
     qu'une seule navigation, et on rend aux pages la hauteur liberee. */
  body.has-sb { padding-left:var(--sb-w); }
  body.has-sb .site-nav, body.has-sb .header { display:none !important; }
  /* Le menu deroulant historique s'ancrait en haut a droite : sans declencheur
     visible, il ne peut plus s'ouvrir, mais on le neutralise explicitement. */
  body.has-sb #cyf-user-menu { display:none !important; }

  /* Compte : avatar, identite, parametres, deconnexion - a plat, pas dans un menu */
  .cyl-sb-me { display:flex; align-items:center; gap:10px; padding:7px 9px; border-radius:10px;
    text-decoration:none; color:var(--text-2,#b4ad94); transition:background .16s,color .16s; }
  .cyl-sb-me:hover { background:var(--surface-2,rgba(255,255,255,.05)); color:var(--text-1,#f4efe1); }
  .cyl-sb-me.on { background:rgba(132,194,94,.14); color:var(--leaf,#84c25e); }
  .cyl-sb-av { width:26px; height:26px; border-radius:50%; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:.76rem; font-weight:800; color:#08130a;
    background:linear-gradient(140deg,#f1cd92,#84c25e); background-size:cover; background-position:center; }
  .cyl-sb-av.img { color:transparent; }
  .cyl-sb-out { width:100%; border:none; background:none; font:inherit; cursor:pointer; text-align:left; }
  .cyl-sb-out:hover { background:rgba(224,120,95,.12); color:#e58e73; }
  /* DECALAGE DES CONTENEURS PLEIN ECRAN
     Les pages posent leur cadre en position:fixed : padding-left sur le body
     ne les touche pas, il faut nommer chaque conteneur. Une page qui invente sa
     propre classe passe donc SOUS la barre - c'est arrive a /frise/.
     [data-cyl-shell] est la porte de sortie : toute nouvelle page pose cet
     attribut sur son cadre et herite du decalage sans toucher a ce fichier. */
  body.has-sb .app-container { left:calc(var(--sb-w) + 15px) !important; }
  body.has-sb .ap-shell,
  body.has-sb [data-cyl-shell] {
    inset:16px 16px 16px calc(var(--sb-w) + 16px) !important;
  }
  body.has-sb .page-shell, body.has-sb .page-shell-nav {
    inset:20px 20px 20px calc(var(--sb-w) + 20px) !important;
  }

  /* Bouton d'ouverture sur petit ecran */
  .cyl-sb-burger { position:fixed; top:12px; left:12px; z-index:9900; width:38px; height:38px;
    border-radius:11px; border:1px solid var(--line,rgba(221,205,160,.12)); cursor:pointer;
    background:var(--bg-surface,#0f1710); color:var(--text-1,#f4efe1); font-size:1.1rem;
    display:none; align-items:center; justify-content:center; }
  .cyl-sb-veil { position:fixed; inset:0; z-index:9790; background:rgba(5,8,4,.6);
    display:none; }

  @media (max-width:1080px) {
    .cyl-sb { transform:translateX(-100%); transition:transform .26s cubic-bezier(.4,0,.2,1);
      box-shadow:0 0 60px rgba(0,0,0,.5); }
    body.sb-open .cyl-sb { transform:none; }
    body.sb-open .cyl-sb-veil { display:block; }
    .cyl-sb-burger { display:flex; }
    body.has-sb { padding-left:0; }
    body.has-sb .app-container { left:15px !important; }
    body.has-sb .ap-shell,
    body.has-sb [data-cyl-shell] { inset:60px 8px 8px !important; }
    body.has-sb .page-shell, body.has-sb .page-shell-nav { inset:60px 8px 8px !important; }
    /* la ligne d'accueil laisse la place au bouton d'ouverture */
    body.has-sb .welcome-row { padding-left:46px; }
  }
  @media (prefers-reduced-motion:reduce) { .cyl-sb { transition:none; } }
  `;
  document.head.appendChild(s);
}

function item(o, path, withNote) {
  const on = path === o.href;
  return `<a class="cyl-sb-i${on ? ' on' : ''}" href="${o.href}"${on ? ' aria-current="page"' : ''}>
    <span class="cyl-sb-ic" aria-hidden="true">${o.icon}</span>
    <span class="cyl-sb-txt"><span class="cyl-sb-l">${esc(o.label)}</span>
    ${withNote && o.note ? `<span class="cyl-sb-n">${esc(o.note)}</span>` : ''}</span>
  </a>`;
}

// Les contrôles sont créés par d'autres modules, à des moments qu'on ne
// maîtrise pas. On les récupère dès qu'ils apparaissent, puis on arrête.
// On N'ADOPTE PAS `.user-panel-trigger` : ce bouton ouvrait un menu déroulant
// ancré en haut à droite, à l'opposé de l'écran par rapport à l'avatar, ce qui
// n'avait plus aucun sens une fois l'avatar descendu à gauche. Le pied de la
// barre expose directement les trois actions que ce menu contenait : profil,
// paramètres, déconnexion. Un clic de moins, et on voit où l'on va.
function adopt(host) {
  const SEL = ['.lang-switch--floating', '#cyf-theme-toggle'];
  let left = SEL.length;
  const grab = () => {
    SEL.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el && el.parentElement !== host) { host.appendChild(el); left--; }
    });
    return left <= 0;
  };
  if (grab()) return;
  const obs = new MutationObserver(() => { if (grab()) obs.disconnect(); });
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 15000);   // filet : on n'observe pas indéfiniment
}

// Avatar + identite + deconnexion, directement dans le pied.
async function initAccount(sb) {
  const av = sb.querySelector('#cyl-sb-av');
  const nm = sb.querySelector('#cyl-sb-me-n');
  const out = sb.querySelector('#cyl-sb-out');

  // L'avatar enregistre localement s'affiche tout de suite, sans attendre Firebase.
  try {
    const url = localStorage.getItem('userAvatarUrl');
    if (url && av) { av.style.backgroundImage = `url("${CSS.escape ? url.replace(/"/g, '%22') : url}")`; av.classList.add('img'); }
  } catch (_) {}

  let auth = null;
  try {
    if (window._cyfFirebase) ({ auth } = window._cyfFirebase);
    else { await import('/js/firebase.js'); ({ auth } = window._cyfFirebase); }
  } catch (_) { return; }
  if (!auth) return;

  const { onAuthStateChanged, signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const label = user.displayName || (user.email || '').split('@')[0] || 'Mon profil';
    if (nm) nm.textContent = label;
    if (av && !av.classList.contains('img')) av.textContent = label.charAt(0).toUpperCase();
  });

  if (out) out.onclick = async () => {
    if (!window.confirm('Se déconnecter de ChangeYourLife ?')) return;
    try { await signOut(auth); } catch (_) {}
    window.location.href = '/login';
  };
}

export function initSidebar() {
  if (document.querySelector('.cyl-sb')) return;
  injectCSS();
  const path = currentPath();

  const sb = document.createElement('nav');
  sb.className = 'cyl-sb';
  sb.setAttribute('aria-label', 'Navigation principale');
  sb.innerHTML = `
    <a class="cyl-sb-top" href="/app/" style="text-decoration:none">
      <span class="cyl-sb-logo">${LOGO}</span>
      <span class="cyl-sb-name">ChangeYourLife<small>Ton espace</small></span>
    </a>
    <div class="cyl-sb-nav">
      ${NAV.map((o) => item(o, path, true)).join('')}
      <div class="cyl-sb-sec">Ce que ça dit de toi</div>
      ${NAV_LECTURE.map((o) => item(o, path, true)).join('')}
      <div class="cyl-sb-sec">Modules</div>
      ${NAV_MORE.map((o) => item(o, path, false)).join('')}
    </div>
    <div class="cyl-sb-foot">
      <div class="cyl-sb-xp">⚡ <span id="cyl-sb-xp">0 XP</span><small>total</small></div>
      <a class="cyl-sb-me${path === '/profile/' ? ' on' : ''}" href="/profile/">
        <span class="cyl-sb-av" id="cyl-sb-av" aria-hidden="true"></span>
        <span class="cyl-sb-txt"><span class="cyl-sb-l" id="cyl-sb-me-n">Mon profil</span>
          <span class="cyl-sb-n">Voir et modifier</span></span>
      </a>
      <a class="cyl-sb-i${path === '/settings/' ? ' on' : ''}" href="/settings/">
        <span class="cyl-sb-ic" aria-hidden="true">⚙️</span>
        <span class="cyl-sb-txt"><span class="cyl-sb-l">PARAMÈTRES</span></span>
      </a>
      <button class="cyl-sb-i cyl-sb-out" id="cyl-sb-out" type="button">
        <span class="cyl-sb-ic" aria-hidden="true">↪</span>
        <span class="cyl-sb-txt"><span class="cyl-sb-l">Se déconnecter</span></span>
      </button>
      <div class="cyl-sb-ctl" id="cyl-sb-ctl"></div>
    </div>`;

  const veil = document.createElement('div');
  veil.className = 'cyl-sb-veil';
  const burger = document.createElement('button');
  burger.className = 'cyl-sb-burger';
  burger.type = 'button';
  burger.setAttribute('aria-label', 'Ouvrir la navigation');
  burger.textContent = '☰';

  document.body.appendChild(sb);
  document.body.appendChild(veil);
  document.body.appendChild(burger);
  document.body.classList.add('has-sb');

  const close = () => document.body.classList.remove('sb-open');
  burger.onclick = () => document.body.classList.toggle('sb-open');
  veil.onclick = close;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  sb.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));

  adopt(sb.querySelector('#cyl-sb-ctl'));
  initAccount(sb);

  // L'XP est calculé par app.js sur /app/ ; ailleurs on le lit sur le document
  // s'il existe. La barre ne recalcule rien, elle reflète.
  const sync = () => {
    const src = document.getElementById('xp-corner-val');
    const dst = document.getElementById('cyl-sb-xp');
    if (src && dst) dst.textContent = src.textContent;
  };
  sync();
  document.addEventListener('cyl:xp-gained', () => setTimeout(sync, 60));
  const xpObs = new MutationObserver(sync);
  const src = document.getElementById('xp-corner-val');
  if (src) xpObs.observe(src, { childList: true, characterData: true, subtree: true });
}
