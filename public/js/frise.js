// /js/frise.js - Frise chronologique : trois facons de regarder la meme vie.
//
//   Frise   - l'axe plat, de gauche a droite : passe -> present -> futur.
//   Carte   - l'arbre editable, repris de l'audit XMind de l'owner.
//   Piliers - les cinq domaines, chacun lu dans les trois temps.
//
// Les trois vues lisent LE MEME arbre (frise-data.js). Ce n'est pas trois
// pages : c'est trois angles. Ce qu'on ecrit dans la carte apparait dans la
// frise, et inversement.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import '/js/common.js';
import {
  ERAS, ERA_BY_KEY, PILLARS, PILLAR_BY_KEY, ROOT_ID,
  loadFrise, saveFrise, childrenOf, addNode, removeNode, eraOf, isFilled, stats, toMarkdown, esc, FULL_MSG,
} from '/js/frise-data.js';
import { createMap } from '/js/frise-map.js';

let auth, db;
if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }

const $ = (s) => document.querySelector(s);
const YEAR = 365.25 * 24 * 3600 * 1000;

let uid = null;
let map = null;
let mapView = null;
let view = 'frise';
let sel = null;

// ── Sauvegarde ──────────────────────────────────────────────────────────────
function touch() {
  if (!uid || !map) return;
  const s = $('#fr-save');
  if (s) { s.textContent = 'Enregistrement…'; s.className = 'fr-save on'; }
  map.view = view;
  saveFrise(db, uid, map, {
    onSaved() { if (s) { s.textContent = 'Enregistré'; s.className = 'fr-save ok'; setTimeout(() => { if (s.classList.contains('ok')) s.textContent = ''; }, 2200); } },
    onError() { if (s) { s.textContent = 'Sauvegarde impossible - vérifie ta connexion'; s.className = 'fr-save err'; } },
  });
  renderStats();
}

// ── Onglets ─────────────────────────────────────────────────────────────────
function setView(v) {
  view = v;
  document.querySelectorAll('.view-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view-panel').forEach((p) => p.classList.toggle('active', p.id === 'view-' + v));
  document.body.classList.toggle('fr-mapmode', v === 'map');
  render();
  if (v === 'map' && mapView) requestAnimationFrame(() => mapView.fit());
  touch();
}

function render() {
  if (view === 'frise') renderFrise();
  else if (view === 'piliers') renderPiliers();
  else if (view === 'map') { if (mapView) mapView.render(); }
  renderStats();
}

function renderStats() {
  const el = $('#fr-stats');
  if (!el || !map) return;
  const s = stats(map);
  const parts = [
    s.filled + ' / ' + s.themes + ' thèmes renseignés',
    s.dated + ' daté' + (s.dated > 1 ? 's' : ''),
    s.links + ' lien' + (s.links > 1 ? 's' : ''),
  ];
  el.textContent = parts.join(' · ');
}

// ── Vue 1 : la frise plate ──────────────────────────────────────────────────
// Un axe, de gauche a droite. Ce que tu as date se pose dessus a sa vraie
// place ; le reste attend en dessous, range par temps.
function renderFrise() {
  const host = $('#fr-axisview');
  if (!host) return;

  const dated = Object.values(map.nodes)
    .filter((n) => n.date && n.kind !== 'root')
    .sort((a, b) => a.date - b.date);

  const t0 = Date.now();
  // L'echelle couvre ce qui existe, avec une marge : sans evenement, on montre
  // quand meme trente ans en arriere pour que l'axe ne soit pas un point.
  const min = dated.length ? Math.min(dated[0].date, t0 - 5 * YEAR) : t0 - 30 * YEAR;
  const max = dated.length ? Math.max(dated[dated.length - 1].date, t0 + 3 * YEAR) : t0 + 5 * YEAR;
  const span = Math.max(max - min, YEAR);
  const pct = (ms) => ((ms - min) / span) * 100;

  const nowPct = pct(t0);
  let h = '';

  h += '<div class="fr-ribbon">';
  h += '<div class="fr-track" role="img" aria-label="Axe du temps, du passé vers le futur">';
  h += '<div class="fr-track-past" style="width:' + nowPct.toFixed(2) + '%"></div>';
  h += '<div class="fr-arrow" aria-hidden="true"></div>';
  h += '<div class="fr-now" style="left:' + nowPct.toFixed(2) + '%"><span>aujourd\'hui</span></div>';

  // Les jalons alternent au-dessus et en dessous, sinon deux dates proches se
  // recouvrent et deviennent illisibles.
  dated.forEach((n, i) => {
    const p = Math.min(99.4, Math.max(0.6, pct(n.date)));
    const pil = n.pillar ? PILLAR_BY_KEY[n.pillar] : null;
    const col = pil ? pil.color : (ERA_BY_KEY[eraOf(map, n) || 'present'] || {}).color || '#84c25e';
    h += '<button class="fr-pin ' + (i % 2 ? 'below' : 'above') + '" data-node="' + esc(n.id) + '"'
      + ' style="left:' + p.toFixed(2) + '%;--ac:' + col + '">'
      + '<span class="fr-pin-dot"></span>'
      + '<span class="fr-pin-lab"><b>' + esc(n.label) + '</b>'
      + '<small>' + new Date(n.date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) + '</small></span>'
      + '</button>';
  });
  h += '</div></div>';

  if (!dated.length) {
    h += '<p class="fr-empty-axis">Rien n\'est encore daté. Ouvre la <b>Carte</b>, choisis un élément '
      + 'et donne-lui une date : il viendra se poser ici, à sa place dans le temps.</p>';
  }

  // Les trois temps, avec ce qui n'a pas de date.
  h += '<div class="fr-eras3">';
  for (const era of ERAS) {
    const eNode = map.nodes['e-' + era.key];
    const kids = eNode ? childrenOf(map, eNode.id) : [];
    const themes = [];
    for (const k of kids) for (const t of childrenOf(map, k.id)) themes.push(t);
    const done = themes.filter((t) => isFilled(map, t)).length;

    h += '<section class="fr-era3" style="--ac:' + era.color + '">';
    h += '<header><b>' + esc(era.label) + '</b><span>' + esc(era.q) + '</span></header>';
    h += '<div class="fr-bar"><i style="width:' + (themes.length ? (done / themes.length) * 100 : 0).toFixed(0) + '%"></i></div>';
    h += '<div class="fr-cnt">' + done + ' / ' + themes.length + ' renseignés</div>';
    h += '<ul class="fr-mini">';
    const shown = themes.filter((t) => isFilled(map, t)).slice(0, 6);
    if (!shown.length) h += '<li class="mut">Rien ici pour l\'instant.</li>';
    for (const t of shown) {
      h += '<li><button data-node="' + esc(t.id) + '">' + esc(t.label) + '</button></li>';
    }
    if (done > shown.length) h += '<li class="mut">+ ' + (done - shown.length) + ' autre(s)</li>';
    h += '</ul></section>';
  }
  h += '</div>';

  host.innerHTML = h;
}

// ── Vue 2 : les piliers ─────────────────────────────────────────────────────
// Meme matiere, lue par domaine : « ma santé, d'où elle vient, où elle en est,
// où elle va ». C'est le POV que la frise ne donne pas.
function renderPiliers() {
  const host = $('#fr-pilview');
  if (!host) return;
  let h = '<div class="fr-pgrid">';
  for (const p of PILLARS) {
    h += '<section class="fr-pcol" style="--ac:' + p.color + '">';
    h += '<header class="fr-phead"><span class="ic">' + p.emoji + '</span><b>' + esc(p.label) + '</b></header>';
    for (const era of ERAS) {
      const node = map.nodes['p-' + era.key + '-' + p.key];
      const themes = node ? childrenOf(map, node.id) : [];
      const done = themes.filter((t) => isFilled(map, t)).length;
      h += '<div class="fr-pblock">';
      h += '<div class="fr-pera"><b>' + esc(era.label) + '</b><small>' + done + '/' + themes.length + '</small></div>';
      h += '<ul>';
      for (const t of themes) {
        const filled = isFilled(map, t);
        h += '<li class="' + (filled ? 'on' : '') + '">'
          + '<button data-node="' + esc(t.id) + '">'
          + '<span class="tick" aria-hidden="true">' + (filled ? '●' : '○') + '</span>'
          + esc(t.label) + '</button></li>';
      }
      if (!themes.length) h += '<li class="mut">-</li>';
      h += '</ul></div>';
    }
    h += '</section>';
  }
  h += '</div>';
  host.innerHTML = h;
}

// ── Panneau d'inspection ────────────────────────────────────────────────────
// Le meme pour les trois vues : on clique un element n'importe ou, il s'ouvre.
function openNode(id) {
  const n = map.nodes[id];
  if (!n) return;
  sel = id;
  const pan = $('#fr-insp');
  const era = eraOf(map, n);
  const pil = n.pillar ? PILLAR_BY_KEY[n.pillar] : null;

  $('#fi-path').textContent = pathOf(id);
  $('#fi-label').value = n.label;
  $('#fi-note').value = n.note;
  $('#fi-note').placeholder = n.hint || 'Ce que tu veux garder ici. Personne d\'autre ne le lit.';
  $('#fi-date').value = n.date ? new Date(n.date).toISOString().slice(0, 10) : '';
  $('#fi-tag').textContent = [pil ? pil.label : null, era ? ERA_BY_KEY[era].label : null].filter(Boolean).join(' · ');
  $('#fi-del').disabled = id === ROOT_ID;

  // Les liens libres de ce noeud, pour pouvoir les defaire.
  const lw = $('#fi-links');
  lw.replaceChildren();
  const mine = map.links.filter((l) => l.from === id || l.to === id);
  if (!mine.length) {
    const p = document.createElement('p');
    p.className = 'fi-mut';
    p.textContent = 'Aucun lien. Dans la Carte, active « Relier » pour rattacher cet élément à un autre.';
    lw.appendChild(p);
  }
  for (const l of mine) {
    const other = map.nodes[l.from === id ? l.to : l.from];
    if (!other) continue;
    const row = document.createElement('div');
    row.className = 'fi-link';
    const s = document.createElement('span');
    s.textContent = other.label;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = '✕';
    b.title = 'Retirer ce lien';
    b.setAttribute('aria-label', 'Retirer le lien vers ' + other.label);
    b.addEventListener('click', () => {
      map.links = map.links.filter((x) => x.id !== l.id);
      touch(); openNode(id); if (mapView) mapView.render();
    });
    row.append(s, b);
    lw.appendChild(row);
  }

  pan.classList.add('open');
  document.body.classList.add('fr-insp-open');
}

function pathOf(id) {
  const out = [];
  let cur = map.nodes[id];
  const guard = new Set();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    out.unshift(cur.label);
    cur = map.nodes[cur.parent];
  }
  return out.join('  ›  ');
}

function closeInsp() {
  sel = null;
  $('#fr-insp').classList.remove('open');
  document.body.classList.remove('fr-insp-open');
}

// ── Cablage ─────────────────────────────────────────────────────────────────
function wireInspector() {
  $('#fi-close').addEventListener('click', closeInsp);

  const commitField = (el, apply) => {
    let t = 0;
    el.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!sel || !map.nodes[sel]) return;
        apply(map.nodes[sel], el.value);
        touch();
        if (mapView) mapView.render();
        if (view !== 'map') render();
      }, 300);
    });
  };
  commitField($('#fi-label'), (n, v) => { n.label = v.slice(0, 160) || n.label; });
  commitField($('#fi-note'), (n, v) => { n.note = v.slice(0, 4000); });

  $('#fi-date').addEventListener('change', (e) => {
    if (!sel || !map.nodes[sel]) return;
    const v = e.target.value;
    // midi : evite qu'un fuseau negatif fasse reculer la date d'un jour.
    map.nodes[sel].date = v ? new Date(v + 'T12:00:00').getTime() : null;
    touch();
    if (mapView) mapView.render();
    render();
  });

  $('#fi-add').addEventListener('click', () => {
    if (!sel) return;
    const n = addNode(map, sel, 'Nouveau');
    if (!n) { alert(FULL_MSG); return; }
    touch();
    if (mapView) { mapView.render(); mapView.select(n.id); }
    render();
    openNode(n.id);
    $('#fi-label').focus();
    $('#fi-label').select();
  });

  $('#fi-del').addEventListener('click', () => {
    if (!sel || sel === ROOT_ID) return;
    const n = map.nodes[sel];
    const kids = childrenOf(map, sel).length;
    if (!confirm(kids ? 'Supprimer « ' + n.label + ' » et les ' + kids + ' élément(s) en dessous ?'
      : 'Supprimer « ' + n.label + ' » ?')) return;
    removeNode(map, sel);
    closeInsp();
    touch();
    if (mapView) mapView.render();
    render();
  });
}

// Un seul ecouteur pour toutes les vues : les boutons [data-node] sont
// reconstruits a chaque rendu, les recabler un par un fuirait.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-node]');
  if (!b || !map) return;
  openNode(b.dataset.node);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('fr-insp-open')) {
    const a = document.activeElement;
    if (a && /INPUT|TEXTAREA/.test(a.tagName)) { a.blur(); return; }
    closeInsp();
  }
});

// ── Barre d'outils de la carte ──────────────────────────────────────────────
function wireToolbar() {
  $('#fm-link').addEventListener('click', () => {
    if (!mapView) return;
    const on = !mapView.linkMode();
    mapView.setLinkMode(on);
    $('#fm-link').classList.toggle('on', on);
    $('#fm-link').setAttribute('aria-pressed', String(on));
    $('#fm-hint').textContent = on
      ? 'Clique un premier élément, puis un second : ils seront reliés. Reclique la paire pour défaire.'
      : defaultHint;
  });
  $('#fm-fit').addEventListener('click', () => mapView && mapView.fit());
  $('#fm-open').addEventListener('click', () => mapView && mapView.expandAll(true));
  $('#fm-close').addEventListener('click', () => mapView && mapView.expandAll(false));

  $('#fr-export').addEventListener('click', () => {
    const blob = new Blob([toMarkdown(map)], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ma-frise.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#fr-print').addEventListener('click', () => window.print());
}

const defaultHint = 'Double-clic pour renommer · + pour ajouter dessous · glisse un élément sur un autre pour le déplacer · molette pour zoomer';

// ── Demarrage ───────────────────────────────────────────────────────────────
let booted = false;
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  if (booted) return;   // le jeton se renouvelle : ne pas remonter une 2e carte
  booted = true;
  uid = user.uid;
  map = await loadFrise(db, uid);

  document.querySelectorAll('.view-btn').forEach((b) => {
    b.addEventListener('click', () => setView(b.dataset.view));
  });
  wireInspector();

  mapView = createMap($('#fm-host'), map, {
    onChange: touch,
    onSelect(n) { if (n) openNode(n.id); else closeInsp(); },
  });
  $('#fm-hint').textContent = defaultHint;
  wireToolbar();

  const boot = ['frise', 'map', 'piliers'].includes(map.view) ? map.view : 'frise';
  setView(boot);
  const b = $('#fr-boot');
  if (b) b.remove();
});
