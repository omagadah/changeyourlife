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
- [x] **Conversation libre** branchée sur Gemini 2.0 Flash (`/api/coach`) qui voit l'état réel de l'arbre
- [x] Historique de conversation conservé

### Onboarding conversationnel
- [x] Nouvel utilisateur → arbre plein écran direct, Lya pose 8 questions (1 par branche)
- [x] Chaque réponse fait pousser SA branche en direct (avec carte d'XP)
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
- [ ] Création d'un objectif → **jalons** auto-générés ou éditables (J+1 sans fumer / J+7 / J+30 / J+90)
- [ ] Page **Objectifs** : vue chronologique des jalons en cours, à venir, atteints
- [ ] Chaque jalon coché = gain d'XP **accomplissement** + branche **physio** (santé) + carte de récompense
- [ ] Une frise simple sous l'arbre pour visualiser ses jalons sur la durée

### B · Lya overlay sur TOUTES les interfaces
> L'IA n'est pas dans l'arbre seulement — elle est addosée à chaque page.

- [ ] Bouton/orb « Parler à Lya » persistant en bas à droite de chaque module
- [ ] Quand on est dans `/sommeil/`, Lya voit ton historique sommeil → conseil contextuel
- [ ] Quand on est dans `/objectifs/`, elle voit tes jalons → t'aide à prioriser
- [ ] Quand on est dans `/journal/`, elle peut suggérer une question d'amorce

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

## Principes de priorisation

1. **Cohérence narrative d'abord.** Chaque ajout doit s'expliquer comme une partie de l'arbre, sinon il n'a pas sa place.
2. **Pas de feature sans impact concret** dans la vie réelle de l'utilisateur. Pas d'XP creux.
3. **Une amélioration à la fois.** L'utilisateur valide visuellement, on passe à la suivante.
