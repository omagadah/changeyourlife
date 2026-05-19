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

## 2 · Les 8 branches — la pyramide de Maslow, verticale

**Décision owner (2026-05) : l'arbre EST la pyramide de Maslow étendue.** Les
8 branches sont les 8 niveaux de besoin, de la base du tronc (besoins vitaux)
à la cime (transcendance). On ne s'épanouit pas tant que le niveau inférieur
n'est pas tenu — d'où l'empilement vertical. Affiché sur le site : « inspiré
de la pyramide de Maslow ».

| # | Branche | Niveau de Maslow | Couleur | Sous-branches |
|---|---|---|---|---|
| 1 | **Physiologique** | besoins vitaux | #2dd4bf | Sommeil · Nutrition · Hydratation · Mouvement · Repos |
| 2 | **Sécurité** | besoin de sûreté | #fbbf24 | Logement · Stabilité · Finances · Santé · Sérénité |
| 3 | **Appartenance** | amour, lien | #f87171 | Famille · Amis · Amour · Empathie · Communauté |
| 4 | **Estime** | reconnaissance | #fb923c | Confiance · Compétence · Réussite · Reconnaissance · Fierté |
| 5 | **Cognitif** | savoir, comprendre | #a78bfa | Savoir · Curiosité · Compréhension · Apprentissage · Lucidité |
| 6 | **Esthétique** | beauté, harmonie | #e879c7 | Beauté · Harmonie · Ordre · Créativité · Émerveillement |
| 7 | **Accomplissement** | réalisation de soi | #38bdf8 | Croissance · Projets · Maîtrise · Authenticité · Vision |
| 8 | **Transcendance** | au-delà de soi | #c4b5fd | Spiritualité · Contribution · Sens · Transmission · Héritage |

Sur le tronc : Physiologique est la branche la plus basse et la plus épaisse,
Transcendance est la cime (le leader vertical). « Héritage » est désormais une
sous-branche de Transcendance — tout en haut, car elle s'épanouit en fin de
parcours.

### Les 3 axes de croissance de l'arbre

L'arbre grandit de **trois façons distinctes**, chacune liée à un signal réel :

1. **Épaisseur / taille globale** — pilotée par le **tier 1** (Corps, Finances)
   + la fréquence de connexion (nourrir le système en infos). Un socle solide
   et un usage régulier = un arbre gros et haut. C'est « l'arbre c'est le corps ».
2. **Densité / nombre de nœuds** — chaque sous-branche sémantique qui se précise
   (Relations → Famille, puis Famille → tel proche…) ajoute un nœud. Plus la vie
   de l'utilisateur est cartographiée finement, plus l'exosquelette se ramifie.
3. **Hauteur / nouvelles branches** — quand une **dimension inconnue émerge**
   dans la vie de la personne, une nouvelle branche pousse vers le haut. L'arbre
   n'est pas figé à 7 : 7 est le socle, il peut s'étendre.

→ Un arbre « centenaire » = socle épais + des centaines de sous-nœuds + une cime
très haute. Un arbre de débutant = sapling à 7 branches dont 3 dormantes.

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

## 5 · Le modèle Firestore `tree` (implémenté — Étape B)

Schéma de `users/{uid}.tree` :
```
users/{uid}.tree = {
  v: 1,                          // version du schéma
  createdAt: <ms epoch>,
  branches: {
    corps:     { xp: <number cumulé>, lastActionAt: <ms epoch> },
    finances:  { ... }, relations, mental, creation, sens, heritage
  }
}
```

**Principe : on ne stocke que le brut.** Une branche = `xp` cumulé +
`lastActionAt`. Tout le reste est **dérivé**, jamais stocké :
- `level` ← `xp` (seuil k = 100 + k·20)
- `dev` 0-100 ← `xp` (courbe saturante : un arbre centenaire frôle 100)
- `vitality` 0-100 ← `lastActionAt` (100 après une action, → 0 en ~21 j de négligence)
- `stage` (sapling/jeune/mature/centenaire) ← xp total toutes branches
- `state` (active/dormant) ← `dev`

→ Aucune redondance, aucune désynchronisation possible.

**Implémentation :**
- `public/js/tree-data.js` — le socle : schéma, `createTree()`,
  `migrateFromLevels()`, `treeFromUserDoc()`, dérivations, `applyXp()` (pur),
  `toVisualModel()` (→ alimente `buildTree()` de tree-model.js).
- `public/js/firebase.js` — `awardXp()` écrit `tree` **côté client** via une
  transaction Firestore (cap 10 000/appel, **dual-write** `levels`). Le projet
  est sur le plan Firebase **gratuit** (Spark) : les Cloud Functions ne sont
  pas déployables. `addXp` (`functions/src/index.ts`) reste la **référence
  canonique** — logique identique — pour un futur passage en Blaze.
- `firestore.rules` — `xpFieldsValid()` autorise l'owner à écrire son `tree`
  (et `levels`), en vérifiant juste que ce sont des maps. L'anti-triche
  serveur (écriture XP réservée à l'admin SDK) reviendra avec le plan Blaze.

**Migration** (décision §8.2) : ancien `levels` 4-axes → 8 branches Maslow,
faite à la volée par `treeFromUserDoc()` (si pas de `tree`, on lit `levels`).

⚠️ Activation : `npm run deploy:firestore` (déploie les rules — gratuit).

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

## 9 · Idées visuelles à venir (roadmap arbre)

Idées de l'owner à intégrer progressivement :

- **La santé (Corps) est LA base** — pas la finance. Corps s'accroche le plus
  bas, le tronc le plus épais. Finances est une fondation distincte qui évolue
  à son propre rythme. Le socle de l'arbre = la santé.
- **Le sol / socle = le passé de la personne.** La frise chronologique (mémoire
  longue) se construit au pied de l'arbre, dans les racines/la terre, au fur et
  à mesure que l'histoire de la personne est connue.
- **Décor généré depuis l'histoire de vie.** Si la personne a vécu à la
  campagne → décor campagne ; sinon ville, plage, montagne… L'environnement
  autour de l'arbre reflète son vécu (lu sur la frise chronologique).
- **Croissance pilotée par l'XP global du site.** Plus l'utilisateur nourrit le
  système (connexions, infos, actions validées), plus l'arbre grandit. Il faut
  développer toutes les sections pour devenir « complet » — un arbre centenaire.
- **L'arbre n'est pas figé à 7 branches.** De nouvelles branches poussent quand
  des dimensions inconnues émergent dans la vie de la personne.

## 10 · Prochaine étape

Animation de croissance (Phase 1.1, en cours) : l'arbre pousse sous les yeux,
du sapling à l'arbre centenaire, tier par tier. Ensuite : câblage aux vraies
données utilisateur, navigation par les branches, frise chronologique au sol.
