# HISTORIQUE - ChangeYourLife.ai

> **Mémoire longue du projet.** De la première ligne à aujourd'hui.
>
> `ROADMAP.md` dit **où on va**. `AUDIT.md` dit **où on en est techniquement**.
> Ce fichier dit **d'où on vient** : les décisions, les virages, ce qu'on a
> essayé, gardé, abandonné - et pourquoi. Rien de ce qu'on a construit ne doit
> tomber dans l'oubli, même ce qui a été supprimé depuis.
>
> **Règle : à chaque session de travail, on ajoute une entrée ici.** Le détail
> technique va dans `docs/sessions/YYYY-MM-DD.md` ; ici on garde le récit.

---

## Le fil rouge

Le projet a changé trois fois de centre de gravité :

1. **L'arbre** (mai → juin 2026) - la vie devient un organisme vivant.
2. **Les modules** (juin → juillet 2026) - 16 outils empilés autour de l'arbre.
3. **L'ORGANIZER** (août 2026) - *ce que j'ai en tête* devient le point
   d'entrée ; l'arbre redevient le **reflet** de l'action, plus le sujet.

Le fil qui n'a jamais bougé : **le site assiste, il ne dirige jamais.**

---

## 2026-05-08 · Fondations et premier audit

Premier audit complet du codebase. Corrections PWA, XSS, OTP, navigation.
Mise en place du workflow de travail (sessions documentées, audits réguliers).
Second passage : ~2000 lignes de code mort supprimées, sécurité durcie
(authentification du Coach, XP côté serveur, règles Firestore resserrées).
Arrivée des **Custom Claims** (rôles admin/mod/user) et de l'outillage
(Prettier, EditorConfig, scripts npm).

## 2026-05-16 · Reprise et purge

Toolchain réparée (git reconstruit, Node/Vercel/Firebase CLI).
Audit → 4 XSS corrigés, vulnérabilité critique `protobufjs` traitée.
**Purge d'un token exposé dans l'historique git** (`filter-branch`).
Nettoyage des imports, dépendances et fichiers morts. Nav unifiée.

## 2026-06-08 · La journée fondatrice de l'univers visuel

SW v92 → v147. La direction artistique naît ce jour-là.

- **L'arbre ez-tree** remplace l'arbre SVG : un vrai modèle 3D qui pousse.
- **La plaque Pioneer** (NASA, 1972) se met à flotter dans l'espace, loin,
  découvrable seulement en dézoomant. Le système solaire passe à l'échelle.
- **ORGANIZER** apparaît : board Eisenhower + vue Canvas avec connecteurs.
- **Croissance par branche Maslow** : l'XP ne tombe plus dans un pot commun.
- **SYL devient un vrai chatbot** (Claude), avec un **cadre strictement
  non-directif** - décision structurante, jamais remise en cause depuis.
- **Bouton Urgence** et flux de crise (3114 / 15 / 112).
- Emojis Fluent 3D, badge pixel-art devenu le logo.

## 2026-07-10 · Interface et conformité

SW v147 → v168.

- **Fix login Chrome** : `COOP: same-origin-allow-popups` - sans lui, la
  connexion Google était cassée sur Chrome et fonctionnait sur Opera.
- Bascule clair/sombre dans le bandeau, menu vertical animé, fiche profil
  premium, badge ID interactif.
- **Giveaway** avec backend Firestore (participations cross-device) puis
  back-office et tirage serveur admin.
- **i18n automatique** de tout le DOM.
- Conformité SYL : consentement à la première ouverture + modération serveur.

## 2026-08-08 · Virage : « l'ORGANIZER est le cerveau »

SW v168 → v169. Changement de cap assumé : **construire pour l'owner**, pas
pour un utilisateur imaginaire.

- **Bug bloquant trouvé** : le jeton Google Agenda était écrit en
  `sessionStorage` et relu en `localStorage`, avec un scope lecture seule.
  « Ajouter à l'Agenda » ne pouvait donc **jamais** fonctionner. Correction :
  `/js/gcal.js`, source unique, scope lecture **et** écriture.
- `/js/organizer-data.js` : schéma partagé entre `/app/` et `/organizer/`.
- `/js/app-organizer.js` : l'ORGANIZER embarqué en tête de `/app/`.
- `/api/syl-brief.js` : SYL ne répond plus seulement quand on lui parle, elle
  **regarde** l'état réel (organizer + agenda) et rend un brief.
- L'XP d'une fiche terminée part sur **sa** branche Maslow.

## 2026-08-16 · Audit total, refonte visuelle, et CYL

Grosse session. SW v169 → v175.

### Audit des 10 dimensions
4 critiques, 36 importants, 51 mineurs, avec vérification adversariale
(6 findings réfutés et retirés). Trois découvertes structurantes :

1. **Le CSS et le JS n'atteignaient jamais les clients** - `/css/` était servi
   en `immutable` un an sans versionnage d'URL. Les refontes seraient restées
   invisibles pour tout visiteur déjà venu.
2. **Le circuit ORGANIZER → arbre était rompu sur 4 branches sur 8** -
   `BRANCH_TO_LEGACY` n'en mappait que 4, et `/app/` lisait ce miroir. Terminer
   une fiche « Accomplissement » créditait l'arbre sans que rien ne bouge à
   l'écran.
3. **La suppression de compte ne supprimait aucune donnée** (RGPD) - le compte
   Auth partait, les données restaient.

Plus : 2 XSS réels, OTP non lié à son email, coût LLM non borné, CSP trop
large, back-office admin entièrement bloqué par les rules. Toutes les
vulnérabilités npm critical et high éliminées.

### Refonte visuelle de `/app/`
La page était restée en **navy v2** alors que le design system était passé à la
**forêt nocturne** : 3 `var()` sur ~600 déclarations. Réécrite sur les tokens.
Suppression des 11 règles `order:` - l'ordre du DOM redevient l'ordre visuel.
Fond Vanta + three.js r134 retirés au profit d'un dégradé CSS.

### SYL → CYL
L'IA prend le nom du produit. 332 remplacements, fichiers renommés.
**Bug trouvé au passage** : deux chats se chargeaient en parallèle sur `/app/`
(l'ancien overlay Lya + le chat récent) - deux orbes superposées. Unifié.

### L'onglet-module
Tout le bandeau d'en-tête de l'ORGANIZER devient cliquable et mène au board
complet. Motif validé, à décliner sur les autres modules.

### Le moteur de classification
Réécriture complète : d'une liste de 8 mots-clés à un moteur qui rend une
**lecture** de la pensée - branche, sous-catégorie, nature (tâche / ressenti /
envie / objectif / idée), ampleur, confiance, colonne proposée. Il sait que
« j'en ai marre de ce boulot… » est un **ressenti** qui touche deux branches,
et que « apprendre la conjecture de Hodge » est un **chantier** malgré ses
quatre mots. Quand il ne sait pas trancher, **CYL tend la main** au lieu de
deviner. 18/18 sur le jeu de test.

### Mode clair réparé
Le site n'avait **aucune** règle de thème clair dans son design system : 26
règles bricolées dans 7 modules. Résultat, seul l'ORGANIZER changeait - en
blanc illisible. Refait au niveau des **tokens** : un seul point de bascule.

### Suppression du code mort
~2,3 Mo retirés : `public/models/` (GLB jamais référencés depuis le passage à
ez-tree), `tree-widget.js` (remplacé par `living-tree.js`), `tree-lab/` (page
de dev servie en production), `arbre.svg.legacy.js`, `landing.js` (qui
chargeait Tidio sur la page portant le formulaire mot de passe), et
`lya-overlay.js` (l'ancienne IA).

> **Ce qui a été supprimé n'est pas perdu** : tout reste dans l'historique git.
> `git log --diff-filter=D --name-only` retrouve n'importe quel fichier effacé.

---

## Décisions structurantes (à ne pas remettre en cause sans raison)

| Décision | Quand | Pourquoi |
|---|---|---|
| **CYL ne dirige jamais** | 2026-06 | Protège juridiquement, et respecte le principe : chacun vise son propre bonheur |
| **Une seule IA** | 2026-08 | Trois marques concurrentes (Lya, SYL, « Coach IA ») pour une seule fonction |
| **L'ORGANIZER est le point d'entrée** | 2026-08-08 | On construit pour un usage réel, pas pour une démo |
| **L'arbre est le reflet, pas le sujet** | 2026-08-08 | Il reste la signature visuelle et le langage du produit |
| **L'ordre du DOM = l'ordre visuel** | 2026-08-16 | Le réordonnancement CSS cassait tab-order et lecteurs d'écran |
| **Le thème vit dans les tokens** | 2026-08-16 | Un module qui code une couleur en dur casse le thème |
| **Pas de tiret long** | - | Convention d'écriture du projet |
