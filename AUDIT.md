# Audit technique — changeyourlife.ai

> **Date :** 8 mai 2026
> **Repo :** [omagadah/changeyourlife](https://github.com/omagadah/changeyourlife)
> **Commit audité :** `9667516` — *feat(nav): menu déroulant dynamique par section*
> **Périmètre :** 114 fichiers · 3.3 Mo · 20 modules

---

## 1. Vérification : code local ↔ production

Le code dans ton dossier `ChangeYourLife.ai` est **strictement identique** à celui qui tourne en production sur `changeyourlife.ai`.

| Élément | Statut |
|---|---|
| SHA HEAD local | `9667516f09832985db48376dbf7fde3139298ea8` |
| SHA dernier deploy Vercel | `9667516f09832985db48376dbf7fde3139298ea8` |
| **Match** | ✅ **Identique — code local = production** |
| Branche | `main` (à jour avec `origin/main`) |
| Dernier commit | *feat(nav): menu déroulant dynamique par section* — 5 avr. 2026 |
| État deployment | `READY` · production · target=main |

> Le check par fetch HTTP du HTML rendu n'a pas été possible (`changeyourlife.ai` pas dans l'allowlist réseau du sandbox), mais comme le hash de commit du dernier déploiement Vercel est strictement égal au HEAD local, c'est la garantie la plus forte possible que les deux sont identiques.

---

## 2. Verdict global

Bon projet, structure claire, design system propre, sécurité de fond correcte côté backend. Quelques points qui méritent un coup de torchon — surtout côté **PWA (bug bloquant)**, centralisation **Firebase config**, **XSS modéré** sur le Codex, et la double-pile de fichiers obsolètes (CSS et docs).

### Score par axe

| Axe | Note | Commentaire |
|---|:---:|---|
| Architecture | **B+** | Modules bien séparés. Quelques duplications (Firebase config × 14, deux dossiers Firebase Functions). |
| Sécurité | **B** | Headers + CSP + Firestore rules OK. XSS modéré sur Codex. `Math.random` pour OTP. |
| Qualité code | **B+** | Pas de TODO, pas d'eval. Beaucoup d'`innerHTML` mais user content correctement échappé partout sauf Codex. |
| **PWA** | **D** | **Bug bloquant** : `index.html` charge `site.webmanifest` (générique « MyWebSite ») au lieu de `manifest.json`. |
| SEO | **C** | 13 pages sans `<meta description>`. Sitemap incomplet (manque modules récents). |
| Perf | **B** | Cache headers Vercel solides. Service Worker incomplet. |
| Maintenabilité | **C+** | 17 fichiers `.md` à la racine, deux dossiers functions, CSS doublonné. |

---

## 3. À corriger en priorité (CRITIQUES)

### 3.1 — 🔴 CRITIQUE — Bug PWA : mauvais manifest chargé

**Impact :** UX directe sur mobile

**Fichier :** `public/index.html`, ligne 36

```html
<link rel="manifest" href="/site.webmanifest">
```

Or `/site.webmanifest` contient un placeholder générique :

```json
{ "name": "MyWebSite", "short_name": "MySite", "theme_color": "#000000" ... }
```

Le vrai manifest avec le branding correct (Change Your Life, theme `#00aaff`, shortcuts vers `/yourlife` et `/meditation`) est dans `/manifest.json` mais **n'est jamais chargé**.

**Conséquences :**

- Quand un user installe la PWA sur mobile, l'icône s'appelle « MySite » avec couleur noire.
- Pas de shortcuts (Your Life / Méditation).
- Pas de catégories app-store (`health`, `lifestyle`, `education`) → moins discoverable.
- Pas de description, pas de screenshots PWA.

**Fix recommandé :**

- Soit pointer `index.html` vers `/manifest.json` (et supprimer `site.webmanifest`).
- Soit fusionner les deux fichiers en un seul (à privilégier — décision : garder `manifest.json` comme source de vérité).
- Ajouter `<link rel="manifest">` sur **toutes les pages** (actuellement présent uniquement sur `index.html`).

---

### 3.2 — 🟠 ÉLEVÉ — XSS modéré sur le module Codex

**Impact :** self-XSS exploitable via URL params / partage / import JSON

**Fichier :** `public/codex/index.html`, lignes 373-393 et 410-417

Les notes utilisateur (`item.title`, `item.summary`, `item.body`, `item.tags`) sont injectées dans le DOM via `innerHTML` sans échappement :

```js
cont.innerHTML = items.map((item, i) => `
  ...
  <h3>${item.title}</h3>
  <p>${item.summary}</p>
  ...`).join('');
```

Un utilisateur qui crée une note avec `<img src=x onerror=alert(1)>` dans le titre exécute du JS dans son propre navigateur. Comme les Firestore rules limitent l'écriture au propriétaire (`codexNotes.uid == auth.uid`), c'est techniquement du **self-XSS** — mais devient exploitable si :

- Tu ouvres un partage de note (feature future).
- Un attaquant te fait cliquer sur un lien avec des paramètres URL qui pré-remplissent une note.
- Tu importes du JSON contenant des notes.

**Fix recommandé :**

- Remplacer la construction par `innerHTML` par un `createElement` + `textContent` (comme c'est déjà fait dans Journal et Objectifs).
- Alternative rapide : passer chaque champ user dans une fonction `escapeHtml()` avant insertion.

---

### 3.3 — 🟡 MOYEN — OTP généré avec `Math.random()`

**Impact :** théoriquement prédictible

**Fichier :** `api/send-verification.js`, ligne 134

```js
const code = String(Math.floor(100000 + Math.random() * 900000));
```

`Math.random()` n'est pas cryptographiquement sûr. En pratique, vu :

- Le rate limit de 60s côté serveur (ligne 122).
- Les 5 tentatives max côté verify.
- L'expiration en 15min.

Le risque réel d'exploitation est très faible. Mais un OTP doit utiliser `crypto.randomInt` :

```js
const { randomInt } = require('node:crypto');
const code = String(randomInt(100000, 1000000));
```

---

## 4. À nettoyer ensuite (IMPORTANT)

### 4.1 — 🟠 ÉLEVÉ — Firebase config dupliquée dans 14+ fichiers

**Impact :** cauchemar de maintenance

La config Firebase (`apiKey`, `projectId`, etc.) est répétée à l'identique dans :

- `public/index.html`, `app/index.html`, `autoevaluation/`, `coach/`, `codex/`, `habitudes/`, `journal/`, `meditation/`, `objectifs/`, `settings/`, `verify-email/`, `yourlife/`
- `public/js/firebase.js`, `config.js`, `agent-builder.js`, `inscription.js`, `profile.js`, `yourlife-editor.js`, `yourlife.js`

> ⚠️ **Note importante :** ce n'est **PAS** une fuite de secret — l'`apiKey` Firebase web est publique par design (sécurité = Firestore rules + App Check). Le problème est qu'au prochain renouvellement de projet ou changement de config, il faudra modifier 20 endroits.

**Fix recommandé :**

- Centraliser dans `/js/firebase.js` (déjà fait à 90%).
- Importer depuis chaque page : `import { getFirebaseApp } from '/js/firebase.js'`
- Supprimer toutes les copies inline.

---

### 4.2 — 🟠 ÉLEVÉ — Service Worker incomplet

**Impact :** pages récentes pas en cache offline

**Fichier :** `public/service-worker.js`, lignes 4-19

```js
const urlsToCache = [
  '/', '/app/', '/login/', '/verify-email/', '/journal/',
  '/settings/', '/profile/', '/yourlife/', '/meditation/', '/objectifs/',
  '/css/main.min.css', ...
];
```

**Manquent :** `/coach/`, `/codex/`, `/autoevaluation/`, `/bilan/`, `/humeur/`, `/habitudes/`, `/sommeil/`, `/gratitude/`. Ces pages **ne fonctionnent pas en offline**.

---

### 4.3 — 🟠 ÉLEVÉ — Métadonnées SEO manquantes

**Impact :** référencement Google

**13 pages n'ont pas de `<meta name="description">` :**

`app`, `autoevaluation`, `bilan`, `codex`, `gratitude`, `habitudes`, `humeur`, `login`, `profile`, `settings`, `signup`, `sommeil`, `verify-email`, `404`

**Aussi :** `sitemap.xml` liste 10 URLs, mais le projet en compte 20. Manquent : `bilan`, `coach`, `gratitude`, `habitudes`, `humeur`, `signup`, `sommeil`, `verify-email`.

---

### 4.4 — 🟡 MOYEN — Doublon `main.css` vs `main.min.css` désynchronisé

**Fichier :** `public/css/`

`main.css` (101 lignes) et `main.min.css` (332 lignes) sont **deux design systems différents** :

- `main.css` = ancien (variables `--background-color`, `--glass-bg`, etc.)
- `main.min.css` = nouveau « Design System v2 » (variables `--bg`, `--bg-surface`, etc.)

Toutes les pages utilisent `main.min.css`. `main.css` peut être supprimé (ou renommé en `main.legacy.css` si tu veux garder en référence).

---

### 4.5 — 🟡 MOYEN — Doublon `functions/` vs `changeyourlife-database/`

Deux dossiers Firebase Functions :

- `functions/` — version TypeScript avec genkit + express
- `changeyourlife-database/` — version JS classique

`firebase.json` pointe sur `"functions"` (le bon). `changeyourlife-database/` est probablement un vestige à supprimer.

---

## 5. Améliorations conseillées (NICE TO HAVE)

### 5.1 — 🔵 FAIBLE — `firestore.indexes.json` contient des commentaires JSON invalides

Le fichier contient des `//` commentaires de template au début. Firebase CLI les tolère, mais c'est techniquement du JSON invalide qui peut casser un parser tiers.

### 5.2 — 🔵 FAIBLE — 17 fichiers `.md`/`.txt` à la racine

`ACCESSIBILITY.md`, `AUDIT_FINAL.md`, `CHANGELOG.md`, `COMPLETION_REPORT.md`, `CONTRIBUTING.md`, `DEPLOYMENT_CHECKLIST.md`, `DOCUMENTATION.md`, `FAQ.md`, `IMPROVEMENTS_SUMMARY.md`, `INDEX.md`, `QUICKSTART.md`, `README.md`, `README_IMPROVED.md`, `SECURITY.md`, `SUMMARY.txt`, `TESTING.md`, `VANTA_IMPLEMENTATION.md`.

**Recommandation :** déplacer dans `/docs/`, garder seulement `README.md` à la racine. `README.md` actuel ne fait que 1 ligne — il faudrait soit le compléter, soit utiliser `README_IMPROVED.md` à la place.

### 5.3 — 🔵 FAIBLE — `public/_cleanup_note.txt`

Fichier de note interne qui se retrouve dans le bundle servi en prod. À supprimer.

### 5.4 — 🔵 FAIBLE — `innerHTML` extensif (95+ occurrences)

Beaucoup d'`innerHTML`, mais pour les pages qui touchent du contenu utilisateur (Journal, Objectifs, Coach), le code utilise correctement `textContent`. Seul Codex est problématique (cf. 3.2). Sur le long terme, migrer vers une lib légère (lit-html, ou juste `createElement` + DOM API) limiterait la surface d'attaque.

### 5.5 — 🔵 FAIBLE — `console.log` encore présents

`public/index.html` écrase `console.log` en prod (ligne 757) — bonne idée. Mais `yourlife-editor.js` a encore des `console.debug` actifs, et le `service-worker.js` a des `console.log`. À nettoyer ou centraliser via le `logger.js` existant.

### 5.6 — 🔵 FAIBLE — Open Graph / Twitter image trop petite

`og:image` et `twitter:image` pointent vers `/apple-touch-icon.png` (180×180). LinkedIn/X recommandent **1200×630** pour un meilleur preview de partage.

---

## 6. Ce qui est très bien fait ✅

- **Headers HTTP solides** : CSP correctement configurée, `X-Frame-Options DENY`, `X-Content-Type-Options`, `Permissions-Policy` strictes (geolocation/microphone/camera bloqués).
- **Cache strategy Vercel** : CSS et images en cache 1 an immutable, JS en `stale-while-revalidate`, `service-worker.js` `no-cache`. Très propre.
- **Redirects propres** pour les anciennes URLs (`.html` → routes propres).
- **Firestore rules correctement scopées** : `isOwner` check, validation des emotions du journal, range check pour `quality`/`mood`, `verificationCodes` verrouillé en read/write.
- **Backend OTP** : token verification, rate limit 60s, 5 tentatives max, expiration 15min, code clearing après succès. Solide.
- **PWA service-worker** : network-first pour navigation, cache-first pour assets, fallback offline.
- **Design system v2 cohérent** : variables CSS centralisées, palette unifiée (`#060e1a`, `#0b1829`).
- **0 TODO, 0 FIXME, 0 HACK** dans le code — discipline impressionnante.
- **Aucun `eval` / `new Function`** — pas de surface d'attaque côté JS dynamique.
- Toutes les pages ont l'attribut `lang="fr"`, toutes les `<img>` ont un `alt`.
- L'API `send-verification` utilise un beau template HTML responsive pour l'email avec brand cohérent.

---

## 7. Plan d'action recommandé

Si tu veux tout fixer, je propose cet ordre — du plus payant au moins urgent :

| # | Sévérité | Action | Effort |
|:---:|:---:|---|---|
| 1 | 🔴 **CRIT** | Fixer le manifest PWA (pointer vers `manifest.json` sur toutes les pages) | 15 min · 1 commit |
| 2 | 🟠 HIGH | Centraliser la config Firebase dans `/js/firebase.js` + supprimer les 14 copies | 1h · 1 commit |
| 3 | 🟠 HIGH | Sécuriser le module Codex (`escapeHtml` ou refactor `textContent`) | 30 min · 1 commit |
| 4 | 🟠 HIGH | Ajouter les modules manquants au Service Worker | 10 min · 1 commit |
| 5 | 🟠 HIGH | Ajouter `<meta description>` aux 13 pages manquantes + compléter `sitemap.xml` | 30 min · 1 commit |
| 6 | 🟡 MED | Remplacer `Math.random()` par `crypto.randomInt()` dans `send-verification.js` | 5 min · 1 commit |
| 7 | 🟡 MED | Supprimer `main.css` obsolète + dossier `changeyourlife-database/` | 10 min · 1 commit |
| 8 | 🔵 LOW | Ranger `/docs/`, supprimer `_cleanup_note.txt`, nettoyer `console.log` | 20 min · 1 commit |
| 9 | 🔵 LOW | Créer une vraie OG image 1200×630 | 15 min + 1 image |

**Total estimé :** ~3h pour tout corriger + 9 commits propres → redeploy auto Vercel.

---

**Dis-moi par où tu veux commencer et on enchaîne.** 🚀
