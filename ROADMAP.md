# Roadmap — ChangeYourLife.ai

> Liste opérationnelle, à cocher au fil de l'eau. Vision narrative → [docs/VISION.md](docs/VISION.md).
> Architecture technique → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). MAJ : 2026-05-20.

---

## ✅ Fait

### Le cœur — l'arbre est la métaphore vivante du site
- [x] Arbre 3D procédural en page d'accueil (landing) — 8 branches = 8 niveaux de Maslow étendue
- [x] Arbre **dans le dashboard** `/app/` — widget en haut, clic → plein écran interactif (✕ pour fermer)
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
- [x] **Double provider** : Groq (Llama 3.3 70B, gratuit, rapide — préféré si `GROQ_API_KEY` Vercel) avec fallback Gemini 2.0 Flash
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

## 🚧 Prochaine itération — la « supra-appli » de gestion de vie

> Vision : un objectif réel → des jalons dans le site → synchronisés au calendrier → rappels multi-canaux → l'arbre pousse.

### A · Flow concret « Objectif → Réalité »
Exemple cible (arrêter de fumer) :
- [x] Création d'un objectif avec **jalons datés** (ex: J+7 sans fumer / J+30 / J+90), date d'échéance optionnelle par jalon
- [x] Tri automatique des jalons par échéance, badge de date avec coloration (overdue rouge / soon ambre / ok bleu)
- [x] Surlignage du « prochain jalon » sur chaque carte d'objectif (avec emoji ⚠️ si en retard)
- [x] Chaque jalon coché = **+5 XP** sur la branche de l'objectif (en plus de l'XP de complétion de l'objectif)
- [ ] Une frise globale sous l'arbre pour visualiser tous les jalons sur la durée (page dédiée, plus tard)
- [ ] Génération automatique de jalons par Lya (« Propose-moi 5 jalons pour cet objectif » — nécessite IA payante)

### B · Lya overlay sur TOUTES les interfaces ✅
> L'IA n'est pas dans l'arbre seulement — elle est addossée à chaque page.

- [x] Orb « Parler à Lya » persistant en bas à droite de chaque page authentifiée
- [x] Panneau de chat compact, ferme sur clic en dehors / Échap / ✕
- [x] Contexte envoyé : page actuelle + résumé de l'arbre (8 branches : niveau/dev/vitalité)
- [x] Sur `/app/`, l'orb s'efface quand l'arbre passe en plein écran (le tree-widget a sa propre Lya)
- [ ] **Phase suivante (besoin payant)** : Lya pré-charge l'historique sommeil sur `/sommeil/`, lit les jalons sur `/objectifs/`, propose une amorce de journal sur `/journal/` — vrai contexte spécifique par page

### C · Onboarding — message de clôture
- [ ] Après les 8 branches plantées, Lya explique : « Maintenant à toi. Chaque action sur ce site (méditer, journaler, dormir, atteindre un objectif…) fait pousser SA branche. Pas de magie : on agit dans le vrai, ça compte ici. »

### D · Page Paramètres — connecteurs (le système nerveux)
Sans connecteurs, l'arbre est borgne. Avec, il devient un chêne.

- [ ] **Google Calendar** — synchronise les jalons et rappels, lit les événements pour contextualiser Lya
- [ ] **Trello** — pipeline Notes / idées → objectifs structurés
- [ ] **Montre connectée** (Apple Watch / Google Fit / Garmin) — sommeil + activité + cœur en automatique
- [ ] **WhatsApp bot** — rappels et coups de coude (Lya t'écrit) + journal vocal
- [ ] **SMS / Email** — fallback rappels pour ceux sans WhatsApp
- [ ] **Notifications navigateur** (Web Push) — quick win sans connecteur externe

UI : chaque connecteur = une carte dans `/settings/` avec son état (connecté / non) + bouton OAuth.

### E · Modèle « plugins » — extensibilité
- [ ] Chaque connecteur devient un **add-on** pluggable (manifest minimal : nom, branche nourrie, droits demandés)
- [ ] Le panneau d'une branche affiche les add-ons actifs qui la nourrissent
- [ ] Préparer une API interne `connectors/` pour ajouter facilement de nouveaux pluggables

---

## 🤖 IA — montée en gamme progressive

Stratégie : démarrer avec des modèles **gratuits et simples** (Groq Llama 3.3 70B,
Gemini 2.0 Flash), itérer sur l'UX et la valeur, puis basculer vers des modèles
**payants méga-promptés** quand la base sera prouvée.

- [x] Phase 1 : Groq / Gemini gratuits, prompt système simple, conversation libre
- [ ] **Phase 2 (plus tard)** : provider payant (Claude Opus, GPT-4o, Gemini Pro…)
  - Prompts ultra-spécialisés par contexte (page actuelle, branche en cours, état émotionnel)
  - Mémoire long-terme entre sessions (Lya se souvient de ce qu'elle t'a dit hier)
  - Tool-use : Lya peut directement ouvrir un module, créer un objectif, planifier dans le calendrier
  - Streaming des réponses (effet « elle écrit en direct »)

## ⚖️ Cadre éthique & conformité (SYL) — NON NÉGOCIABLE

Principe : SYL **assiste** sans jamais **diriger**. La frontière (assister vs manipuler)
est tenue par une posture **non-directive** (approche centrée sur la personne / entretien
motivationnel) : refléter, questionner, clarifier — l'utilisateur décide seul. Objectif :
protéger l'utilisateur (autonomie, pas de dérive sectaire/idéologique) ET dédouaner le site
de toute responsabilité sur les décisions des utilisateurs.

- [x] **System prompt non-directif** ✅ (`api/chat.js`) : interdit de prescrire / décider /
  pousser une idéologie ; pas de conseil médical-juridique-financier prescriptif ; sécurité
  détresse (3114/15/112) ; rappel « pas un professionnel de santé ».
- [x] **Wording produit corrigé** ✅ (satellite SYL, widget) : plus de « t'oriente vers la
  bonne action » ; disclaimer visible dans le chat (« ne décide pas à ta place / pas un pro »).
- [ ] **CGU + mentions légales + politique de confidentialité** (pages dédiées, lien footer).
- [ ] **Consentement explicite** à la 1re ouverture de SYL (case « j'ai compris que SYL ne
  remplace pas un professionnel »).
- [ ] **Modération / garde-fou serveur** : filtre de sécurité sur les réponses (anti-conseil
  dangereux), journalisation minimale anonymisée des cas de détresse signalés.

## 📝 Idées validées (à planifier)

- [ ] **Racines / frise chronologique** — le passé de la personne sous l'arbre (mémoire longue, depuis la naissance)
- [ ] **Décor environnant l'arbre** dérivé de la frise (campagne / ville / mer selon le vécu)
- [ ] **Remplacer la vieille page `/yourlife/`** (pyramide statique) par l'arbre — la migration est prête, à activer
- [ ] **Pousse de nouvelles branches** quand des dimensions inconnues émergent (au-delà des 8 Maslow de base)
- [ ] **Anti-triche serveur** : repasser l'écriture XP en Cloud Function le jour où on passe en plan Blaze
- [ ] **Vue détaillée de la branche** dans une page dédiée (`/branche/cognitif/` par ex.) pour drill-down complet

---

## 🌌 Phases futures (cf. [VISION.md §15](docs/VISION.md))

- **Phase 3** — Patterns émergents sur la frise (cycles de joie / d'échec / de croissance détectés par IA)
- **Phase 4** — Scénarios de crise / protocoles de reconstruction (séparation, perte d'emploi, deuil…)
- **Phase 5** — Communauté « ceux qui aident / ceux qui sont aidés » + blockchain + token CYL

---

## 🎨 Univers & expériences premium (idées owner — juin 2026)

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
  pointée, **connecteurs/flèches entre fiches** — tirer le point d'une fiche, clic sur un
  lien pour l'effacer). Vision workflow IA atteinte (réf. v0 `ai-workflow-canvas`).
- [~] **Changement d’UNIVERS / thème en 1 clic** (Arbre↔Architecture FAIT sur accueil+login+/app via selecteur /profile ; reste : adapter les TEXTES en mode archi, d’autres mondes, plus de details).
  d'autres mondes — ex. **architecture / bureau 3D** (réf. v0 `3d-software-engineer-portfolio`).
  Objectif : **plusieurs arbres + plusieurs thèmes**, décor au choix, préférence persistée.
- [x] **Boutons magnifiques** ✅ (couche premium globale via common.js : relief + halo + press) - + : animations premium sur les CTA (réf. v0 `button`).
  *(Démarré : effet « shine » sur le CTA d'accueil.)*
- [x] **Mesures d'urgence (bouton « Urgence »)** ✅ (`urgence.js`) : bouton rectangulaire
  bas-gauche, texte vertical « URGENCE ». Au clic, triage bienveillant (danger / détresse /
  besoin de souffler). Détresse grave → ressources d'urgence immédiates (3114, 15, 112,
  SMS 114). Sinon → respiration guidée + « Parler à SYL ». Anonyme, sans compte.
  Reste possible : détection auto de détresse par SYL pendant la conversation.

## 🌳 Arbre vivant — raffinements restants

- [x] **Croissance PAR BRANCHE Maslow** ✅ (FAIT sur `/app` : 8 nœuds Maslow autour de
  l'arbre, taille/halo ∝ XP réel de chaque branche `tree.branches[key].xp`, croissance
  LIVE via l'événement `cyl:xp-gained`, clic → page de la branche).
- [ ] **Croissance animée (plan de coupe)** aussi sur `/app` quand l'XP monte.
- [ ] **Optimisation** : lazy-load ez-tree (4 Mo) après 1er paint ; arbre allégé sur
  l'accueil ; dispose des géométries au changement.

## 🪐 Cosmos / accueil — qualité visuelle

- [x] **Système solaire à l'échelle** ✅ (Soleil ENORME + 7 planètes proportionnelles
  entre elles, distances croissantes, anneaux d'orbite visibles). Échelle compressée
  (à la vraie échelle le Soleil ferait 109× la Terre) → réglable dans `tree-model.js`.
- [x] **Plaque de Pioneer** ✅ déplacée loin dans l'espace + agrandie (visible au dézoom max).
- [x] **Panneaux satellites masqués au dézoom** ✅ (réglable : constante `SAT_PANEL_HIDE_RADIUS`
  dans `arbre3d.js`, défaut 3000 ; zoom min 95, repos ~200, max 7000).
- [x] **SYL posé sur un rayon** ✅ (mi-hauteur de l'arbre, quasi-géostationnaire ; n'est plus en bas).
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
- [ ] **Références visuelles owner** (sites/templates donnés en session) — à ré-appliquer
  une par une (l'owner doit re-partager les liens ; non conservés entre sessions).

## Principes de priorisation

1. **Cohérence narrative d'abord.** Chaque ajout doit s'expliquer comme une partie de l'arbre, sinon il n'a pas sa place.
2. **Pas de feature sans impact concret** dans la vie réelle de l'utilisateur. Pas d'XP creux.
3. **Une amélioration à la fois.** L'utilisateur valide visuellement, on passe à la suivante.
