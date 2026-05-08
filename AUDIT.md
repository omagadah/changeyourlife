# Audit changeyourlife.ai

> **Dernière MAJ :** 2026-05-08 (post Custom Claims + DX improvements)
> **Branche :** `main`
> **Type :** profond — sécurité, code mort, anomalies, perf, cohérence

---

## 1 · Verdict global

Repo en **excellent état**. Tous les critiques + high + la plupart des mineurs sont fixés. Reste un seul gros chantier optionnel (externaliser scripts inline pour CSP plus stricte) et des décisions business.

| Axe | Note | Évolution |
|---|:---:|---|
| Architecture | **A−** | ↗ — singleton Firebase enrichi (auth+db+functions+awardXp) |
| Sécurité | **A** | ↗↗ — Custom Claims, XP server-side, Coach auth, Firestore rules strictes |
| Qualité code | **A−** | = — XSS Codex + admin fixés, doublons supprimés |
| PWA / SEO | **A** | = |
| Maintenabilité | **A** | ↗ — Prettier + EditorConfig + scripts npm + workflow Claude |

---

## 2 · État courant des findings

### ✅ Critiques fixés
- ~~`/api/coach` non authentifié~~ → idToken vérifié + rate-limit Firestore 10 req/min/uid
- ~~Clé Gemini en query string~~ → header `x-goog-api-key`
- ~~Code orphelin top-level dans `yourlife-editor.js`~~ → fichier entier supprimé (mort)

### ✅ Importants fixés
- ~~`api/proxy.js` mort~~ → supprimé
- ~~`external/v0-app/` + token v0~~ → dossier supprimé (⚠️ **token v0 à révoquer manuellement** sur l'interface v0.app)
- ~~`dataconnect/` + `src/dataconnect-generated/`~~ → supprimés + dépendance retirée du `package.json`
- ~~`.firebase/` cache committé~~ → supprimé + ajouté à `.gitignore`
- ~~9 JS morts (~1 750 LOC)~~ → supprimés
- ~~`common.min.js` désynchronisé~~ → supprimé
- ~~`vanta-global.css` mort~~ → supprimé
- ~~`firestore.indexes.json` JSON invalide~~ → propre
- ~~Désync version SW~~ → aligné sur `?v=21`
- ~~Pas de validation XP server-side~~ → tous les `levels.*.xp` passent par Cloud Function `addXp` ; rule Firestore `noXpTampering()` bloque les écritures directes
- ~~`functions/src/genkit-sample.ts`~~ → supprimé

### ✅ Mineurs fixés
- ~~XSS modéré panneau admin Settings~~ → `escAdmin()` sur tous les champs user
- ~~`document.write` dans 404.html~~ → `appendChild` style
- ~~Compteurs landing inventés~~ → garanties honnêtes (100% gratuit / 16 modules / PWA / EU)
- ~~ld+json `aggregateRating: 4.8 / 127`~~ → retiré
- ~~`api/coach.js` leak Gemini error~~ → message générique côté client
- ~~Sitemap entrée `/signup/` redondante~~ → retirée
- ~~README.md obsolète~~ → réécrit selon réalité
- ~~Collection `coachRate/{uid}` non protégée~~ → rule `if false` (admin SDK only)
- ~~`@dataconnect/generated` dans package.json~~ → retiré
- ~~Firebase Functions versions divergentes~~ → alignées sur `^12.6.0`
- ~~`vercel.json` `frame-src https://v0.app`~~ → retiré (vestige)
- ~~`assessments` / `codexNotes` `allow update` manquant~~ → ajouté avec validation uid stable
- ~~UID admin en dur + collection `roles` sans rules~~ → migré vers **Custom Claims** Firebase Auth (Cloud Functions `setUserRole` + `getMyRole`, ROOT_ADMIN_UID env var pour bootstrap, miroir Firestore en read-only client)

### ✅ DX & Workflow ajoutés ce 2026-05-08
- `CLAUDE.md` (contexte permanent), `docs/sessions/` (logs incrémentaux par jour)
- `.vscode/{settings,extensions}.json` — config workspace + 9 extensions recommandées
- `.claude/commands/{audit,session-end}.md` — slash commands custom
- `.claude/settings.json` — auto-permissions git/rm/mkdir/mv/npm/Vercel MCP
- `.prettierrc` + `.prettierignore` + `.editorconfig` — formatage cohérent
- `package.json` enrichi : `npm run dev|format|deploy:functions|deploy:firestore|deploy:firebase|audit:security|logs:functions`

---

## 3 · Restants (pour les prochaines sessions)

### 🟡 Cohérence visuelle restante (effort 2-4h)

`/profile/` et `/settings/` sont désormais alignés sur le design system v2. Mais **8 autres pages** ont encore des CSS inline locaux qui dévient du design system :
- `/codex/`, `/autoevaluation/`, `/gratitude/`, `/humeur/`, `/sommeil/`, `/habitudes/`, `/bilan/`, `/coach/`

Pour chaque : remplacer les variables CSS locales (`--bg:#07192f`, `--card:rgba(...)`, etc.) par les tokens du design system (`var(--bg)`, `var(--bg-surface)`, etc.). Petit gain visuel, gros gain cohérence.

### 🟡 Gros chantier (effort 4-6h)

**CSP `'unsafe-inline'` dans `script-src`** — toujours présent. Annule théoriquement la protection CSP contre XSS injecté en HTML. **Mitigations actuelles** : pas d'`innerHTML` user-controlled (Codex + admin escapent), Firestore rules strictes, OTP CSPRNG.

Pour le retirer :
1. Extraire chaque `<script>` inline des HTML vers des fichiers `/js/page-X.js` (~20 pages)
2. Pour les bootstraps Vanta/Firebase qui dépendent du timing, garder en module
3. Calculer les hashes SHA256 des inline scripts restants (logique conditionnelle minime) et les ajouter à la CSP
4. Tester chaque page après extraction (pas de tests automatisés → smoke test manuel)

À faire dans une session dédiée. Risque modéré de régression visuelle.

### ⚠️ Action manuelle requise (Romain)

1. **Bootstrap Custom Claims** :
   ```bash
   firebase functions:secrets:set ROOT_ADMIN_UID
   # entrer l'UID Firebase Auth de romainruiz31@gmail.com
   firebase deploy --only functions
   # ou: npm run deploy:functions
   ```
   Une fois admin créé via le custom claim, le `ROOT_ADMIN_UID` peut être retiré pour réduire la surface.

2. **Deploy des nouvelles règles Firestore** :
   ```bash
   npm run deploy:firestore
   ```
   Sans ça, `noXpTampering()` et le verrouillage `coachRate`/`roles` ne sont pas actifs.

3. **Révoquer le token v0** sur l'interface v0.app (était commité dans `external/v0-app/`, supprimé du HEAD mais reste dans l'historique git public).

### ⏸ Décisions business (à toi)

- **Tidio chat externe** chargé après 3s sur landing — garder ou retirer ?
- Re-câbler les compteurs landing à de vraies stats Firestore (vs garanties statiques) ?
- Programme de témoignages / avis vérifiés pour ré-activer un `aggregateRating` honnête ?

### 🔵 Curiosités sans gravité

- `console.log` dans `service-worker.js` reste visible (override `console.log = () => {}` de `index.html` est scope window, pas worker). À nettoyer un jour ou ignorer.
- `firebase-admin@^12.6.0` désormais aligné racine ↔ `functions/`

---

## 4 · Architecture courante (post-fix)

### Frontend
- 18 pages HTML statiques, vanilla JS via ESM
- Singleton Firebase via [public/js/firebase.js](public/js/firebase.js) — exporte `auth`, `db`, `functions`, `awardXp`
- Logo Mon Compte fixed top-right sur les 16 pages module (CSS global `.header` + back button via `.site-nav`)
- Service Worker v21 cache 18 routes + assets statiques
- Manifest PWA propre avec shortcuts YourLife/Méditation/Coach

### Backend
- `/api/send-verification.js` — OTP 6 chiffres CSPRNG, Resend, rate-limit 60s
- `/api/verify-code.js` — vérif OTP, 5 tentatives max
- `/api/coach.js` — Coach IA Gemini, idToken vérifié, rate-limit 10/min/uid
- `functions/src/index.ts` — Cloud Function `addXp` (transactional, cap 10 000)

### Firestore
- Rules par défaut **deny all** + matches explicites par collection
- `users/{uid}` → owner only, no `levels`/`xp_*` tampering (force passage par `addXp`)
- `users/{uid}/{journal,moods,bilans,sleep,gratitude}` → owner only avec validation
- `assessments`, `codexNotes` → owner only, create + delete
- `verificationCodes`, `coachRate`, `roles` → backend-only (admin SDK)

---

## 5 · Stats du repo (post-cleanup + DX)

| Métrique | Avant | Après |
|---|---|---|
| Code source total | ~14 700 LOC | ~12 700 LOC (−14%) |
| Fichiers JS dans `public/js/` | 16 | 6 |
| Dossiers de generated code | 2 | 0 |
| `package.json` racine deps | 4 | 3 |
| `.md` à la racine | 17 | 3 (README, CLAUDE, AUDIT) |
| Code mort identifié restant | ~2 000 LOC | 0 |
| Cloud Functions exportées | 1 (`addXp`) | 3 (`addXp`, `setUserRole`, `getMyRole`) |
| Custom Claims Auth | non | oui (`role: admin\|mod\|user`) |
| Scripts npm utiles | 0 | 7 (dev, format, deploy:*, audit:security, logs) |

**Top 5 fichiers (hors lock & images) :**
1. `public/settings/index.html` — 60 KB / 1 087 LOC
2. `public/app/index.html` — 66 KB / 1 053 LOC
3. `public/index.html` — 41 KB / 815 LOC
4. `public/coach/index.html` — 31 KB / 695 LOC
5. `public/codex/index.html` — 36 KB / 504 LOC

---

## 6 · Prochains chantiers recommandés

1. **Bootstrap Custom Claims** (5 min, manuel) — `firebase functions:secrets:set ROOT_ADMIN_UID` puis `npm run deploy:functions`
2. **Deploy règles Firestore** (1 min, manuel) — `npm run deploy:firestore`
3. **Extraire scripts inline** (4-6h, optionnel) — pour CSP plus stricte sans `'unsafe-inline'`

Le 1 et 2 sont les seuls bloquants pour activer 100% des fixes de sécurité de cette session.

---

## Méthode de l'audit

Audit lancé via Claude Agent en read-only, scan complet du codebase :
- Recherche patterns dangereux (`eval`, `document.write`, `innerHTML` user-controlled, secrets en clair)
- Détection imports inutilisés, code mort, doublons désynchronisés
- Lecture intégrale `firestore.rules`, `vercel.json`, `package.json`, `.gitignore`
- `npm audit` racine + functions
- Cross-référence service-worker / sitemap / pages réelles

Refaire un audit : taper `/audit` dans Claude Code.
