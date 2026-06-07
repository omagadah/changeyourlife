# Plan directeur — l'écosystème qui fait grandir l'arbre

> Comment chaque action réelle de l'utilisateur fait pousser l'arbre, branche par
> branche, autour d'un **moteur central de rythme de vie**. Pont concret entre
> [VISION.md](VISION.md) / [ARCHITECTURE.md](ARCHITECTURE.md) et les modules à construire.
> Décidé avec l'owner (carte blanche) — 2026-06-07.

---

## 1 · Constat de départ (juin 2026)

- ✅ Le câblage **action → XP → arbre** existe : `awardXp(branche, montant)` dans
  `firebase.js`, appelé par tous les modules (sommeil, habitudes, objectifs,
  journal, méditation, humeur, gratitude, codex, autoévaluation, bilan).
- ✅ Modèle `tree` (xp + lastActionAt par branche, tout le reste dérivé) prêt.
- ❌ L'accueil affiche un **arbre de démo**, pas l'arbre réel de l'utilisateur.
- ❌ **Aucun moteur central** : rien n'orchestre la journée (réveil, sommeil,
  travail, énergie, temps disponible) ni ne dit « voici quoi faire maintenant ».
- ❌ Les **40 sous-catégories** et 3 branches (Relations, Finances, Héritage)
  n'ont pas de module → impossible de les faire grandir.
- ❌ Le connecté `/app/` est un **dashboard en grille** (version −200), pas
  « habiter l'arbre ».

**Le chaînon manquant n'est pas l'XP — c'est l'ORCHESTRATION.** Un cerveau qui
relie le rythme vital, les objectifs et les actions à l'arbre.

---

## 2 · Le moteur central — « Aujourd'hui » (le poste de pilotage)

Nouveau module `/plan/` (ou `/aujourdhui/`). C'est le cœur que l'owner veut, et
ce qui rend tout le reste utile. Boucle quotidienne :

1. **Rythme de vie** (check-in léger) : heure de réveil, sommeil de la nuit,
   énergie ressentie (1-5), temps disponible aujourd'hui, focus du jour.
   → ces signaux conditionnent ce que le système propose.
2. **Base vitale = garde-fous** : Sommeil · Nutrition · Hydratation · Mouvement.
   Tant qu'ils ne sont pas tenus, Lya le signale et **freine** l'empilement de
   tâches (« tu as dormi 4 h — on allège la journée »). *Sans base, rien ne pousse.*
3. **Objectifs → étapes → tâches du jour** : chaque objectif se décompose en
   jalons puis en tâches concrètes ; le moteur sort un **plan du jour réaliste**
   (selon énergie + temps dispo).
4. **Faire → valider** : cocher une tâche = `awardXp(branche)` → une feuille
   pousse sur la bonne branche, en direct.
5. **Lya** commente, priorise, réajuste (modes Observatrice / Guide / Intervention).

> Règle d'or de l'owner : *« si on ne dort pas ou qu'on ne mange pas, on ne peut
> rien faire »* → la base vitale gouverne le reste, ce n'est pas une option.

---

## 3 · Mapping : 8 branches × 5 sous-catégories → comment ça pousse

Légende source : **[E]** module existant · **[N]** nouveau module · **[C]** connecteur.

### 1. Physiologique (base vitale)
| Sous-cat | Action qui la nourrit | Source |
|---|---|---|
| Sommeil | log nuit + qualité | [E] sommeil · [C] montre |
| Nutrition | repas / qualité du jour | [N] nutrition · [C] santé |
| Hydratation | verres d'eau | [N] hydratation (tracker simple) |
| Mouvement | activité / pas / séance | [N] mouvement · [C] montre |
| Repos | pauses, jour off assumé | [N] dans `/plan/` |

### 2. Sécurité
| Logement | stabilité du lieu | [N] relations/sécurité |
| Stabilité | routine tenue | [E] habitudes |
| Finances | budget, épargne, dépenses | [N] finances · [C] banque |
| Santé | RDV, prévention, signaux | [N] santé · [C] santé |
| Sérénité | niveau de stress | [E] humeur |

### 3. Appartenance
| Famille / Amis / Amour | contacts, moments partagés | [N] relations · [C] contacts/agenda |
| Empathie | écoute, aide rendue | [N] relations + communauté |
| Communauté | entraide (donner/recevoir) | [N] communauté (Phase 5) |

### 4. Estime
| Confiance / Fierté | victoires notées | [E] journal/gratitude |
| Compétence / Réussite | jalons franchis | [E] objectifs |
| Reconnaissance | feedback reçu | [N] relations |

### 5. Cognitif
| Savoir / Apprentissage | leçons, cours suivis | [E] codex · [C] Khan Academy |
| Curiosité / Compréhension / Lucidité | notes, lectures, réflexion | [E] codex/journal |

### 6. Esthétique
| Beauté / Émerveillement | moments de beauté captés | [E] gratitude |
| Harmonie / Ordre | rangement, cadre clair | [E] habitudes · [N] ordre |
| Créativité | créations (écrit, art, projet) | [N] créativité |

### 7. Accomplissement
| Projets / Vision / Maîtrise | objectifs en cours | [E] objectifs ⇄ [N] /plan/ |
| Croissance | progression mesurée | dérivé (XP, jalons) |
| Authenticité | alignement (bilan) | [E] bilan |

### 8. Transcendance
| Spiritualité / Sens | méditation, introspection | [E] méditation/journal |
| Contribution / Transmission | aider, enseigner | [N] communauté |
| Héritage | frise chronologique (racines) | [N] frise (Phase 3) |

**Transverses** : `objectifs` = fruits · `habitudes` = n'importe quelle branche ·
`autoevaluation` = ressenti (roue) · `bilan` = rituel · `coach` = Lya.

---

## 4 · Nouveaux modules à créer (par priorité)

1. **`/plan/` — Aujourd'hui** (le moteur central, §2). 🔑 *priorité absolue*
2. **Corps complet** : nutrition, hydratation, mouvement (compléter sommeil).
3. **Relations** (Appartenance) — branche vide aujourd'hui.
4. **Finances** (Sécurité) — branche vide.
5. **Créativité** (Esthétique).
6. **Frise chronologique / racines** (Héritage) — Phase 3.
7. **Communauté** (Transcendance, donner/recevoir) — Phase 5.

> Principe : on ne fait pas « une page par sous-catégorie » (40 pages mortes).
> On regroupe par branche → **8 espaces-dimension** ouverts depuis l'arbre, +
> le moteur `/plan/` transversal. (Cf. ARCHITECTURE §6 « habiter ».)

---

## 5 · Connecteurs — le système nerveux (ordre VISION)

1. **Google Calendar** — temps & jalons (lecture/écriture des tâches du plan).
2. **Montre connectée** — sommeil, activité, cœur (alimente Corps en auto).
3. **Khan Academy** — apprentissage (Cognitif).
4. **Banque** — Finances.
5. **Pipeline Notes → Trello → Calendar** — notes vocales → objectifs structurés.

Chaque connecteur **remplit l'arbre automatiquement** : sans eux l'arbre reste un
sapling, avec eux il devient un chêne (VISION §8).

---

## 6 · L'expérience connectée (remplacer le dashboard)

- Login → **ton arbre réel** plein écran (brancher `tree` réel à la scène 3D de
  l'accueil, au lieu de la démo).
- **Lya** présente en bas, le moteur **« Aujourd'hui »** accessible d'un geste.
- Clic sur une branche → son **espace-dimension** (ses sous-catégories + modules).
- Le dashboard grille `/app/` (version −200) est progressivement absorbé.

---

## 7 · Séquence de build proposée

- **Étape 1** : `/plan/` (Aujourd'hui) — rythme de vie + objectifs en étapes +
  base vitale + validation → XP. *Le truc utile tout de suite, pour l'owner.*
- **Étape 2** : brancher l'**arbre réel** au login (fin de la démo côté connecté).
- **Étape 3** : compléter **Corps** (nutrition/hydratation/mouvement) + **Relations** + **Finances**.
- **Étape 4** : connecteur **Google Calendar**.
- **Étape 5** : frise (Héritage), communauté, scénarios de crise (VISION §9).

---

## 7bis · Le système de COMPÉTENCES + le flux Eisenhower (vision owner, 2026-06-07)

C'est le manque ressenti par l'owner : *« j'accomplis mes tâches mais elles sont
perdues dans le vent — je ne vois pas mes compétences évoluer au fil de ma vie. »*

**Boucle cible (comme son usage perso Trello + matrice d'Eisenhower) :**
1. **Capture en vrac** — toutes les idées/tâches jetées sans friction (texte, voix).
2. **Tri par matrice d'Eisenhower** — Urgent/Important × 4 quadrants → priorisation.
3. **Planification** — la tâche triée part dans l'agenda (Google Calendar à terme).
4. **Accomplissement** — on coche → XP sur la branche **ET** sur une COMPÉTENCE.
5. **Trace permanente** — l'accomplissement ne se perd plus : il s'inscrit dans
   l'historique (frise) et fait **monter une compétence**.

**Modèle « Compétences » (à construire) :**
- Une **compétence** = un savoir-faire nommé librement (Cuisine, Informatique,
  Prise de parole, Finance…), rattachée à une branche de l'arbre.
- Chaque tâche accomplie peut être taguée d'une compétence → +XP compétence →
  **niveau de compétence qui monte avec le temps** (Débutant → … → Pro).
- Vue « Mes compétences » : courbe d'évolution par compétence sur la durée de vie.
- Visuel arbre : les compétences = **sous-nœuds qui se densifient** sur la branche
  (cf. ARCHITECTURE §2 « densité / nombre de nœuds »).

Firestore (proposé) : `users/{uid}.skills = { <id>: { name, branch, xp, lastAt,
history:[{t,xp}] } }` — même principe que `tree` (brut + dérivé).

→ Étape de build dédiée : **module « Compétences »** + intégration au moteur
`/plan/` (tag compétence sur une tâche) + capture/matrice Eisenhower.

## 7ter · « La Boussole » — explorateur de voies d'épanouissement (à concevoir)

Demande owner (2026-06-07) : un espace qui **n'est PAS un tableau ni un classement
d'ego**, mais une présentation **intelligente** des différents **aspects de
personnalité** possibles et des différentes **pyramides / modèles d'épanouissement**
(Maslow, mais aussi d'autres cadres : ikigaï, ERG d'Alderfer, autodétermination de
Deci & Ryan, vertus, etc.) — pour **éclaircir la vision de l'utilisateur** sur où il
peut aller et qui il peut devenir.

- Pas « Tableau », pas « Classement ». Noms candidats : **La Boussole**, **Les Voies**,
  **Constellations**, **La Galerie des chemins**.
- Forme : cartes/constellations explorables, chacune = un modèle d'épanouissement ou
  un archétype, avec « comment ça se traduit sur ton arbre ». Aide à se situer, pas à
  se comparer aux autres. Lecture inspirante, jamais culpabilisante.
- Branche concernée : surtout **Accomplissement** + **Cognitif** (se comprendre).

## 7quater · Approfondir CHAQUE module (refonte totale autorisée)

Constat owner : tous les modules sont « niveau 1 ». Chaque module doit devenir un
**espace complet**, pas un gadget. Méditation = le modèle de référence.

- **Méditation** → vrai espace de détente : plusieurs **modes** (respiration guidée,
  ASMR, histoires, réflexions philosophiques, scan corporel, scommeil), **dialogue
  d'entrée** avec Lya (« stressé ? → respiration » / « besoin de sens ? → philo »),
  **bilan avant/après** la séance, ambiances sonores, durées adaptatives.
- **Journal** → prompts guidés, détection d'émotions, insights, recherche, fil de vie.
- **Habitudes** → calendrier / heatmap de régularité, rappels, séries visuelles.
- **Humeur** → tendances, déclencheurs, corrélations (sommeil↔humeur), graphes.
- **Sommeil / Corps** → compléter (nutrition, hydratation, mouvement) + connecteurs.

Chaque module nourrit l'arbre (XP branche) **et** les compétences (§7bis).

## 8 · Décisions ouvertes (à trancher avec l'owner)

- 🔴 Le moteur `/plan/` : module à part OU intégré directement dans l'arbre connecté ?
- 🔴 Refondre les modules existants au style Calm/Headspace **maintenant** ou après
  avoir tout relié ?
- 🔴 Connecteurs : commence-t-on Google Calendar dès l'étape 2 (très structurant) ?
