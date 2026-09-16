// /js/cyl-prefs.js - LES REGLAGES DE CYL. Source unique.
//
// Deux portes d entree, un seul fichier : l en-tete du panneau lateral (un clic
// sur « CYL ») et la section CYL des parametres du site. Les deux montent le
// MEME rendu a partir des memes definitions - sinon les deux ecrans divergent
// au premier reglage ajoute, et c est toujours celui qu on oublie qui compte.
//
// LES REGLAGES AGISSENT VRAIMENT. Aucune case decorative : chacune est branchee
// soit sur le panneau (CSS/JS), soit sur l appel a /api/chat, soit sur ce qui
// est envoye au modele. Un panneau d options qui ne change rien est pire que
// pas d options - il fait croire a une maitrise qu on n a pas.
//
// CE QUI N EST PAS DEBRAYABLE, ET POURQUOI. Les ressources d urgence (3114, 15,
// 112) restent garanties quoi qu il arrive. On les affiche dans la liste, en
// clair, verrouillees : cacher l existence d un garde-fou serait pire que de le
// montrer inactivable. Le filet de securite serveur (api/chat.js, moderateReply)
// ne lit de toute facon aucune preference.
//
// STOCKAGE : localStorage, donc PAR APPAREIL - c est immediat et ca marche hors
// ligne. Un miroir Firestore sert uniquement a amorcer un appareil neuf : on ne
// le relit jamais ensuite, donc aucun conflit a arbitrer entre deux machines.

import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const CLE = 'cyl_prefs_v1';

// ── Les reglages ────────────────────────────────────────────────────────────
// Declaratif : l interface est GENEREE a partir d ici. Ajouter une option, c est
// ajouter une ligne - pas toucher a deux rendus.
export const GROUPES = [
  {
    cle: 'parole',
    titre: 'Comment CYL te parle',
    note: "Ces réglages partent avec ta question et changent la réponse du modèle.",
    champs: [
      { cle: 'longueur', type: 'choix', label: 'Longueur des réponses', defaut: 'mesuree',
        options: [
          { v: 'breve', l: 'Brèves', d: '2 à 3 phrases' },
          { v: 'mesuree', l: 'Mesurées', d: 'Le défaut' },
          { v: 'developpee', l: 'Développées', d: 'Elle prend le temps' },
        ] },
      { cle: 'ton', type: 'choix', label: 'Ton', defaut: 'chaleureux',
        options: [
          { v: 'sobre', l: 'Sobre', d: 'Factuel, sans effusion' },
          { v: 'chaleureux', l: 'Chaleureux', d: 'Le défaut' },
          { v: 'direct', l: 'Direct', d: 'Va droit au but' },
        ] },
      { cle: 'questions', type: 'choix', label: 'Questions en retour', defaut: 'parfois',
        options: [
          { v: 'souvent', l: 'Souvent', d: 'Elle creuse' },
          { v: 'parfois', l: 'Parfois', d: 'Le défaut' },
          { v: 'rarement', l: 'Rarement', d: 'Elle répond, point' },
        ] },
      { cle: 'adresse', type: 'choix', label: 'Elle te dit', defaut: 'tu',
        options: [
          { v: 'tu', l: 'Tu', d: 'Le défaut' },
          { v: 'vous', l: 'Vous', d: 'Plus de distance' },
        ] },
    ],
  },
  {
    cle: 'vue',
    titre: 'Ce que CYL voit de toi',
    note: "Le texte de ton journal, tes gratitudes et le détail de ton humeur ne partent JAMAIS, quel que soit ce réglage.",
    champs: [
      { cle: 'contexte', type: 'choix', label: 'Contexte de la page', defaut: 'complet',
        options: [
          { v: 'complet', l: 'Complet', d: 'Chiffres et quelques titres' },
          { v: 'chiffres', l: 'Chiffres seuls', d: 'Aucun libellé, que des compteurs' },
          { v: 'aucun', l: 'Rien', d: 'Elle ne sait pas où tu es' },
        ] },
      { cle: 'memoire', type: 'bool', label: 'Garder la conversation d\'une page à l\'autre', defaut: true,
        note: 'Décoché, chaque page repart d\'une page blanche.' },
      { cle: 'voir', type: 'action', label: 'Voir ce qui est envoyé',
        note: "Affiche exactement le contenu transmis lors de ton prochain message.", bouton: 'Afficher' },
    ],
  },
  {
    cle: 'panneau',
    titre: 'Le panneau',
    champs: [
      { cle: 'etatDefaut', type: 'choix', label: 'À l\'ouverture d\'une page', defaut: 'auto',
        options: [
          { v: 'auto', l: 'Selon la page', d: 'Ouvert sur l\'accueil' },
          { v: 'open', l: 'Toujours ouvert', d: '' },
          { v: 'min', l: 'Toujours réduit', d: '' },
        ] },
      { cle: 'largeur', type: 'choix', label: 'Largeur', defaut: '360',
        options: [
          { v: '320', l: 'Étroit', d: '320 px' },
          { v: '360', l: 'Normal', d: '360 px' },
          { v: '420', l: 'Large', d: '420 px' },
          { v: '500', l: 'Très large', d: '500 px' },
        ] },
      { cle: 'texte', type: 'choix', label: 'Taille du texte', defaut: 'normal',
        options: [
          { v: 'petit', l: 'Petit', d: '' },
          { v: 'normal', l: 'Normal', d: '' },
          { v: 'grand', l: 'Grand', d: '' },
        ] },
      { cle: 'ongletDefaut', type: 'choix', label: 'Onglet par défaut', defaut: 'chat',
        options: [
          { v: 'chat', l: 'Chat', d: '' },
          { v: 'acts', l: 'Actions', d: '' },
        ] },
      { cle: 'raccourci', type: 'bool', label: 'Raccourci Ctrl+K', defaut: true,
        note: 'Ouvre CYL et place le curseur dans la zone de saisie.' },
      { cle: 'badge', type: 'bool', label: 'Pastille quand elle a répondu', defaut: true,
        note: 'Visible sur le panneau réduit.' },
      { cle: 'entree', type: 'choix', label: 'Envoyer avec', defaut: 'entree',
        options: [
          { v: 'entree', l: 'Entrée', d: 'Maj+Entrée pour aller à la ligne' },
          { v: 'ctrl', l: 'Ctrl+Entrée', d: 'Entrée va à la ligne' },
        ] },
    ],
  },
  {
    cle: 'cadre',
    titre: 'Garde-fous',
    note: "CYL n'est pas un professionnel de santé et ne décide jamais à ta place. Ce cadre ne se désactive pas.",
    champs: [
      { cle: 'urgence', type: 'verrou', label: 'Ressources d\'urgence garanties', defaut: true,
        note: 'En cas de détresse exprimée, le 3114, le 15 et le 112 sont toujours rappelés. Vérifié côté serveur.' },
      { cle: 'nonDirectif', type: 'verrou', label: 'Posture non directive', defaut: true,
        note: "Elle constate, propose des pistes, et ne te dit pas quoi faire de ta vie." },
      { cle: 'rappelPro', type: 'bool', label: 'Rappeler qu\'elle est une IA', defaut: true,
        note: 'Affiche une mention discrète sous la conversation.' },
    ],
  },
  {
    cle: 'donnees',
    titre: 'Tes données',
    champs: [
      { cle: 'effacerConv', type: 'action', label: 'Effacer la conversation en cours',
        note: 'Elle ne quitte pas ton navigateur, mais autant la vider.', bouton: 'Effacer', danger: true },
      { cle: 'consentement', type: 'action', label: 'Revoir mon accord',
        note: "Réaffiche l'écran d'information avant de reparler à CYL.", bouton: 'Revoir', danger: true },
      { cle: 'reset', type: 'action', label: 'Remettre tous les réglages par défaut',
        note: '', bouton: 'Réinitialiser', danger: true },
    ],
  },
];

// Table plate { cle: champ } pour lire un defaut sans reparcourir les groupes.
const PLAT = {};
for (const g of GROUPES) for (const c of g.champs) if (c.type !== 'action') PLAT[c.cle] = c;

export function defauts() {
  const o = {};
  for (const k in PLAT) o[k] = PLAT[k].defaut;
  return o;
}

// ── Lecture / ecriture ──────────────────────────────────────────────────────
let cache = null;

export function lire() {
  if (cache) return cache;
  const base = defauts();
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) || '{}');
    for (const k in base) {
      if (!(k in brut)) continue;
      const def = PLAT[k];
      // VALIDATION A LA LECTURE : un localStorage se bricole a la main, et une
      // valeur inconnue partirait ensuite vers le prompt systeme.
      if (def.type === 'bool') { if (typeof brut[k] === 'boolean') base[k] = brut[k]; }
      else if (def.type === 'verrou') { /* jamais relu : toujours le defaut */ }
      else if (def.options && def.options.some((o) => o.v === brut[k])) base[k] = brut[k];
    }
  } catch (_) { /* reglages par defaut */ }
  cache = base;
  return cache;
}

export function ecrire(patch) {
  const p = Object.assign(lire(), patch || {});
  cache = p;
  try { localStorage.setItem(CLE, JSON.stringify(p)); } catch (_) {}
  appliquer();
  document.dispatchEvent(new CustomEvent('cyl:prefs', { detail: p }));
  miroir(p);
  return p;
}

export function reinitialiser() {
  cache = null;
  try { localStorage.removeItem(CLE); } catch (_) {}
  const p = lire();
  appliquer();
  document.dispatchEvent(new CustomEvent('cyl:prefs', { detail: p }));
  miroir(p);
  return p;
}

// ── Miroir Firestore : amorcer un appareil neuf, rien de plus ───────────────
let _db = null, _uid = null;
export function brancherCompte(db, uid) { _db = db; _uid = uid; }

function miroir(p) {
  if (!_db || !_uid) return;
  try {
    setDoc(doc(_db, 'users', _uid), { cylPrefs: { ...p, updatedAt: Date.now() } }, { merge: true })
      .catch(() => {});
  } catch (_) {}
}

// Appelee UNE fois, au demarrage, et seulement si rien n existe en local : un
// telephone qu on vient d installer retrouve ses reglages. Ensuite chaque
// appareil vit sa vie - donc aucun conflit a arbitrer.
export async function amorcerDepuisCompte(db, uid) {
  brancherCompte(db, uid);
  try {
    if (localStorage.getItem(CLE)) return false;
    const snap = await getDoc(doc(db, 'users', uid));
    const dist = snap.exists() && snap.data().cylPrefs;
    if (!dist) return false;
    cache = null;
    const base = defauts();
    for (const k in base) {
      const def = PLAT[k];
      if (def.type === 'verrou' || !(k in dist)) continue;
      if (def.type === 'bool') { if (typeof dist[k] === 'boolean') base[k] = dist[k]; }
      else if (def.options && def.options.some((o) => o.v === dist[k])) base[k] = dist[k];
    }
    cache = base;
    localStorage.setItem(CLE, JSON.stringify(base));
    appliquer();
    return true;
  } catch (_) { return false; }
}

// ── Application : ce qui se voit tout de suite ──────────────────────────────
const TAILLES = { petit: '.76rem', normal: '.82rem', grand: '.92rem' };

export function appliquer() {
  const p = lire();
  try {
    const r = document.documentElement;
    r.style.setProperty('--cylp-w', p.largeur + 'px');
    r.style.setProperty('--cylp-fs', TAILLES[p.texte] || TAILLES.normal);
  } catch (_) {}
}

// ── La part qui part au serveur ─────────────────────────────────────────────
// UNIQUEMENT des cles d enumeration, jamais de texte libre : c est ce qui
// empeche un localStorage bricole de devenir une injection dans le prompt
// systeme. api/chat.js revalide de son cote.
export function pourApi() {
  const p = lire();
  return { longueur: p.longueur, ton: p.ton, questions: p.questions, adresse: p.adresse };
}

export function contextePermis() { return lire().contexte; }

// ── Rendu ───────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function injecterCSS() {
  if (document.getElementById('cyl-prefs-css')) return;
  const s = document.createElement('style');
  s.id = 'cyl-prefs-css';
  s.textContent = `
  .cyp { display:flex; flex-direction:column; gap:18px; }
  .cyp-g { display:flex; flex-direction:column; gap:10px; }
  .cyp-gt { font-size:.68rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase;
    color:var(--text-3,#86806a); }
  .cyp-gn { font-size:.73rem; line-height:1.5; color:var(--text-3,#86806a);
    padding:8px 10px; border-radius:9px; background:var(--surface-2,rgba(255,255,255,.05));
    border-left:2px solid rgba(132,194,94,.4); }
  .cyp-f { display:flex; flex-direction:column; gap:7px; }
  .cyp-l { font-size:.81rem; font-weight:700; color:var(--text-1,#f4efe1); }
  .cyp-n { font-size:.71rem; line-height:1.45; color:var(--text-3,#86806a); }
  /* Les choix : des segments, pas un <select>. On voit les options sans ouvrir,
     et on lit ce que chacune veut dire. */
  .cyp-seg { display:flex; flex-wrap:wrap; gap:5px; }
  .cyp-o { flex:1 1 auto; min-width:82px; padding:7px 9px; border-radius:9px; cursor:pointer;
    border:1px solid var(--line,rgba(221,205,160,.12)); background:var(--surface-2,rgba(255,255,255,.05));
    color:var(--text-2,#b4ad94); font:inherit; font-size:.76rem; font-weight:700; text-align:left;
    transition:background .15s,border-color .15s,color .15s; }
  .cyp-o:hover { background:var(--surface-3,rgba(255,255,255,.08)); color:var(--text-1,#f4efe1); }
  .cyp-o[aria-pressed="true"] { background:rgba(132,194,94,.14); border-color:rgba(132,194,94,.36);
    color:var(--leaf,#84c25e); }
  .cyp-o i { display:block; font-style:normal; font-size:.66rem; font-weight:600;
    color:var(--text-3,#86806a); margin-top:1px; }
  .cyp-o[aria-pressed="true"] i { color:rgba(132,194,94,.75); }
  /* Interrupteur */
  .cyp-row { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
  .cyp-sw { position:relative; width:40px; height:23px; flex-shrink:0; border:none; cursor:pointer;
    border-radius:99px; background:var(--surface-3,rgba(255,255,255,.1)); padding:0;
    transition:background .18s; }
  .cyp-sw::after { content:''; position:absolute; top:3px; left:3px; width:17px; height:17px;
    border-radius:50%; background:var(--text-3,#86806a); transition:transform .18s, background .18s; }
  .cyp-sw[aria-pressed="true"] { background:rgba(132,194,94,.34); }
  .cyp-sw[aria-pressed="true"]::after { transform:translateX(17px); background:var(--leaf,#84c25e); }
  .cyp-sw[disabled] { cursor:not-allowed; opacity:.85; }
  .cyp-lock { font-size:.64rem; font-weight:800; padding:2px 7px; border-radius:99px;
    background:rgba(231,177,92,.14); color:var(--gold-soft,#f1cd92); white-space:nowrap; }
  .cyp-b { align-self:flex-start; padding:8px 14px; border-radius:9px; cursor:pointer;
    border:1px solid var(--line,rgba(221,205,160,.12)); background:var(--surface-2,rgba(255,255,255,.05));
    color:var(--text-2,#b4ad94); font:inherit; font-size:.77rem; font-weight:700; }
  .cyp-b:hover { background:var(--surface-3,rgba(255,255,255,.08)); color:var(--text-1,#f4efe1); }
  .cyp-b.danger { border-color:rgba(224,120,95,.3); color:#e58e73; }
  .cyp-b.danger:hover { background:rgba(224,120,95,.12); }
  .cyp-code { margin-top:8px; padding:10px; border-radius:9px; font-size:.7rem; line-height:1.5;
    white-space:pre-wrap; word-break:break-word; max-height:220px; overflow:auto;
    background:var(--field-bg,rgba(8,13,7,.55)); border:1px solid var(--line,rgba(221,205,160,.12));
    color:var(--text-2,#b4ad94); font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
  `;
  document.head.appendChild(s);
}

/**
 * Monte les réglages dans un hôte.
 * @param {HTMLElement} hote
 * @param {object} api - crochets fournis par l'appelant (le panneau les câble,
 *   la page de réglages n'en fournit qu'une partie). Tout est optionnel.
 */
export function rendre(hote, api) {
  if (!hote) return;
  injecterCSS();
  const a = api || {};
  const p = lire();
  hote.classList.add('cyp');
  hote.replaceChildren();

  for (const g of GROUPES) {
    const gEl = document.createElement('div');
    gEl.className = 'cyp-g';
    const t = document.createElement('div');
    t.className = 'cyp-gt'; t.textContent = g.titre;
    gEl.appendChild(t);
    if (g.note) {
      const n = document.createElement('div');
      n.className = 'cyp-gn'; n.textContent = g.note;
      gEl.appendChild(n);
    }

    for (const c of g.champs) {
      const f = document.createElement('div');
      f.className = 'cyp-f';

      if (c.type === 'choix') {
        const l = document.createElement('div'); l.className = 'cyp-l'; l.textContent = c.label;
        const seg = document.createElement('div'); seg.className = 'cyp-seg';
        seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', c.label);
        for (const o of c.options) {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'cyp-o';
          b.setAttribute('aria-pressed', String(p[c.cle] === o.v));
          b.innerHTML = esc(o.l) + (o.d ? `<i>${esc(o.d)}</i>` : '');
          b.onclick = () => {
            ecrire({ [c.cle]: o.v });
            seg.querySelectorAll('.cyp-o').forEach((x, i) => x.setAttribute('aria-pressed', String(c.options[i].v === o.v)));
          };
          seg.appendChild(b);
        }
        f.append(l, seg);

      } else if (c.type === 'bool' || c.type === 'verrou') {
        const verrou = c.type === 'verrou';
        const row = document.createElement('div'); row.className = 'cyp-row';
        const gauche = document.createElement('div');
        const l = document.createElement('div'); l.className = 'cyp-l'; l.textContent = c.label;
        gauche.appendChild(l);
        const sw = document.createElement('button');
        sw.type = 'button'; sw.className = 'cyp-sw';
        sw.setAttribute('aria-pressed', String(verrou ? true : !!p[c.cle]));
        sw.setAttribute('aria-label', c.label);
        if (verrou) {
          sw.disabled = true;
          const pill = document.createElement('span');
          pill.className = 'cyp-lock'; pill.textContent = 'Toujours actif';
          row.append(gauche, pill);
        } else {
          sw.onclick = () => {
            const v = !lire()[c.cle];
            ecrire({ [c.cle]: v });
            sw.setAttribute('aria-pressed', String(v));
          };
          row.append(gauche, sw);
        }
        f.appendChild(row);

      } else if (c.type === 'action') {
        const l = document.createElement('div'); l.className = 'cyp-l'; l.textContent = c.label;
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'cyp-b' + (c.danger ? ' danger' : '');
        b.textContent = c.bouton || 'Ouvrir';
        b.onclick = () => actionner(c.cle, a, f, b);
        f.append(l);
        if (c.note) { const n = document.createElement('div'); n.className = 'cyp-n'; n.textContent = c.note; f.appendChild(n); }
        f.appendChild(b);
        gEl.appendChild(f);
        continue;
      }

      if (c.note) { const n = document.createElement('div'); n.className = 'cyp-n'; n.textContent = c.note; f.appendChild(n); }
      gEl.appendChild(f);
    }
    hote.appendChild(gEl);
  }
}

function actionner(cle, a, hote, bouton) {
  if (cle === 'voir') {
    let boite = hote.querySelector('.cyp-code');
    if (boite) { boite.remove(); bouton.textContent = 'Afficher'; return; }
    boite = document.createElement('pre');
    boite.className = 'cyp-code';
    // Le contenu vient de l appelant : seul le panneau sait ce qu il enverrait
    // vraiment. La page de reglages, elle, montre au moins la part « style ».
    boite.textContent = a.apercuEnvoi ? a.apercuEnvoi() : JSON.stringify({ preferences: pourApi() }, null, 2);
    hote.appendChild(boite);
    bouton.textContent = 'Masquer';
    return;
  }
  if (cle === 'effacerConv') {
    if (!confirm('Effacer la conversation en cours avec CYL ?')) return;
    if (a.effacerConversation) a.effacerConversation();
    else { try { sessionStorage.removeItem('cyl_panel_hist'); } catch (_) {} }
    bouton.textContent = 'Effacée';
    setTimeout(() => { bouton.textContent = 'Effacer'; }, 2000);
    return;
  }
  if (cle === 'consentement') {
    if (!confirm("Revoir l'écran d'information avant de reparler à CYL ?")) return;
    try { localStorage.removeItem('cyl_consent_v1'); } catch (_) {}
    if (a.consentementRevoque) a.consentementRevoque();
    bouton.textContent = 'À revoir';
    setTimeout(() => { bouton.textContent = 'Revoir'; }, 2000);
    return;
  }
  if (cle === 'reset') {
    if (!confirm('Remettre tous les réglages de CYL par défaut ?')) return;
    reinitialiser();
    // On redessine : les segments doivent refléter les valeurs revenues.
    const racine = hote.closest('.cyp');
    if (racine) rendre(racine, a);
  }
}

// Applique des le chargement du module : la largeur et la taille du texte
// doivent etre posees avant que le panneau ne se dessine.
appliquer();
