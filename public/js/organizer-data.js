// /js/organizer-data.js - Socle de donnees de l'ORGANIZER (le cerveau du site).
//
// PUR cote logique : lecture/ecriture Firestore + normalisation + operations
// sur le board. Partage par la page /organizer/ ET le widget en tete de /app/,
// pour qu'il n'existe qu'UN SEUL modele de donnees.
//
// Document : users/{uid}.organizer
//   {
//     v: 2,
//     columns: [{ id, title, color, cards: [Card] }],
//     links:   [{ id, from, to }],          // connecteurs de la vue Canvas
//     canvas:  { x, y, z }, view: 'board'|'canvas',
//     lockCols, lockCards
//   }
//
// Card :
//   { id, title, desc, due (ms|null), checklist: [{id,t,done}], logs: [{at,m}],
//     done, createdAt,
//     branch: <cle Maslow|null>,   // la branche de l'arbre que la fiche nourrit
//     gcalId: <id evenement|null>, // evenement Google Agenda cree depuis la fiche
//     cx, cy }                     // position dans la vue Canvas

import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const ORGANIZER_VERSION = 3;
export const TRI_ID = 'tri';
export const FINISH_ID = 'finish';
export const FINISH_XP = 50;

export const DEFAULT_COLUMNS = [
  { id: TRI_ID,    title: 'Idées à trier',                                color: '#b0a999' },
  { id: 'ui',      title: 'Urgent · Important - à faire',                 color: '#f87171' },
  { id: 'ni',      title: 'Important, non urgent - à planifier',          color: '#67c96a' },
  { id: 'up',      title: 'Urgent, peu important - vite fait / déléguer', color: '#fbbf24' },
  { id: 'nn',      title: 'Non urgent · non important - plus tard',       color: '#a79f8c' },
  { id: FINISH_ID, title: 'Terminé',                                      color: '#4ade80' },
];

// Les 8 branches Maslow (miroir de tree-model.js, sans dependance THREE).
// PALETTE ORGANIQUE - source unique de verite des couleurs de branche : elle
// est reprise a l'identique par app.js (anneaux), tree-model.js (arbre 3D),
// le hub ORGANIZER, l'agenda et le brief CYL. Avant, trois palettes navy v2
// concurrentes coloraient la meme branche differemment (AUDIT 2026-08-16).
export const BRANCHES = [
  { key: 'physio',          label: 'Physiologique',   emoji: '🌱', color: '#84c25e' },
  { key: 'securite',        label: 'Sécurité',        emoji: '🛡️', color: '#e7b15c' },
  { key: 'appartenance',    label: 'Appartenance',    emoji: '🤝', color: '#e0785f' },
  { key: 'estime',          label: 'Estime',          emoji: '🏆', color: '#c39a6b' },
  { key: 'cognitif',        label: 'Cognitif',        emoji: '📚', color: '#9d8ec4' },
  { key: 'esthetique',      label: 'Esthétique',      emoji: '🎨', color: '#d98cae' },
  { key: 'accomplissement', label: 'Accomplissement', emoji: '🚀', color: '#6f9a52' },
  { key: 'transcendance',   label: 'Transcendance',   emoji: '✨', color: '#f1cd92' },
];
export const BRANCH_BY_KEY = Object.fromEntries(BRANCHES.map((b) => [b.key, b]));

// ── Utilitaires ──────────────────────────────────────────────────────────────
export const now = () => Date.now();
export const uid6 = (p) => (p || 'c') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function stripEmoji(s) { return String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}✅✔️]/gu, '').trim(); }

// ── Chargement / sauvegarde ──────────────────────────────────────────────────
export function emptyBoard() {
  return {
    v: ORGANIZER_VERSION,
    columns: DEFAULT_COLUMNS.map((c) => ({ ...c, cards: [] })),
    links: [], canvas: { x: 20, y: 20, z: 1 }, view: 'board',
    lockCols: false, lockCards: false,
  };
}

export function normalizeBoard(raw) {
  const board = (raw && Array.isArray(raw.columns)) ? raw : emptyBoard();
  board.v = ORGANIZER_VERSION;
  board.columns.forEach((c) => {
    if (!Array.isArray(c.cards)) c.cards = [];
    c.cards.forEach((k) => {
      if (!Array.isArray(k.checklist)) k.checklist = [];
      if (!Array.isArray(k.logs)) k.logs = [];
      if (!('branch' in k)) k.branch = null;
      if (!('gcalId' in k)) k.gcalId = null;
      if (typeof k.createdAt !== 'number') k.createdAt = now();
      // v3 : les fiches anterieures n'ont pas de lecture. On la calcule une
      // fois, sans jamais ecraser ce que l'utilisateur a deja choisi.
      if (!('kind' in k)) {
        const r = classify(k.title || '');
        k.sub = k.sub || r.sub;
        k.kind = r.kind;
        k.complexity = r.complexity;
        k.confidence = r.confidence;
        k.suggestCol = r.col;
        k.altBranch = r.alt || null;
        k.cylReason = r.reason || '';
        k.cylDismissed = false;
        k.distress = r.distress;
        k.crisis = r.crisis;
        if (!k.branch) k.branch = r.branch;
      }
    });
  });
  board.lockCols = !!board.lockCols;
  board.lockCards = !!board.lockCards;
  board.view = board.view === 'canvas' ? 'canvas' : 'board';
  if (!board.canvas || typeof board.canvas.z !== 'number') board.canvas = { x: 20, y: 20, z: 1 };
  if (!Array.isArray(board.links)) board.links = [];
  // garantit que 'tri' existe et passe en tete
  if (!getCol(board, TRI_ID)) board.columns.unshift({ ...DEFAULT_COLUMNS[0], cards: [] });
  board.columns.sort((a, b) => (a.id === TRI_ID ? -1 : b.id === TRI_ID ? 1 : 0));
  return board;
}

export async function loadBoard(db, uid) {
  let raw = null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    raw = snap.exists() ? snap.data().organizer : null;
  } catch (_) { raw = null; }
  return normalizeBoard(raw);
}

// Ecriture debouncee. `onError` permet d'afficher un vrai retour (pas de perte
// silencieuse - cf. AUDIT P0 « ecritures Firestore perdues en silence »).
const saveTimers = new WeakMap();
export function saveBoard(db, uid, board, { delay = 250, onError = null, onSaved = null } = {}) {
  clearTimeout(saveTimers.get(board));
  saveTimers.set(board, setTimeout(async () => {
    try {
      await setDoc(doc(db, 'users', uid), { organizer: board }, { merge: true });
      if (onSaved) onSaved();
    } catch (e) {
      console.error('[organizer] save failed:', e && e.message);
      if (onError) onError(e);
    }
  }, delay));
}

// ── Operations sur le board ──────────────────────────────────────────────────
export function getCol(board, id) { return board.columns.find((c) => c.id === id); }
export function colTitle(board, id) { const c = getCol(board, id); return c ? c.title : ''; }
export function findCard(board, id) {
  for (const c of board.columns) { const k = c.cards.find((x) => x.id === id); if (k) return { card: k, col: c }; }
  return null;
}
export function allCards(board) {
  return board.columns.flatMap((c) => c.cards.map((card) => ({ card, col: c })));
}
export function logCard(card, m) {
  card.logs = card.logs || [];
  card.logs.unshift({ at: now(), m });
  if (card.logs.length > 60) card.logs.length = 60;
}

export function newCard(title, extra = {}) {
  // La fiche arrive PRE-REMPLIE : branche, sous-categorie, nature, ampleur et
  // colonne suggeree. Tout reste modifiable en un clic - c'est une proposition.
  const r = classify(title);
  const card = {
    id: uid6(), title: String(title || '').trim(), desc: '', due: null,
    checklist: [], logs: [], done: false, createdAt: now(),
    branch: extra.branch || r.branch, gcalId: null,
    sub: r.sub,                    // sous-categorie (Sommeil, Finances, Projets…)
    kind: r.kind,                  // tache | ressenti | envie | objectif | idee
    complexity: r.complexity,      // simple | moyen | complexe
    confidence: r.confidence,      // 0..1 : sert a decider si CYL tend la main
    suggestCol: r.col,             // colonne Eisenhower proposee (non appliquee)
    altBranch: r.alt || null,      // 2e branche plausible quand c'est serre
    cylReason: r.reason || '',     // pourquoi CYL propose de l'aide
    cylDismissed: false,           // « non, c'est bon » de l'utilisateur
    distress: r.distress,          // mal-etre : passe devant tout le reste
    crisis: r.crisis,              // mise en danger : oriente vers de l'aide
    ...extra,
  };
  logCard(card, 'Fiche créée');
  return card;
}

export function addCard(board, colId, title, extra) {
  const c = getCol(board, colId) || getCol(board, TRI_ID);
  if (!c) return null;
  const card = newCard(title, extra);
  if (c.id === FINISH_ID) card.done = true;
  c.cards.unshift(card);
  return card;
}

// Deplace une fiche. Retourne { finished, reopened } pour que l'appelant decide
// de l'XP / du toast (la logique XP reste cote UI, avec le feedback visuel).
export function moveCard(board, cardId, toColId) {
  const f = findCard(board, cardId);
  if (!f || f.col.id === toColId) return { finished: false, reopened: false };
  const dest = getCol(board, toColId);
  if (!dest) return { finished: false, reopened: false };
  f.col.cards = f.col.cards.filter((x) => x.id !== cardId);
  dest.cards.push(f.card);
  logCard(f.card, `Deplacee : ${stripEmoji(f.col.title)} -> ${stripEmoji(dest.title)}`);
  let finished = false, reopened = false;
  if (toColId === FINISH_ID && !f.card.done) { f.card.done = true; logCard(f.card, 'Termine'); finished = true; }
  else if (toColId !== FINISH_ID && f.card.done) { f.card.done = false; reopened = true; }
  return { finished, reopened, card: f.card };
}

// ── Priorisation / tri du jour ───────────────────────────────────────────────
// Poids d'urgence par colonne Eisenhower (sert au classement « quoi maintenant »).
const COL_WEIGHT = { ui: 100, up: 70, ni: 55, nn: 20, [TRI_ID]: 30, [FINISH_ID]: -100 };

export function cardScore(card, col, ref = now()) {
  let s = COL_WEIGHT[col.id] ?? 40;
  if (card.due) {
    const days = (card.due - ref) / 86400000;
    if (days < 0) s += 60;              // en retard : remonte fort
    else if (days < 1) s += 45;
    else if (days < 3) s += 25;
    else if (days < 7) s += 10;
  }
  const checked = (card.checklist || []).filter((x) => x.done).length;
  if (checked && checked < (card.checklist || []).length) s += 8;   // deja entame
  return s;
}

// Les N fiches les plus prioritaires, hors « Termine ».
export function topPriorities(board, n = 5, ref = now()) {
  return allCards(board)
    .filter(({ card, col }) => !card.done && col.id !== FINISH_ID)
    .map((x) => ({ ...x, score: cardScore(x.card, x.col, ref) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// Fiches echues aujourd'hui ou avant (le « d'abord ca » de la journee).
export function dueToday(board, ref = new Date()) {
  const end = new Date(ref); end.setHours(23, 59, 59, 999);
  return allCards(board)
    .filter(({ card, col }) => !card.done && col.id !== FINISH_ID && card.due && card.due <= end.getTime())
    .sort((a, b) => a.card.due - b.card.due);
}

// ═══════════════════════════════════════════════════════════════════════════
//  MOTEUR DE CLASSIFICATION
//  « Tout ce qui peut passer par la tete d'un humain doit pouvoir se ranger. »
//
//  Il ne rend pas qu'une branche : il rend une LECTURE de la pensee.
//    branch      -> la branche Maslow (la part de vie concernee)
//    sub         -> la sous-categorie (miroir des `sub` de tree-model.js)
//    kind        -> sa NATURE : tache / ressenti / envie / objectif / idee
//    complexity  -> simple | moyen | complexe
//    confidence  -> 0..1, sert a decider si CYL doit demander des precisions
//    col         -> la colonne Eisenhower proposee
//    alt         -> 2e branche plausible quand c'est serre (l'utilisateur tranche)
//
//  Rien n'est impose : tout est PROPOSE et modifiable en un clic (cadre
//  non-directif). Une confiance faible ou une pensee complexe font apparaitre
//  la main tendue de CYL sur la fiche, jamais une decision automatique.
// ═══════════════════════════════════════════════════════════════════════════

// Sous-categories : miroir de DIMENSIONS[].sub dans tree-model.js.
export const SUBS = {
  physio:          ['Sommeil', 'Nutrition', 'Hydratation', 'Mouvement', 'Repos'],
  securite:        ['Logement', 'Stabilite', 'Finances', 'Sante', 'Serenite'],
  appartenance:    ['Famille', 'Amis', 'Amour', 'Empathie', 'Communaute'],
  estime:          ['Confiance', 'Competence', 'Reussite', 'Reconnaissance', 'Fierte'],
  cognitif:        ['Savoir', 'Curiosite', 'Comprehension', 'Apprentissage', 'Lucidite'],
  esthetique:      ['Beaute', 'Harmonie', 'Ordre', 'Creativite', 'Emerveillement'],
  accomplissement: ['Croissance', 'Projets', 'Maitrise', 'Authenticite', 'Vision'],
  transcendance:   ['Spiritualite', 'Contribution', 'Sens', 'Transmission', 'Heritage'],
};

// [branche, sous-categorie, poids, motif]
// poids 3 = signal fort et specifique · 2 = net · 1 = indice contextuel
// Les motifs sont ecrits SANS accent (le texte est normalise avant le test) et
// sans `\b` final, pour tolerer pluriels et conjugaisons.
const RULES = [
  // ── PHYSIOLOGIQUE ────────────────────────────────────────────────────────
  ['physio', 'Sommeil', 3, /\b(dormir|sommeil|insomni|sieste|reveil|nuit blanche|couche tard|endormi)/],
  ['physio', 'Sommeil', 2, /\b(fatigu|epuis|creve|a plat|plus d energie|pas assez d energie|manque d energie|energie)/],
  ['physio', 'Nutrition', 3, /\b(manger|repas|cuisin|alimentation|regime|petit dej|dejeuner|diner|courses|frigo|proteine|sucre|grignot)/],
  ['physio', 'Nutrition', 2, /\b(pain|lait|legume|fruit|viande|poisson|fromage|pates|riz|oeufs?|supermarche|epicerie|marche\b|drive\b)/],
  ['physio', 'Hydratation', 3, /\b(boire de l eau|hydrat|trop de cafe|arreter l alcool|alcool)/],
  ['physio', 'Mouvement', 3, /\b(sport|muscu|musculation|courir|running|footing|velo|natation|nager|gym|fitness|yoga|pompes|abdos|entrainement|marcher|randonn|escalade|boxe|tennis|foot\b)/],
  ['physio', 'Repos', 3, /\b(pause|souffler|recuperer|repos|detente|relax|me poser|vacances|arret maladie|burn out)/],

  // ── SECURITE ─────────────────────────────────────────────────────────────
  ['securite', 'Logement', 3, /\b(loyer|appart|appartement|maison|demenag|logement|proprietaire|bail|travaux|plombier|electricien|chauffage|serrure)/],
  ['securite', 'Stabilite', 3, /\b(assurance|mutuelle|contrat|papier|administratif|paperasse|impot|taxe|declaration|prefecture|permis|passeport|carte d identite|caf\b|pole emploi|urssaf)/],
  ['securite', 'Finances', 3, /\b(budget|argent|banque|epargne|credit|dette|emprunt|facture|payer|virement|salaire|compta|economiser|depense|decouvert|investir|placement|impaye)/],
  ['securite', 'Sante', 3, /\b(medecin|docteur|dentiste|ordonnance|pharmacie|analyse|prise de sang|vaccin|kine|osteo|specialiste|hopital|rdv medical|generaliste|ophtalmo|dermato)/],
  ['securite', 'Serenite', 3, /\b(sauvegarde|backup|mot de passe|securiser|proteger|assurance vie|testament)/],
  ['securite', 'Serenite', 2, /\b(peur de manquer|insecurite|precaire|instable|angoisse financiere)/],

  // ── APPARTENANCE ─────────────────────────────────────────────────────────
  ['appartenance', 'Famille', 3, /\b(famille|maman|papa|mere|pere|parents|frere|soeur|enfant|fils|fille|grand mere|grand pere|mamie|papy|cousin|oncle|tante|neveu|niece)/],
  ['appartenance', 'Amis', 3, /\b(ami|amie|copain|copine|pote|soiree|apero|retrouver|inviter|anniversaire|restau)/],
  ['appartenance', 'Amour', 3, /\b(couple|amoureux|amoureuse|conjoint|compagne|compagnon|mari|epouse|petit ami|petite amie|rencard|saint valentin|rupture|divorce|celibataire|draguer|seduire)/],
  ['appartenance', 'Empathie', 3, /\b(appeler|telephoner|prendre des nouvelles|ecouter|soutenir|repondre a|message|sms|rappeler)/],
  ['appartenance', 'Communaute', 3, /\b(association|voisin|groupe|communaute|club|equipe|reseau|collectif)/],
  ['appartenance', 'Amis', 2, /\b(seul|solitude|isole|personne a qui parler)/],

  // ── ESTIME (travail, valeur percue) ──────────────────────────────────────
  ['estime', 'Reussite', 3, /\b(boulot|travail|job\b|taf\b|emploi|carriere|bureau|patron|manager|chef|collegue|reunion|entretien|cv\b|candidatur|promotion|augmentation|demission|licenciement|mission|freelance)/],
  ['estime', 'Confiance', 3, /\b(confiance en moi|estime de moi|oser|j ose pas|timide|complexe|image de soi|m affirmer|imposteur|legitim)/],
  ['estime', 'Competence', 3, /\b(competence|monter en competence|me former|formation pro|certification)/],
  ['estime', 'Reconnaissance', 3, /\b(reconnaissance|feedback|evaluation|entretien annuel|reconnu|merite)/],
  ['estime', 'Fierte', 3, /\b(fier|fiere|defi|challenge|relever)/],
  ['estime', 'Reussite', 2, /\b(reconversion|changer de voie|quitter mon)/],

  // ── COGNITIF (savoir, comprendre) ────────────────────────────────────────
  ['cognitif', 'Apprentissage', 3, /\b(apprendre|etudier|revis|cours|formation|examen|diplome|tuto|tutoriel|mooc|khan|exercice)/],
  ['cognitif', 'Savoir', 3, /\b(math|mathematique|physique quantique|chimie|biologie|histoire|geographie|philosophie|science|conjecture|theoreme|equation|algorithme|statistique)/],
  ['cognitif', 'Savoir', 3, /\b(anglais|espagnol|allemand|italien|chinois|japonais|langue etrangere|vocabulaire|grammaire)/],
  ['cognitif', 'Comprehension', 3, /\b(comprendre|expliquer|analyser|demonstration|resoudre|decrypter|approfondir)/],
  ['cognitif', 'Curiosite', 3, /\b(curieux|curiosite|decouvrir|explorer|me renseigner|documentaire|podcast)/],
  ['cognitif', 'Apprentissage', 2, /\b(lire|lecture|livre(?!r)|bouquin|roman|essai)/],
  ['cognitif', 'Lucidite', 3, /\b(clarifier|y voir clair|faire le point|prendre du recul|introspection)/],

  // ── ESTHETIQUE (beau, creer, ordonner) ───────────────────────────────────
  ['esthetique', 'Creativite', 3, /\b(creer|creation|dessin|dessiner|peinture|peindre|musique|guitare|piano|chanter|composer|photo|video|montage|design|graphisme|illustration|artistique)/],
  ['esthetique', 'Harmonie', 3, /\b(ranger|rangement|menage|nettoyer|desencombrer|minimalisme|debarrasser)/],
  ['esthetique', 'Beaute', 3, /\b(style|look|vetement|garde robe|coiffure|coiffeur|mode\b|s habiller|esthetique)/],
  ['esthetique', 'Emerveillement', 3, /\b(voyage|voyager|paysage|nature|expo|musee|concert|spectacle|cinema|film|serie|festival)/],
  ['esthetique', 'Ordre', 2, /\b(deco|decoration|amenager)/],

  // ── ACCOMPLISSEMENT (faire advenir) ──────────────────────────────────────
  ['accomplissement', 'Projets', 3, /\b(projet|lancer|creer une entreprise|business|startup|site web|application|produit|prototype|mvp|coder|programmer|developper|deployer|livrer|mettre en ligne|dev\b)/],
  ['accomplissement', 'Vision', 3, /\b(objectif|but\b|ambition|vision|strategie|long terme|dans (5|10|3|2) ans|avenir|plan de vie)/],
  ['accomplissement', 'Croissance', 3, /\b(progresser|evoluer|ameliorer|grandir|sortir de ma zone|me depasser)/],
  ['accomplissement', 'Maitrise', 3, /\b(maitriser|maitrise|expert|perfectionner|exceller)/],
  ['accomplissement', 'Authenticite', 3, /\b(authentique|aligne|fidele a moi|etre moi meme|arreter de faire semblant)/],
  ['accomplissement', 'Projets', 2, /\b(deadline|echeance|livraison|jalon)/],

  // ── TRANSCENDANCE (sens, au-dela de soi) ─────────────────────────────────
  ['transcendance', 'Spiritualite', 3, /\b(mediter|meditation|priere|prier|spirituel|spiritualite|ame|pleine conscience|zen|bouddh|eveil)/],
  ['transcendance', 'Contribution', 3, /\b(benevol|donner|don\b|caritatif|aider les autres|impact|changer le monde|utile aux autres|solidarite)/],
  ['transcendance', 'Sens', 3, /\b(sens de (ma|la) vie|ma mission|ikigai|raison d etre|a quoi bon|vide existentiel|quete de sens)/],
  ['transcendance', 'Sens', 3, /\b(quoi faire de ma vie|sens a ma vie|perdu dans ma vie|ou je vais dans la vie|but dans la vie|ma place)/],
  ['transcendance', 'Transmission', 3, /\b(transmettre|enseigner|mentor|partager mon experience)/],
  ['transcendance', 'Heritage', 3, /\b(heritage|posterite|laisser une trace|apres moi)/],
  ['transcendance', 'Spiritualite', 2, /\b(gratitude|reconnaissant)/],
];

// Nature de la pensee. L'ordre compte : le premier motif qui matche gagne.
const KINDS = [
  ['ressenti', /\b(j en ai marre|marre de|ras le bol|je me sens|je suis (fatigu|triste|perdu|seul|stress|anxieu|deprim|nul|epuis)|j arrive pas|je n arrive pas|ca va pas|je supporte plus|j en peux plus|ca me (soule|stresse|angoisse)|je deteste|j ai peur|je culpabilise|je (ne )?sais pas (quoi|plus|ou)|j hesite)/],
  ['envie',    /\b(j aimerais|j ai envie|je voudrais|ce serait bien|un jour je|je reve de|il faudrait que je|envie de)/],
  ['objectif', /\b(objectif|mon but|atteindre|devenir|reussir a|arriver a|d ici (a )?(\d|la fin|l ete|noel)|avant (la fin|l ete|noel|\d))/],
  ['idee',     /\b(idee|et si|pourquoi pas|note pour|penser a|a explorer|piste)/],
  ['tache',    /(^|\b)(appeler|envoyer|acheter|payer|reserver|prendre rdv|prendre rendez|repondre|ranger|nettoyer|finir|terminer|commencer|relancer|imprimer|remplir|declarer|renouveler|annuler|confirmer)/],
];

function detectKind(t) {
  for (const [kind, re] of KINDS) if (re.test(t)) return kind;
  return 'tache';   // par defaut : une note deposee est une chose a faire
}

// L'AMPLEUR ne se lit PAS dans la longueur du texte : « apprendre la conjecture
// de Hodge » tient en 4 mots et représente des années. Ces motifs mesurent
// l'effort réel demandé, indépendamment du nombre de mots.
const VERY_HEAVY_RE = /\b(conjecture|theoreme|doctorat|these\b|agregation|concours|marathon|creer une entreprise|reconversion|apprendre (a parler |le |la |l )?(chinois|japonais|arabe|russe))/;
const HEAVY_RE = /\b(apprendre|maitriser|devenir|creer|lancer|construire|monter|demenag|formation|diplome|examen|ecrire un livre|entreprise|startup|projet|refaire|renover|organiser un)/;
// Gestes courts : quelques minutes, aucune preparation.
const LIGHT_RE = /\b(appeler|telephoner|envoyer|acheter|payer|repondre|imprimer|confirmer|annuler|rappeler|arroser|sortir la poubelle|noter|verifier)/;

// Une pensee « complexe » n'est pas une case a cocher : elle demande a etre
// depliee avant de pouvoir etre priorisee. C'est ce score qui declenche la
// main tendue de CYL sur la fiche.
function scoreComplexity(raw, t, kind) {
  let s = 0;
  const words = String(raw).trim().split(/\s+/).filter(Boolean).length;
  if (words > 16) s += 3; else if (words > 9) s += 2; else if (words > 5) s += 1;
  if (kind === 'ressenti') s += 3;
  else if (kind === 'envie' || kind === 'objectif') s += 2;
  if (/\b(et|puis|ensuite|aussi|mais|parce que|car|donc)\b/.test(t)) s += 1;
  if (/\?/.test(raw)) s += 1;
  if (/\b(comment|pourquoi|je sais pas|sais pas|hesit|sais plus|dilemme)/.test(t)) s += 2;
  if (/\b(tout|toujours|jamais|chaque fois)\b/.test(t)) s += 1;   // generalisation = flou
  // Ampleur intrinseque de la chose demandee
  if (VERY_HEAVY_RE.test(t)) s += 5;
  else if (HEAVY_RE.test(t)) s += 3;
  if (LIGHT_RE.test(t)) s -= 2;
  return Math.max(0, s);
}

const URGENT_RE = /\b(urgent|aujourd hui|ce soir|demain|au plus vite|asap|deadline|en retard|derniere minute|imperatif)/;
const IMPORTANT_RE = /\b(important|crucial|vital|prioritaire|essentiel|indispensable)/;

// ── DETRESSE ────────────────────────────────────────────────────────────────
// Quand quelqu'un ecrit qu'il n'en peut plus, ce n'est PAS « a planifier ».
// C'est ce qu'il y a de plus urgent ET de plus important dans sa journee.
// Deux niveaux, deux reponses tres differentes.
//
//  · DISTRESS : mal-etre installe (« j'en ai marre de ce boulot », epuisement,
//    perte de sens). -> remonte en Urgent · Important, et la fiche propose un
//    eventail de portes de sortie. On PROPOSE, on ne prescrit pas : c'est lui
//    qui choisit, y compris de ne rien faire.
//  · CRISIS : mise en danger. -> on n'essaie surtout pas de « ranger » ca dans
//    une matrice de productivite : on oriente vers de l'aide humaine reelle.
const DISTRESS_RE = /\b(j en ai marre|marre de|ras le bol|j en peux plus|je (n )?en peux plus|a bout|au bout du rouleau|epuis|burn ?out|craque|je craque|je tiens plus|je (ne )?supporte plus|degoute|deprim|mal etre|je vais mal|ca va pas du tout|plus envie de rien|vide|desespere|angoiss|panique|je pleure|insupportable)/;
const CRISIS_RE = /\b(envie d en finir|en finir avec la vie|me suicider|suicide|plus envie de vivre|disparaitre a jamais|me faire du mal|mettre fin a mes jours|je veux mourir)/;
// Les motifs sont ecrits SANS accent : on normalise le titre avant de tester,
// sinon « mediter » ne matcherait jamais « mediter » ecrit avec un accent (le
// \b de JS s'appuie sur [A-Za-z0-9_], les lettres accentuees le cassent).
function deaccent(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
const norm = (s) => deaccent(s).toLowerCase().replace(/['’]/g, ' ');

/**
 * Lit une pensee et propose un rangement complet.
 * Aucune decision n'est appliquee : tout reste une suggestion.
 */
export function classify(raw) {
  const t = norm(raw);
  const kind = detectKind(t);

  // 1. Score par branche
  const scores = {};
  const bestSub = {};
  for (const [branch, sub, w, re] of RULES) {
    if (!re.test(t)) continue;
    scores[branch] = (scores[branch] || 0) + w;
    if (!bestSub[branch] || bestSub[branch].w < w) bestSub[branch] = { sub, w };
  }
  const ranked = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  const branch = ranked[0] || null;
  const top = branch ? scores[branch] : 0;
  const second = ranked[1] ? scores[ranked[1]] : 0;
  const margin = top - second;
  // 2e branche retenue seulement si elle talonne la premiere
  const alt = (ranked[1] && margin <= 1) ? ranked[1] : null;

  // 2. Confiance
  let confidence = 0;
  if (top >= 5 && margin >= 2) confidence = 0.9;
  else if (top >= 3 && margin >= 2) confidence = 0.75;
  else if (top >= 3) confidence = 0.5;
  else if (top >= 2) confidence = 0.4;
  else if (top >= 1) confidence = 0.25;

  // 3. Complexite
  const cScore = scoreComplexity(raw, t, kind);
  const complexity = cScore >= 5 ? 'complexe' : cScore >= 3 ? 'moyen' : 'simple';

  // 3 bis. Detresse : elle prime sur tout le reste du classement.
  const crisis = CRISIS_RE.test(t);
  const distress = crisis || DISTRESS_RE.test(t);

  // 4. Colonne Eisenhower proposee
  let col;
  const urgent = URGENT_RE.test(t);
  const important = IMPORTANT_RE.test(t);
  if (distress) col = 'ui';                    // rien ne passe avant
  else if (urgent && (important || complexity !== 'simple')) col = 'ui';
  else if (urgent) col = 'up';
  else if (kind === 'ressenti' || kind === 'objectif') col = 'ni';
  else if (kind === 'envie') col = complexity === 'simple' ? 'ni' : 'nn';
  else if (kind === 'idee') col = 'nn';
  else col = complexity === 'simple' ? 'up' : 'ni';

  // 5. CYL tend la main quand elle ne peut PAS ranger seule, quand la pensee
  //    merite d'etre depliee, ou quand la personne ne va pas bien.
  const needsCyl = distress || confidence < 0.5 || complexity === 'complexe' || !!alt;

  let reason = '';
  if (crisis) reason = "Tu n'as pas à porter ça seul. Il y a des gens dont c'est le métier d'écouter, tout de suite.";
  else if (distress) reason = "Ça passe devant le reste. Tu n'as rien à organiser tant que tu te sens comme ça.";
  else if (!branch) reason = "Je n'ai pas su rattacher ça à une part de ta vie.";
  else if (alt) reason = `Ça touche à deux choses : ${BRANCH_BY_KEY[branch]?.label} et ${BRANCH_BY_KEY[alt]?.label}.`;
  else if (kind === 'ressenti') reason = "C'est un ressenti, pas une tâche : il gagne à être déplié avant d'être rangé.";
  else if (complexity === 'complexe') reason = "C'est large : il y a sans doute plusieurs choses là-dedans.";

  return {
    branch, sub: branch ? (bestSub[branch]?.sub || null) : null,
    kind, complexity, complexityScore: cScore,
    confidence, col, alt, needsCyl, reason,
    distress, crisis,
  };
}

// Portes de sortie proposees sur une fiche de detresse.
// PROPOSITIONS, jamais prescriptions : l'utilisateur choisit, y compris de
// tout ignorer. Aucune ne promet de « regler » quoi que ce soit.
export function reliefOptions(card) {
  if (card && card.crisis) {
    return [
      { label: 'Parler à quelqu\'un maintenant', href: '#urgence', tone: 'urgent' },
      { label: 'En parler à CYL', act: 'cyl' },
      { label: 'Poser ce qui pèse', href: '/journal/' },
    ];
  }
  return [
    { label: 'En parler à CYL', act: 'cyl' },
    { label: 'Poser ce qui pèse', href: '/journal/' },
    { label: 'Souffler 5 min', href: '/meditation/' },
    { label: 'Voir ce qui va', href: '/gratitude/' },
  ];
}

// Compatibilite : l'ancienne API ne rendait que la branche.
export function guessBranch(title) { return classify(title).branch; }
