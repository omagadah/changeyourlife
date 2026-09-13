// /js/seed.js - LA NAISSANCE. On plante la graine, l'arbre apparait.
//
// CE QUI EXISTAIT AVANT CE FICHIER : rien. CLAUDE.md, app.js et firebase.js
// renvoyaient tous les trois a `tree-widget.js` (« CYL accueille le nouvel
// utilisateur et plante l arbre avec lui ») - un fichier absent du depot. Le
// premier ecran d un nouvel inscrit etait un tableau de bord vide, sans un mot.
//
// LE PARTI PRIS : la premiere phrase que la personne ecrit ne part pas dans le
// vide. Elle oriente sa premiere branche, ET devient la premiere fiche de son
// ORGANIZER. On ne lui fait pas remplir un formulaire d inscription deguise :
// on lui fait poser la premiere chose de sa vie dans l outil.
//
// AUCUN APPEL RESEAU. CYL parle avec des phrases ecrites, et `classify()`
// (organizer-data.js) devine la branche hors ligne. C est deliberé : le moment
// le plus fragile du parcours ne doit dependre ni d un quota, ni d une latence,
// ni d un modele qui change de nom. Un LLM ici, c est un ecran blanc le jour ou
// l API tombe - et on ne rate pas deux fois une premiere impression.
//
// POSTURE : les deux questions sont OUVERTES et peuvent rester vides. On ne
// demande pas d objectif, on ne propose pas de programme, on ne juge aucune
// reponse. « Passer » est visible des le premier ecran.

import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { classify, newCard, normalizeBoard, TRI_ID, BRANCH_BY_KEY } from '/js/organizer-data.js';
import { mountAvatar } from '/js/cyl-avatar.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// XP de depart : exactement le seuil du palier « Germe » (cf. growth.js).
// La graine plantee DOIT germer - sinon on finit l acte fondateur sur un arbre
// qui n a pas bouge.
const XP_GRAINE = 40;

// ── Faut-il planter ? ───────────────────────────────────────────────────────
// Une seule condition : l arbre n a jamais ete plante. On ne se fie pas a
// `hasSeenTutorial` seul - ce drapeau vient de l ancien tutoriel Shepherd
// supprime, et des comptes l ont a true sans avoir jamais vu de graine.
export function doitPlanter(userData) {
  if (!userData) return true;
  if (userData.tree && userData.tree.seed && userData.tree.seed.plantedAt) return false;
  // Un compte qui a deja de l XP a vecu sans cet ecran : on ne le renvoie pas
  // a sa naissance, ce serait absurde et vaguement insultant.
  const br = userData.tree && userData.tree.branches;
  if (br && Object.values(br).some((b) => (b && b.xp) > 0)) return false;
  return true;
}

// ── Les etapes ──────────────────────────────────────────────────────────────
const ETAPES = [
  {
    cle: 'accueil',
    cyl: "Bonjour. Je suis CYL.",
    texte: "Ici, ta vie prend la forme d'un arbre. Il ne pousse pas tout seul : il pousse là où tu agis, vraiment.",
    action: 'Planter ma graine',
  },
  {
    cle: 'q1',
    cyl: "Qu'est-ce qui t'amène ici ?",
    texte: "Ce que tu veux, avec tes mots. Il n'y a pas de bonne réponse, et tu peux passer.",
    champ: "Ce qui m'amène...",
  },
  {
    cle: 'q2',
    cyl: "Et qu'est-ce qui compte pour toi, en ce moment ?",
    texte: "Une chose, même petite. Elle deviendra la première note de ton espace.",
    champ: 'Ce qui compte pour moi...',
  },
];

// ── Rendu ───────────────────────────────────────────────────────────────────
function injecterCSS() {
  if (document.getElementById('cyl-seed-css')) return;
  const s = document.createElement('style');
  s.id = 'cyl-seed-css';
  s.textContent = `
  .seed-ov {
    position:fixed; inset:0; z-index:99800; display:flex; align-items:center; justify-content:center;
    padding:24px calc(20px + env(safe-area-inset-right,0px)) calc(24px + env(safe-area-inset-bottom,0px)) calc(20px + env(safe-area-inset-left,0px));
    background:
      radial-gradient(ellipse 70% 50% at 50% 100%, rgba(74,122,58,.22), transparent 70%),
      radial-gradient(ellipse 60% 40% at 50% 0%, rgba(231,177,92,.10), transparent 70%),
      #070b06;
    opacity:0; transition:opacity .5s ease;
  }
  .seed-ov.on { opacity:1; }
  .seed-ov.out { opacity:0; }
  .seed-box { width:min(520px,100%); text-align:center; }

  /* La scene : la graine, puis la pousse. Une seule zone qui change d etat,
     pour que l oeil suive UNE chose qui se transforme. */
  .seed-scene { height:170px; display:flex; align-items:flex-end; justify-content:center; margin-bottom:20px; }
  .seed-svg { width:150px; height:170px; overflow:visible; }
  .seed-sol { stroke:rgba(231,177,92,.34); stroke-width:2; stroke-linecap:round; }
  .seed-grain {
    fill:#c9a227; transform-origin:75px 118px;
    animation:seedPulse 2.6s ease-in-out infinite;
  }
  @keyframes seedPulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.09);} }
  .seed-ov[data-etat="pousse"] .seed-grain,
  .seed-ov[data-etat="arbre"] .seed-grain { animation:none; opacity:.35; }

  /* Tiges, racines et feuilles se dessinent par leur trace : un seul
     stroke-dashoffset anime, aucun reflow. */
  .seed-trace { fill:none; stroke:#84c25e; stroke-width:3; stroke-linecap:round;
    stroke-dasharray:var(--l,200); stroke-dashoffset:var(--l,200);
    transition:stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1); }
  .seed-ov[data-etat="pousse"] .seed-tige,
  .seed-ov[data-etat="arbre"] .seed-tige { stroke-dashoffset:0; }
  .seed-racine { stroke:rgba(201,162,39,.6); stroke-width:2; }
  .seed-ov[data-etat="racine"] .seed-racine,
  .seed-ov[data-etat="pousse"] .seed-racine,
  .seed-ov[data-etat="arbre"] .seed-racine { stroke-dashoffset:0; }
  .seed-feuille { fill:#84c25e; opacity:0; transform-origin:75px 70px;
    transition:opacity .7s ease .5s, transform .7s cubic-bezier(.34,1.56,.64,1) .5s; transform:scale(.4); }
  .seed-ov[data-etat="arbre"] .seed-feuille { opacity:1; transform:scale(1); }

  .seed-cyl { display:flex; align-items:center; gap:11px; justify-content:center; margin-bottom:14px; }
  .seed-orb { width:40px; height:40px; flex-shrink:0; }
  .seed-t { font-size:1.18rem; font-weight:800; color:#f4efe1; letter-spacing:-.3px; line-height:1.3; text-align:left; }
  .seed-p { font-size:.88rem; color:#b4ad94; line-height:1.6; margin-bottom:20px; }
  .seed-in {
    width:100%; padding:13px 15px; border-radius:13px; resize:none;
    border:1px solid rgba(221,205,160,.18); background:rgba(255,255,255,.04); color:#f4efe1;
    font:inherit; font-size:.92rem; line-height:1.5; margin-bottom:16px;
  }
  .seed-in:focus { outline:none; border-color:rgba(132,194,94,.55); box-shadow:0 0 0 3px rgba(132,194,94,.14); }
  .seed-in::placeholder { color:#6b6656; }
  .seed-btns { display:flex; align-items:center; justify-content:center; gap:14px; }
  .seed-ok {
    padding:13px 26px; border:none; border-radius:13px; cursor:pointer;
    background:linear-gradient(135deg,#84c25e,#6f9a52); color:#07120a;
    font:inherit; font-size:.92rem; font-weight:800;
    box-shadow:0 10px 30px -12px rgba(132,194,94,.9);
    transition:transform .18s, filter .18s;
  }
  .seed-ok:hover { transform:translateY(-2px); filter:brightness(1.07); }
  .seed-ok:disabled { opacity:.5; cursor:default; transform:none; }
  .seed-skip { border:none; background:none; cursor:pointer; color:#6b6656; font:inherit; font-size:.8rem; }
  .seed-skip:hover { color:#b4ad94; text-decoration:underline; }
  .seed-pas { display:flex; gap:6px; justify-content:center; margin-top:22px; }
  .seed-pas i { width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,.16); transition:background .3s, width .3s; }
  .seed-pas i.on { background:#84c25e; width:18px; border-radius:3px; }

  .seed-fin-br {
    display:inline-flex; align-items:center; gap:8px; padding:9px 16px; border-radius:99px;
    background:rgba(132,194,94,.13); border:1px solid rgba(132,194,94,.34);
    color:#a8d98a; font-size:.86rem; font-weight:800; margin-bottom:18px;
  }
  @media (prefers-reduced-motion:reduce) {
    .seed-ov, .seed-trace, .seed-feuille { transition:none; }
    .seed-grain { animation:none; }
  }
  @media (max-width:560px) { .seed-t { font-size:1.04rem; } .seed-scene { height:140px; } .seed-svg { width:120px; height:140px; } }
  `;
  document.head.appendChild(s);
}

function scene() {
  // Longueurs de trace approchées : elles n'ont qu'à dépasser la longueur
  // réelle pour que le trait parte bien de rien.
  return `
  <svg class="seed-svg" viewBox="0 0 150 170" aria-hidden="true">
    <line class="seed-sol" x1="18" y1="126" x2="132" y2="126"/>
    <path class="seed-trace seed-racine" style="--l:70"  d="M75 122 C 70 140, 56 146, 48 156"/>
    <path class="seed-trace seed-racine" style="--l:70"  d="M75 122 C 80 140, 94 146, 102 156"/>
    <path class="seed-trace seed-tige"   style="--l:130" d="M75 120 C 75 100, 75 84, 75 58"/>
    <path class="seed-trace seed-tige"   style="--l:70"  d="M75 84 C 62 76, 52 70, 44 62"/>
    <path class="seed-trace seed-tige"   style="--l:70"  d="M75 74 C 88 66, 98 60, 106 52"/>
    <ellipse class="seed-grain" cx="75" cy="118" rx="9" ry="11"/>
    <ellipse class="seed-feuille" cx="40" cy="58"  rx="11" ry="7" transform="rotate(-28 40 58)"/>
    <ellipse class="seed-feuille" cx="110" cy="48" rx="11" ry="7" transform="rotate(28 110 48)"/>
    <ellipse class="seed-feuille" cx="75" cy="52"  rx="10" ry="13"/>
  </svg>`;
}

// ── Le parcours ─────────────────────────────────────────────────────────────
// `apercu: true` rejoue l'ecran SANS RIEN ECRIRE : ni fiche, ni XP, ni drapeau.
// C est indispensable pour pouvoir regarder la naissance depuis un compte deja
// actif - la seule facon de la juger sans creer un compte jetable a chaque fois.
// Et ca protege surtout l ORGANIZER : `enregistrer()` reecrit le board entier
// a partir de userData, donc le rejouer sur une donnee pas fraiche ecraserait
// de vraies fiches.
export function planterGraine(db, uid, userData, opts) {
  const apercu = !!(opts && opts.apercu);
  return new Promise((resolve) => {
    injecterCSS();

    const ov = document.createElement('div');
    ov.className = 'seed-ov';
    ov.dataset.etat = 'graine';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Planter ton arbre');
    ov.innerHTML = `
      <div class="seed-box">
        <div class="seed-scene">${scene()}</div>
        <div class="seed-cyl"><div class="seed-orb"></div><div class="seed-t" id="seed-t"></div></div>
        <p class="seed-p" id="seed-p"></p>
        <div id="seed-champ"></div>
        <div class="seed-btns">
          <button class="seed-ok" id="seed-ok" type="button"></button>
          <button class="seed-skip" id="seed-skip" type="button">Passer</button>
        </div>
        <div class="seed-pas" id="seed-pas"></div>
      </div>`;
    document.body.appendChild(ov);
    mountAvatar(ov.querySelector('.seed-orb'), { size: 40, ring: true });
    requestAnimationFrame(() => ov.classList.add('on'));

    const reponses = {};
    let i = 0;

    const tEl = ov.querySelector('#seed-t');
    const pEl = ov.querySelector('#seed-p');
    const champEl = ov.querySelector('#seed-champ');
    const okEl = ov.querySelector('#seed-ok');
    const skipEl = ov.querySelector('#seed-skip');
    const pasEl = ov.querySelector('#seed-pas');

    const points = () => {
      pasEl.innerHTML = ETAPES.map((_, n) => `<i class="${n === i ? 'on' : ''}"></i>`).join('') + '<i></i>';
    };

    function afficher() {
      const e = ETAPES[i];
      tEl.textContent = e.cyl;
      pEl.textContent = e.texte;
      champEl.innerHTML = e.champ
        ? `<textarea class="seed-in" id="seed-in" rows="2" placeholder="${esc(e.champ)}" aria-label="${esc(e.cyl)}"></textarea>`
        : '';
      okEl.textContent = e.action || 'Continuer';
      ov.dataset.etat = i === 0 ? 'graine' : i === 1 ? 'racine' : 'pousse';
      points();
      const in_ = ov.querySelector('#seed-in');
      if (in_) {
        setTimeout(() => { try { in_.focus(); } catch (_) {} }, 120);
        // Entree valide, Maj+Entree passe a la ligne : on ecrit une phrase,
        // pas un paragraphe.
        in_.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); suivant(); }
        });
      } else {
        setTimeout(() => { try { okEl.focus(); } catch (_) {} }, 120);
      }
    }

    function suivant() {
      const e = ETAPES[i];
      const in_ = ov.querySelector('#seed-in');
      if (in_) reponses[e.cle] = (in_.value || '').trim().slice(0, 500);
      i += 1;
      if (i < ETAPES.length) { afficher(); return; }
      terminer();
    }

    // ── La fin : l arbre apparait, et on ecrit ───────────────────────────────
    async function terminer() {
      // La branche vient des mots de la personne, pas d un choix impose.
      // On lit les deux reponses ensemble : « ce qui compte » pese plus, mais
      // « ce qui t amene » aide quand la seconde est vide.
      const source = [reponses.q2, reponses.q1].filter(Boolean).join('. ');
      const lecture = source ? classify(source) : null;
      const cle = (lecture && lecture.branch) || 'accomplissement';
      const br = BRANCH_BY_KEY[cle] || BRANCH_BY_KEY.accomplissement;

      ov.dataset.etat = 'arbre';
      tEl.textContent = 'Voilà ton arbre.';
      pEl.textContent = apercu
        ? "Aperçu : rien n'a été enregistré, ton espace n'a pas bougé."
        : source
          ? "Il pousse là où tu agis. Ta première note est déjà déposée dans ton espace."
          : "Il pousse là où tu agis. À toi de jouer.";
      champEl.innerHTML = `<div class="seed-fin-br">${br.emoji} Première branche : ${esc(br.label)}</div>`;
      okEl.textContent = 'Entrer';
      skipEl.style.display = 'none';
      pasEl.innerHTML = ETAPES.map(() => '<i></i>').join('') + '<i class="on"></i>';
      okEl.onclick = fermer;
      try { okEl.focus(); } catch (_) {}

      // Ecriture en arriere-plan : l utilisateur ne doit jamais attendre un
      // aller-retour reseau devant l ecran final de son inscription.
      enregistrer(cle, source).catch(() => {});
    }

    async function enregistrer(cle, source) {
      // Mode aperçu : on a juste regardé l'écran, rien ne doit bouger en base.
      if (apercu) return;

      const patch = {
        hasSeenTutorial: true,     // compat : d anciennes pages lisent ce drapeau
        tree: {
          seed: {
            plantedAt: Date.now(),
            premiereBranche: cle,
            // On garde ce que la personne a ecrit : c est son point de depart,
            // elle doit pouvoir le relire plus tard. Rien n en est deduit
            // d autre que la branche.
            motsDuDebut: source ? String(source).slice(0, 500) : '',
          },
        },
      };

      // La 2e reponse devient la premiere fiche de l ORGANIZER : ce que la
      // personne vient d ecrire existe VRAIMENT quelque part apres l ecran.
      if (reponses.q2) {
        try {
          const board = normalizeBoard((userData && userData.organizer) || null);
          const carte = newCard(reponses.q2, { branch: cle });
          const tri = board.columns.find((c) => c.id === TRI_ID);
          if (tri) tri.cards.unshift(carte);
          patch.organizer = board;
        } catch (_) { /* la graine est plantee meme si la fiche echoue */ }
      }

      try {
        await setDoc(doc(db, 'users', uid), patch, { merge: true });
      } catch (_) { /* silencieux : l ecran est deja passe */ }

      // L XP passe par la Cloud Function (validation serveur), jamais en
      // ecriture directe. La graine germe : 40 XP = seuil du palier « Germe ».
      try {
        const fn = window._cyfFirebase && window._cyfFirebase.awardXp;
        if (fn) await fn(cle, XP_GRAINE);
      } catch (_) {}
    }

    function fermer() {
      ov.classList.add('out');
      setTimeout(() => { try { ov.remove(); } catch (_) {} resolve(true); }, 520);
    }

    okEl.onclick = suivant;
    skipEl.onclick = () => {
      // Passer n est pas annuler : la graine est plantee quand meme, sinon
      // l ecran reviendrait a chaque visite.
      enregistrer('accomplissement', '').catch(() => {});
      fermer();
    };

    afficher();
  });
}
