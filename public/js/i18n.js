// /js/i18n.js — Internationalisation de l'accueil + sélecteur de langue.
//
// Principe : chaque texte traduisible porte un attribut data-i18n="clé"
// (textContent), data-i18n-html="clé" (innerHTML, pour <br>/<strong>) ou
// data-i18n-ph="clé" (placeholder). Au chargement et à chaque changement de
// langue, on parcourt le DOM et on remplace. La 3D (Lya, stades) lit les
// chaînes via window.CYL.t(). Choix mémorisé dans localStorage.
//
// Ajouter une langue = ajouter une entrée dans LANGS + un bloc dans DICT.
// Les langues plus « exotiques » se branchent ainsi en quelques lignes ;
// le sélecteur a déjà la recherche pour absorber une longue liste.

// ── Drapeaux (SVG inline → s'affichent partout, y compris Windows où les
//    emojis drapeaux 🇫🇷 ne sont pas rendus). ──────────────────────────────
const FLAGS = {
  fr: '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><rect width="1" height="2" fill="#002654"/><rect x="2" width="1" height="2" fill="#ce1126"/></svg>',
  en: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#012169"/><path d="M0,0 60,40 M60,0 0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 60,40" stroke="#C8102E" stroke-width="4"/><path d="M60,0 0,40" stroke="#C8102E" stroke-width="4"/><path d="M30,0 V40 M0,20 H60" stroke="#fff" stroke-width="12"/><path d="M30,0 V40 M0,20 H60" stroke="#C8102E" stroke-width="7"/></svg>',
  es: '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#AA151B"/><rect y="0.5" width="3" height="1" fill="#F1BF00"/></svg>',
  de: '<svg viewBox="0 0 3 3"><rect width="3" height="3" fill="#000"/><rect y="1" width="3" height="1" fill="#DD0000"/><rect y="2" width="3" height="1" fill="#FFCE00"/></svg>',
  it: '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><rect width="1" height="2" fill="#009246"/><rect x="2" width="1" height="2" fill="#CE2B37"/></svg>',
  pt: '<svg viewBox="0 0 5 3"><rect width="5" height="3" fill="#DA291C"/><rect width="2" height="3" fill="#046A38"/><circle cx="2" cy="1.5" r="0.5" fill="#FFE000" stroke="#DA291C" stroke-width="0.12"/></svg>',
  nl: '<svg viewBox="0 0 3 3"><rect width="3" height="3" fill="#fff"/><rect width="3" height="1" fill="#AE1C28"/><rect y="2" width="3" height="1" fill="#21468B"/></svg>',
};

// ── Registre des langues proposées (ordre = ordre d'affichage). ─────────────
export const LANGS = [
  { code: 'fr', label: 'Français',   en: 'French',  dir: 'ltr' },
  { code: 'en', label: 'English',    en: 'English', dir: 'ltr' },
  { code: 'es', label: 'Español',    en: 'Spanish', dir: 'ltr' },
  { code: 'de', label: 'Deutsch',    en: 'German',  dir: 'ltr' },
  { code: 'it', label: 'Italiano',   en: 'Italian', dir: 'ltr' },
  { code: 'pt', label: 'Português',  en: 'Portuguese', dir: 'ltr' },
  { code: 'nl', label: 'Nederlands', en: 'Dutch',   dir: 'ltr' },
];

// ── Dictionnaires ───────────────────────────────────────────────────────────
const DICT = {
  fr: {
    'nav.login': 'Se connecter',
    'hero.eyebrow': 'Ta vie, devenue vivante',
    'hero.title': 'Chaque action te fait grandir.<br>Pour de vrai.',
    'hero.desc': 'Une méditation, une nuit complète, un appel à un proche… <strong>chaque geste de ta vie réelle fait pousser ton arbre.</strong> Tout est relié — et Lya, ton coach, t\'accompagne à chaque pas.',
    'stream.caption': 'Tes actions, dans la vraie vie',
    'cta.start': 'Commencer l\'aventure',
    'lya.voice': 'Voix de Lya',
    'lya.intro1': 'Bonjour, je suis Lya. Ravie de te rencontrer.',
    'lya.intro2': 'Regarde : chaque chose que tu fais dans ta vraie vie fait pousser ton arbre.',
    'lya.intro3': 'Le voilà épanoui. Touche une branche pour voir ce qui la nourrit.',
    'lya.branch': '%s — voici ce qui fait grandir cette branche.',
    'stage.sprout': 'Jeune pousse',
    'stage.young': 'Jeune arbre',
    'stage.mature': 'Arbre mature',
    'stage.old': 'Arbre centenaire',
    'ui.langTitle': 'Choisis ta langue',
    'ui.langSearch': 'Rechercher une langue',
    'ui.langNone': 'Aucune langue trouvée',
  },
  en: {
    'nav.login': 'Sign in',
    'hero.eyebrow': 'Your life, brought to life',
    'hero.title': 'Every action makes you grow.<br>For real.',
    'hero.desc': 'A meditation, a full night\'s sleep, a call to a loved one… <strong>every act of your real life makes your tree grow.</strong> Everything is connected — and Lya, your coach, walks with you every step.',
    'stream.caption': 'Your actions, in real life',
    'cta.start': 'Begin the journey',
    'lya.voice': 'Lya\'s voice',
    'lya.intro1': 'Hello, I\'m Lya. So glad to meet you.',
    'lya.intro2': 'Look: everything you do in your real life makes your tree grow.',
    'lya.intro3': 'There it is, in full bloom. Tap a branch to see what feeds it.',
    'lya.branch': '%s — here\'s what makes this branch grow.',
    'stage.sprout': 'Sprout',
    'stage.young': 'Young tree',
    'stage.mature': 'Mature tree',
    'stage.old': 'Ancient tree',
    'ui.langTitle': 'Choose your language',
    'ui.langSearch': 'Search a language',
    'ui.langNone': 'No language found',
  },
  es: {
    'nav.login': 'Iniciar sesión',
    'hero.eyebrow': 'Tu vida, cobra vida',
    'hero.title': 'Cada acción te hace crecer.<br>De verdad.',
    'hero.desc': 'Una meditación, una noche completa, una llamada a un ser querido… <strong>cada gesto de tu vida real hace crecer tu árbol.</strong> Todo está conectado, y Lya, tu coach, te acompaña en cada paso.',
    'stream.caption': 'Tus acciones, en la vida real',
    'cta.start': 'Comenzar la aventura',
    'lya.voice': 'Voz de Lya',
    'lya.intro1': 'Hola, soy Lya. Encantada de conocerte.',
    'lya.intro2': 'Mira: todo lo que haces en tu vida real hace crecer tu árbol.',
    'lya.intro3': 'Ahí está, pleno. Toca una rama para ver qué la nutre.',
    'lya.branch': '%s — esto es lo que hace crecer esta rama.',
    'stage.sprout': 'Brote',
    'stage.young': 'Árbol joven',
    'stage.mature': 'Árbol maduro',
    'stage.old': 'Árbol centenario',
    'ui.langTitle': 'Elige tu idioma',
    'ui.langSearch': 'Buscar un idioma',
    'ui.langNone': 'No se encontró ningún idioma',
  },
  de: {
    'nav.login': 'Anmelden',
    'hero.eyebrow': 'Dein Leben, lebendig geworden',
    'hero.title': 'Jede Handlung lässt dich wachsen.<br>Wirklich.',
    'hero.desc': 'Eine Meditation, eine durchschlafene Nacht, ein Anruf bei einem geliebten Menschen… <strong>jede Handlung deines echten Lebens lässt deinen Baum wachsen.</strong> Alles ist verbunden – und Lya, dein Coach, begleitet dich bei jedem Schritt.',
    'stream.caption': 'Deine Taten, im echten Leben',
    'cta.start': 'Das Abenteuer beginnen',
    'lya.voice': 'Lyas Stimme',
    'lya.intro1': 'Hallo, ich bin Lya. Schön, dich kennenzulernen.',
    'lya.intro2': 'Schau: alles, was du in deinem echten Leben tust, lässt deinen Baum wachsen.',
    'lya.intro3': 'Da ist er, voll erblüht. Tippe auf einen Ast, um zu sehen, was ihn nährt.',
    'lya.branch': '%s — das lässt diesen Ast wachsen.',
    'stage.sprout': 'Junger Spross',
    'stage.young': 'Junger Baum',
    'stage.mature': 'Reifer Baum',
    'stage.old': 'Hundertjähriger Baum',
    'ui.langTitle': 'Wähle deine Sprache',
    'ui.langSearch': 'Sprache suchen',
    'ui.langNone': 'Keine Sprache gefunden',
  },
  it: {
    'nav.login': 'Accedi',
    'hero.eyebrow': 'La tua vita, diventata viva',
    'hero.title': 'Ogni azione ti fa crescere.<br>Davvero.',
    'hero.desc': 'Una meditazione, una notte intera, una telefonata a una persona cara… <strong>ogni gesto della tua vita reale fa crescere il tuo albero.</strong> Tutto è collegato, e Lya, il tuo coach, ti accompagna a ogni passo.',
    'stream.caption': 'Le tue azioni, nella vita reale',
    'cta.start': 'Inizia l\'avventura',
    'lya.voice': 'Voce di Lya',
    'lya.intro1': 'Ciao, sono Lya. Felice di conoscerti.',
    'lya.intro2': 'Guarda: ogni cosa che fai nella tua vita reale fa crescere il tuo albero.',
    'lya.intro3': 'Eccolo, rigoglioso. Tocca un ramo per vedere cosa lo nutre.',
    'lya.branch': '%s — ecco cosa fa crescere questo ramo.',
    'stage.sprout': 'Germoglio',
    'stage.young': 'Albero giovane',
    'stage.mature': 'Albero maturo',
    'stage.old': 'Albero secolare',
    'ui.langTitle': 'Scegli la tua lingua',
    'ui.langSearch': 'Cerca una lingua',
    'ui.langNone': 'Nessuna lingua trovata',
  },
  pt: {
    'nav.login': 'Entrar',
    'hero.eyebrow': 'A tua vida, ganha vida',
    'hero.title': 'Cada ação faz-te crescer.<br>A sério.',
    'hero.desc': 'Uma meditação, uma noite inteira, uma chamada a alguém querido… <strong>cada gesto da tua vida real faz crescer a tua árvore.</strong> Está tudo ligado — e a Lya, o teu coach, acompanha-te a cada passo.',
    'stream.caption': 'As tuas ações, na vida real',
    'cta.start': 'Começar a aventura',
    'lya.voice': 'Voz da Lya',
    'lya.intro1': 'Olá, sou a Lya. Muito prazer em conhecer-te.',
    'lya.intro2': 'Olha: tudo o que fazes na tua vida real faz crescer a tua árvore.',
    'lya.intro3': 'Aqui está, florescente. Toca num ramo para ver o que o alimenta.',
    'lya.branch': '%s — eis o que faz crescer este ramo.',
    'stage.sprout': 'Rebento',
    'stage.young': 'Árvore jovem',
    'stage.mature': 'Árvore madura',
    'stage.old': 'Árvore centenária',
    'ui.langTitle': 'Escolhe o teu idioma',
    'ui.langSearch': 'Procurar um idioma',
    'ui.langNone': 'Nenhum idioma encontrado',
  },
  nl: {
    'nav.login': 'Inloggen',
    'hero.eyebrow': 'Jouw leven, tot leven gewekt',
    'hero.title': 'Elke actie laat je groeien.<br>Echt waar.',
    'hero.desc': 'Een meditatie, een volledige nacht slaap, een telefoontje naar een dierbare… <strong>elke daad uit je echte leven laat je boom groeien.</strong> Alles is verbonden — en Lya, je coach, loopt bij elke stap met je mee.',
    'stream.caption': 'Jouw acties, in het echte leven',
    'cta.start': 'Begin het avontuur',
    'lya.voice': 'Stem van Lya',
    'lya.intro1': 'Hallo, ik ben Lya. Leuk je te ontmoeten.',
    'lya.intro2': 'Kijk: alles wat je in je echte leven doet, laat je boom groeien.',
    'lya.intro3': 'Daar is hij, volgroeid. Tik op een tak om te zien wat hem voedt.',
    'lya.branch': '%s — dit laat deze tak groeien.',
    'stage.sprout': 'Jonge scheut',
    'stage.young': 'Jonge boom',
    'stage.mature': 'Volgroeide boom',
    'stage.old': 'Eeuwenoude boom',
    'ui.langTitle': 'Kies je taal',
    'ui.langSearch': 'Zoek een taal',
    'ui.langNone': 'Geen taal gevonden',
  },
};

// ── Moteur ───────────────────────────────────────────────────────────────────
const STORE_KEY = 'cyl_lang';
let current = 'fr';

function pick() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved && DICT[saved]) return saved;
  } catch (_) {}
  const nav = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  return DICT[nav] ? nav : 'fr';
}

function t(key) {
  const d = DICT[current] || DICT.fr;
  return (d && d[key]) || (DICT.fr[key]) || key;
}

function applyDom(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  scope.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
  });
}

function meta(code) { return LANGS.find((l) => l.code === code) || LANGS[0]; }

function setLang(code, persist) {
  if (!DICT[code]) return;
  current = code;
  const m = meta(code);
  document.documentElement.lang = code;
  document.documentElement.dir = m.dir || 'ltr';
  if (persist !== false) { try { localStorage.setItem(STORE_KEY, code); } catch (_) {} }
  applyDom();
  syncButton();
  syncList();
  // La 3D (Lya, stades) se met à jour via cet évènement.
  window.dispatchEvent(new CustomEvent('cyl:langchange', { detail: { lang: code } }));
}

// Exposé global pour arbre3d.js (Lya, stades).
window.CYL = window.CYL || {};
window.CYL.t = t;
window.CYL.getLang = () => current;
window.CYL.setLang = (c) => setLang(c, true);

// ── Sélecteur de langue (bouton + popover avec recherche) ───────────────────
let elBtn, elPop, elFlag, elCode, elList, elSearch, elEmpty;

function syncButton() {
  const m = meta(current);
  if (elFlag) elFlag.innerHTML = FLAGS[current] || '';
  if (elCode) elCode.textContent = current.toUpperCase();
  if (elBtn) elBtn.setAttribute('aria-label', `${t('ui.langTitle')} (${m.label})`);
}

function buildList() {
  if (!elList) return;
  elList.innerHTML = '';
  LANGS.forEach((l) => {
    const li = document.createElement('li');
    li.className = 'lang-opt' + (l.code === current ? ' active' : '');
    li.setAttribute('role', 'option');
    li.setAttribute('data-code', l.code);
    li.setAttribute('data-search', (l.label + ' ' + l.en + ' ' + l.code).toLowerCase());
    li.setAttribute('aria-selected', l.code === current ? 'true' : 'false');
    li.innerHTML =
      `<span class="lang-opt-flag">${FLAGS[l.code] || ''}</span>` +
      `<span class="lang-opt-name">${l.label}</span>` +
      `<span class="lang-opt-check" aria-hidden="true">` +
        `<svg viewBox="0 0 14 14"><path d="M2.5 7.5 6 11 11.5 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    li.addEventListener('click', () => { setLang(l.code, true); closePop(); });
    elList.appendChild(li);
  });
}

function syncList() {
  if (!elList) return;
  elList.querySelectorAll('.lang-opt').forEach((li) => {
    const on = li.getAttribute('data-code') === current;
    li.classList.toggle('active', on);
    li.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function filterList(q) {
  const needle = (q || '').trim().toLowerCase();
  let visible = 0;
  elList.querySelectorAll('.lang-opt').forEach((li) => {
    const match = !needle || li.getAttribute('data-search').includes(needle);
    li.hidden = !match;
    if (match) visible++;
  });
  if (elEmpty) elEmpty.hidden = visible !== 0;
}

function openPop() {
  if (!elPop) return;
  elPop.classList.add('open');
  elBtn.setAttribute('aria-expanded', 'true');
  if (elSearch) { elSearch.value = ''; filterList(''); setTimeout(() => elSearch.focus(), 60); }
  document.addEventListener('pointerdown', onOutside, true);
  document.addEventListener('keydown', onKey, true);
}
function closePop() {
  if (!elPop) return;
  elPop.classList.remove('open');
  elBtn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('pointerdown', onOutside, true);
  document.removeEventListener('keydown', onKey, true);
}
function onOutside(e) {
  if (!elPop.contains(e.target) && !elBtn.contains(e.target)) closePop();
}
function onKey(e) {
  if (e.key === 'Escape') { closePop(); elBtn.focus(); return; }
  // Navigation flèches dans les options visibles
  const opts = Array.from(elList.querySelectorAll('.lang-opt')).filter((o) => !o.hidden);
  if (!opts.length) return;
  const active = document.activeElement;
  let idx = opts.indexOf(active);
  if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(opts.length - 1, idx + 1); opts[Math.max(0, idx)].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); idx = idx <= 0 ? 0 : idx - 1; opts[idx].focus(); }
  else if (e.key === 'Enter' && opts.includes(active)) { active.click(); }
}

function initSwitcher() {
  elBtn = document.getElementById('lang-btn');
  elPop = document.getElementById('lang-pop');
  elFlag = document.getElementById('lang-btn-flag');
  elCode = document.getElementById('lang-btn-code');
  elList = document.getElementById('lang-list');
  elSearch = document.getElementById('lang-search');
  elEmpty = document.getElementById('lang-empty');
  if (!elBtn || !elPop) return;
  buildList();
  elBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elPop.classList.contains('open') ? closePop() : openPop();
  });
  if (elSearch) elSearch.addEventListener('input', () => filterList(elSearch.value));
  // Les options doivent pouvoir recevoir le focus clavier.
  elList.querySelectorAll('.lang-opt').forEach((o) => o.setAttribute('tabindex', '0'));
}

// ── Boot ─────────────────────────────────────────────────────────────────────
function boot() {
  initSwitcher();
  setLang(pick(), false);   // applique sans réécrire le storage (respecte la détection)
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
