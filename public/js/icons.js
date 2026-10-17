// /js/icons.js - Le jeu d'icones du site, en SVG, dessine a la main.
//
// POURQUOI CE FICHIER
// La navigation, les gestes du jour, les cartes et les etats vides portaient
// des emojis en guise d'icones. Un emoji n'est pas une icone : il change de
// dessin selon le systeme (Apple, Google, Windows, Samsung), il ne prend pas
// la couleur du texte, il ne suit pas le theme clair, et il signe l'interface
// « generee » que l'audit du 2026-10-17 demande de quitter. Un trait de 1,75 px
// sur une grille de 24, en `currentColor`, se fond dans n'importe quel texte.
//
// USAGE
//   import { icon } from '/js/icons.js';
//   el.innerHTML = icon('calendar');                 // 18 px, currentColor
//   el.innerHTML = icon('zap', { size: 14, cls: 'x' });
//
// Les chemins sont ecrits pour une viewBox 0 0 24 24, trait arrondi. Un nom
// inconnu renvoie un point : l'interface ne casse jamais pour une icone.

const P = {
  home:        '<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/>',
  inbox:       '<path d="M4 13h4l2 3h4l2-3h4"/><path d="M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7"/><path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
  calendar:    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  sun:         '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  target:      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  compass:     '<circle cx="12" cy="12" r="9"/><path d="M16 8l-2 6-6 2 2-6z"/>',
  timeline:    '<path d="M3 12h18"/><circle cx="7" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="17" cy="12" r="2" fill="currentColor" stroke="none"/>',
  mountain:    '<path d="M3 20l6-10 4 6 2-3 6 7z"/><path d="M9 10l-1.5-2.5L5 11"/>',
  chart:       '<path d="M4 20v-8M10 20V5M16 20v-5M2 20h20"/>',
  book:        '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  checks:      '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  leaf:        '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/>',
  smile:       '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  moon:        '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sparkles:    '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>',
  library:     '<path d="M4 20h16"/><path d="M6 4h2v16H6zM11 4h2v16h-2z"/><path d="M16 5l2-.5 4 15.5-2 .5z"/>',
  pie:         '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  sliders:     '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
  logout:      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  download:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  zap:         '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  flame:       '<path d="M12 22c4-2 7-5 7-9 0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-5-3-7-1 3-5 5-5 11 0 4 3 7 7 9z"/>',
  plus:        '<path d="M12 5v14M5 12h14"/>',
  x:           '<path d="M18 6L6 18M6 6l12 12"/>',
  check:       '<path d="M5 12l5 5L20 7"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
  chevronRight:'<path d="M9 18l6-6-6-6"/>',
  arrowRight:  '<path d="M5 12h14M13 6l6 6-6 6"/>',
  search:      '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  send:        '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  menu:        '<path d="M4 7h16M4 12h16M4 17h16"/>',
  user:        '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sapling:     '<path d="M12 22v-7"/><path d="M12 15c-4 0-7-3-7-7 3 0 5 1 7 3 2-2 4-3 7-3 0 4-3 7-7 7z"/>',
  tree:        '<path d="M12 22v-5"/><path d="M8 17h8l-2-4h1.5l-3-4H13l-1-3-1 3h.5l-3 4H10z"/>',
  heart:       '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>',
  lifebuoy:    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M4.9 4.9l4.3 4.3M14.8 14.8l4.3 4.3M4.9 19.1l4.3-4.3M14.8 9.2l4.3-4.3"/>',
  bell:        '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  clock:       '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit:        '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  mic:         '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/>',
  droplet:     '<path d="M12 2.7l5.7 6.3a7.5 7.5 0 1 1-11.4 0z"/>',
  walk:        '<circle cx="13" cy="4" r="1.6"/><path d="M10 22l1.5-6-2.5-2 .5-5 3-1 2 3 3 1"/><path d="M9 11l-2 2 1 4M14 15l3 7"/>',
  water:       '<path d="M12 2.7l5.7 6.3a7.5 7.5 0 1 1-11.4 0z"/>',
  bowl:        '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 11c0-3 2-6 4-7 2 1 4 4 4 7"/>',
  grid:        '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  sort:        '<path d="M4 6h16M7 12h10M10 18h4"/>',
  dot:         '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
  info:        '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  external:    '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  refresh:     '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  minimize:    '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  shield:      '<path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  users:       '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 20a7 7 0 0 0-5-6.7"/>',
  award:       '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 8 5-3 5 3-1.5-8"/>',
  palette:     '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2h1.5a3.5 3.5 0 0 0 3.5-3.5A9.5 9.5 0 0 0 12 3z"/><path d="M7.5 10.5h.01M10.5 7h.01M14.5 7.5h.01M17 11h.01"/>',
  hand:        '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.6L3.4 15a2 2 0 0 1 3.2-2.4L8 14"/>',
};

export const ICON_NAMES = Object.keys(P);

export function icon(name, opts) {
  const o = opts || {};
  const size = o.size || 18;
  const sw = o.stroke || 1.75;
  const cls = o.cls ? ` class="${String(o.cls).replace(/"/g, '')}"` : '';
  const label = o.label ? ` role="img" aria-label="${String(o.label).replace(/"/g, '&quot;')}"` : ' aria-hidden="true"';
  const body = P[name] || P.dot;
  return `<svg${cls} xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${label} focusable="false">${body}</svg>`;
}

// Un noeud DOM pret a inserer, pour les modules qui construisent sans innerHTML.
export function iconEl(name, opts) {
  const t = document.createElement('template');
  t.innerHTML = icon(name, opts);
  return t.content.firstElementChild;
}

// Les gestes du jour et les modules partagent une correspondance route -> icone,
// pour que la meme page porte la meme icone partout (barre, accueil, CYL).
export const ROUTE_ICON = {
  '/':               'home',
  '/organizer/':     'inbox',
  '/agenda/':        'calendar',
  '/plan/':          'sun',
  '/objectifs/':     'target',
  '/yourlife/':      'compass',
  '/frise/':         'timeline',
  '/competences/':   'mountain',
  '/bilan/':         'chart',
  '/journal/':       'book',
  '/habitudes/':     'checks',
  '/meditation/':    'leaf',
  '/humeur/':        'smile',
  '/sommeil/':       'moon',
  '/gratitude/':     'sparkles',
  '/codex/':         'library',
  '/autoevaluation/':'pie',
  '/settings/':      'sliders',
  '/profile/':       'user',
};

// Expose aussi en global pour les scripts classiques (non-module) qui en ont
// besoin ponctuellement, sans import.
try { window.cylIcon = icon; } catch (_) {}
