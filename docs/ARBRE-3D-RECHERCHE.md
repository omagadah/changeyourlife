# Recherche — Arbre 3D AAA pour ChangeYourLife.ai

> Date : 2026-05-19
> Brief utilisateur : « un arbre technologique ULTRA impressionnant niveau Unreal,
> avec tous les éléments de la vie reliés sur chaque branche, qui pousse
> dynamiquement, avec branche cassée en rouge, intégrable au site vanilla JS. »
>
> Cette note est une analyse comparée des meilleurs candidats trouvés sur
> GitHub, Three.js forum, Codrops, Awwwards. Verdict à la fin : **EZ-Tree** +
> wrapper custom CYL.

---

## Critères de sélection

Tout candidat doit cocher au minimum :

1. **Visuel AAA** — feuilles, écorce, ombrage, vent. Pas une silhouette plate.
2. **3D temps réel WebGL** — pas du SVG / 2D / pré-rendu.
3. **Data-driven dynamique** — on doit pouvoir modifier l'arbre à la volée
   selon l'état utilisateur (7 branches × `dev` × `vitality`).
4. **Croissance progressive** — l'arbre doit visiblement grandir, pas
   apparaître d'un coup.
5. **Intégration vanilla JS / ESM** — le repo CYL n'a pas de build step, on
   importe via `<script type="module">` ou CDN.
6. **Licence MIT / Apache 2.0** — copier-coller-modifier autorisé.
7. **Maintenu** — commits dans les 12 derniers mois.

---

## Top 5 candidats classés

### 🏆 #1 — EZ-Tree (Dan Greenheck) — **RECOMMANDATION FORTE**

- **Repo** : https://github.com/dgreenheck/ez-tree
- **Démo live** : https://www.eztree.dev/
- **NPM** : `@dgreenheck/ez-tree` · v1.1.0 (jan. 2026)
- **Stars** : 1.2k · **License** : MIT
- **Auteur** : Dan Greenheck, ex-Navigation Engineer Blue Origin, ex-iOS
  Microsoft OneDrive. Chaîne YouTube Three.js très active, course
  *Three.js Roadmap*.

**Pourquoi c'est le bon**

- 50+ paramètres tunables : `trunk.length`, `branch.levels`, `branch.children`,
  `branch.gnarliness`, `branch.angle`, `branch.taper`, `branch.twist`,
  `branch.force` (direction de croissance — soleil/gravité), `leaves.count`,
  `leaves.size`, `leaves.tint`, etc.
- 16 presets prêts (Ash, Aspen, Oak, Pine en S/M/L + bushes). On peut démarrer
  sur Oak et le faire évoluer.
- Export GLB possible si on veut un asset pré-rendu, mais on l'utilise *en
  runtime* pour pouvoir régénérer.
- L'auteur a publié l'algo complet sur Codrops (cf. ressource #2). On peut
  forker et adapter sans deviner.
- Shaders vent inclus dans la démo (animation feuilles + grass).

**API minimale**

```js
import { Tree, TreeType, BarkType, LeafType } from '@dgreenheck/ez-tree';

const tree = new Tree();
tree.options.seed = 42;
tree.options.trunk.length = 20;
tree.options.branch.levels = 3;
tree.options.branch.children = [7, 5, 3]; // ← nos 7 branches au niveau 0 !
tree.options.leaves.tint = 0x2dd4bf;       // ← couleur dimension Corps
tree.generate();
scene.add(tree);
```

**Limites et comment on les contourne**

| Limite | Réponse |
|---|---|
| Génère un arbre statique, pas une croissance | Régénérer tous les N pas avec params croissants (length, levels, children), interpoler |
| Pas de notion de "branche cassée" native | On parcourt `tree.children`, on isole la mesh d'une branche par index, on lui pousse un material rouge émissif + scale Y plus petit |
| Pas de hover/click natif | `THREE.Raycaster` standard, l'auteur taggue chaque branche dans un userData |
| Pas de système de "feuilles = micro-actions récentes" | On ajoute nos propres meshes (sphères glow) en plus, attachées aux extrémités via `tree.branchTips` (exposé) |

**Effort d'intégration estimé** : 3 à 5 jours pour un MVP qui remplace
l'arbre SVG actuel par l'EZ-Tree 3D wrappé CYL, avec mapping des 7 branches
sur les `branch.children[0]`.

---

### #2 — Codrops "Fractals to Forests" — tutoriel + code source

- **Article** : https://tympanus.net/codrops/2025/01/27/fractals-to-forests-creating-realistic-3d-trees-with-three-js/
- **Auteur** : Dan Greenheck (le même)
- **Licence** : code = MIT (le repo d'EZ-Tree)

Ce n'est pas un produit à part — c'est le **mode d'emploi de l'algo
d'EZ-Tree**. À lire impérativement avant de toucher au code. Couvre :

- Le concept de procédural / L-systems / récursivité
- La structure `Branch` (origin, orientation, length, radius, level)
- La file `branchQueue` qui pilote toute la génération
- Comment sont construits les **vertices, indices, normales, UVs**
- Le paramètre `gnarliness` (twist organique des branches)
- Le paramètre `growth force` (croissance vers le soleil — utile pour la
  métaphore : Lya pourrait "pencher" l'arbre vers une direction selon ce que
  l'utilisateur travaille)
- Le shader vent complet en GLSL

**À utiliser comme** : référence pédagogique. Si l'équipe veut customiser EZ-Tree
au-delà des options, c'est par là que ça passe.

---

### #3 — THREE.Tree (mattatz)

- **Repo** : https://github.com/mattatz/THREE.Tree
- **License** : MIT

Plus minimaliste, plus ancien. Génération géométrique paramétrable (depth,
length, radius, segments). Bonne option **de secours** si EZ-Tree pose un
problème de taille de bundle ou de licence (mais EZ-Tree est MIT donc pas de
souci).

Avantage : code plus simple à lire, plus facile à modifier ligne par ligne.
Inconvénient : sans wrapper, ça reste un arbre "brut", moins joli que EZ-Tree
qui a tout le travail d'écorce/feuilles/vent.

---

### #4 — Three.js Tree Growth Simulator (forum showcase)

- **Démo** : https://discourse.threejs.org/t/three-js-based-tree-growth-simulator/22025

Démo communautaire orientée **animation de croissance**. Génère du low-poly,
exporte en GLTF. Moins beau qu'EZ-Tree, **mais** la logique de croissance est
explicitement traitée — utile pour s'inspirer côté animation si on construit
notre propre wrapper.

---

### #5 — Spline.design — l'option no-code

- **App** : https://spline.design/3d-design

À considérer **seulement** si on veut prototyper un visuel d'arbre 3D en
quelques heures pour valider l'esthétique avant d'engager le développement
Three.js. Spline exporte en iframe (intégrable n'importe où) ou en
React/three.js.

**Pourquoi ce n'est pas le bon choix final** pour CYL :

- Propriétaire, pas open source
- Difficile à piloter dynamiquement (on ne peut pas dire à Spline "fais pousser
  la branche Relations de +12 %")
- Pas adapté à des arbres data-driven générés par 7 dimensions × 2 signaux
- L'iframe casse l'intégration avec Lya (la voix, le raycaster, etc.)

**Bon pour** : maquette de discussion d'ambiance avec une équipe design,
inspiration visuelle, rien de plus.

---

## Autres ressources notables (non classées)

- **FloraSynth** — https://www.florasynth.com/ — alternative à EZ-Tree, plus
  fermée, export OBJ. Pas mieux qu'EZ-Tree pour notre cas.
- **deadtree (lmparppei)** — https://github.com/lmparppei/deadtree — Three.js
  procédural ultra simple, expose `.branchPivots` (utile si on veut accrocher
  des objets aux jonctions).
- **glTF-Procedural-Trees (donmccurdy)** — https://github.com/donmccurdy/glTF-Procedural-Trees
  par Don McCurdy (mainteneur officiel three.js). Vieux mais propre.
- **Greg Tatum — "Growth"** — https://gregtatum.com/interactive/2015/growth-incremental-additions/
  démo créative de croissance procédurale, parfaite pour l'inspiration UX du
  ressenti "ça pousse vraiment".
- **Codrops Creative Hub** — https://tympanus.net/codrops/hub/ — pour
  s'imprégner du niveau visuel des sites primés Awwwards en 2026.

---

## Plan d'intégration recommandé

### Phase 1.x — Remplacer l'arbre SVG actuel par EZ-Tree

1. **Spike technique (½ journée)**
   - Installer EZ-Tree localement : `npm i @dgreenheck/ez-tree three`
   - Ou via CDN ES modules (cohérent avec le repo qui n'a pas de build step) :
     `import { Tree } from 'https://esm.sh/@dgreenheck/ez-tree';`
   - Vérifier que ça tourne dans `/public/arbre/` avec un canvas Three.js basique.
   - **Critère succès** : un Oak EZ-Tree par défaut s'affiche en plein écran.

2. **Wrapper CYL (1-2 jours)**
   - Créer `/public/js/arbre3d.js` qui expose `renderTree3D(el, state)` avec
     la même signature que l'actuel `renderTree(el, state)` de `arbre.js`.
   - Mapper les 7 dimensions de `BRANCHES` (Corps, Mental, Relations,
     Finances, Sens, Création, Héritage) sur **7 branches niveau 0** d'EZ-Tree.
   - `dev` (0-100) pilote `branch.length[0]`, `branch.radius[0]`, `branch.levels`.
   - `vitality` (0-100) pilote `leaves.count`, `leaves.tint` (saturation),
     `leaves.size`.

3. **Animation de croissance (1 jour)**
   - Au chargement, démarrer avec `state.stage = 'sapling'` (params minimaux).
   - Animer (GSAP ou tween manuel) `length`, `levels`, `children` vers les
     valeurs cibles sur 4-6 secondes.
   - Régénérer la mesh à chaque step (`tree.generate()` est rapide).
   - Pour la perf : ne régénérer que 10-15 fois sur la durée totale, pas à 60fps.

4. **Branche cassée en rouge (½ journée)**
   - Après `generate()`, parcourir `tree.children` (Group THREE) pour récupérer
     la mesh d'une branche niveau 0 par son index ou son `userData.branchIndex`.
   - Cloner son material, lui appliquer `color: 0xff3344`, `emissive: 0x661111`.
   - Optionnel : la faire trembler subtilement (sine wave sur la rotation).

5. **Interactivité — clic sur branche (½ journée)**
   - `THREE.Raycaster` sur le pointeur, intersection avec `tree.children`.
   - Remonter au "groupe-branche" niveau 0 via `userData`.
   - `onclick` → navigation vers `/{dimension}/` ou ouverture d'un panneau.

### Phase 2 — Polish AAA

- Ajouter le **shader vent** du tuto Codrops (anime feuilles + extrémités).
- Ajouter un **ground glow** sous l'arbre (déjà présent en SVG actuel).
- Ajouter des **particules lumineuses** qui flottent autour (feuilles
  récentes = micro-actions de la vision).
- Postprocessing `EffectComposer` : bloom léger sur les feuilles, vignette,
  film grain subtil.
- Caméra : `OrbitControls` désactivé par défaut, mouvement de respiration
  automatique (orbite très lente).

### Phase 3 — Fruits + Racines

- **Fruits** = objectifs accomplis. Géométrie de sphère brillante accrochée
  aux extrémités, animation pop-in à chaque ajout.
- **Racines** = frise chronologique. Système séparé sous le sol (clip plane).
  À traiter quand on attaque la phase 3 de la vision (mémoire longue).

---

## Décision finale

**EZ-Tree, en mode librairie NPM (ou CDN ESM) + wrapper custom CYL.**

C'est l'unique solution qui combine :

- visuel AAA out-of-the-box
- moteur procédural data-driven (parfait pour 7 dimensions × dev × vitality)
- licence MIT, donc on peut tout customiser, y compris ajouter une notion de
  "branche cassée"
- auteur actif en 2026, course Three.js Roadmap dispo si on bloque
- tutoriel Codrops qui dépacke chaque ligne de l'algo

Tout autre choix (Spline, FloraSynth, modélisation Blender manuelle) impose
soit un compromis sur la dynamique data-driven, soit un coût de production
artistique disproportionné pour une équipe d'une personne.

---

## Liens à garder sous la main

| Ressource | URL |
|---|---|
| EZ-Tree repo | https://github.com/dgreenheck/ez-tree |
| EZ-Tree app | https://www.eztree.dev/ |
| Codrops tutoriel | https://tympanus.net/codrops/2025/01/27/fractals-to-forests-creating-realistic-3d-trees-with-three-js/ |
| Three.js docs | https://threejs.org/docs/ |
| Three.js examples | https://threejs.org/examples/ |
| Dan Greenheck YouTube | https://www.youtube.com/@dangreenheck |
| Three.js forum tree showcases | https://discourse.threejs.org/t/three-js-based-tree-growth-simulator/22025 |
