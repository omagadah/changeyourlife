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
  pl: '<svg viewBox="0 0 5 3"><rect width="5" height="3" fill="#fff"/><rect y="1.5" width="5" height="1.5" fill="#DC143C"/></svg>',
  ru: '<svg viewBox="0 0 3 3"><rect width="3" height="3" fill="#fff"/><rect y="1" width="3" height="1" fill="#0039A6"/><rect y="2" width="3" height="1" fill="#D52B1E"/></svg>',
  sv: '<svg viewBox="0 0 16 10"><rect width="16" height="10" fill="#006AA7"/><rect x="5" width="2" height="10" fill="#FECC00"/><rect y="4" width="16" height="2" fill="#FECC00"/></svg>',
  tr: '<svg viewBox="0 0 6 4"><rect width="6" height="4" fill="#E30A17"/><circle cx="2.35" cy="2" r="0.95" fill="#fff"/><circle cx="2.62" cy="2" r="0.76" fill="#E30A17"/></svg>',
  ja: '<svg viewBox="0 0 5 3"><rect width="5" height="3" fill="#fff"/><circle cx="2.5" cy="1.5" r="0.9" fill="#BC002D"/></svg>',
  zh: '<svg viewBox="0 0 6 4"><rect width="6" height="4" fill="#DE2910"/><circle cx="1.2" cy="1.1" r="0.55" fill="#FFDE00"/></svg>',
  hi: '<svg viewBox="0 0 3 3"><rect width="3" height="3" fill="#fff"/><rect width="3" height="1" fill="#FF9933"/><rect y="2" width="3" height="1" fill="#138808"/><circle cx="1.5" cy="1.5" r="0.27" fill="none" stroke="#0a3a8c" stroke-width="0.07"/></svg>',
};

// ── Registre des langues proposées (ordre = ordre d'affichage). ─────────────
// `en` = nom anglais (sert d'indication au traducteur IA). Pas de drapeau →
// une pastille avec le code s'affiche à la place.
export const LANGS = [
  { code: 'fr', label: 'Français',   en: 'French',     dir: 'ltr' },
  { code: 'en', label: 'English',    en: 'English',    dir: 'ltr' },
  { code: 'es', label: 'Español',    en: 'Spanish',    dir: 'ltr' },
  { code: 'de', label: 'Deutsch',    en: 'German',     dir: 'ltr' },
  { code: 'it', label: 'Italiano',   en: 'Italian',    dir: 'ltr' },
  { code: 'pt', label: 'Português',  en: 'Portuguese', dir: 'ltr' },
  { code: 'nl', label: 'Nederlands', en: 'Dutch',      dir: 'ltr' },
  { code: 'pl', label: 'Polski',     en: 'Polish',     dir: 'ltr' },
  { code: 'ru', label: 'Русский',    en: 'Russian',    dir: 'ltr' },
  { code: 'sv', label: 'Svenska',    en: 'Swedish',    dir: 'ltr' },
  { code: 'tr', label: 'Türkçe',     en: 'Turkish',    dir: 'ltr' },
  { code: 'ja', label: '日本語',      en: 'Japanese',   dir: 'ltr' },
  { code: 'zh', label: '中文',        en: 'Chinese (Simplified)', dir: 'ltr' },
  { code: 'ko', label: '한국어',      en: 'Korean',     dir: 'ltr' },
  { code: 'hi', label: 'हिन्दी',       en: 'Hindi',      dir: 'ltr' },
  { code: 'ar', label: 'العربية',     en: 'Arabic',     dir: 'rtl' },
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
    'beat.wake': 'Réveil en pleine forme',
    'beat.meditate': 'Méditation du matin',
    'beat.hydrate': 'Hydratation',
    'beat.journal': 'Journal du jour',
    'beat.sport': 'Séance de sport',
    'beat.goal': 'Objectif atteint',
    'beat.gratitude': 'Gratitude notée',
    'beat.reading': '30 min de lecture',
    'beat.call': 'Appel à un proche',
    'beat.sleep': 'Nuit réparatrice',
    'beat.habit': 'Habitude tenue 7 jours',
    'beat.levelup': 'Nouveau palier de niveau',
    // ── Panneaux de branches (8 dimensions = pyramide de Maslow) ──
    'branch.physio.label': 'Physiologique',
    'branch.physio.desc': 'Le besoin vital — la base de tout. Sans énergie ni sommeil, rien d’autre ne tient debout.',
    'branch.physio.s1.name': 'Sommeil', 'branch.physio.s1.note': '7 à 9 h règlent l’humeur, le focus, la santé.',
    'branch.physio.s2.name': 'Nutrition', 'branch.physio.s2.note': 'Le carburant du cerveau et du corps.',
    'branch.physio.s3.name': 'Hydratation', 'branch.physio.s3.note': 'Le premier réflexe, trop souvent oublié.',
    'branch.physio.s4.name': 'Mouvement', 'branch.physio.s4.note': 'Le corps est fait pour bouger, chaque jour.',
    'branch.physio.s5.name': 'Repos', 'branch.physio.s5.note': 'Récupérer fait partie de la performance.',
    'branch.physio.modules': 'Déjà sur le site : Sommeil, Habitudes.',
    'branch.securite.label': 'Sécurité',
    'branch.securite.desc': 'Se sentir à l’abri — un toit, des ressources, un lendemain serein.',
    'branch.securite.s1.name': 'Logement', 'branch.securite.s1.note': 'Un lieu stable, le point d’ancrage.',
    'branch.securite.s2.name': 'Stabilité', 'branch.securite.s2.note': 'Un cadre prévisible où se poser.',
    'branch.securite.s3.name': 'Finances', 'branch.securite.s3.note': 'Un coussin, c’est de la sérénité.',
    'branch.securite.s4.name': 'Santé', 'branch.securite.s4.note': 'Prévenir, écouter les signaux du corps.',
    'branch.securite.s5.name': 'Sérénité', 'branch.securite.s5.note': 'L’esprit libre, parce que la base est tenue.',
    'branch.securite.modules': 'Module dédié à venir.',
    'branch.appartenance.label': 'Appartenance',
    'branch.appartenance.desc': 'Aimer et être aimé. Personne ne s’épanouit seul.',
    'branch.appartenance.s1.name': 'Famille', 'branch.appartenance.s1.note': 'Tes racines, ton premier cercle.',
    'branch.appartenance.s2.name': 'Amis', 'branch.appartenance.s2.note': 'Ceux qui te choisissent.',
    'branch.appartenance.s3.name': 'Amour', 'branch.appartenance.s3.note': 'L’intimité, le lien profond.',
    'branch.appartenance.s4.name': 'Empathie', 'branch.appartenance.s4.note': 'Comprendre et accueillir l’autre.',
    'branch.appartenance.s5.name': 'Communauté', 'branch.appartenance.s5.note': 'Appartenir à plus grand que soi.',
    'branch.appartenance.modules': 'Module dédié à venir.',
    'branch.estime.label': 'Estime',
    'branch.estime.desc': 'Être reconnu — et d’abord se reconnaître soi-même de la valeur.',
    'branch.estime.s1.name': 'Confiance', 'branch.estime.s1.note': 'Croire en sa capacité d’agir.',
    'branch.estime.s2.name': 'Compétence', 'branch.estime.s2.note': 'Ce que tu sais faire, vraiment.',
    'branch.estime.s3.name': 'Réussite', 'branch.estime.s3.note': 'Atteindre ce que tu vises.',
    'branch.estime.s4.name': 'Reconnaissance', 'branch.estime.s4.note': 'Être vu et apprécié pour ce que tu fais.',
    'branch.estime.s5.name': 'Fierté', 'branch.estime.s5.note': 'Le respect que tu te portes.',
    'branch.estime.modules': 'Déjà sur le site : Autoévaluation, Bilan.',
    'branch.cognitif.label': 'Cognitif',
    'branch.cognitif.desc': 'Le besoin de savoir, de comprendre, d’explorer le monde et soi.',
    'branch.cognitif.s1.name': 'Savoir', 'branch.cognitif.s1.note': 'Nourrir l’esprit en continu.',
    'branch.cognitif.s2.name': 'Curiosité', 'branch.cognitif.s2.note': 'Le moteur de toute découverte.',
    'branch.cognitif.s3.name': 'Compréhension', 'branch.cognitif.s3.note': 'Relier les choses, voir clair.',
    'branch.cognitif.s4.name': 'Apprentissage', 'branch.cognitif.s4.note': 'Grandir, toujours.',
    'branch.cognitif.s5.name': 'Lucidité', 'branch.cognitif.s5.note': 'Penser net, décider juste.',
    'branch.cognitif.modules': 'Déjà sur le site : Codex, Journal.',
    'branch.esthetique.label': 'Esthétique',
    'branch.esthetique.desc': 'Le besoin de beauté, d’harmonie et d’ordre — autour de soi et en soi.',
    'branch.esthetique.s1.name': 'Beauté', 'branch.esthetique.s1.note': 'Ce qui élève le regard.',
    'branch.esthetique.s2.name': 'Harmonie', 'branch.esthetique.s2.note': 'L’équilibre entre les choses.',
    'branch.esthetique.s3.name': 'Ordre', 'branch.esthetique.s3.note': 'Un cadre clair libère l’esprit.',
    'branch.esthetique.s4.name': 'Créativité', 'branch.esthetique.s4.note': 'Mettre de la forme au monde.',
    'branch.esthetique.s5.name': 'Émerveillement', 'branch.esthetique.s5.note': 'Savoir encore s’étonner.',
    'branch.esthetique.modules': 'Module dédié à venir.',
    'branch.accomplissement.label': 'Accomplissement',
    'branch.accomplissement.desc': 'Devenir pleinement soi — réaliser son potentiel.',
    'branch.accomplissement.s1.name': 'Croissance', 'branch.accomplissement.s1.note': 'Toujours un cran plus loin.',
    'branch.accomplissement.s2.name': 'Projets', 'branch.accomplissement.s2.note': 'Ce que tu mets au monde.',
    'branch.accomplissement.s3.name': 'Maîtrise', 'branch.accomplissement.s3.note': 'L’excellence dans ce qui compte.',
    'branch.accomplissement.s4.name': 'Authenticité', 'branch.accomplissement.s4.note': 'Vivre aligné avec qui tu es.',
    'branch.accomplissement.s5.name': 'Vision', 'branch.accomplissement.s5.note': 'Savoir où tu vas.',
    'branch.accomplissement.modules': 'Déjà sur le site : Objectifs, Méditation.',
    'branch.transcendance.label': 'Transcendance',
    'branch.transcendance.desc': 'Aller au-delà de soi — donner du sens, contribuer, transmettre. La cime s’épanouit tard, et c’est normal.',
    'branch.transcendance.s1.name': 'Spiritualité', 'branch.transcendance.s1.note': 'Le lien à plus vaste que soi.',
    'branch.transcendance.s2.name': 'Contribution', 'branch.transcendance.s2.note': 'Ce que tu apportes au monde.',
    'branch.transcendance.s3.name': 'Sens', 'branch.transcendance.s3.note': 'Le pourquoi de tout le reste.',
    'branch.transcendance.s4.name': 'Transmission', 'branch.transcendance.s4.note': 'Ce que tu passes aux autres.',
    'branch.transcendance.s5.name': 'Héritage', 'branch.transcendance.s5.note': 'La trace que tu laisses.',
    'branch.transcendance.modules': 'Déjà sur le site : Gratitude. Frise chronologique à venir.',
    'app.open': 'Ouvrir →',
    'app.plan.title': "Aujourd'hui — ton plan du jour",
    'app.plan.desc': 'Ton rythme, tes besoins essentiels et tes tâches — chaque action fait grandir ton arbre.',
    'app.skills.title': 'Mes compétences',
    'app.skills.desc': 'Tes savoir-faire (cuisine, info, sport…) qui montent de niveau avec le temps.',
    'app.modules': 'Tous les modules',
    'app.domains': 'Niveaux par domaine',
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
    'beat.wake': 'Woke up full of energy',
    'beat.meditate': 'Morning meditation',
    'beat.hydrate': 'Hydration',
    'beat.journal': 'Daily journal',
    'beat.sport': 'Workout session',
    'beat.goal': 'Goal achieved',
    'beat.gratitude': 'Gratitude noted',
    'beat.reading': '30 min of reading',
    'beat.call': 'Called a loved one',
    'beat.sleep': 'Restful night',
    'beat.habit': 'Habit kept for 7 days',
    'beat.levelup': 'New level reached',
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
    'beat.wake': 'Despertar lleno de energía',
    'beat.meditate': 'Meditación matutina',
    'beat.hydrate': 'Hidratación',
    'beat.journal': 'Diario del día',
    'beat.sport': 'Sesión de deporte',
    'beat.goal': 'Objetivo logrado',
    'beat.gratitude': 'Gratitud anotada',
    'beat.reading': '30 min de lectura',
    'beat.call': 'Llamada a un ser querido',
    'beat.sleep': 'Noche reparadora',
    'beat.habit': 'Hábito mantenido 7 días',
    'beat.levelup': 'Nuevo nivel alcanzado',
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
    'beat.wake': 'Voller Energie aufgewacht',
    'beat.meditate': 'Morgenmeditation',
    'beat.hydrate': 'Genug getrunken',
    'beat.journal': 'Tagebuch des Tages',
    'beat.sport': 'Sporteinheit',
    'beat.goal': 'Ziel erreicht',
    'beat.gratitude': 'Dankbarkeit notiert',
    'beat.reading': '30 Min. gelesen',
    'beat.call': 'Angehörigen angerufen',
    'beat.sleep': 'Erholsame Nacht',
    'beat.habit': 'Gewohnheit 7 Tage gehalten',
    'beat.levelup': 'Neue Stufe erreicht',
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
    'beat.wake': 'Sveglia pieno di energia',
    'beat.meditate': 'Meditazione mattutina',
    'beat.hydrate': 'Idratazione',
    'beat.journal': 'Diario del giorno',
    'beat.sport': 'Sessione di sport',
    'beat.goal': 'Obiettivo raggiunto',
    'beat.gratitude': 'Gratitudine annotata',
    'beat.reading': '30 min di lettura',
    'beat.call': 'Chiamata a una persona cara',
    'beat.sleep': 'Notte ristoratrice',
    'beat.habit': 'Abitudine mantenuta 7 giorni',
    'beat.levelup': 'Nuovo livello raggiunto',
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
    'beat.wake': 'Acordar cheio de energia',
    'beat.meditate': 'Meditação da manhã',
    'beat.hydrate': 'Hidratação',
    'beat.journal': 'Diário do dia',
    'beat.sport': 'Sessão de desporto',
    'beat.goal': 'Objetivo alcançado',
    'beat.gratitude': 'Gratidão registada',
    'beat.reading': '30 min de leitura',
    'beat.call': 'Chamada a alguém querido',
    'beat.sleep': 'Noite reparadora',
    'beat.habit': 'Hábito mantido 7 dias',
    'beat.levelup': 'Novo nível alcançado',
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
    'beat.wake': 'Vol energie wakker geworden',
    'beat.meditate': 'Ochtendmeditatie',
    'beat.hydrate': 'Hydratatie',
    'beat.journal': 'Dagboek van vandaag',
    'beat.sport': 'Sportsessie',
    'beat.goal': 'Doel behaald',
    'beat.gratitude': 'Dankbaarheid genoteerd',
    'beat.reading': '30 min lezen',
    'beat.call': 'Dierbare gebeld',
    'beat.sleep': 'Herstellende nacht',
    'beat.habit': 'Gewoonte 7 dagen volgehouden',
    'beat.levelup': 'Nieuw niveau bereikt',
    'ui.langTitle': 'Kies je taal',
    'ui.langSearch': 'Zoek een taal',
    'ui.langNone': 'Geen taal gevonden',
  },
};

// ── Moteur ───────────────────────────────────────────────────────────────────
const STORE_KEY = 'cyl_lang';
let current = 'fr';

function pick() {
  const has = (c) => LANGS.some((l) => l.code === c);
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved && has(saved)) return saved;
  } catch (_) {}
  const nav = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  return has(nav) ? nav : 'fr';
}

// ── Cache des traductions IA (langues sans dictionnaire écrit à la main, ou
//    clés manquantes d'une langue principale comme les panneaux de branches). ──
// Bump SRC_VERSION si on modifie une chaîne source FR → invalide les caches.
const SRC_VERSION = 1;
const ai = {};                 // ai[lang] = { clé: traduction }
const translating = new Set(); // langues dont une traduction IA est en cours

function cacheName(lang) { return 'cyl_i18n:' + lang; }
function loadCache(lang) {
  try {
    const raw = JSON.parse(localStorage.getItem(cacheName(lang)) || 'null');
    if (raw && raw.v === SRC_VERSION && raw.m) return raw.m;
  } catch (_) {}
  return {};
}
function saveCache(lang) {
  try { localStorage.setItem(cacheName(lang), JSON.stringify({ v: SRC_VERSION, m: ai[lang] || {} })); } catch (_) {}
}

function t(key) {
  const hand = DICT[current] && DICT[current][key];
  if (hand) return hand;
  const cached = ai[current] && ai[current][key];
  if (cached) return cached;
  return DICT.fr[key] || key;   // repli FR le temps que l'IA traduise
}

// Drapeau SVG si dispo, sinon pastille avec le code (langues « exotiques »).
function flagHTML(code) {
  return FLAGS[code] || `<span class="lang-chip">${code.toUpperCase()}</span>`;
}

// Traduit (via /api/translate) toutes les clés FR encore non couvertes pour
// `lang`, par lots, en mettant à jour le DOM + le cache au fur et à mesure.
async function ensureTranslations(lang) {
  if (lang === 'fr' || translating.has(lang)) return;
  const missing = {};
  for (const k in DICT.fr) {
    const hand = DICT[lang] && DICT[lang][k];
    const cached = ai[lang] && ai[lang][k];
    if (!hand && !cached) missing[k] = DICT.fr[k];
  }
  const keys = Object.keys(missing);
  if (!keys.length) return;
  translating.add(lang);
  ai[lang] = ai[lang] || {};
  const CHUNK = 50;
  const name = meta(lang).en || lang;
  try {
    for (let i = 0; i < keys.length; i += CHUNK) {
      const slice = keys.slice(i, i + CHUNK);
      const items = {};
      slice.forEach((k) => { items[k] = missing[k]; });
      let data;
      try {
        const r = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: lang, targetName: name, items }),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        data = await r.json();
      } catch (e) {
        console.warn('[i18n] traduction IA indisponible pour', lang, e?.message || e);
        break;   // on garde le repli FR, sans boucler
      }
      const tr = data && data.translations;
      if (tr) {
        Object.assign(ai[lang], tr);
        saveCache(lang);
        if (lang === current) {
          applyDom();
          window.dispatchEvent(new CustomEvent('cyl:langchange', { detail: { lang } }));
        }
      }
    }
  } finally {
    translating.delete(lang);
  }
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
  if (!meta(code) || !LANGS.some((l) => l.code === code)) return;
  current = code;
  const m = meta(code);
  document.documentElement.lang = code;
  document.documentElement.dir = m.dir || 'ltr';
  if (persist !== false) { try { localStorage.setItem(STORE_KEY, code); } catch (_) {} }
  if (!ai[code]) ai[code] = loadCache(code);   // cache IA éventuel
  applyDom();
  syncButton();
  syncList();
  // La 3D (Lya, stades, panneaux) se met à jour via cet évènement.
  window.dispatchEvent(new CustomEvent('cyl:langchange', { detail: { lang: code } }));
  // Complète les clés manquantes via l'IA (langues exotiques, branches…).
  ensureTranslations(code);
}

// Exposé global pour arbre3d.js (Lya, stades).
window.CYL = window.CYL || {};
window.CYL.t = t;
window.CYL.getLang = () => current;
window.CYL.setLang = (c) => setLang(c, true);

// Sélection par l'utilisateur : on mémorise le choix puis on RECHARGE toute la
// page — ainsi l'intégralité du site (DOM + scène 3D) repart proprement dans la
// nouvelle langue, sans état résiduel.
function selectLang(code) {
  if (code === current) { closePop(); return; }
  try { localStorage.setItem(STORE_KEY, code); } catch (_) {}
  location.reload();
}

// ── Sélecteur de langue (bouton + popover avec recherche) ───────────────────
let elBtn, elPop, elFlag, elCode, elList, elSearch, elEmpty;

function syncButton() {
  const m = meta(current);
  if (elFlag) elFlag.innerHTML = flagHTML(current);
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
      `<span class="lang-opt-flag">${flagHTML(l.code)}</span>` +
      `<span class="lang-opt-name">${l.label}</span>` +
      `<span class="lang-opt-check" aria-hidden="true">` +
        `<svg viewBox="0 0 14 14"><path d="M2.5 7.5 6 11 11.5 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    li.addEventListener('click', () => { selectLang(l.code); });
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

// ── Auto-injection du sélecteur (pages sans markup inline, ex. /app/) ────────
// Couleurs en fallback explicite pour rester correct hors de la palette accueil.
const SWITCHER_CSS = `
.lang-switch{position:relative;}
.lang-switch--floating{position:fixed;top:16px;right:70px;z-index:50;}
.lang-btn{display:flex;align-items:center;gap:8px;padding:8px 12px 8px 10px;border-radius:99px;cursor:pointer;background:rgba(255,255,255,0.04);border:1px solid var(--line,rgba(221,205,160,0.18));color:var(--text-2,#b4ad94);font-family:inherit;font-size:0.84rem;font-weight:600;transition:color .25s,border-color .25s,background .25s;}
.lang-btn:hover{color:var(--text-1,#f4efe1);border-color:rgba(132,194,94,0.42);background:rgba(132,194,94,0.1);}
.lang-flag{width:21px;height:15px;border-radius:3px;overflow:hidden;flex-shrink:0;display:block;box-shadow:0 0 0 1px rgba(0,0,0,0.25),0 1px 3px rgba(0,0,0,0.35);}
.lang-flag svg,.lang-opt-flag svg{width:100%;height:100%;display:block;object-fit:cover;}
.lang-code{letter-spacing:0.5px;}
.lang-chev{width:12px;height:12px;opacity:0.7;transition:transform .25s;}
.lang-btn[aria-expanded="true"] .lang-chev{transform:rotate(180deg);}
.lang-chip{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:8px;font-weight:800;letter-spacing:0.2px;color:#0c130a;background:linear-gradient(135deg,#f1cd92,#6f9a52);}
.lang-opt-flag .lang-chip{font-size:9px;}
.lang-pop{position:absolute;top:calc(100% + 10px);right:0;width:264px;z-index:30;padding:8px;border-radius:18px;background:rgba(13,18,11,0.96);backdrop-filter:blur(22px) saturate(1.2);-webkit-backdrop-filter:blur(22px) saturate(1.2);border:1px solid var(--line,rgba(221,205,160,0.18));box-shadow:0 24px 64px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.05);opacity:0;visibility:hidden;transform:translateY(-8px) scale(0.97);transform-origin:top right;transition:opacity .22s ease,transform .26s cubic-bezier(0.22,1,0.36,1),visibility .22s;}
.lang-pop.open{opacity:1;visibility:visible;transform:none;}
.lang-search-wrap{display:flex;align-items:center;gap:8px;margin:2px 2px 6px;padding:9px 12px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);}
.lang-search-wrap svg{width:15px;height:15px;color:var(--text-3,#7c7660);flex-shrink:0;}
.lang-search-wrap input{flex:1;min-width:0;border:none;background:none;outline:none;color:var(--text-1,#f4efe1);font-family:inherit;font-size:0.88rem;}
.lang-search-wrap input::placeholder{color:var(--text-3,#7c7660);}
.lang-list{list-style:none;margin:0;padding:0;max-height:268px;overflow-y:auto;}
.lang-list::-webkit-scrollbar{width:6px;}
.lang-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:99px;}
.lang-opt{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:11px;cursor:pointer;outline:none;transition:background .16s;}
.lang-opt:hover,.lang-opt:focus-visible{background:rgba(132,194,94,0.12);}
.lang-opt.active{background:rgba(132,194,94,0.08);}
.lang-opt-flag{width:23px;height:16px;border-radius:3px;overflow:hidden;flex-shrink:0;box-shadow:0 0 0 1px rgba(0,0,0,0.25);}
.lang-opt-name{flex:1;font-size:0.9rem;font-weight:600;color:var(--text-1,#f4efe1);}
.lang-opt-check{width:16px;height:16px;color:#84c25e;opacity:0;flex-shrink:0;}
.lang-opt-check svg{width:100%;height:100%;}
.lang-opt.active .lang-opt-check{opacity:1;}
.lang-empty{padding:18px 12px;text-align:center;color:var(--text-3,#7c7660);font-size:0.86rem;}
@media (max-width:600px){.lang-switch--floating{right:60px;top:14px;}.lang-switch--floating .lang-code{display:none;}}
`;
const SWITCHER_HTML = `
<div class="lang-switch" id="lang-switch">
  <button class="lang-btn" id="lang-btn" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="Changer de langue">
    <span class="lang-flag" id="lang-btn-flag"></span>
    <span class="lang-code" id="lang-btn-code">FR</span>
    <svg class="lang-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <div class="lang-pop" id="lang-pop" role="dialog" aria-label="Choisir une langue">
    <div class="lang-search-wrap">
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 10.5 14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      <input type="text" id="lang-search" autocomplete="off" spellcheck="false" data-i18n-ph="ui.langSearch" placeholder="Rechercher une langue" aria-label="Rechercher une langue" />
    </div>
    <ul class="lang-list" id="lang-list" role="listbox" aria-label="Langues"></ul>
    <div class="lang-empty" id="lang-empty" data-i18n="ui.langNone" hidden>Aucune langue trouvée</div>
  </div>
</div>`;
function ensureSwitcherUI() {
  if (!document.getElementById('cyl-lang-css')) {
    const s = document.createElement('style'); s.id = 'cyl-lang-css'; s.textContent = SWITCHER_CSS;
    document.head.appendChild(s);
  }
  if (document.getElementById('lang-switch')) return;  // page avec markup inline (accueil)
  const wrap = document.createElement('div');
  wrap.innerHTML = SWITCHER_HTML.trim();
  const el = wrap.firstElementChild;
  el.classList.add('lang-switch--floating');
  document.body.appendChild(el);
}

// ── Boot ─────────────────────────────────────────────────────────────────────
function boot() {
  ensureSwitcherUI();
  initSwitcher();
  setLang(pick(), false);   // applique sans réécrire le storage (respecte la détection)
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
