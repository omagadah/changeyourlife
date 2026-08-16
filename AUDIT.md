# AUDIT — changeyourlife.ai

> Dernier passage : **2026-08-16** · SW **v171** · branche `main`
> Méthode : scan complet des 10 dimensions (sécurité front, sécurité API, Firebase,
> headers/dépendances, qualité de code, cohérence repo, PWA/perf, UX de `/app/`,
> i18n/a11y, liens fonctionnels), puis **vérification adversariale** de chaque
> finding critique ou important (relecture du code réel, tentative de réfutation).
> 6 findings ont été réfutés à la vérification et retirés du rapport.

## Résumé

| | Trouvés | Corrigés dans cette passe | Restants |
|---|---|---|---|
| Critique | 4 | 3 | 1 |
| Important | 36 | 17 | 19 |
| Mineur | 51 | 4 | 47 |
| Curiosités | 18 | — | 18 |

**Aucune fuite de secret, aucun `eval`/`new Function`, aucun `Math.random` sur un
chemin de sécurité, aucun lien interne cassé, aucune collection Firestore sans
règle.** Le socle est sain ; les problèmes réels sont concentrés sur le cache
HTTP, l'accessibilité clavier, le poids des assets et le circuit XP.

---

## 🔴 Critique

### C1 — CSS et JS servis en cache long : les mises à jour n'atteignaient jamais les clients ✅ CORRIGÉ
`vercel.json:6` · `/css/(.*)` était servi en `max-age=31536000, immutable` alors que
les 29 pages référencent `/css/main.min.css` **sans hash ni `?v=`**. `immutable`
interdit toute revalidation : un utilisateur récurrent pouvait garder l'ancien CSS
**jusqu'à un an**. Le service worker n'y changeait rien — sa stratégie network-first
passe par `fetch(request)`, donc par le cache HTTP du navigateur. Idem `/js/*.js`
en `max-age=86400` (jusqu'à 24 h de retard, 7 jours en `stale-while-revalidate`).

> Conséquence directe : la palette organique et la refonte de `/app/` ne seraient
> jamais apparues chez un utilisateur existant.

**Fix** : `/css/` et `/js/` passent en `max-age=0, must-revalidate` (revalidation
304, peu coûteuse). En compensation, `/vendor/`, `.jpg/.webp/.glb` — réellement
immuables — passent en cache 1 an, ce qu'ils n'avaient pas du tout.

### C2 — `functions/` : 32 vulnérabilités npm dont 3 critiques ✅ CORRIGÉ (partiellement)
`functions/package.json:18` · `fast-xml-parser`, `protobufjs` (RCE
GHSA-xq3m-2v4x-88gg), `websocket-driver`, plus 13 high (express 4.x, lodash,
node-forge, jws, path-to-regexp, @grpc/grpc-js). Racine : 13 vulnérabilités dont
1 critique. Ces dépendances tournent en production dans les API `/api/*`.

**Fix** : `npm audit fix` appliqué aux deux emplacements.
**Résultat : racine 13 → 8, functions 32 → 10. Plus aucune critique ni high.**
Les 18 restantes sont **modérées** et exigent un major `firebase-admin 12 → 14`
(breaking) — à planifier, pas à faire à chaud.

### C3 — XP invisible sur 4 branches sur 8 : le circuit ORGANIZER → arbre était rompu ✅ CORRIGÉ
`public/js/firebase.js` · `BRANCH_TO_LEGACY` ne mappe que 4 des 8 branches
(`physio`, `appartenance`, `cognitif`, `securite`). `app.js` calculait les anneaux
**et le total XP affiché** depuis le miroir legacy `levels`. Donc terminer une fiche
rattachée à **Estime, Esthétique, Accomplissement ou Transcendance** créditait bien
l'arbre, mais **l'écran ne bougeait pas d'un point** : anneaux figés, total XP bloqué.

Aggravant : `guessBranch()` range « projet / coder / livrer / objectif / deadline »
dans **accomplissement** — précisément la catégorie la plus fréquente pour toi.

**Fix** : `/app/` lit désormais `tree.branches` (source de vérité, 8 branches) au
lieu du miroir 4 axes, avec repli sur `levels` pour les comptes antérieurs. Les
anneaux affichent les 8 vraies branches Maslow, chacune liée à sa page de
drill-down.

### C4 — `/organizer/` totalement inutilisable au clavier ⚠️ RESTANT
`public/js/organizer.js:169` · Les fiches sont des `<div>` avec un seul listener
`click`, sans `tabindex` ni `role`. Le déplacement repose sur SortableJS, qui n'a
aucun support clavier. L'alternative (le select « Déplacer vers » de la modale) est
inatteignable, puisque la modale ne s'ouvre qu'au clic souris. La vue Canvas est
pire (drag `pointerdown` exclusivement).

**Le hub de `/app/` a été corrigé** (fiches focusables, `role=dialog`, Escape),
**mais pas la page `/organizer/` elle-même** — même traitement à appliquer.

---

## 🟠 Important

### Corrigés dans cette passe

| # | Sujet | Fichier | Ce qui a été fait |
|---|---|---|---|
| I1 | **Suppression de compte 100 % cassée** (RGPD) | `firestore.rules:58` · `settings.js:504` | `deleteDoc(users/{uid})` était refusé (aucun `allow delete`) : le compte Auth était supprimé mais **les données restaient**. Ajout de la clause + purge explicite des 5 sous-collections et des collections `assessments`/`codexNotes` (un `deleteDoc` ne supprime pas les sous-collections) |
| I2 | **XSS stocké** dans `/yourlife/` | `yourlife.js:329,417` | `skill.label` (saisie libre) injecté brut dans la timeline et le SVG de la mindmap. Ajout d'un `esc()` sur tous les points d'injection |
| I3 | **XSS via traductions IA** | `i18n.js:490` | `data-i18n-html` faisait `innerHTML = t(clé)`, où `t()` renvoie en priorité du texte **généré par LLM** mis en cache localStorage, sans sanitisation. Ajout d'un filtre qui échappe tout puis ne réautorise que `<br> <strong> <em>` (testé : `<img onerror>`, `<script>`, `<br onmouseover>` neutralisés, mise en forme légitime préservée) |
| I4 | **OTP non lié à son email** | `verify-code.js:58` | Le code stockait `email` mais ne le comparait jamais à `decoded.email` : demander un code sur son adresse, puis changer l'email du compte, marquait vérifiée une adresse **jamais confirmée**. Contrôle ajouté |
| I5 | **Email bombing** d'un tiers | `send-verification.js:129` | Seul garde-fou : 60 s entre deux envois. Ajout d'un plafond **8/jour/uid** |
| I6 | **Coût LLM non borné** | `chat.js:146` · `coach.js:98` | 15/min/uid sans plafond journalier = 21 600 appels/jour possibles par compte. Ajout de **200/j** (chat) et **150/j** (coach) |
| I7 | **Quota i18n épuisable par une IP** | `translate.js:21` | Endpoint public : une seule IP épuisait le quota global (400/j) en ~100 min et coupait la traduction pour tous. Ajout d'un plafond **60/j/IP** |
| I8 | **Giveaway : Sybil + pré-inscription** | `firestore.rules:134` | Participation possible sans email vérifié et sur n'importe quel `cycleId`, y compris futur lointain. Verrouillé : `email_verified` requis + fenêtre de cycle à 8 jours |
| I9 | **Back-office admin entièrement bloqué** | `settings.js:544` | Aucune clause `isAdmin()` dans les rules : compteur, recherche et export échouaient tous en `permission-denied`. Helper `isAdmin()` ajouté (claim serveur uniquement, `roles/` reste read-only → pas d'auto-promotion) |
| I10 | **CSP : `wss:` sans hôte** | `vercel.json:38` | Schéma nu = WebSocket sortant vers n'importe quel domaine (canal d'exfiltration idéal). Retiré (0 usage dans le code) |
| I11 | **CSP : CDN inutiles autorisés** | `vercel.json:38` | `unpkg.com` (0 usage) et `code.tidio.co` (chargé par `landing.js`, fichier orphelin) retirés. Ajout de `object-src 'none'` et `base-uri 'self'` |
| I12 | **Clés i18n périmées sur `/app/`** | `app/index.html:371` | `data-i18n="app.organizer.title"` réécrivait « Board complet » en « ORGANIZER », et `app.plan.title` remplaçait « Aujourd'hui » par une chaîne longue qui débordait de la puce. Clés retirées de ces libellés contextuels |
| I13 | **Hub ORGANIZER inaccessible au clavier** | `app-organizer.js:156` | Fiches `tabindex=0` + `role=button` + Enter/Espace ; modale en `role=dialog aria-modal`, focus initial, fermeture par Escape |
| I14 | **Toasts muets pour les lecteurs d'écran** | `app-organizer.js` · `agenda.js` | `role=status` + `aria-live=polite` ajoutés (3 autres implémentations restent à traiter) |
| I15 | **Collision de classe `.hub-ghost`** | `app-organizer.js:182` | Le `ghostClass` de SortableJS portait le même nom que les boutons pilule de l'en-tête : le fantôme de drag héritait du style bouton. Renommé `hub-ghost-card` |
| I16 | **Badge XP sur le logo (mobile)** | `app/index.html:125` | Chevauchement à ≤ 600 px (logo 12+40 px vs badge à 48 px). Badge descendu à 58 px |
| I17 | **Posture directive sur `/app/`** | `app.js:301` | Le bloc « Action du jour » prescrivait (« Tu n'as pas encore médité », « Domaine à renforcer ») — contraire à la règle **non négociable** de non-directivité. Reformulé en constat (« Ce que ton arbre montre… c'est un constat, pas un reproche »), et masqué tant qu'il n'y a rien d'observé |

### Restants — sécurité

- **`/api/*` : aucun SRI sur ~30 scripts CDN** (`grep integrity=` → 0). Une
  compromission de cdnjs ou jsdelivr exécute du code arbitraire sur toutes les
  pages connectées. → vendoriser (comme déjà fait pour three r184) ou épingler.
- **Jeton OAuth Google Calendar en `sessionStorage`** (`gcal.js:43`), scope
  **écriture**, TTL ~55 min, lisible par tout JS de la page. → garder en mémoire
  module, et ne demander le scope écriture qu'au premier besoin réel.
- **`ROOT_ADMIN_UID` toujours actif** (`functions/src/index.ts:127`) : l'UID de
  l'env var est admin permanent sans custom claim, et `setUserRole` refuse de le
  déclasser. CLAUDE.md prévoit son retrait une fois un admin créé.
- **Tidio sur la landing qui porte le formulaire mot de passe** — neutralisé de
  fait (`landing.js` orphelin, CSP resserrée), mais **le fichier existe encore** :
  à supprimer pour que personne ne le réactive.

### Restants — PWA / performance

- **`ez-tree.es.js` = 4,0 Mo** (20 images base64 embarquées), chargé sur `/login/`
  **et** `/app/` — les deux pages les plus visitées.
- **three.js r134 + vanta chargés depuis CDN sur ~26 pages** (~640 Ko) pour un
  fond animé, alors que three **r184 est déjà vendoré**. *(Retiré de `/app/` dans
  cette passe ; les 25 autres pages restent.)*
- **Le précache offline de 33 routes est illusoire** : le SW ignore le
  cross-origin (`service-worker.js:116`), donc Sortable, Chart.js, three et vanta
  ne sont jamais mis en cache. Les pages précachées ne fonctionnent pas hors ligne.
- **Le SW n'est jamais enregistré sur la landing `/`** : l'enregistrement vit dans
  `common.js`, qu'aucun script de `index.html` n'importe. Un visiteur qui reste sur
  l'accueil n'a **ni installabilité PWA ni offline**.

### Restants — i18n / accessibilité

- **9 langues sur 16 n'ont aucun dictionnaire** : si `/api/translate` échoue
  (quota, 429, hors ligne), l'utilisateur reste **définitivement en français**.
- **Les 6 dictionnaires manuels traduisent l'ancienne copie** du hero et sont
  **prioritaires sur l'IA** : `SRC_VERSION` n'invalide que les caches IA.
- **`auto-translate` ne traduit aucun attribut** : `placeholder`, `title`,
  `aria-label` restent en français dans toutes les langues.
- **Dates figées en `fr-FR` dans 15+ modules** — un utilisateur espagnol lit
  « jeudi 16 août ». `CYL.getLang()` existe mais n'est jamais utilisé.
- **`prefers-reduced-motion` ignoré par les boucles 3D** (`living-tree.js:283`,
  `arbre3d.js:1021`) : la media query CSS ne coupe pas une scène WebGL.
- **`#tree-stage` annonce `role="button"` sans handler clavier** : la promesse
  d'activation Enter/Espace ne fait rien.
- **Contraste `--text-3` (#7c7660) = 4,25:1**, sous le seuil AA (4,5:1), utilisé
  massivement en 0,6–0,74 rem.
- **`/plan/` : puces d'énergie et cartes vitales = `<div>` cliquables** sans
  `tabindex`, `role` ni `aria-pressed`.

---

## 🟡 Mineur (extraits)

- **`npm run deploy:functions` casse sur machine neuve** : aucun `tsc` avant le
  deploy, `firebase.json` n'a pas de hook `predeploy`, et `lib/` est gitignoré.
- **`web/`** : refonte Next.js 15 complète (29 fichiers trackés, 687 Mo en local),
  **absente de CLAUDE.md**. À trancher : supprimer ou documenter comme gelée.
- **CLAUDE.md documente 5 API serverless, il y en a 7** (`syl-brief`,
  `giveaway-draw` manquent). `addXp` (Cloud Function) n'est pas documenté non plus.
- **Sitemap : 17 URLs pour 35 pages** — ~13 pages publiques absentes.
- **`/coach/` est orpheline** : dans le sitemap et le précache, mais **aucun lien
  interne** n'y mène. Module inaccessible sans taper l'URL.
- **2 événements custom émis sans écouteur** : `cyf:theme-changed`,
  `cyl:gcal-changed`.
- **`#greeting-sub` et `#user-email` référencés par `app.js`, absents du DOM**
  (déjà protégés par des garde-fous — code mort, pas un bug).
- 5 `console.log` de debug restants dans `public/js` et `api`.
- `firebase-functions-test` déclaré en devDep, jamais utilisé.

## Code mort — suppression proposée (⚠️ en attente de ton accord)

Rien n'a été supprimé : ce sont des actions destructives.

| Chemin | Poids | Statut |
|---|---|---|
| `public/models/` | **2 251 Ko** | `tree-hd.glb`, `tree.glb`, `tree-preview.html` — référencés par **aucun** code (l'arbre est procédural via ez-tree) |
| `public/js/tree-widget.js` | 41 Ko | Remplacé par `living-tree.js`, mais **encore précaché** par le SW |
| `public/js/arbre.svg.legacy.js` | 10 Ko | Orphelin |
| `public/tree-lab/` + `js/tree-lab.js` | 7 Ko | Page de dev servie en production, précachée pour tous |
| `public/js/landing.js` | 4 Ko | Orphelin — c'est lui qui injectait Tidio |
| **Total** | **~2,3 Mo** | |

## Curiosités

- Le SW précache `/js/gcal.js`, `/organizer-data.js`, `/app-organizer.js`,
  `/syl-brief.js` : ces 4 fichiers sont **untracked en git**. `cache.addAll()` est
  **atomique** → s'ils sont poussés sans le SW (ou l'inverse), **l'installation du
  SW échoue en entier pour tous les utilisateurs**. Ils doivent partir dans le
  **même commit**.
- Deux taxonomies de couleurs coexistent : 8 branches Maslow + 4 domaines legacy,
  toutes en teintes Tailwind froides dans un décor or/mousse.
- `tree-widget.js` (mort) est resté 100 % navy v2 ; l'arbre en plein écran bascule
  donc dans un autre univers visuel dès l'expansion.
- `stripEmoji()` retire les emojis des titres de colonnes mais pas des fiches.
- `X-XSS-Protection: 0` est **volontaire et correct** (le filtre XSS des vieux
  navigateurs créait plus de failles qu'il n'en corrigeait).

## Stats

```
Pages HTML          38            Modules JS           65
API serverless       7            Cloud Functions       3
Règles Firestore   199 lignes     Index composites      0 (cohérent)
Poids public/     11,5 Mo         dont vendor/        4,7 Mo
Service worker    v171            Entrées précache     78
Vulns npm racine   8 modérées     Vulns functions     10 modérées
```

## Ce qui reste à faire côté owner (hors code)

- [ ] **Déployer les rules** : `npm run deploy:firestore` — sinon la suppression
      de compte, le back-office admin et le verrou giveaway restent inactifs.
- [ ] **Reconnecter Google Agenda** une fois (le scope OAuth a changé pour
      l'écriture lors de la session précédente).
- [ ] Vérifier `API_ANTHROPIC_CHATBOT` sur Vercel (utilisé par `/api/syl-brief`).
- [ ] Trancher : supprimer le code mort listé ci-dessus (~2,3 Mo) ?
