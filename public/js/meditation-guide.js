// /js/meditation-guide.js - Ce qui manquait a la meditation : le guidage.
//
// Le module proposait « Calme & Sérénité - 5 min » et lancait... un compte a
// rebours de cinq minutes avec un fond sonore. Aucune raison de le faire ici
// plutot qu'avec le minuteur d'un telephone. C'est pour ca que personne ne s'y
// mettait : le produit promettait une seance guidee et livrait une horloge.
//
// Ici, une voix accompagne reellement, et le texte s'affiche en parallele pour
// qui coupe le son ou n'entend pas.
//
// POURQUOI speechSynthesis : elle est NATIVE au navigateur. Pas un fichier
// audio a heberger, pas un CDN (la CSP l'interdirait), pas un centime d'API,
// et elle s'adapte a toutes les durees. Une banque de voix enregistrees aurait
// coute des dizaines de megaoctets pour un resultat fige.
//
// POSITIONS RELATIVES : chaque phrase porte un `p` entre 0 et 1, pas un temps
// en secondes. Le meme script tient donc en 3 minutes comme en 30 - une seance
// personnalisee n'a pas besoin d'etre reecrite.
//
// LIMITE VOLONTAIRE (regle CYL non-directif) : le guidage parle du CORPS et de
// L'ATTENTION - respirer, relacher, remarquer. Jamais de ce qu'il faudrait
// croire, vouloir ou devenir. Aucune phrase ne dit a quelqu'un qui il doit
// etre.

// ── Les scripts ─────────────────────────────────────────────────────────────
export const SCRIPTS = {
  calm: [
    [0.00, 'Installe-toi. Tu peux fermer les yeux, ou simplement baisser le regard.'],
    [0.05, 'Prends une inspiration lente. Et laisse-la repartir sans la retenir.'],
    [0.11, 'Sens le poids de ton corps. Là où il touche le sol, la chaise, le lit.'],
    [0.19, 'Tes épaules. Laisse-les descendre d’un centimètre.'],
    [0.27, 'Ta mâchoire. Desserre-la.'],
    [0.35, 'Ton front. Laisse-le se lisser.'],
    [0.43, 'Si une pensée passe, ce n’est pas une erreur. Laisse-la traverser.'],
    [0.52, 'Reviens à ta respiration. Elle n’a rien de spécial à faire.'],
    [0.61, 'Écoute ce qu’il y a autour de toi. Sans nommer, sans juger.'],
    [0.70, 'Ton corps respire tout seul depuis le premier jour. Tu peux lui laisser faire.'],
    [0.80, 'Encore un moment. Il n’y a rien à réussir ici.'],
    [0.89, 'Commence à revenir. Sens tes mains, sens tes pieds.'],
    [0.95, 'Bouge doucement les doigts.'],
    [0.99, 'Quand tu es prêt, ouvre les yeux.'],
  ],
  focus: [
    [0.00, 'Assieds-toi droit, sans raideur.'],
    [0.05, 'Une inspiration profonde. Puis laisse le souffle reprendre son rythme.'],
    [0.11, 'Choisis un point : le bout de tes narines, ou le mouvement de ton ventre.'],
    [0.18, 'Pose ton attention là. Juste là.'],
    [0.27, 'Elle va partir. C’est normal, ce n’est pas un échec.'],
    [0.36, 'Chaque fois que tu la ramènes, tu muscles exactement ce que tu es venu muscler.'],
    [0.46, 'Compte tes expirations. Un. Deux. Jusqu’à dix.'],
    [0.56, 'Si tu perds le compte, reprends à un. Sans t’en vouloir.'],
    [0.66, 'Le mental s’agite quand on l’observe. Laisse-le s’agiter, continue de regarder.'],
    [0.76, 'Rien d’autre à faire que ça.'],
    [0.85, 'Encore quelques respirations.'],
    [0.92, 'Ton attention est plus stable qu’au début. Remarque-le.'],
    [0.97, 'Reviens à la pièce. Ouvre les yeux quand tu veux.'],
  ],
  sleep: [
    [0.00, 'Allonge-toi. Laisse le matelas porter tout ton poids.'],
    [0.05, 'Tu n’as plus rien à tenir.'],
    [0.10, 'Inspire par le nez. Expire par la bouche, plus longtemps.'],
    [0.17, 'Tes pieds deviennent lourds.'],
    [0.24, 'Tes jambes s’enfoncent.'],
    [0.31, 'Ton bassin, ton dos. Lourds.'],
    [0.39, 'Tes mains, tes bras. Lourds.'],
    [0.47, 'Ta nuque se relâche.'],
    [0.55, 'Ton visage se défait.'],
    [0.64, 'Si la journée revient, elle a le droit. Elle passera.'],
    [0.73, 'Ta respiration ralentit d’elle-même.'],
    [0.82, 'Tu n’as pas besoin de rester éveillé jusqu’au bout.'],
    [0.90, 'Laisse venir.'],
  ],
  gratitude: [
    [0.00, 'Installe-toi. Respire une fois, lentement.'],
    [0.06, 'Pense à quelque chose de bien qui t’est arrivé aujourd’hui. Même minuscule.'],
    [0.14, 'Revois-le. Où tu étais, ce que tu as senti.'],
    [0.24, 'Reste avec ça un moment.'],
    [0.34, 'Maintenant, quelqu’un. Une personne qui t’a fait du bien, un jour.'],
    [0.44, 'Tu n’as pas besoin de le lui dire. Le ressentir suffit.'],
    [0.54, 'Pense à une chose de ton corps qui fonctionne sans que tu la demandes.'],
    [0.63, 'Ton cœur bat depuis le premier jour, sans une seule pause.'],
    [0.72, 'Pense à une difficulté que tu as traversée.'],
    [0.80, 'Tu es de l’autre côté, maintenant.'],
    [0.87, 'Rien de tout cela n’était garanti.'],
    [0.93, 'Garde une de ces images avec toi.'],
    [0.98, 'Reviens doucement.'],
  ],
  'body-scan': [
    [0.00, 'Allonge-toi, ou assieds-toi confortablement.'],
    [0.04, 'On va parcourir ton corps. Sans rien changer : juste en regardant.'],
    [0.09, 'Commence par le sommet du crâne.'],
    [0.15, 'Le front, les tempes.'],
    [0.21, 'Les yeux, les paupières. Laisse-les lourdes.'],
    [0.27, 'Les joues, la mâchoire. Desserre.'],
    [0.33, 'La gorge, la nuque.'],
    [0.39, 'Les épaules. Laisse-les tomber.'],
    [0.46, 'Les bras, jusqu’aux mains. Chaque doigt.'],
    [0.53, 'La poitrine, qui monte et qui descend.'],
    [0.60, 'Le ventre. Laisse-le se relâcher.'],
    [0.66, 'Le dos, appuyé.'],
    [0.72, 'Le bassin, les hanches.'],
    [0.78, 'Les cuisses, les genoux.'],
    [0.84, 'Les mollets, les chevilles.'],
    [0.90, 'Les pieds. La plante, les orteils.'],
    [0.95, 'Ton corps entier, d’un seul tenant.'],
    [0.99, 'Reviens quand tu veux.'],
  ],
  nature: [
    [0.00, 'Ferme les yeux. Tu vas quelque part.'],
    [0.06, 'Un sentier. De la terre sous tes pieds.'],
    [0.13, 'Il fait doux. Le soleil passe entre les feuilles.'],
    [0.21, 'Écoute : des feuilles, un oiseau, loin.'],
    [0.29, 'Tu marches sans être pressé.'],
    [0.38, 'Le sentier s’ouvre sur une clairière.'],
    [0.46, 'De l’herbe haute. Un arbre au milieu.'],
    [0.54, 'Tu t’assieds contre le tronc.'],
    [0.62, 'Le vent bouge dans les branches, au-dessus de toi.'],
    [0.70, 'L’air sent la terre chaude.'],
    [0.78, 'Personne ne t’attend nulle part.'],
    [0.86, 'Reste là.'],
    [0.93, 'Cet endroit ne disparaît pas quand tu pars. Tu peux revenir.'],
    [0.98, 'Reviens dans la pièce, doucement.'],
  ],
  // La respiration a deja son rythme visuel : la voix ne compte pas les cycles
  // (ce serait harcelant), elle pose seulement quelques reperes.
  breathing: [
    [0.00, 'Suis le cercle. Il grandit quand tu inspires, il rétrécit quand tu expires.'],
    [0.08, 'Ne force pas. Si le rythme est trop lent, respire plus doucement, pas plus fort.'],
    [0.20, 'Si ton mental part, il revient au souffle tout seul. Pas besoin de le rappeler.'],
    [0.35, 'Tu peux fermer les yeux et suivre au son de ta propre respiration.'],
    [0.50, 'Tu es à la moitié. Rien à faire de plus que ça.'],
    [0.65, 'Ton rythme cardiaque est déjà en train de suivre.'],
    [0.78, 'Ton corps connaît ce rythme mieux que toi.'],
    [0.90, 'Encore quelques souffles.'],
    [0.98, 'Voilà. Reprends ton rythme normal.'],
  ],
};

// La reflexion se construit autour de la question tiree : le script est genere.
export function reflectionScript(question) {
  const q = String(question || '').trim();
  return [
    [0.00, 'Installe-toi. Voici ta question.'],
    [0.06, q],
    [0.14, 'Ne réponds pas tout de suite. Laisse-la tourner.'],
    [0.30, q],
    [0.40, 'Qu’est-ce qui t’est venu en premier ? Est-ce vraiment ce que tu penses ?'],
    [0.55, 'Et si c’était l’inverse ?'],
    [0.70, q],
    [0.85, 'Il n’y a pas de bonne réponse. Il y a la tienne, aujourd’hui.'],
    [0.95, 'Garde ce qui est venu.'],
  ];
}

// ── La voix ─────────────────────────────────────────────────────────────────
// getVoices() est peuplee de facon asynchrone : au premier appel elle renvoie
// souvent un tableau vide, d'ou l'ecoute de `voiceschanged`.
export function createVoice() {
  const synth = window.speechSynthesis;
  const available = !!synth && typeof SpeechSynthesisUtterance === 'function';
  let voice = null;
  let muted = false;

  function pick() {
    if (!available) return;
    const all = synth.getVoices() || [];
    const fr = all.filter((v) => /^fr/i.test(v.lang || ''));
    // Une voix locale ne depend pas du reseau : elle ne coupera pas en plein
    // milieu d'une seance parce que la connexion a faibli.
    voice = fr.find((v) => v.localService) || fr[0] || null;
  }
  if (available) {
    pick();
    try { synth.addEventListener('voiceschanged', pick); } catch (_) { synth.onvoiceschanged = pick; }
  }

  return {
    available,
    isMuted: () => muted,
    setMuted(m) { muted = !!m; if (muted) this.stop(); },
    say(text) {
      if (!available || muted || !text) return;
      try {
        // On coupe la phrase precedente : deux voix superposees sont pires que
        // pas de voix du tout.
        synth.cancel();
        const u = new SpeechSynthesisUtterance(String(text));
        if (voice) u.voice = voice;
        u.lang = voice ? voice.lang : 'fr-FR';
        u.rate = 0.82;    // plus lent que la parole normale, sans etre trainant
        u.pitch = 1;
        u.volume = 0.9;
        synth.speak(u);
      } catch (_) {}
    },
    stop() { if (available) { try { synth.cancel(); } catch (_) {} } },
  };
}

// ── Le moteur ───────────────────────────────────────────────────────────────
// Il ne tient PAS son propre minuteur : il est nourri par celui de la seance,
// une fois par seconde. Deux horloges auraient forcement derive l'une de
// l'autre, et le texte se serait decale de la respiration.
export function createGuide({ voice, onLine }) {
  let script = [];
  let total = 0;
  let next = 0;

  return {
    load(steps, totalSeconds) {
      script = (steps || []).slice().sort((a, b) => a[0] - b[0]);
      total = Math.max(1, totalSeconds || 1);
      next = 0;
      if (onLine) onLine('');
    },
    // Renvoie true si une phrase vient d'etre prononcee.
    tick(elapsedSeconds) {
      let spoke = false;
      while (next < script.length && script[next][0] * total <= elapsedSeconds) {
        const line = script[next][1];
        next++;
        if (!line) continue;
        if (voice) voice.say(line);
        if (onLine) onLine(line);
        spoke = true;
      }
      return spoke;
    },
    // Rejoue depuis le debut sans reprononcer ce qui est deja passe : sert a la
    // reprise apres pause.
    seek(elapsedSeconds) {
      next = 0;
      while (next < script.length && script[next][0] * total <= elapsedSeconds) next++;
    },
    reset() { next = 0; if (onLine) onLine(''); },
    hasScript: () => script.length > 0,
  };
}
