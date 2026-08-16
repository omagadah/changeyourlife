# Roadmap - ChangeYourLife.ai

> Liste opérationnelle, à cocher au fil de l'eau. Vision narrative → [docs/VISION.md](docs/VISION.md).
> Architecture technique → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). MAJ : **2026-08-16**.

---

# 🎬 CHANTIER MAJEUR - « le site s'explique tout seul »

> Décidé le 2026-08-16. **Priorité produit après l'ORGANIZER.**
> Aucun utilisateur ne doit se demander « qu'est-ce que je fais ici ? ».

## 1 · Démonstration fantôme à la première connexion (le gros morceau)

À la **toute première** visite d'un module - et **uniquement** celle-là - le
site se joue lui-même sous les yeux de l'utilisateur, en filigrane.

Scénario pour l'ORGANIZER :

1. Une idée d'exemple **s'écrit toute seule** dans le champ de dépôt, lettre
   par lettre, en gris très clair, presque invisible (ex. « Rappeler le
   dentiste »).
2. Elle **part dans « À trier »** : la fiche fantôme glisse du champ vers la
   colonne, avec la même courbe que le vrai rendu.
3. Un **curseur de souris dessiné** apparaît, vient saisir la fiche (le curseur
   change visiblement de la flèche à la main fermée), la **déplace** dans
   « Urgent · Important », et la relâche.
4. Tout s'efface. L'utilisateur a compris sans lire une ligne.

Règles impératives :

- **Jamais de doute sur ce qui se passe.** Un libellé discret et permanent
  (« Démonstration - regarde comment ça marche ») doit accompagner l'animation,
  sinon l'utilisateur croit à un bug ou à une saisie fantôme.
- **Interruptible à tout moment** : la moindre frappe ou le moindre clic arrête
  la démo et rend la main. Bouton « passer » visible.
- **Aucune donnée créée** : la fiche de démo est purement visuelle, jamais
  écrite dans Firestore.
- **Une seule fois par module**, mémorisé côté utilisateur (`users/{uid}.seenDemo`),
  pas en localStorage seul (sinon elle se rejoue sur chaque appareil).
- `prefers-reduced-motion` → remplacer l'animation par 3 captures fixes légendées.

**À décliner ensuite sur TOUS les modules** (plan, agenda, journal, habitudes,
compétences, arbre…). C'est le fil conducteur de l'onboarding : le site
enseigne son propre usage, module par module, au moment où on y arrive.

## 2 · Généraliser l'« onglet-module » de l'ORGANIZER

Le motif validé le 2026-08-16 sur `/app/` : **un aperçu utile en haut de la
page d'accueil, dont TOUT le bandeau d'en-tête est cliquable et mène au module
complet.** L'utilisateur agit tout de suite (déposer une idée) sans quitter
l'accueil, et n'ouvre la page complète que s'il en a besoin.

À décliner, chacun avec son aperçu actionnable :

| Module | Aperçu en tête de `/app/` | Mène à |
|---|---|---|
| ORGANIZER | dépôt + 4 colonnes Eisenhower | `/organizer/` ✅ fait |
| Aujourd'hui | rythme du jour, base vitale à cocher | `/plan/` |
| Agenda | 3 prochains créneaux + ajout rapide | `/agenda/` |
| Journal | champ « une ligne sur ta journée » | `/journal/` |
| Compétences | les 2-3 compétences qui montent | `/competences/` |
| Habitudes | cases du jour, cochables sur place | `/habitudes/` |

Règles du motif :

- **Toute la bande** est la zone de clic (lien étiré, `pointer-events:none`
  sur le texte), pas seulement le titre. Le survol éclaire la bande entière :
  la surface visible et la surface cliquable doivent coïncider.
- Les boutons d'action de l'en-tête restent **au-dessus** du lien et ne
  déclenchent pas la navigation.
- L'aperçu ne montre que l'essentiel ; **le module complet garde la totalité**
  des données (l'ORGANIZER affiche tout, y compris ce qui est déjà planifié).
- Un module par bandeau, jamais empilés au point de faire défiler l'accueil.

## 3 · CHARTE GRAPHIQUE COMPLÈTE (gros morceau — à faire EN DERNIER)

> La mise en page se fait à la fin. On construit d'abord des modules qui
> marchent, on habille ensuite. Mais quand on y viendra, ce sera un chantier
> entier, pas une retouche.

À produire :

- **Charte graphique formelle** : palette figée (rôles, pas juste des teintes),
  échelle typographique, grille d'espacement, rayons, ombres, états
  (repos / survol / focus / actif / désactivé). Un document, pas des valeurs
  éparpillées dans 40 fichiers.
- **Direction artistique de l'XP** : à quoi ressemble un gain ? une montée de
  niveau ? un palier ? Aujourd'hui c'est un toast et un nombre — il n'y a
  aucune *sensation*.
- **Badges par domaine** : un jeu complet pour les 8 branches Maslow, décliné
  par niveau (Novice → Légende). Cohérent avec le badge pixel-art déjà créé.
- **Badges de compétences** : distincts des badges de domaine, liés au module
  Compétences.
- **Effets visuels par branche de l'arbre** : chaque branche doit avoir sa
  signature quand elle reçoit de l'XP (particules, floraison, lumière), et son
  état de négligence (feuilles qui tombent, teinte qui se ternit).
- **XP inscrit DANS la branche** : le nombre visible sur la branche elle-même
  dans la vue 3D, pas seulement dans un anneau à côté.
- **Cohérence clair / sombre** sur tout ce qui précède.

## 4 · CYL propose un tri automatique dans la matrice Eisenhower

Quand des fiches attendent dans « À trier », CYL propose un rangement -
**proposition, jamais application automatique** :

- Pour chaque fiche : colonne Eisenhower suggérée + branche Maslow + une
  échéance plausible, avec **une raison en une ligne** (« tu l'as notée trois
  fois cette semaine », « ça bloque autre chose »).
- L'utilisateur voit la proposition **en aperçu** (fiches fantômes posées dans
  les colonnes cibles) et valide **en bloc** ou **fiche par fiche**.
- Un « Annuler » qui remet tout en place, tant que l'utilisateur n'a pas quitté.
- **Chronologie** : CYL propose aussi un ordre dans la journée / la semaine,
  cohérent avec le Google Agenda déjà rempli.
- Cadre non-négociable : CYL **ne décide pas**. Le vocabulaire reste celui de la
  suggestion, jamais de l'injonction.

---

# 🧠 REFONTE 2026-08 - « l'ORGANIZER est le cerveau »

> **Changement de cap assumé.** Le site n'est plus construit autour de l'arbre qui
> pousse, mais autour de ce dont l'owner a réellement besoin au quotidien :
> déverser ce qu'il a en tête, le trier, le planifier, et être accompagné par une
> IA qui voit tout. L'arbre reste - c'est la signature visuelle et le langage du
> produit - mais il devient le **reflet** de l'action, plus le sujet principal.
>
> Règle de conception : **une seule IA (CYL), au-dessus de tous les modules.**
> Elle lit l'état réel du système et le restitue. Elle propose, ne prescrit jamais
> (cf. cadre éthique non-négociable plus bas).

## Le triangle porteur

```
        ORGANIZER  (ce que tu as en tête, trié par priorité)
             │
    branche  │  échéance                      CYL lit les trois
    Maslow   │  + planification               et rend un brief
             ▼
  MASLOW ◄────────► GOOGLE AGENDA  (ce qui est déjà pris)
  (l'arbre)          lecture + écriture
```

## ✅ Posé le 2026-08-08

- [x] **`/js/gcal.js`** - connecteur Google Agenda **unifié**, scope
  `calendar.events` (**lecture ET écriture**), jeton unique en `sessionStorage`.
  *Corrige un bug bloquant : l'organizer lisait le jeton dans `localStorage`
  alors qu'`agenda.js` l'écrivait dans `sessionStorage`, avec un scope en lecture
  seule → « Ajouter à l'Agenda » ne pouvait pas aboutir.* `agenda.js`,
  `agenda-page.js` et `organizer.js` passent tous par ce module.
- [x] **`/js/organizer-data.js`** - schéma de données partagé (`users/{uid}.organizer`,
  v2). Une fiche porte désormais une **branche Maslow** (`branch`) et l'id de son
  **événement agenda** (`gcalId`). Priorisation (`topPriorities`, `dueToday`) et
  heuristique de rangement (`guessBranch`) côté client.
- [x] **`/js/app-organizer.js`** - l'ORGANIZER **embarqué en tête de `/app/`** :
  capture en une ligne, 4 colonnes Eisenhower, drag & drop, fiche → branche
  Maslow, échéance en 1 clic, « Planifier dans Google Agenda ».
- [x] **`/api/cyl-brief.js` + `/js/cyl-brief.js`** - CYL lit l'organizer **et**
  l'agenda, et rend : un brief du jour, un **profil type** (comment tu fonctionnes,
  d'après tes vraies données), les fiches à regarder en premier, les branches
  nourries vs en jachère. Cache ~12 h, rate-limit 8/h, repli 100 % local sans IA.
- [x] **Refonte de `/app/`** : le « bonjour » réduit à une ligne discrète ·
  ORGANIZER tout en haut · CYL juste dessous · journée (agenda + fiches échues
  fusionnés) · raccourcis · **arbre relégué** (260 px, sous les blocs utiles).
- [x] **Une seule IA** : l'ancien gros CTA « Coach IA / Gemini 2.0 » retiré de
  `/app/` (doublon avec CYL, cf. AUDIT « 3 stacks IA concurrentes »).
- [x] **L'XP suit la vraie branche** : une fiche terminée crédite la branche
  Maslow qu'elle nourrit (au lieu d'« accomplissement » systématiquement).

## 🚧 Suite immédiate de la refonte

- [ ] **Écriture bidirectionnelle** : cocher une fiche → mettre à jour /
  supprimer l'événement agenda ; déplacer un événement → décaler l'échéance.
- [ ] **CYL agissante (tool-use)** : « range ça en urgent », « planifie-moi ça
  jeudi » exécuté directement depuis le chat, avec confirmation de l'utilisateur.
- [ ] **Profil type persistant** : stocker l'analyse dans `users/{uid}.profileAI`
  et la faire évoluer dans le temps (tendances sur 4 semaines) au lieu d'un
  instantané re-calculé.
- [ ] **Capture depuis partout** : raccourci clavier global + partage PWA
  (`share_target`) pour déverser une idée sans ouvrir le site.
- [ ] **Vue « ma semaine »** : organizer + agenda sur 7 jours dans un seul écran.
- [ ] **Retirer `/coach/`** (3e stack IA) ou le fusionner dans CYL.
- [ ] **Rappels** : Web Push sur les fiches à échéance du jour (quick win, aucun
  connecteur externe).

---

## ✅ Fait (avant la refonte)

### Le cœur - l'arbre est la métaphore vivante du site
- [x] Arbre 3D procédural en page d'accueil (landing) - 8 branches = 8 niveaux de Maslow étendue
- [x] Arbre **dans le dashboard** `/app/` - widget en haut, clic → plein écran interactif (✕ pour fermer)
- [x] L'arbre reflète les **vraies données utilisateur** Firestore (`tree.branches`, sinon migration de `levels`)
- [x] Évolution visible : un nouvel utilisateur démarre niveau 1 (8 branches dormantes), l'arbre pousse avec l'XP
- [x] Clic sur une branche → panneau : niveau / XP cumulé / progression / dev / vitalité **réels** + sous-éléments + outils
- [x] Sous-labels des sous-branches affichés au clic uniquement

### XP câblé de bout en bout
- [x] Chaque action des 10 modules crédite la **bonne branche Maslow** via `awardXp`
  - Sommeil / Habitudes / Méditation → physio · Humeur → appartenance · Autoévaluation / Bilan → estime · Codex / Journal → cognitif · Objectifs → accomplissement · Gratitude → transcendance
- [x] Écriture client-side (plan Firebase gratuit), Cloud Function `addXp` conservée pour futur Blaze
- [x] **Carte de récompense** qui glisse à chaque gain d'XP (couleur de la branche nourrie)
- [x] **Pousse visible** au retour sur l'arbre : branches qui ont gagné de l'XP depuis la dernière visite pulsent, Lya récapitule

### Lya
- [x] Présence dans l'arbre en plein écran : message contextuel à l'arrivée
- [x] **Conversation libre** branchée sur l'IA (`/api/coach`) qui voit l'état réel de l'arbre
- [x] Historique de conversation conservé
- [x] **Double provider** : Groq (Llama 3.3 70B, gratuit, rapide - préféré si `GROQ_API_KEY` Vercel) avec fallback Gemini 2.0 Flash
- [x] Diagnostic des erreurs IA remonté côté client (status Gemini/Groq + début du message)

### Onboarding conversationnel
- [x] Nouvel utilisateur → arbre plein écran direct, Lya pose **1 question** pour planter la première branche et expliquer le mécanisme
- [x] Les 7 autres branches restent dormantes et s'éveillent au fil des actions vraies (Sommeil, Journal, Méditation…)
- [x] Message de clôture explicite : « pas d'XP creux, on agit dans le réel et l'arbre le voit »
- [x] L'ancien tutoriel guidé Shepherd a été retiré

### Plomberie
- [x] Service Worker auto-recharge les onglets à chaque déploiement (plus jamais d'utilisateur bloqué sur du vieux cache)
- [x] Network-first pour HTML/JS/CSS (la dernière version est toujours servie en ligne)
- [x] Sécurité : XSS, vulns npm, token v0 purgé de l'historique git
- [x] Firestore rules : ownership stricte + bornes sur les champs user-content

---

## 🚧 Prochaine itération - la « supra-appli » de gestion de vie

> Vision : un objectif réel → des jalons dans le site → synchronisés au calendrier → rappels multi-canaux → l'arbre pousse.

### A · Flow concret « Objectif → Réalité »
Exemple cible (arrêter de fumer) :
- [x] Création d'un objectif avec **jalons datés** (ex: J+7 sans fumer / J+30 / J+90), date d'échéance optionnelle par jalon
- [x] Tri automatique des jalons par échéance, badge de date avec coloration (overdue rouge / soon ambre / ok bleu)
- [x] Surlignage du « prochain jalon » sur chaque carte d'objectif (avec emoji ⚠️ si en retard)
- [x] Chaque jalon coché = **+5 XP** sur la branche de l'objectif (en plus de l'XP de complétion de l'objectif)
- [ ] Une frise globale sous l'arbre pour visualiser tous les jalons sur la durée (page dédiée, plus tard)
- [ ] Génération automatique de jalons par Lya (« Propose-moi 5 jalons pour cet objectif » - nécessite IA payante)

### B · Lya overlay sur TOUTES les interfaces ✅
> L'IA n'est pas dans l'arbre seulement - elle est addossée à chaque page.

- [x] Orb « Parler à Lya » persistant en bas à droite de chaque page authentifiée
- [x] Panneau de chat compact, ferme sur clic en dehors / Échap / ✕
- [x] Contexte envoyé : page actuelle + résumé de l'arbre (8 branches : niveau/dev/vitalité)
- [x] Sur `/app/`, l'orb s'efface quand l'arbre passe en plein écran (le tree-widget a sa propre Lya)
- [ ] **Phase suivante (besoin payant)** : Lya pré-charge l'historique sommeil sur `/sommeil/`, lit les jalons sur `/objectifs/`, propose une amorce de journal sur `/journal/` - vrai contexte spécifique par page

### C · Onboarding - message de clôture
- [ ] Après les 8 branches plantées, Lya explique : « Maintenant à toi. Chaque action sur ce site (méditer, journaler, dormir, atteindre un objectif…) fait pousser SA branche. Pas de magie : on agit dans le vrai, ça compte ici. »

### D · Page Paramètres - connecteurs (le système nerveux)
Sans connecteurs, l'arbre est borgne. Avec, il devient un chêne.

- [x] **Google Calendar** ✅ - connecteur unifié `/js/gcal.js` (lecture + écriture).
  Lit tes événements pour contextualiser CYL, et reçoit les fiches que tu planifies
  depuis l'ORGANIZER. *Reste : synchro bidirectionnelle (cf. refonte 2026-08).*
- [ ] **Trello** - pipeline Notes / idées → objectifs structurés
- [ ] **Montre connectée** (Apple Watch / Google Fit / Garmin) - sommeil + activité + cœur en automatique
- [ ] **WhatsApp bot** - rappels et coups de coude (Lya t'écrit) + journal vocal
- [ ] **SMS / Email** - fallback rappels pour ceux sans WhatsApp
- [ ] **Notifications navigateur** (Web Push) - quick win sans connecteur externe

UI : chaque connecteur = une carte dans `/settings/` avec son état (connecté / non) + bouton OAuth.

### E · Modèle « plugins » - extensibilité
- [ ] Chaque connecteur devient un **add-on** pluggable (manifest minimal : nom, branche nourrie, droits demandés)
- [ ] Le panneau d'une branche affiche les add-ons actifs qui la nourrissent
- [ ] Préparer une API interne `connectors/` pour ajouter facilement de nouveaux pluggables

---

## 🤖 IA - montée en gamme progressive

Stratégie : démarrer avec des modèles **gratuits et simples** (Groq Llama 3.3 70B,
Gemini 2.0 Flash), itérer sur l'UX et la valeur, puis basculer vers des modèles
**payants méga-promptés** quand la base sera prouvée.

- [x] Phase 1 : Groq / Gemini gratuits, prompt système simple, conversation libre
- [ ] **Phase 2 (plus tard)** : provider payant (Claude Opus, GPT-4o, Gemini Pro…)
  - Prompts ultra-spécialisés par contexte (page actuelle, branche en cours, état émotionnel)
  - Mémoire long-terme entre sessions (Lya se souvient de ce qu'elle t'a dit hier)
  - Tool-use : Lya peut directement ouvrir un module, créer un objectif, planifier dans le calendrier
  - Streaming des réponses (effet « elle écrit en direct »)
- [ ] **Visualiseur audio CYL** (réf. v0 `audio-visualizer-k7XX4QGgciS`) : anim d'ondes
  réactive quand CYL parle/écoute. Posture voulue : parler à l'IA n'est **pas central**
  mais **essentiel** - module branché à l'oral quand des connecteurs vocaux arriveront.
  À poser dès qu'on a un canal audio (TTS/STT) ou des modules IA externes connectés.

## ⚖️ Cadre éthique & conformité (CYL) - NON NÉGOCIABLE

Principe : CYL **assiste** sans jamais **diriger**. La frontière (assister vs manipuler)
est tenue par une posture **non-directive** (approche centrée sur la personne / entretien
motivationnel) : refléter, questionner, clarifier - l'utilisateur décide seul. Objectif :
protéger l'utilisateur (autonomie, pas de dérive sectaire/idéologique) ET dédouaner le site
de toute responsabilité sur les décisions des utilisateurs.

- [x] **System prompt non-directif** ✅ (`api/chat.js`) : interdit de prescrire / décider /
  pousser une idéologie ; pas de conseil médical-juridique-financier prescriptif ; sécurité
  détresse (3114/15/112) ; rappel « pas un professionnel de santé ».
- [x] **Wording produit corrigé** ✅ (satellite CYL, widget) : plus de « t'oriente vers la
  bonne action » ; disclaimer visible dans le chat (« ne décide pas à ta place / pas un pro »).
- [ ] **CGU + mentions légales + politique de confidentialité** (pages dédiées, lien footer).
- [x] **Consentement explicite** ✅ à la 1re ouverture de CYL (`cyl-chat.js` : écran de
  consentement + case « j'ai compris que CYL ne remplace pas un professionnel », stocké
  `cyl_consent_v1`). Bloque le chat tant que non accepté.
- [x] **Modération / garde-fou serveur** ✅ (`api/chat.js` : `moderateReply()` détecte la
  détresse dans le message et GARANTIT les ressources d'urgence 3114/15/112/114 dans la
  réponse, quel que soit le retour du modèle ; flag `safety`).

## 📝 Idées validées (à planifier)

- [ ] **Racines / frise chronologique** - le passé de la personne sous l'arbre (mémoire longue, depuis la naissance)
- [ ] **Décor environnant l'arbre** dérivé de la frise (campagne / ville / mer selon le vécu)
- [ ] **Remplacer la vieille page `/yourlife/`** (pyramide statique) par l'arbre - la migration est prête, à activer
- [ ] **Pousse de nouvelles branches** quand des dimensions inconnues émergent (au-delà des 8 Maslow de base)
- [ ] **Anti-triche serveur** : repasser l'écriture XP en Cloud Function le jour où on passe en plan Blaze
- [ ] **Vue détaillée de la branche** dans une page dédiée (`/branche/cognitif/` par ex.) pour drill-down complet

---

## 🌌 Phases futures (cf. [VISION.md §15](docs/VISION.md))

- **Phase 3** - Patterns émergents sur la frise (cycles de joie / d'échec / de croissance détectés par IA)
- **Phase 4** - Scénarios de crise / protocoles de reconstruction (séparation, perte d'emploi, deuil…)
- **Phase 5** - Communauté « ceux qui aident / ceux qui sont aidés » + blockchain + token CYL

---

## 🎨 Univers & expériences premium (idées owner - juin 2026)

> Templates repérés sur **v0.app** : ce sont des composants **React / Next.js**. Notre
> site est **vanilla JS sans build** → chaque template doit être **adapté** en vanilla
> (réécriture du rendu) OU on monte un mini-sous-app. À cadrer feature par feature.

- [x] **Avatar « image → particules »** ✅ FAIT (`/js/particle-avatar.js`) : avatar
  compact rond + grand rendu dans le banner du hero `/profile`, dispersion au survol
  souris. Source = avatar généré / photo uploadée (data URL). *(À étendre : photo
  Google/HD, et réutiliser la version compacte comme avatar global si voulu.)*
- [x] **Badge pixel-art** ✅ FAIT (/js/pixel-badge.js, sceau dans le hero /profile) généré depuis la photo de profil (réf. v0 `clerk-pixel-art-badge`).
  Gamification / profil public. À préparer dès maintenant.
- [x] **ORGANIZER façon canvas IA** ✅ (bascule Board/Canvas sur `/organizer/` : toile
  infinie pan/zoom, fiches positionnables/persistées, nœuds colorés par colonne, grille
  pointée, **connecteurs/flèches entre fiches** - tirer le point d'une fiche, clic sur un
  lien pour l'effacer). Vision workflow IA atteinte (réf. v0 `ai-workflow-canvas`).
- [~] **Changement d’UNIVERS / thème en 1 clic** (Arbre↔Architecture FAIT sur accueil+login+/app via selecteur /profile ; reste : adapter les TEXTES en mode archi, d’autres mondes, plus de details).
  d'autres mondes - ex. **architecture / bureau 3D** (réf. v0 `3d-software-engineer-portfolio`).
  Objectif : **plusieurs arbres + plusieurs thèmes**, décor au choix, préférence persistée.
- [x] **Boutons magnifiques** ✅ (couche premium globale via common.js : relief + halo + press) - + : animations premium sur les CTA (réf. v0 `button`).
  *(Démarré : effet « shine » sur le CTA d'accueil.)*
- [ ] **Matrice / pluie « Matrix »** (réf. v0 `dynamic-rain-website`) : fond de pluie de
  caractères style Matrix. **IMPÉRATIF** pour l'owner. À **débloquer aux niveaux
  supérieurs** (récompense de progression : décor/thème réservé aux hauts niveaux d'XP ou
  au titre max). À poser plus tard - idéalement branché sur le niveau utilisateur comme un
  univers premium (cf. changement d'univers/thème). Pas d'intégration immédiate.
- [ ] **Tags « gravité » animés** (réf. v0 `tags-gravity-animation`) : nuage de tags/mots
  soumis à une physique de gravité (chute, rebond, drag). À poser **plus tard** - idéal
  pour un mini-jeu ou une intégration stylée (ex. tags de compétences/valeurs/émotions qui
  tombent et s'empilent, section ludique). Pas d'intégration immédiate.
- [ ] **Image → ASCII** (réf. v0 `image-to-ascii`) : convertir une image en art ASCII.
  **Même famille** que ce qu'on fait déjà sur `/profile` au choix de la photo (avatar
  particules `particle-avatar.js` + badge pixel-art `pixel-badge.js`) → 3e style de rendu
  d'avatar possible (ASCII), ou effet décoratif. À planifier comme variante d'avatar.
- [x] **Menu vertical animé (top-right)** ✅ (réf. v0 `vertical-menu-component`) : le menu du
  logo en haut à droite se déroule en menu vertical animé (stagger) avec Home /
  Notifications / Profil / Paramètres + déconnexion. `userMenu.js`.
- [x] **Badge ID interactif** ✅ (réf. v0 `interactive-vercel-ship-26-id-badge`) : carte
  d'identité type badge de conf (avatar, nom, titre, Player #, XP) avec inclinaison au
  survol / drag façon lanyard, sur `/profile`. `id-badge.js`.
- [~] **Fiche profil premium** (réf. v0 `metallic-silver-border-card` + `profile-card` +
  `animated-file-upload`) : carte d'identité utilisateur soignée = bordure métallique
  argentée + contenu profile-card fusionné + upload d'avatar animé (drag & drop + preview).
  « L'identification de l'utilisateur » → doit être irréprochable.
- [~] **Dark / Light mode dans le bandeau supérieur** : toggle global à côté du logo (le
  système de thème `light-mode` existe déjà via settings, on l'expose partout).
- [x] **Module Giveaway** ✅ (réf. v0 `ios-style-timer`) : compte à rebours iOS + cooldown,
  violet, en page `/app`. **Backend Firestore** (participations `giveaways/{cycleId}/entries/{uid}`,
  cross-device) + **tirage serveur admin** (`api/giveaway-draw.js`, crypto, réservé claim
  admin) + **back-office** `/admin/giveaway/` + annonce du gagnant dans la carte. Reste
  possible : back-office du lot (texte configurable), notification e-mail du gagnant.
- [x] **Mesures d'urgence (bouton « Urgence »)** ✅ (`urgence.js`) : bouton rectangulaire
  bas-gauche, texte vertical « URGENCE ». Au clic, triage bienveillant (danger / détresse /
  besoin de souffler). Détresse grave → ressources d'urgence immédiates (3114, 15, 112,
  SMS 114). Sinon → respiration guidée + « Parler à CYL ». Anonyme, sans compte.
  Reste possible : détection auto de détresse par CYL pendant la conversation.

## 🌳 Arbre vivant - raffinements restants

- [x] **Croissance PAR BRANCHE Maslow** ✅ (FAIT sur `/app` : 8 nœuds Maslow autour de
  l'arbre, taille/halo ∝ XP réel de chaque branche `tree.branches[key].xp`, croissance
  LIVE via l'événement `cyl:xp-gained`, clic → page de la branche).
- [ ] **Croissance animée (plan de coupe)** aussi sur `/app` quand l'XP monte.
- [ ] **Optimisation** : lazy-load ez-tree (4 Mo) après 1er paint ; arbre allégé sur
  l'accueil ; dispose des géométries au changement.

## 🪐 Cosmos / accueil - qualité visuelle

- [x] **Système solaire à l'échelle** ✅ (Soleil ENORME + 7 planètes proportionnelles
  entre elles, distances croissantes, anneaux d'orbite visibles). Échelle compressée
  (à la vraie échelle le Soleil ferait 109× la Terre) → réglable dans `tree-model.js`.
- [x] **Plaque de Pioneer** ✅ déplacée loin dans l'espace + agrandie (visible au dézoom max).
- [x] **Panneaux satellites masqués au dézoom** ✅ (réglable : constante `SAT_PANEL_HIDE_RADIUS`
  dans `arbre3d.js`, défaut 3000 ; zoom min 95, repos ~200, max 7000).
- [x] **CYL posé sur un rayon** ✅ (mi-hauteur de l'arbre, quasi-géostationnaire ; n'est plus en bas).
- [x] **Squelette ESP (exosquelette rayon-X)** ✅ BASE FAITE : wireframe réel de l'ez-tree
  (parfaitement aligné), limité au **tronc bas + corridors tronc→8 points-catégories + halos
  sous-familles** (`addEspSkeletonCorridors` dans `ez-tree-build.js`, sur accueil + /app ;
  login = tronc seul). Curseurs : `D` (épaisseur), `hubFrac`, `Rnode`, `Rsub`.
- [ ] **Squelette PRÉCIS par branche (à co-construire)** : numéroter schématiquement les
  branches de l'ez-tree (vue de face annotée) avec l'owner, puis mapper EXACTEMENT quelle
  branche = quelle catégorie/sous-famille, pour n'allumer que celles-là (au lieu de
  l'approximation par corridors). → session dédiée plus tard.
- [x] **Emojis premium** ✅ (`emoji.js`) : Twemoji rendu d'abord (couverture 100 %, jamais
  d'emoji système), puis **upgrade Fluent 3D** par probe (swap si l'image charge → 0 cassée).
  Observer = parse des nœuds AJOUTÉS seulement (fix « site qui saute » sur l'accueil 3D).
- [ ] **Références visuelles owner** (sites/templates donnés en session) - à ré-appliquer
  une par une (l'owner doit re-partager les liens ; non conservés entre sessions).

## Principes de priorisation

1. **Cohérence narrative d'abord.** Chaque ajout doit s'expliquer comme une partie de l'arbre, sinon il n'a pas sa place.
2. **Pas de feature sans impact concret** dans la vie réelle de l'utilisateur. Pas d'XP creux.
3. **Une amélioration à la fois.** L'utilisateur valide visuellement, on passe à la suivante.
