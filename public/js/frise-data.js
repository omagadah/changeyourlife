// /js/frise-data.js - Socle de donnees de la frise chronologique.
//
// PUR cote logique : structure de l'arbre, template de depart, lecture et
// ecriture Firestore. Partage par les trois vues de /frise/ pour qu'il
// n'existe qu'UN SEUL modele - meme principe que organizer-data.js.
//
// Document : users/{uid}.frise
//   {
//     v: 1,
//     nodes: { [id]: Node },
//     links: [{ id, from, to, label }],   // liens libres, hors hierarchie
//     view: 'frise' | 'map' | 'piliers',
//     cam:  { x, y, z }                   // camera de la carte mentale
//   }
//
// Node :
//   { id, parent, label, note, date (ms|null), era, pillar,
//     hint, collapsed, custom, createdAt, order }
//
// L'ARBRE EST STOCKE A PLAT (une table id -> noeud, chacun pointant son
// parent) plutot qu'en objets imbriques : deplacer une branche revient a
// changer un champ, et aucune operation ne demande de recopier l'arbre.

import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const FRISE_VERSION = 1;
export const ROOT_ID = 'root';
// 400 noeuds x 4000 caracteres de note = ~1,6 Mo dans le pire des cas, soit
// au-dela de la limite d'un document Firestore. En pratique personne n'ecrit
// 4000 caracteres partout, mais la borne evite le piege silencieux.
export const MAX_NODES = 400;
export const FULL_MSG = 'Ta carte a atteint sa taille maximale. Supprime des éléments avant d’en ajouter.';

export const now = () => Date.now();
export const uid6 = (p) => (p || 'n') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── Les trois temps ─────────────────────────────────────────────────────────
// Le vocabulaire vient de l'audit XMind de l'owner : chaque temps pose UNE
// question, et c'est la question qui donne envie de remplir, pas le titre.
export const ERAS = [
  { key: 'passe',   label: 'Le passé',   q: "D'où je viens ?",  sub: 'Le bilan',                color: '#c39a6b' },
  { key: 'present', label: 'Le présent', q: "Où j'en suis ?",   sub: "L'état des lieux",        color: '#84c25e' },
  { key: 'futur',   label: 'Le futur',   q: 'Où je vais ?',     sub: 'La vision et le plan',    color: '#e7b15c' },
];
export const ERA_BY_KEY = Object.fromEntries(ERAS.map((e) => [e.key, e]));

// ── Les cinq piliers ────────────────────────────────────────────────────────
// Couleurs reprises de la palette organique du site (organizer-data.js) pour
// qu'un pilier ait la meme teinte partout.
export const PILLARS = [
  { key: 'sante',     label: 'Santé & Corps',       emoji: '❤️', color: '#e0785f' },
  { key: 'esprit',    label: 'Esprit & Émotions',   emoji: '🧠', color: '#9d8ec4' },
  { key: 'relations', label: 'Relations & Social',  emoji: '🤝', color: '#e7b15c' },
  { key: 'carriere',  label: 'Carrière & Matériel', emoji: '💼', color: '#84c25e' },
  { key: 'evolution', label: 'Évolution & Loisirs', emoji: '🚀', color: '#f1cd92' },
];
export const PILLAR_BY_KEY = Object.fromEntries(PILLARS.map((p) => [p.key, p]));

// ── Le template de depart ───────────────────────────────────────────────────
// Transcription de la carte XMind « Audit de l'Être (Humain) ».
//
// CE SONT DES PISTES, PAS UN FORMULAIRE. Chaque noeud est renommable et
// supprimable, et rien n'oblige a le remplir. Le `hint` s'affiche en gris
// tant que le noeud est vide : il montre le genre de chose qu'on peut y
// mettre, puis disparait des qu'on ecrit. C'est la seule facon de guider
// sans prescrire (regle CYL non-directif).
const T = {
  passe: {
    sante: [
      ['Historique médical', 'Maladies, opérations, blessures passées · addictions · prédispositions familiales'],
      ['Historique physique', 'Niveau de forme physique passé · relation à l’alimentation'],
      ['Historique énergétique', 'Croyances sur le corps et la santé transmises par la famille'],
    ],
    esprit: [
      ['Historique éducatif & intellectuel', 'Parcours scolaire, diplômes · croyances et schémas de pensée acquis · modèles de réussite'],
      ['Historique émotionnel', 'Traumatismes, chocs, événements marquants · schémas qui reviennent (abandon, rejet) · gestion passée des émotions'],
      ['Historique spirituel', 'Éducation religieuse ou spirituelle · crises de sens passées'],
    ],
    relations: [
      ['Historique familial', 'Relation aux parents · dynamique frères et sœurs · modèle de couple parental'],
      ['Historique relationnel & amoureux', 'Grandes amitiés, ruptures · relations marquantes · ce que tu as appris sur la confiance'],
      ['Historique social', 'Sentiment d’appartenance passé · associations, clubs, communautés'],
    ],
    carriere: [
      ['Historique professionnel', 'Postes, entreprises · succès et échecs notables · relation à l’autorité'],
      ['Historique financier', 'Relation à l’argent apprise des parents · habitudes passées · dettes ou investissements'],
      ['Historique matériel', 'Stabilité ou instabilité du logement'],
    ],
    evolution: [
      ['Compétences acquises (et perdues)', 'Ce que tu savais faire · ce qui s’est perdu faute de pratique'],
      ['Passions & hobbies passés', 'Ce qui t’animait avant'],
      ['Rêves d’enfant', 'Réalisés ou abandonnés'],
    ],
  },
  present: {
    sante: [
      ['Besoins physiologiques', 'Sommeil (qualité, durée) · alimentation · hydratation, respiration · santé sexuelle'],
      ['État physique & mouvement', 'Niveau d’énergie, bien-être · exercice, cardio, équilibre'],
    ],
    esprit: [
      ['État émotionnel dominant', 'À cultiver : gratitude, optimisme, motivation · à gérer : peur, tristesse, colère, frustration'],
      ['Système de pensée', 'Philosophie de vie : croyances, perspectives · éthique : morale, valeurs'],
      ['Spiritualité & rituels', 'Quête de sens actuelle · pratiques (méditation, prière) · rituel matinal ou du soir'],
    ],
    relations: [
      ['Appartenance', 'Sentiment d’appartenance · isolement social : perçu ou réel'],
      ['Cercle intime', 'Partenaire · parents · proches (confiance, loyauté)'],
      ['Cercle élargi', 'Connaissances, réseau, interactions · voisins, associations'],
    ],
    carriere: [
      ['Sécurité', 'Stabilité, revenus, investissements'],
      ['Carrière & contribution', 'Statut actuel, avancement · estime de soi, sentiment d’accomplissement · reconnaissance · indépendance'],
    ],
    evolution: [
      ['Réalisation de soi', 'Développement personnel, apprentissage continu · créativité, expression'],
      ['Loisirs & passions actuels', 'Hobbies · ce qui te fait vibrer aujourd’hui'],
      ['Compétences à développer', 'Ce que tu veux savoir faire'],
    ],
  },
  futur: {
    sante: [
      ['Vision & objectifs', 'État physique idéal · objectif de santé à court terme'],
      ['Plan d’action', 'Les prochaines actions concrètes'],
    ],
    esprit: [
      ['Vision & objectifs', 'État émotionnel désiré : sérénité, confiance · compétences à acquérir'],
      ['Plan d’action', 'Rituels à instaurer · pratiques (méditation, lecture)'],
    ],
    relations: [
      ['Vision & objectifs', 'Relations familiales et partenariat idéaux'],
      ['Plan d’action', 'Actions de rencontre · qualité du temps passé ensemble'],
    ],
    carriere: [
      ['Vision & objectifs', 'Postes clés visés (long terme) · contributions majeures'],
      ['Plan d’action', 'Projets en cours (court terme) · plan d’investissement'],
    ],
    evolution: [
      ['Vision & objectifs', 'Rêves à réaliser · épanouissement (long terme)'],
      ['Plan d’action', 'Compétences à maîtriser'],
      ['Transmission & héritage', 'L’impact durable · ce que tu transmets : valeurs, biens'],
    ],
  },
};

// Sous LE PRESENT uniquement : ce qui ne peut pas attendre.
const VIGILANCE = [
  ['Addictions', 'Ce que tu veux arrêter ou réduire'],
  ['Corps à réparer', 'Les rendez-vous repoussés · ce qui traîne'],
  ['Rituels à tenir', 'Ce que tu sais bon pour toi et que tu ne fais pas'],
];

// Le template est genere, pas ecrit a la main : 60 noeuds recopies un a un
// auraient diverge a la premiere correction.
export function buildTemplate() {
  const nodes = {};
  let order = 0;
  const put = (id, parent, label, extra) => {
    nodes[id] = Object.assign({
      id, parent, label, note: '', date: null, era: null, pillar: null,
      hint: '', collapsed: false, custom: false, createdAt: 0, order: order++,
    }, extra || {});
    return id;
  };

  put(ROOT_ID, null, 'Ma vie', { kind: 'root' });
  for (const era of ERAS) {
    const eid = put('e-' + era.key, ROOT_ID, era.label, { era: era.key, kind: 'era' });
    for (const p of PILLARS) {
      const themes = (T[era.key] || {})[p.key] || [];
      if (!themes.length) continue;
      const pid = put('p-' + era.key + '-' + p.key, eid, p.label, { era: era.key, pillar: p.key, kind: 'pillar' });
      themes.forEach(([label, hint], i) => {
        put('t-' + era.key + '-' + p.key + '-' + i, pid, label, { era: era.key, pillar: p.key, hint, kind: 'theme' });
      });
    }
    if (era.key === 'present') {
      const vid = put('p-present-vigilance', eid, 'À traiter maintenant', { era: 'present', kind: 'pillar', urgent: true });
      VIGILANCE.forEach(([label, hint], i) => {
        put('t-present-vigilance-' + i, vid, label, { era: 'present', hint, kind: 'theme', urgent: true });
      });
    }
  }
  return nodes;
}

// ── Normalisation ───────────────────────────────────────────────────────────
export function normalize(raw) {
  const b = raw && typeof raw === 'object' ? raw : {};
  let nodes = b.nodes && typeof b.nodes === 'object' ? Object.assign({}, b.nodes) : null;
  if (!nodes || !nodes[ROOT_ID]) nodes = buildTemplate();

  let order = 0;
  for (const [id, n] of Object.entries(nodes)) {
    if (!n || typeof n !== 'object') { delete nodes[id]; continue; }
    n.id = id;
    n.label = String(n.label ?? '').slice(0, 160);
    n.note = String(n.note ?? '').slice(0, 4000);
    n.hint = String(n.hint ?? '').slice(0, 300);
    n.date = Number.isFinite(n.date) ? n.date : null;
    n.collapsed = !!n.collapsed;
    n.custom = !!n.custom;
    n.order = Number.isFinite(n.order) ? n.order : order;
    order = Math.max(order, n.order) + 1;
    if (id !== ROOT_ID && (!n.parent || !nodes[n.parent])) n.parent = ROOT_ID; // orphelin recolle
  }
  nodes[ROOT_ID].parent = null;

  // Un parent qui redescend dans sa propre branche rendrait l'arbre infini :
  // on remonte depuis chaque noeud, et toute boucle est recollee a la racine.
  for (const id of Object.keys(nodes)) {
    const seen = new Set([id]);
    let cur = nodes[id].parent;
    while (cur && nodes[cur]) {
      if (seen.has(cur)) { nodes[id].parent = ROOT_ID; break; }
      seen.add(cur);
      cur = nodes[cur].parent;
    }
  }

  const ids = new Set(Object.keys(nodes));
  const links = (Array.isArray(b.links) ? b.links : [])
    .filter((l) => l && ids.has(l.from) && ids.has(l.to) && l.from !== l.to)
    .map((l) => ({ id: l.id || uid6('l'), from: l.from, to: l.to, label: String(l.label ?? '').slice(0, 80) }))
    .slice(0, 300);

  const cam = b.cam && typeof b.cam === 'object' ? b.cam : {};
  return {
    v: FRISE_VERSION,
    nodes,
    links,
    view: ['frise', 'map', 'piliers'].includes(b.view) ? b.view : 'frise',
    cam: {
      x: Number.isFinite(cam.x) ? cam.x : 0,
      y: Number.isFinite(cam.y) ? cam.y : 0,
      z: Number.isFinite(cam.z) ? Math.min(2.2, Math.max(0.35, cam.z)) : 1,
    },
  };
}

// ── Operations sur l'arbre ──────────────────────────────────────────────────
export function childrenOf(map, id) {
  return Object.values(map.nodes)
    .filter((n) => n.parent === id)
    .sort((a, b) => (a.order - b.order) || a.label.localeCompare(b.label));
}

// Renvoie null si la carte est pleine : l'appelant doit le dire a l'utilisateur.
export function addNode(map, parentId, label, extra) {
  if (Object.keys(map.nodes).length >= MAX_NODES) return null;
  const p = map.nodes[parentId] || map.nodes[ROOT_ID];
  const maxOrder = childrenOf(map, p.id).reduce((m, n) => Math.max(m, n.order), -1);
  const id = uid6('n');
  map.nodes[id] = Object.assign({
    id, parent: p.id, label: String(label || 'Nouveau').slice(0, 160),
    note: '', date: null, hint: '', collapsed: false, custom: true,
    createdAt: now(), order: maxOrder + 1,
    era: p.era || null, pillar: p.pillar || null, kind: 'leaf',
  }, extra || {});
  if (p.collapsed) p.collapsed = false; // sinon on ajoute dans le vide
  return map.nodes[id];
}

// Supprime le noeud ET sa descendance : laisser les enfants remonter d'un cran
// donnerait un arbre que l'utilisateur n'a pas voulu.
export function removeNode(map, id) {
  if (id === ROOT_ID) return 0;
  const doomed = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of Object.values(map.nodes)) {
      if (!doomed.has(n.id) && doomed.has(n.parent)) { doomed.add(n.id); grew = true; }
    }
  }
  for (const d of doomed) delete map.nodes[d];
  map.links = map.links.filter((l) => !doomed.has(l.from) && !doomed.has(l.to));
  return doomed.size;
}

// Rattache `id` sous `newParent`. Refuse de descendre un noeud dans sa propre
// descendance - ce qui detacherait toute la branche de l'arbre.
export function reparent(map, id, newParent) {
  if (id === ROOT_ID || id === newParent) return false;
  if (!map.nodes[id] || !map.nodes[newParent]) return false;
  let cur = newParent;
  while (cur) {
    if (cur === id) return false;
    cur = map.nodes[cur] ? map.nodes[cur].parent : null;
  }
  const maxOrder = childrenOf(map, newParent).reduce((m, n) => Math.max(m, n.order), -1);
  map.nodes[id].parent = newParent;
  map.nodes[id].order = maxOrder + 1;
  map.nodes[newParent].collapsed = false;
  return true;
}

export function toggleLink(map, from, to) {
  if (from === to) return null;
  const i = map.links.findIndex((l) => (l.from === from && l.to === to) || (l.from === to && l.to === from));
  if (i >= 0) { map.links.splice(i, 1); return null; }
  if (map.links.length >= 300) return null;
  const l = { id: uid6('l'), from, to, label: '' };
  map.links.push(l);
  return l;
}

// Le temps d'un noeud : porte par lui, sinon herite de son ancetre.
export function eraOf(map, node) {
  let cur = node;
  const guard = new Set();
  while (cur && !guard.has(cur.id)) {
    if (cur.era) return cur.era;
    guard.add(cur.id);
    cur = map.nodes[cur.parent];
  }
  return null;
}

export function pillarOf(map, node) {
  let cur = node;
  const guard = new Set();
  while (cur && !guard.has(cur.id)) {
    if (cur.pillar) return cur.pillar;
    guard.add(cur.id);
    cur = map.nodes[cur.parent];
  }
  return null;
}

// Un noeud « rempli » = il porte une note, une date, ou au moins un enfant a
// l'utilisateur. Sert a mesurer l'avancement sans jamais noter la vie de
// quelqu'un : on compte ce qui est ecrit, on n'evalue pas ce qui est ecrit.
export function isFilled(map, node) {
  if (node.note.trim() || node.date) return true;
  return Object.values(map.nodes).some((n) => n.parent === node.id && n.custom);
}

export function stats(map) {
  const themes = Object.values(map.nodes).filter((n) => n.kind === 'theme');
  const filled = themes.filter((n) => isFilled(map, n));
  const dated = Object.values(map.nodes).filter((n) => n.date);
  return {
    total: Object.keys(map.nodes).length,
    themes: themes.length,
    filled: filled.length,
    dated: dated.length,
    links: map.links.length,
  };
}

// ── Firestore ───────────────────────────────────────────────────────────────
export async function loadFrise(db, uid) {
  let raw = null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    raw = snap.exists() ? snap.data().frise : null;
  } catch (_) { raw = null; }
  return normalize(raw);
}

const timers = new WeakMap();
export function saveFrise(db, uid, map, { delay = 400, onError = null, onSaved = null } = {}) {
  clearTimeout(timers.get(map));
  timers.set(map, setTimeout(async () => {
    try {
      await setDoc(doc(db, 'users', uid), { frise: map }, { merge: true });
      if (onSaved) onSaved();
    } catch (e) {
      console.error('[frise] sauvegarde impossible', e);
      if (onError) onError(e);
    }
  }, delay));
}

// Export texte : la carte doit pouvoir sortir du site. Format Markdown pour
// etre relisible partout, y compris re-importable dans XMind.
export function toMarkdown(map) {
  const out = [];
  const walk = (id, depth) => {
    const n = map.nodes[id];
    if (!n) return;
    const pad = '  '.repeat(Math.max(0, depth));
    const d = n.date ? ' (' + new Date(n.date).toLocaleDateString('fr-FR') + ')' : '';
    out.push(pad + '- ' + n.label + d);
    if (n.note.trim()) for (const line of n.note.split(/\r?\n/)) out.push(pad + '  ' + line);
    for (const c of childrenOf(map, id)) walk(c.id, depth + 1);
  };
  walk(ROOT_ID, 0);
  return out.join('\n');
}
