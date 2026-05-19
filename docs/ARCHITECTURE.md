# Architecture narrative — l'Arbre (Phase 1.0)

> Pont entre [VISION.md](VISION.md) (la cible) et le code actuel (le brouillon).
> Document de **proposition** : les sections marquées 🔴 attendent une décision de l'owner.
> MAJ : 2026-05-17.

---

## 1 · Le constat

Tout le produit actuel repose sur **4 axes** : Corps, Cœur, Être, Ordre.
On les retrouve partout :
- `functions/src/index.ts` — `addXp` : domaines `body / heart / etre / order` (+ `mind` aliasé sur `etre`).
- `users/{uid}.levels` — `{ body, heart, etre, order : {level, xp, nextXp} }`.
- `autoevaluation.js` — la « Roue de Vie » note ces **4** axes (0-10) + un score global.
- `firebase.js` — `DOMAIN_ALIASES = { corps→body, coeur→heart, ordre→order }`.

La vision veut **7 branches** : Corps, Mental, Relations, Finances, Sens, Création,
Héritage — explicitement « plus large que Maslow ». Le modèle 4-axes (la pyramide
de Maslow) fait partie du brouillon « version −200 » à dépasser.

→ **Décision structurante** : on passe de 4 axes à 7 branches. Le modèle 4-axes
devient *legacy*, les données existantes sont migrées (cf. §6).

---

## 2 · Les 7 branches (proposition figée)

| Branche | Couvre | Couleur (proposée) |
|---|---|---|
| **Corps** | santé physique, sommeil, énergie, mouvement, nutrition | `--corps` #2dd4bf |
| **Mental** | santé psychique, émotions, stress, clarté, focus | `--mental` #a78bfa |
| **Relations** | famille, amitiés, amour, lien social | `--relations` #f87171 |
| **Finances** | argent, sécurité matérielle, autonomie | `--finances` #fbbf24 |
| **Sens** | valeurs, spiritualité, raison d'être, contribution | `--sens` #38bdf8 |
| **Création** | projets, œuvres, apprentissage, compétences, expression | `--creation` #fb923c |
| **Héritage** | ce qu'on transmet / la trace que l'on laisse | `--heritage` #94a3b8 |

**Statut d'Héritage** (décision §8.1) : Héritage **est** une branche (on agit
dessus, tourné vers l'avenir : ce qu'on construit pour transmettre) ; en parallèle
la frise chronologique alimente les **racines** (d'où l'on vient, mémoire longue
naissance → aujourd'hui). Deux visuels distincts, les deux bouts de l'axe du temps.

---

## 3 · Mapping modules existants → branches

| Branche | Modules actuels qui l'alimentent | État |
|---|---|---|
| Corps | `sommeil`, `habitudes` (volet corps) | ✅ couvert |
| Mental | `humeur`, `meditation`, `journal`, `gratitude` | ✅ bien couvert |
| Relations | — | ⚠️ **vide** |
| Finances | — | ⚠️ **vide** |
| Sens | `codex` (savoir/sagesse), `journal` (volet introspection) | 🟡 partiel |
| Création | `objectifs` (volet projets), `codex` | 🟡 partiel |
| Héritage | — (la frise chronologique, à construire) | ⚠️ **vide** |

**Modules transverses** (ne sont pas une branche) :
- `objectifs` → deviennent les **fruits** de l'arbre (rattachés à une branche).
- `autoevaluation` (Roue de Vie) → devient l'outil de **mesure subjective** de l'état
  des 7 branches (la roue passe de 4 à 7 axes).
- `bilan` → le **rituel de réflexion** périodique (revue de l'arbre).
- `habitudes` → transverse : une habitude se rattache à n'importe quelle branche.
- `coach` → devient **Lya**.
- `yourlife` (pyramide de Maslow) → **supprimé**, remplacé par l'arbre.

**Constat dur** : 3 branches sur 7 sont vides (Relations, Finances, Héritage).
Elles existeront d'abord comme branches **dormantes** sur l'arbre — fines, en
attente — et grandiront quand un module ou un connecteur les alimentera (un
module Relations, le connecteur bancaire pour Finances, la frise pour Héritage).

---

## 4 · Le modèle de données de l'Arbre

L'arbre n'est pas décoratif : chaque élément visuel est dérivé de données réelles.

### 4.1 · Stade de l'arbre (`stage`)
Sapling → jeune arbre → arbre mature → chêne.
Dérivé du **total cumulé d'XP toutes branches confondues** (jamais décroissant —
on ne « rétrécit » pas l'arbre, on le laisse seulement se faner).
Seuils proposés (🔴 à calibrer) : sapling 0–500 · jeune 500–3000 · mature
3000–12000 · chêne 12000+.

### 4.2 · État d'une branche — DEUX signaux distincts
C'est le cœur du modèle. Une branche porte deux mesures indépendantes :

- **Développement** (cumulatif, ne baisse jamais) = le `level`/`xp` de la branche.
  → détermine la **longueur / épaisseur** de la branche.
- **Vitalité** (0–100, **décroît avec la négligence**) = fonction du temps écoulé
  depuis la dernière action validée sur cette branche.
  → détermine la **couleur / les feuilles** : verte et feuillue si active,
  jaunissante puis nue si négligée.

Conséquence visuelle honnête : une branche peut être **longue mais en train de
faner** (très développée autrefois, négligée aujourd'hui) ou **courte mais
éclatante** (jeune mais très active). C'est exactement le « grandit quand on
agit, dépérit quand on néglige » de la vision.

### 4.3 · Feuilles, fruits, racines
- **Feuilles** = micro-actions récentes (N derniers jours). Une action validée =
  une feuille sur la branche concernée. Les vieilles feuilles tombent.
- **Fruits** = objectifs accomplis (`objectifs` terminés), accrochés à leur branche.
- **Racines** = frise chronologique (mémoire longue). Surtout Phase 3.

### 4.4 · Roue de Vie = lecture subjective
L'`autoevaluation` (0–10 par branche) reste le **ressenti** de l'utilisateur, en
complément des données objectives d'activité. Les deux peuvent diverger (« tu
*penses* que ton Corps va bien, mais aucune action depuis 3 semaines ») — c'est
un signal exploitable par Lya.

---

## 5 · Évolution du modèle Firestore

Actuel : `users/{uid}.levels = { body, heart, etre, order }`.

Proposé :
```
users/{uid}.tree = {
  stage: 'sapling',
  branches: {
    corps:     { level, xp, nextXp, lastActionAt, vitality },
    mental:    { ... },
    relations: { ... },
    finances:  { ... },
    sens:      { ... },
    creation:  { ... },
    heritage:  { ... }
  }
}
```
Impacts :
- `functions/src/index.ts` — `addXp` accepte les 7 clés de branche + met à jour
  `lastActionAt` ; ajout possible d'un calcul de `vitality`.
- `firestore.rules` — `noXpTampering()` protège désormais `tree` (au lieu de `levels`).
- `firebase.js` — `awardXp` et `DOMAIN_ALIASES` mis à jour.

**Migration des données existantes** (décision §8.2) : `body → corps` ·
`heart → relations` · `etre → mental` · `order → creation` ; branches neuves à 0 :
`finances`, `sens`, `heritage`. Migration douce : lecture unique de l'ancien
`levels` pour amorcer `tree`, puis on n'écrit plus que `tree`.

---

## 6 · « Habiter » — le modèle d'interaction

- **L'accueil = l'arbre**, plein écran. Plus de dashboard `/app/`, plus de menu.
- **Lya** présente en permanence (coin, discrète), pas un tutoriel d'intro.
- **Cliquer une branche** → ouvre la « dimension » : les modules de cette branche,
  présentés comme **un seul espace** cohérent (et non une liste de pages).
- **Retour** = retour à l'arbre. Pas de navigation horizontale.
- À chaque visite, l'arbre **reflète l'état réel** (ce qui a poussé / fané depuis
  la dernière fois) — c'est la boucle de feedback centrale.

---

## 7 · Ce qui meurt / survit du site actuel

| Sort | Éléments |
|---|---|
| ❌ Supprimé | `yourlife` (pyramide Maslow), le dashboard `/app/` en grille, la nav par menu, la landing actuelle |
| ♻️ Transformé | `coach` → Lya · `autoevaluation` → roue 7 axes · `levels` → `tree` |
| ✅ Conservé (deviennent contenu de branche) | `journal`, `humeur`, `sommeil`, `habitudes`, `meditation`, `gratitude`, `codex`, `objectifs`, `bilan` |
| ✅ Conservé tel quel | auth/login, verify-email, Firebase, Cloud Functions, sécurité |

→ Le travail de fond fait jusqu'ici (sécurité, nettoyage, UI) **n'est pas perdu** :
les organes restent, c'est la coquille qui change.

---

## 8 · Décisions (tranchées 2026-05-17 — owner)

L'owner a validé l'ensemble des propositions. Décisions figées :

1. ✅ **Héritage** = 7ᵉ branche (ce qu'on construit pour transmettre) **et** la
   frise chronologique alimente les **racines** (d'où l'on vient). Deux visuels.
2. ✅ **Migration 4→7** : `body→corps`, `heart→relations`, `etre→mental`,
   `order→creation` ; `finances` / `sens` / `heritage` démarrent à 0. Lecture
   unique de l'ancien `levels` pour amorcer `tree`, puis on n'écrit plus que `tree`.
3. ✅ **Branches vides** : visibles dès le départ comme branches **dormantes**
   (fines, en attente) — la structure des 7 branches se lit immédiatement.
4. ✅ **Stade de l'arbre** : basé sur l'**XP total cumulé** toutes branches.
5. ✅ **Rendu** : **SVG procédural** (maîtrisable sans build step, animable en CSS).

---

## 9 · Prochaine étape (Phase 1.1)

Une fois ce doc validé : prototyper la **landing-arbre** — l'arrivée sur l'arbre
(sapling) + première parole de Lya. Réutilise les protos existants
(`coach` a déjà un `#tree-canvas` + `drawTree()`, point de départ technique).
