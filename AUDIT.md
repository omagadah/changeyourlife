# AUDIT - changeyourlife.ai

> Dernier passage : **2026-08-26** · SW **v201** · branche `main`
> Méthode : reprise du rapport du 2026-08-16, vérification de chacun de ses
> restants contre le code actuel (27 commits entre les deux), puis nouveau
> scan : sécurité front/API, npm, CSP, Firebase, PWA, cohérence des références
> (37 pages × src/href, 70 modules × imports ESM), a11y, code mort.

## Résumé

| | Trouvés | Corrigés dans cette passe | Restants |
|---|---|---|---|
| Critique | 1 | 1 | 0 |
| Important | 8 | 5 | 3 |
| Mineur | 10 | 3 | 7 |
| Décisions produit en attente | 3 | - | 3 |

**Aucun secret exposé, aucun `eval`/`new Function`/`document.write`, aucune URL
externe suspecte, aucune collection Firestore sans règle, aucune référence
locale cassée (pages et imports vérifiés exhaustivement), aucune vulnérabilité
npm critique ou high.** Le gros de cette passe : une **régression critique**
introduite le 20 août (service worker plus jamais enregistré) et la
**vendorisation complète des scripts CDN** qui ferme d'un coup quatre findings
de l'audit précédent.

---

## 🔴 Critique

### C1 - Le service worker n'était plus JAMAIS enregistré ✅ CORRIGÉ
`public/js/common.js` · Le commit `4af1833` (20 août, refonte du fond animé) a
réécrit `common.js` et **perdu le bloc `serviceWorker.register()`** - le seul du
site. Depuis : `grep -r "serviceWorker.register" public/` → **0 résultat**.

Conséquences réelles :
- **Tout nouveau visiteur** : ni installation PWA, ni offline, jamais.
- Les bumps de version du SW (v198 → v200) ne servaient qu'aux navigateurs ayant
  encore un ancien SW enregistré, qui re-vérifient le fichier d'eux-mêmes.
- Un utilisateur qui vidait son navigateur perdait le SW **définitivement**.

**Fix** : bloc d'enregistrement réintroduit dans `common.js` (importé par toutes
les pages connectées via ESM), avec toast « Mettre à jour » via le `toast()`
partagé ; la landing (non-module) a le sien dans `home-boot.js`. SW bumpé
**v201**. L'enregistrement attend l'événement `load` pour ne jamais concurrencer
le chargement initial.

---

## 🟠 Important

### Corrigés dans cette passe

| # | Sujet | Fichiers | Ce qui a été fait |
|---|---|---|---|
| I1 | **Zéro CDN de scripts** - fin des `<script>` tiers | `public/vendor/` · 4 HTML · `cyl-bg.js` · `emoji.js` | Chart.js, SortableJS, three r134, vanta.birds et twemoji sont **vendorisés** (`/vendor/chart/`, `/vendor/sortable/`, `/vendor/three-r134/`, `/vendor/vanta/`, `/vendor/twemoji/`). Ferme d'un coup : « aucun SRI sur les CDN », « three r134 en CDN », la moitié du « précache offline illusoire » (le SW ignorait le cross-origin), et le risque supply-chain cdnjs/jsdelivr. Les assets **images** emoji (Fluent 3D, Twemoji SVG) restent en CDN - des milliers de fichiers, couverts par `img-src https:` |
| I2 | **Chart.js en 3 versions différentes** (4.4.0 / 4.4.1 / 4.4.3 selon la page) | `app/` · `autoevaluation/` · `settings/` | Unifié sur **4.4.3 vendorisé** |
| I3 | **CSP : plus aucun CDN autorisé en script/style/connect** | `vercel.json:84` | `script-src` passe de 4 origines à `'self' + gstatic + apis.google` (Firebase/OAuth, incompressibles). `cdn.jsdelivr.net` et `cdnjs.cloudflare.com` retirés de `script-src`, `style-src` et `connect-src` |
| I4 | **Contraste AA du texte tertiaire (thème sombre)** | `main.min.css:18` | `--text-3` #7c7660 → **#86806a** : 4,26:1 → **4,9:1** sur `--bg` (le thème clair avait déjà été corrigé) |
| I5 | **`prefers-reduced-motion` ignoré par les scènes WebGL** | `living-tree.js` · `arbre3d.js` | La media query CSS n'atteint pas un canvas. `living-tree` : halos « qui respirent » figés, tweens de croissance sautés (état final direct). `arbre3d` (landing) : **autorotation coupée** et sa reprise après 6 s d'inactivité désactivée. `cyl-bg.js` et `home-aura.js` le géraient déjà |

### Restants

- **Jeton OAuth Google en `sessionStorage`** (`gcal.js:43`) - atténué depuis le
  dernier audit (scope lecture par défaut, TTL, effacé à la fermeture de
  l'onglet) mais toujours lisible par tout JS de la page. Cible : mémoire module.
- **`ROOT_ADMIN_UID` toujours actif** (`functions/src/index.ts:124-128`) -
  CLAUDE.md prévoit son retrait une fois un admin créé par custom claim.
- **i18n inchangé** : 9 langues sur 16 sans dictionnaire de secours, attributs
  (`placeholder`, `title`, `aria-label`) jamais traduits, dates figées `fr-FR`
  dans 15+ modules. Le fallback multi-provider (Groq → Gemini) a en revanche été
  fiabilisé par les commits récents (quota ≠ panne, message précis).

---

## 🟡 Mineur

### Corrigés dans cette passe

- **Sitemap** : `/app/` (devenu une redirection 307 vers `/`) retiré ; ajout de
  `/organizer/`, `/agenda/`, `/plan/`, `/competences/`, `/frise/`, `/legal/`,
  `/cgu/`, `/confidentialite/`. 17 → **24 URLs**.
- **Bloc Vanta mort dans `settings.js`** : un `try {} catch` vide (résidu de la
  purge Vanta) supprimé.
- **`emoji.js`** : la lib twemoji est locale, plus de `crossOrigin` inutile.

### Restants

- **`quests-data.js` (284 lignes, commit récent) n'est importé par personne** -
  catalogue de quêtes prêt mais jamais branché. À câbler ou à dater comme WIP.
- **2 événements custom émis sans écouteur** : `cyf:theme-changed`,
  `cyl:gcal-changed`.
- **Offline : `/` précaché sous sa variante vitrine.** Le rewrite cookie
  (`cyl_in`) sert `/app/index.html` ou `/bienvenue.html` sous la même URL ; le SW
  fige la variante du moment de l'installation. Un connecté hors ligne peut
  retomber sur la vitrine. De même `/app/` précaché ne stocke que la redirection.
- **7 pages sans `main.min.css`** : volontaire pour `bienvenue`, `login`,
  `signup`, `verify-email`, `404` (autonomes pré-auth) ; **incohérent** pour
  `codex/` et `autoevaluation/` (modules connectés avec leur propre `<style>`).
- **`console.log` admin** (`settings.js:25-26`) : affiche UID + email en console,
  volontaire pour le bootstrap admin, à retirer quand `ROOT_ADMIN_UID` partira.
- **`web/`** (refonte Next.js gelée) toujours absente de CLAUDE.md.
- **npm** : 8 modérées racine + 10 modérées functions - inchangé, toutes
  attendent le major `firebase-admin 12 → 14` (breaking, à planifier).

---

## ⚪ Décisions produit en attente (rien touché)

1. **`/coach/` est orphelin** : aucun lien entrant, absent des 16 entrées de la
   sidebar, mais présent dans le sitemap et le précache. Redondant avec le chat
   CYL embarqué partout ? → soit une entrée de nav, soit une dépréciation.
2. **`ez-tree.es.js` = 3,9 Mo** chargé sur `/login/` et `/app/`. La landing a
   déjà un mode lite (mobile/2G → SVG à 129 Ko) ; les pages connectées, pas.
3. **`quests-data.js`** : brancher le système de quêtes ou le marquer WIP.

## ✅ Constaté réglé depuis le rapport du 2026-08-16

- **C4 (organizer inutilisable au clavier)** : fiches `tabIndex=0` +
  `role=button` + Enter/Espace, modale fermée par Escape (`organizer.js:176-183`).
- **Code mort ~2,3 Mo purgé** : `public/models/`, `tree-widget.js`,
  `arbre.svg.legacy.js`, `tree-lab/`, `landing.js` (et Tidio avec lui) - disparus.
- **Vanta ×14 implémentations → un seul module** `cyl-bg.js`, avec
  `prefers-reduced-motion`, `saveData` et exclusion mobile.
- **three/vanta CDN sur ~26 pages** → un seul point de chargement (désormais
  vendorisé, cf. I1).

## Stats

```
Pages HTML          37            Modules JS           70
API serverless       7            Cloud Functions       3
Règles Firestore   200 lignes     Index composites      0 (cohérent)
Poids public/       11 Mo         dont vendor/        5,6 Mo
Service worker    v201            Entrées précache     85
Vulns npm racine   8 modérées     Vulns functions     10 modérées
Réfs locales      100 % valides   Imports ESM        100 % valides
```

## Ce qui reste à faire côté owner (hors code)

- [ ] Vérifier après déploiement que le SW s'installe (DevTools → Application →
      Service Workers) - c'est le fix critique de cette passe.
- [ ] Trancher les 3 décisions produit ci-dessus.
- [ ] Planifier le major `firebase-admin` (dernières 18 vulns modérées).
- [ ] Retirer `ROOT_ADMIN_UID` des env vars Functions une fois l'admin claimé.
