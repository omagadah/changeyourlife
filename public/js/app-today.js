// /js/app-today.js - LA BARRE DU JOUR, en tete de l'espace.
//
// POURQUOI ELLE EXISTE
// L'accueil empilait quatorze blocs de meme poids, et surtout : rien n'y
// changeait d'un jour a l'autre. Aucune raison de revenir demain. C'est le
// mecanisme qu'Oura et Apple Fitness ont resolu avec un anneau quotidien :
// un reperage visible, remis a zero chaque matin, qu'on a envie de completer.
//
// Elle remplace TROIS blocs qui disaient la meme chose autrement :
//   · la ligne d'accueil (bonjour + date + XP)
//   · les 7 « actions rapides » (des liens vers les memes modules)
//   · la carte « Aujourd'hui » (cachee par defaut, en 7e position, sous l'arbre)
// Les actions rapides deviennent les GESTES DU JOUR : meme lien, plus leur
// etat. Un seul bloc au lieu de trois, et il devient la raison de revenir.
//
// POSTURE - ce n'est PAS une note sur une vie (regle non negociable du projet).
// On compte des gestes POSES, on ne juge pas ceux qui ne le sont pas : pas de
// « score », pas de pourcentage de reussite, pas de reproche pour un anneau
// incomplet. Une journee a 1 sur 7 est une journee, pas un echec.

import { doc, getDoc, collection, getDocs, query, orderBy, limit }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sameDay = (ts) => ts && new Date(ts).toDateString() === new Date().toDateString();

// Les gestes du jour. L'ordre est celui d'une journee, pas celui des modules :
// on se reveille (sommeil), on se situe (humeur), on agit, on relit (journal,
// gratitude). C'est ce qui rend la barre lisible sans la lire.
const GESTES = [
  { key: 'sommeil',   ic: '🌙', label: 'Sommeil',   href: '/sommeil/' },
  { key: 'humeur',    ic: '😌', label: 'Humeur',    href: '/humeur/' },
  { key: 'habitudes', ic: '✅', label: 'Habitudes', href: '/habitudes/' },
  { key: 'meditation', ic: '🧘', label: 'Méditer',  href: '/meditation/' },
  { key: 'organizer', ic: '🗂️', label: 'Trier',    href: '/organizer/' },
  { key: 'journal',   ic: '✍️', label: 'Journal',   href: '/journal/' },
  { key: 'gratitude', ic: '🌟', label: 'Gratitude', href: '/gratitude/' },
];

// ── Lecture de l'etat du jour ────────────────────────────────────────────────
// Les trois trackers datent leur document avec la cle du jour : une lecture
// CIBLEE (getDoc) au lieu d'une requete sur la collection. Sept gestes coutent
// ainsi quatre lectures, pas sept requetes.
async function readEtat(db, uid, userData) {
  const k = dayKey();
  const etat = {};

  const lire = async (col) => {
    try { const s = await getDoc(doc(db, 'users', uid, col, k)); return s.exists(); }
    catch (_) { return false; }
  };
  const [sommeil, humeur, gratitude] = await Promise.all([
    lire('sleep'), lire('moods'), lire('gratitude'),
  ]);
  etat.sommeil = { done: sommeil };
  etat.humeur = { done: humeur };
  etat.gratitude = { done: gratitude };

  // Journal : pas de cle par jour, on regarde les entrees les plus recentes.
  try {
    const snap = await getDocs(query(collection(db, 'users', uid, 'journal'), orderBy('createdAt', 'desc'), limit(3)));
    etat.journal = {
      done: snap.docs.some((d) => {
        const ts = d.data().createdAt;
        const date = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
        return date && date.toDateString() === new Date().toDateString();
      }),
    };
  } catch (_) { etat.journal = { done: false }; }

  // Les trois suivants vivent dans le document utilisateur, deja charge par
  // app.js : zero lecture supplementaire.
  const med = userData.meditation || {};
  const derniere = med.lastSessionAt || (Array.isArray(med.history) && med.history[0] && med.history[0].completedAt);
  etat.meditation = { done: !!sameDay(derniere) };

  const habits = Array.isArray(userData.habits) ? userData.habits : [];
  const faites = habits.filter((h) => sameDay(h.lastDoneAt)).length;
  etat.habitudes = {
    done: habits.length > 0 && faites === habits.length,
    partiel: faites > 0 && faites < habits.length,
    detail: habits.length ? `${faites}/${habits.length}` : '',
    vide: habits.length === 0,
  };

  // Organizer : une fiche rangee ou terminee aujourd'hui compte comme un geste.
  const board = userData.organizer;
  let bouge = 0, aTrier = 0;
  if (board && Array.isArray(board.columns)) {
    for (const c of board.columns) {
      for (const card of (c.cards || [])) {
        if (c.id === 'tri' && !card.done) aTrier += 1;
        if (sameDay(card.doneAt)) { bouge += 1; continue; }
        const dernier = (card.logs || [])[0];
        if (dernier && sameDay(dernier.at)) bouge += 1;
      }
    }
  }
  etat.organizer = { done: bouge > 0, detail: aTrier ? `${aTrier} à trier` : '', vide: !board };

  return etat;
}

// ── L'anneau ─────────────────────────────────────────────────────────────────
// Un cercle, pas une barre : une barre se lit comme une progression vers une
// fin (« il reste 4 »), un anneau se lit comme un etat du jour.
function anneau(faits, total) {
  const R = 26, C = 2 * Math.PI * R;
  const pct = total ? faits / total : 0;
  return `
    <svg class="td-ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="${R}" class="td-ring-bg"/>
      <circle cx="32" cy="32" r="${R}" class="td-ring-fg"
        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}"/>
    </svg>
    <span class="td-ring-txt"><b>${faits}</b><i>/${total}</i></span>`;
}

function salutation() {
  const h = new Date().getHours();
  if (h < 6) return 'Bonne nuit';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

// ── Rendu ────────────────────────────────────────────────────────────────────
export async function mountToday(db, uid, userData, prenom) {
  const host = document.getElementById('today-bar');
  if (!host) return;

  let etat;
  try { etat = await readEtat(db, uid, userData); }
  catch (_) { etat = {}; }

  const items = GESTES.map((g) => ({ ...g, ...(etat[g.key] || {}) }));
  const faits = items.filter((g) => g.done).length;

  const xp = Number(userData.xp_total || userData.totalXp || 0)
    || ['xp_body', 'xp_heart', 'xp_etre', 'xp_order'].reduce((s, k) => s + (Number(userData[k]) || 0), 0);

  // Serie : combien de jours d'affilee avec au moins un geste. Lue depuis les
  // habitudes et la meditation, les deux seules series deja tenues en base.
  const serie = Number(userData.meditation && userData.meditation.streak) || 0;

  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  // Le titre choisi dans le profil s'affichait dans l'ancienne ligne d'accueil.
  // Il la suit ici : le retirer aurait supprimé en silence une chose que
  // l'utilisateur a explicitement choisi d'afficher.
  const titre = String(userData.selectedTitle || '').slice(0, 40);

  host.innerHTML = `
    <div class="td-head">
      <div class="td-ring-wrap" title="${faits} geste${faits > 1 ? 's' : ''} posé${faits > 1 ? 's' : ''} aujourd'hui">
        ${anneau(faits, items.length)}
      </div>
      <div class="td-id">
        <div class="td-hello">${esc(salutation())}${prenom ? ', ' + esc(prenom) : ''}</div>
        <div class="td-date">${esc(date)}${titre ? ` <span class="td-titre">· ${esc(titre)}</span>` : ''}</div>
      </div>
      <div class="td-meters">
        ${serie > 1 ? `<span class="td-meter" title="Jours d'affilée"><i>🔥</i>${serie} j</span>` : ''}
        <span class="td-meter gold" title="Ton XP total - il fait grandir ton arbre"><i>⚡</i>${xp.toLocaleString('fr-FR')} XP</span>
      </div>
    </div>
    <div class="td-gestes">
      ${items.map((g) => {
        const cls = g.done ? ' on' : g.partiel ? ' half' : '';
        const detail = g.detail ? `<span class="td-g-n">${esc(g.detail)}</span>` : '';
        return `<a class="td-g${cls}" href="${g.href}">
          <span class="td-g-ic">${g.ic}</span>
          <span class="td-g-l">${esc(g.label)}</span>
          ${detail}
          <span class="td-g-check" aria-hidden="true">✓</span>
        </a>`;
      }).join('')}
    </div>`;

  // Le libelle sous l'anneau change de ton avec la journee, sans jamais juger
  // une journee creuse : on constate, on n'evalue pas.
  const wrap = host.querySelector('.td-ring-wrap');
  if (wrap) {
    wrap.setAttribute('aria-label',
      faits === 0 ? "Aucun geste posé pour l'instant aujourd'hui"
        : `${faits} geste${faits > 1 ? 's' : ''} posé${faits > 1 ? 's' : ''} sur ${items.length} aujourd'hui`);
  }
}
