# Gabarit de page v3 - le contrat

> Toute page de l'espace connecté suit ce gabarit. Écrit le 2026-10-17 pour le
> lot 2 de la refonte (cf. [AUDIT-UX-2026-10-17.md](AUDIT-UX-2026-10-17.md)).
> Les classes vivent dans `public/css/main.min.css`, section « v3 ».

## Le squelette

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <script src="/js/theme-init.js"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Journal - Change Your Life</title>
  <meta name="description" content="…">
  <link rel="manifest" href="/manifest.json">
  <link rel="icon" href="/favicon.ico">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <meta name="theme-color" content="#0a0f0a">
  <link rel="stylesheet" href="/css/main.min.css"/>
  <link rel="stylesheet" href="/css/transitions.css"/>
  <style>
    /* UNIQUEMENT ce qui est propre à cette page. Tokens, jamais de couleur en dur. */
  </style>
</head>
<body>
  <main class="page-shell" aria-labelledby="page-title">
    <header class="page-head">
      <div class="page-head-id">
        <h1 id="page-title"><span class="ic" data-icon="book"></span>Journal</h1>
        <p class="page-sub">Ce que tu déposes, jour après jour.</p>
      </div>
      <div class="page-actions">
        <button class="btn primary" type="button" id="btn-new"><span class="ic" data-icon="plus"></span>Nouvelle entrée</button>
      </div>
    </header>
    <div class="page-body">
      … le contenu de la page …
    </div>
  </main>
  <script type="module" src="/js/journal.js"></script>
</body>
</html>
```

## Les règles

1. **Un seul cadre** : `main.page-shell`. Pas de `.site-nav`, pas de `.header`
   flottant, pas de sidebar interne, pas de lien « ← Mon espace » : la barre
   latérale (injectée par `common.js`) fait tout ça. `page-shell-nav`,
   `ap-shell`, `fr-shell`, `layout`, `dashboard-container` sont morts.
   Une page qui a VRAIMENT besoin d'un cadre à elle (canvas plein écran) pose
   `data-cyl-shell` sur son cadre, et c'est tout.
2. **Un seul en-tête** : `header.page-head` avec `h1` (le seul h1 de la page,
   avec son icône `data-icon`), `p.page-sub` facultatif, `div.page-actions`
   pour les boutons. Le libellé du h1 est **celui de la barre latérale**
   (`sidebar.js`) : « Journal », « Habitudes », « Où j'en suis », « Roue de
   vie »… pas une variante.
3. **Le corps défile, pas la page** : `div.page-body`. Pour une page de texte
   (légal), `main.page-shell.scroll` sans `.page-body`.
4. **Composants communs d'abord** : `.btn` (`.primary`, `.quiet`, `.sm`,
   `.danger`), `.input` / `.textarea` / `.select` + `.field`, `.card`,
   `.chip`, `.kv`, `.empty`, `.sk`, `.sec-label`, `.seg` (onglets), `.pick`
   (choix cliquables), `.tap` (cible 44 px), `.modal-veil` + `.modal`.
   On ne recopie pas une variante locale de ce qui existe.
5. **Icônes** : `<span class="ic" data-icon="nom"></span>` dans le HTML
   (hydraté par `common.js`), `icon('nom')` depuis un module. Noms dans
   `/js/icons.js`. **Jamais d'emoji en guise d'icône** (titres, boutons,
   onglets, états vides, libellés de stats). Un emoji reste possible comme
   *contenu choisi par l'utilisateur* (son humeur, l'emoji d'une habitude).
6. **Couleurs** : tokens uniquement (`var(--text-2)`, `var(--surface-2)`,
   `var(--line)`, `var(--leaf)`, `var(--gold-text)`…). Les couleurs de branche
   viennent de `BRANCHES` dans `growth.js` ou de `--corps/--coeur/--etre/--ordre`.
   Pas de `backdrop-filter`, pas d'ombre géante, pas de dégradé décoratif.
7. **Typographie** : h1/h2/h3 héritent de Fraunces via `main.min.css`. Pas de
   `font-family` local. Rien sous `.78rem` pour du texte lu, `.68rem` pour un
   intertitre en capitales.
8. **Formulaires** : chaque champ a un `<label for>`. Un choix cliquable est un
   `<button type="button">` avec `aria-pressed`, jamais un `<div onclick>`.
   Toute cible d'action principale fait 44 px (`.tap`, `.pick > button`).
9. **Retours** : `toast()` de `common.js`, pas un `#toast` local.
   `saveWithFeedback()` pour un enregistrement.
10. **États** : un état vide est un `.empty` avec une phrase et un geste. Un
    chargement est un `.sk`. Une donnée absente se tait (pas de « - »).
11. **Mobile** : deux points de rupture, 900 px (barre et CYL se replient) et
    640 px (cadre à 8 px, en-tête sur une colonne). Pas d'autre `@media`
    sauf `prefers-reduced-motion`.
12. **Écriture** : tutoiement, accents, jamais de tiret long (`-`), jamais
    « Lya », « SYL », « Coach IA ». L'IA s'appelle CYL. CYL constate et
    propose, elle n'ordonne pas et ne note pas une vie.
13. **Ne rien casser** : les `id` et classes que le module JS de la page lit
    (`getElementById`, `querySelector`) sont conservés tels quels, ou le JS
    est mis à jour dans le même commit. `node --check` sur tout JS touché.
14. **Service worker** : `CACHE_NAME` bumpé à chaque modification de `/css`
    ou `/js`, et chaque entrée du précache existe sur disque.
