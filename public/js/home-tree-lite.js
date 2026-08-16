// /js/home-tree-lite.js - L'arbre de l'accueil, version telephone.
//
// Meme metaphore, meme lecture, 0 octet telecharge : un SVG dessine a la main
// plutot que 7,8 Mo de WebGL (ez-tree 3,9 + three 0,7 + textures 3,1).
// Les 8 branches Maslow sont la, colorees, cliquables, et ouvrent le meme
// panneau que la version 3D. On perd le relief, pas le sens.
//
// Charge UNIQUEMENT quand <html> porte la classe `lite` (cf. index.html).

const BRANCHES = [
  // x/y en pourcentage du viewBox 100x100 - places sur la silhouette de l'arbre
  { key: 'physio',          label: 'Physiologique',   color: '#84c25e', x: 30, y: 62,
    desc: 'Le socle : ce que ton corps réclame pour tenir debout.',
    subs: [['Sommeil', 'Récupérer vraiment.'], ['Nutrition', 'Se nourrir, pas se remplir.'], ['Hydratation', 'La base qu\'on oublie.'], ['Mouvement', 'Le corps aime bouger.'], ['Repos', 'S\'arrêter avant de casser.']] },
  { key: 'securite',        label: 'Sécurité',        color: '#e7b15c', x: 70, y: 60,
    desc: 'Le calme de savoir que demain tient debout.',
    subs: [['Logement', 'Un endroit à soi.'], ['Stabilité', 'Moins d\'imprévus subis.'], ['Finances', 'Respirer côté argent.'], ['Santé', 'S\'occuper de soi à temps.'], ['Sérénité', 'Dormir tranquille.']] },
  { key: 'appartenance',    label: 'Appartenance',    color: '#e0785f', x: 20, y: 46,
    desc: 'Les liens qui font qu\'on n\'est pas seul.',
    subs: [['Famille', 'Ceux d\'où tu viens.'], ['Amis', 'Ceux que tu choisis.'], ['Amour', 'Compter pour quelqu\'un.'], ['Empathie', 'Prendre des nouvelles.'], ['Communauté', 'Faire partie de.']] },
  { key: 'estime',          label: 'Estime',          color: '#c39a6b', x: 80, y: 44,
    desc: 'Se sentir capable, et reconnu pour ce qu\'on fait.',
    subs: [['Confiance', 'Oser prendre sa place.'], ['Compétence', 'Savoir faire.'], ['Réussite', 'Mener à bien.'], ['Reconnaissance', 'Être vu.'], ['Fierté', 'Se retourner sans rougir.']] },
  { key: 'cognitif',        label: 'Cognitif',        color: '#9d8ec4', x: 33, y: 30,
    desc: 'Le besoin de savoir, de comprendre, d\'explorer.',
    subs: [['Savoir', 'Nourrir l\'esprit.'], ['Curiosité', 'Le moteur de tout.'], ['Compréhension', 'Relier les choses.'], ['Apprentissage', 'Grandir, toujours.'], ['Lucidité', 'Penser net.']] },
  { key: 'esthetique',      label: 'Esthétique',      color: '#d98cae', x: 67, y: 28,
    desc: 'Le beau, l\'ordre, ce qui donne envie de regarder.',
    subs: [['Beauté', 'Ce qui élève.'], ['Harmonie', 'Un espace qui apaise.'], ['Ordre', 'Moins de bruit.'], ['Créativité', 'Faire exister.'], ['Émerveillement', 'Rester saisissable.']] },
  { key: 'accomplissement', label: 'Accomplissement', color: '#6f9a52', x: 44, y: 17,
    desc: 'Devenir ce que tu peux devenir.',
    subs: [['Croissance', 'Ne pas stagner.'], ['Projets', 'Faire advenir.'], ['Maîtrise', 'Aller au bout.'], ['Authenticité', 'Être aligné.'], ['Vision', 'Savoir où tu vas.']] },
  { key: 'transcendance',   label: 'Transcendance',   color: '#f1cd92', x: 57, y: 10,
    desc: 'Ce qui te dépasse, et ce que tu laisses.',
    subs: [['Spiritualité', 'Plus grand que soi.'], ['Contribution', 'Être utile.'], ['Sens', 'Pourquoi tout ça.'], ['Transmission', 'Passer le relais.'], ['Héritage', 'Laisser une trace.']] },
];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function injectCSS() {
  if (document.getElementById('cyl-lite-tree-css')) return;
  const s = document.createElement('style');
  s.id = 'cyl-lite-tree-css';
  s.textContent = `
    .lt-stage{position:absolute;left:0;right:0;bottom:clamp(120px,20vh,190px);top:clamp(300px,40vh,420px);
      z-index:2;display:flex;align-items:center;justify-content:center;pointer-events:none;}
    .lt-svg{width:min(92vw,460px);height:100%;overflow:visible;pointer-events:auto;}
    .lt-trunk{stroke:#6b4a2a;stroke-linecap:round;fill:none;}
    .lt-canopy{fill:rgba(74,122,58,0.20);stroke:rgba(132,194,94,0.22);stroke-width:0.4;}
    .lt-node{cursor:pointer;transition:transform .18s ease;transform-box:fill-box;transform-origin:center;}
    .lt-node:hover,.lt-node:focus-visible{transform:scale(1.18);outline:none;}
    .lt-node circle{filter:drop-shadow(0 0 6px currentColor);}
    .lt-node text{font:700 3.1px -apple-system,"Segoe UI",Roboto,sans-serif;
      fill:var(--text-1,#f4efe1);text-anchor:middle;letter-spacing:.18px;
      paint-order:stroke;stroke:rgba(6,10,5,0.85);stroke-width:0.9px;}
    .lt-hint{position:absolute;left:0;right:0;bottom:-2px;text-align:center;
      font-size:0.7rem;letter-spacing:1.1px;text-transform:uppercase;
      color:var(--text-3,#7c7660);pointer-events:none;}
    @media (prefers-reduced-motion:no-preference){
      .lt-breathe{animation:ltBreathe 5.5s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
      @keyframes ltBreathe{0%,100%{opacity:.85}50%{opacity:1}}
    }
  `;
  document.head.appendChild(s);
}

// Panneau : on reutilise celui du HTML (#branch-panel) pour garder un seul
// composant, un seul style, un seul comportement de fermeture.
function openPanel(b) {
  const panel = document.getElementById('branch-panel');
  if (!panel) return;
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('bp-dot', (el) => { el.style.background = b.color; });
  set('bp-title', (el) => { el.textContent = b.label; el.style.color = b.color; });
  set('bp-desc', (el) => { el.textContent = b.desc; });
  set('bp-subs', (el) => {
    el.innerHTML = b.subs.map(([n, note], i) =>
      `<div class="bp-sub" style="animation-delay:${(0.12 + i * 0.09).toFixed(2)}s">
         <span class="bp-sub-dot" style="background:${b.color}"></span>
         <span class="bp-sub-txt"><b>${esc(n)}</b>${esc(note)}</span>
       </div>`).join('');
  });
  set('bp-modules', (el) => { el.textContent = ''; });
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
}

function closePanel() {
  const panel = document.getElementById('branch-panel');
  if (!panel) return;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

function build() {
  const scene = document.querySelector('.scene');
  if (!scene || document.querySelector('.lt-stage')) return;
  injectCSS();

  const stage = document.createElement('div');
  stage.className = 'lt-stage';

  const nodes = BRANCHES.map((b, i) => `
    <g class="lt-node" data-i="${i}" tabindex="0" role="button"
       aria-label="${esc(b.label)}" style="color:${b.color}">
      <circle cx="${b.x}" cy="${b.y}" r="2.4" fill="${b.color}" class="lt-breathe"/>
      <circle cx="${b.x}" cy="${b.y}" r="5.2" fill="transparent"/>
      <text x="${b.x}" y="${b.y - 4.2}">${esc(b.label.toUpperCase())}</text>
    </g>`).join('');

  stage.innerHTML = `
    <svg class="lt-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
         role="img" aria-label="Ton arbre de vie et ses huit branches">
      <ellipse class="lt-canopy" cx="50" cy="38" rx="42" ry="34"/>
      <ellipse class="lt-canopy" cx="36" cy="48" rx="24" ry="20"/>
      <ellipse class="lt-canopy" cx="66" cy="45" rx="22" ry="18"/>
      <path class="lt-trunk" stroke-width="3.4" d="M50 100 L50 66"/>
      <path class="lt-trunk" stroke-width="2"   d="M50 74 C42 70 34 66 30 62"/>
      <path class="lt-trunk" stroke-width="2"   d="M50 72 C58 68 66 64 70 60"/>
      <path class="lt-trunk" stroke-width="1.5" d="M50 64 C38 58 26 52 20 46"/>
      <path class="lt-trunk" stroke-width="1.5" d="M50 62 C62 56 74 50 80 44"/>
      <path class="lt-trunk" stroke-width="1.2" d="M50 56 C44 46 36 38 33 30"/>
      <path class="lt-trunk" stroke-width="1.2" d="M50 55 C56 44 63 36 67 28"/>
      <path class="lt-trunk" stroke-width="1"   d="M50 50 C48 38 46 26 44 17"/>
      <path class="lt-trunk" stroke-width="1"   d="M50 48 C52 34 55 20 57 10"/>
      ${nodes}
    </svg>
    <div class="lt-hint">Touche une branche</div>`;

  scene.appendChild(stage);

  stage.querySelectorAll('.lt-node').forEach((g) => {
    const b = BRANCHES[Number(g.dataset.i)];
    const go = () => openPanel(b);
    g.addEventListener('click', go);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });

  const cl = document.getElementById('bp-close');
  if (cl) cl.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', build, { once: true });
} else {
  build();
}
