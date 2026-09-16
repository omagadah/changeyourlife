// /js/growth.js - LES PALIERS DE L'ARBRE. Socle unique de la progression.
//
// Trois recompenses reposent sur ce fichier, et c est voulu : elles doivent
// parler du MEME etat, sinon l arbre dit une chose, le badge une autre et le
// deblocage une troisieme.
//   1. l arbre change de forme       (living-tree.js lit le palier)
//   2. un jalon se pose              (badge nomme, collectionnable)
//   3. quelque chose s ouvre         (capacite, vue, apparence)
//
// LE PALIER DECRIT L ARBRE, JAMAIS LA PERSONNE. C est la nuance qui rend tout
// ceci compatible avec la regle non negociable du projet : « ta branche
// Cognitif est une pousse » parle d un objet a l ecran. « Tu es debutant en
// cognitif » noterait une vie. Aucun nom de palier n est donc un niveau de
// competence, un classement ou un jugement - ce sont des etats de vegetal.
//
// LE DEBLOCAGE AJOUTE, IL NE RETIENT PAS. Rien de ce qui existe aujourd hui
// n est mis derriere un palier : on n enleve pas a quelqu un venu organiser sa
// vie un outil qu il avait hier. Ce qui s ouvre est NOUVEAU (une apparence,
// une vue, une capacite de CYL), et le coeur du produit reste entier a zero XP.

// 800 XP = branche pleinement epanouie A L ECRAN (valeur reprise de
// living-tree.js : BRANCH_TARGET. Les deux fichiers doivent dire le meme
// nombre, c est lui qui pilote la taille du noeud).
//
// Le dernier palier, lui, est AU-DELA de ce nombre - et c est volontaire :
// « Franc de pied » n est pas un arbre plus gros, c est un arbre sans tuteur.
// Un changement de nature, pas de taille. L arbre est deja plein a 800.
export const BRANCH_TARGET = 800;

// Six etats, du plus nu au plus genereux. Les seuils se resserrent au debut
// (on voit bouger vite quand on commence) et s ecartent ensuite.
export const PALIERS = [
  { n: 0, seuil: 0,   cle: 'dormante', nom: 'Dormante', desc: "Rien n'y pousse encore", icone: '·' },
  { n: 1, seuil: 40,  cle: 'germe',    nom: 'Germe',    desc: 'Quelque chose a commencé', icone: '🌱' },
  { n: 2, seuil: 140, cle: 'pousse',   nom: 'Pousse',   desc: 'Ça tient tout seul', icone: '🌿' },
  { n: 3, seuil: 320, cle: 'rameau',   nom: 'Rameau',   desc: 'Ça se ramifie', icone: '🍃' },
  { n: 4, seuil: 550, cle: 'feuillue', nom: 'Feuillue', desc: 'Dense, visible de loin', icone: '🌳' },
  { n: 5, seuil: 800, cle: 'fruits',   nom: 'En fruits', desc: 'Elle donne quelque chose', icone: '🍎' },

  // LE DERNIER PALIER : ON RETIRE LE TUTEUR.
  // « Franc de pied » est le terme exact de l'arboriculture : un arbre non
  // greffe, qui tient sur ses PROPRES racines. C'est litteralement la sortie
  // de la minorite kantienne - « Sapere aude », ose te servir de ton propre
  // entendement, sans la direction d'autrui.
  //
  // Ce que Kant decrit et ce que Milgram mesure sont la meme chose vue de deux
  // cotes : deleguer son jugement est un SOULAGEMENT. Si une autorite pense a
  // ma place, je n'ai plus d'effort a fournir. Ce n'est pas subi, c'est
  // reposant - et c'est pour ca que ca marche.
  //
  // Un assistant de vie est structurellement candidat a devenir « le livre qui
  // me tient lieu d'entendement ». Ce palier est la reponse du produit a sa
  // propre tentation : arrive ici, le site a pour but d'etre devenu un SUPPORT,
  // plus un guide. Il ne recompense pas la fidelite, il acte l'autonomie.
  { n: 6, seuil: 1200, cle: 'francDePied', nom: 'Franc de pied', icone: '🌲',
    desc: "Elle tient sur ses propres racines - tu n'as plus besoin d'ici pour ça" },
];

// Ce qui s ouvre, et quand. Toujours ADDITIF (cf. en-tete).
// `branche: null` = condition sur l arbre entier, pas sur une branche donnee.
export const OUVERTURES = [
  { cle: 'cyl-memoire',   branche: null, palierMin: 1, portee: 'arbre',
    nom: 'CYL se souvient de ton arbre',
    desc: "CYL voit l'état de tes branches quand tu lui parles." },
  { cle: 'arbre-nuit',    branche: null, palierMin: 2, portee: 'arbre',
    nom: 'Ton arbre la nuit',
    desc: 'Une seconde apparence pour la scène : lucioles et ciel profond.' },
  { cle: 'frise-liens',   branche: null, palierMin: 2, portee: 'arbre',
    nom: 'Relier tes moments',
    desc: 'La frise accepte des liens entre les nœuds que tu poses.' },
  { cle: 'canvas-libre',  branche: null, palierMin: 3, portee: 'arbre',
    nom: 'La toile de l\'ORGANIZER',
    desc: 'Placer tes fiches librement et les relier entre elles.' },
  { cle: 'cyl-bilan',     branche: null, palierMin: 3, portee: 'arbre',
    nom: 'La relecture de CYL',
    desc: 'CYL peut relire ta semaine avec toi, à ta demande.' },
  { cle: 'arbre-saisons', branche: null, palierMin: 4, portee: 'arbre',
    nom: 'Les saisons',
    desc: "Ton arbre suit la saison réelle : floraison, feuilles d'automne." },
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── Le palier d'une branche ─────────────────────────────────────────────────
export function palierDe(xp) {
  const x = Math.max(0, Number(xp) || 0);
  let p = PALIERS[0];
  for (const q of PALIERS) if (x >= q.seuil) p = q;
  const suivant = PALIERS[p.n + 1] || null;
  const base = p.seuil;
  const cible = suivant ? suivant.seuil : p.seuil;
  return {
    ...p,
    xp: x,
    suivant,
    // Progression DANS le palier courant, pas depuis zéro : c'est ce qui
    // rend la barre lisible quand on est à 600 XP sur 800.
    reste: suivant ? Math.max(0, cible - x) : 0,
    pct: suivant ? clamp(Math.round(((x - base) / (cible - base)) * 100), 0, 100) : 100,
    // Part du chemin complet - sert à l'arbre, qui grandit en continu.
    pctTotal: clamp(Math.round((x / BRANCH_TARGET) * 100), 0, 100),
  };
}

// ── L'XP d'une branche, lue là où la Cloud Function l'écrit ─────────────────
export function xpDeBranche(userData, cle) {
  const b = userData && userData.tree && userData.tree.branches && userData.tree.branches[cle];
  return (b && Number(b.xp)) || 0;
}

export function derniereActionDe(userData, cle) {
  const b = userData && userData.tree && userData.tree.branches && userData.tree.branches[cle];
  return (b && Number(b.lastActionAt)) || 0;
}

// ── L'état de tout l'arbre ──────────────────────────────────────────────────
// `branches` doit venir de l'appelant (organizer-data.js en est la source de
// vérité) pour qu'il n'existe qu'une seule liste de branches dans le projet.
export function etatArbre(userData, branches) {
  const out = { branches: {}, total: 0, palierMoyen: 0, jalons: 0, plusHaute: null, enJachere: [] };
  let somme = 0, n = 0;
  for (const b of branches) {
    const xp = xpDeBranche(userData, b.key);
    const p = palierDe(xp);
    out.branches[b.key] = { ...p, key: b.key, label: b.label, emoji: b.emoji, color: b.color };
    out.total += xp;
    out.jalons += p.n;
    somme += p.n; n += 1;
    if (!out.plusHaute || p.n > out.branches[out.plusHaute].n) out.plusHaute = b.key;
    // « En jachère » est un CONSTAT, pas un reproche : une branche sans
    // activité depuis un mois. On ne dit jamais qu'il faudrait s'en occuper.
    const last = derniereActionDe(userData, b.key);
    if (last && Date.now() - last > 30 * 86400000) out.enJachere.push(b.key);
  }
  out.palierMoyen = n ? somme / n : 0;
  return out;
}

// ── Ce qui est ouvert ───────────────────────────────────────────────────────
// Une ouverture d'arbre s'obtient dès qu'UNE branche atteint le palier : c'est
// l'inverse d'une moyenne, qui demanderait de tout mener de front - exactement
// le genre d'injonction que le projet s'interdit.
export function ouverturesDe(etat) {
  const maxPalier = Object.values(etat.branches).reduce((m, b) => Math.max(m, b.n), 0);
  return OUVERTURES.map((o) => ({ ...o, ouvert: maxPalier >= o.palierMin }));
}

export function estOuvert(etat, cle) {
  const o = ouverturesDe(etat).find((x) => x.cle === cle);
  return !!(o && o.ouvert);
}

// ── Franchissements ─────────────────────────────────────────────────────────
// Compare deux instantanés et rend les paliers franchis entre les deux. Sert à
// célébrer une seule fois, au bon moment - et jamais à la première visite d'un
// compte qui arrive déjà avec de l'XP.
export function franchissements(avant, apres, branches) {
  const out = [];
  for (const b of branches) {
    const a = palierDe(xpDeBranche(avant, b.key)).n;
    const z = palierDe(xpDeBranche(apres, b.key)).n;
    if (z > a) out.push({ key: b.key, label: b.label, emoji: b.emoji, color: b.color, de: a, vers: z, palier: PALIERS[z] });
  }
  return out;
}

// Phrase d'état d'une branche, en français, sans jugement.
export function phraseDe(etatBranche) {
  const p = etatBranche;
  if (p.n === 0) return "Rien n'y pousse encore";
  // Au sommet, on ne parle plus de progression : il n'y a plus rien à viser,
  // et afficher « 0 XP avant » là serait absurde.
  if (!p.suivant) return 'Franc de pied - elle tient seule';
  if (p.n === 5) return `En fruits · ${p.reste} XP avant de tenir sans tuteur`;
  return `${p.nom} · ${p.reste} XP avant ${p.suivant.nom.toLowerCase()}`;
}
