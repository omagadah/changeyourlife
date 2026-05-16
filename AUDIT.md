# Audit changeyourlife.ai

> **Dernière MAJ :** 2026-05-16 (reprise projet — toolchain réparé + audit + corrections A/B/D)
> **Branche :** `main` (4 commits locaux en avance sur `origin/main`, non poussés)
> **Type :** profond — sécurité, code mort, anomalies, cohérence, deps

---

## 1 · Verdict global

Repo en **bon état**. L'audit du 2026-05-16 a révélé une régression XSS et une vuln npm critique — **toutes deux corrigées dans cette session**, avec le nettoyage du code mort et les mineurs de sécurité.

| Axe | Note | Évolution |
|---|:---:|---|
| Architecture | **A−** | = |
| Sécurité | **A** | ↗ — XSS corrigés, vuln critique résolue, CDN pinné |
| Qualité code | **A** | ↗ — imports morts, deps inutiles, code mort purgés |
| PWA / SEO | **A** | = |
| Maintenabilité | **A−** | = |

---

## 2 · Findings & corrections (session 2026-05-16)

### ✅ Critique — corrigé

- ~~`protobufjs` vuln critique (code execution)~~ → `npm audit fix`. Restent 8 vulns *low* transitives (`firebase-admin`), non cassables sans `--force` — laissées.

### ✅ Important — corrigés

- ~~XSS stocké 4 trackers~~ → `escapeHtml()` ajouté dans gratitude/humeur/sommeil/habitudes, tout le contenu utilisateur échappé avant `innerHTML`.
- ~~7+ fichiers JS avec imports Firebase morts~~ → imports nettoyés sur 8 fichiers (`getAuth`, `signOut`, `initializeApp`, `getFirestore`, + `updateDoc`/`increment` non utilisés).
- ~~`functions/package.json` deps mortes~~ → `express`, `genkit`, `tsx` retirés + script `genkit:start` cassé supprimé. Lockfile régénéré.
- ~~`docs/INDEX.md` obsolète~~ → supprimé (désinformation).

### ✅ Mineurs — corrigés

- ~~`showToast` (coach.js) / `showLevelUp` (xp.js) morts~~ → supprimés + CSS associés (`.toast`, `.levelup-*`).
- ~~Bloc CSS legacy `.user-panel*`~~ → supprimé (`setupUserPanel` retiré depuis longtemps).
- ~~`api/send-verification.js` fuite `err.message`~~ → message générique côté client, détail loggé serveur.
- ~~`vanta@latest` non pinné~~ → pinné `vanta@0.5.24` sur 17 pages + service-worker.
- ~~dep `firebase` racine inutilisée~~ → retirée (48 packages élagués).
- ~~Service Worker commentaire désynchro~~ → `CACHE_NAME` bumpé v22 → v23.
- `firestore.rules` : borne 2000 car. ajoutée sur `gratitude` (g1/g2/g3).

### ⏸ Mineurs — non traités (volontaire)

- `firestore.rules` : pas de borne sur `bilans` / `codexNotes` — schéma non vérifié et effet uniquement après deploy (non testable en l'état). À faire avec le schéma sous les yeux.
- `vercel.json` : `style-src 'unsafe-inline'` (accepté, non exécutable) + `img-src https:` (large mais bénin).
- `functions/src/index.ts` : callables en `cors: true` (pas une faille — auth via idToken).
- `docs/` : ~14 fichiers historiques jamais référencés (`AUDIT_FINAL.md`, `COMPLETION_REPORT.md`, `VANTA_IMPLEMENTATION.md`…) — à trier par l'owner.
- `public/logo.svg`, `og-image.svg` — possiblement orphelins.

### ✅ Sections clean (inchangé)

- Aucun `eval` / `new Function` / `document.write`. Aucun secret en clair.
- `script-src` sans `unsafe-inline`/`unsafe-eval`. CDN allowlistés cohérents.
- `api/coach.js`, `verify-code.js` — auth, rate-limit, validation OK.
- `functions` — `addXp`/`setUserRole`/`getMyRole` correctement protégées.
- `firestore.rules` — deny-all, owner-only, `noXpTampering()`, collections backend verrouillées.

---

## 3 · État du toolchain (2026-05-16)

| Outil | État |
|---|---|
| Git | ✅ Réparé — remote `origin` = `omagadah/changeyourlife`, branche `main` |
| Git Credential Manager | ✅ Présent — auth GitHub au 1er push |
| Node.js / npm | ✅ v24.15.0 / npm 11.12.1 |
| Vercel CLI | ✅ v54.1.0 — non connecté (`vercel login`) |
| Firebase CLI | ✅ v15.18.0 — non connecté (`firebase login`) |
| Deploy Vercel | ✅ Auto via intégration GitHub (push `main` → build) |

---

## 4 · Actions manuelles en attente (owner)

1. ~~Pousser les commits~~ → ✅ fait (7 commits poussés sur `main`).
2. `firebase login` puis `firebase deploy --only firestore` — active `noXpTampering()`, locks `coachRate`/`roles`, et la nouvelle borne `gratitude`.
3. `firebase deploy --only functions` — `addXp` + `setUserRole` + `getMyRole`.
4. ~~Token v0~~ → ✅ purgé de l'historique git (`filter-branch` + force-push). NB : GitHub peut garder des commits orphelins en cache un temps.
5. Smoke-test post-deploy des pages trackers (gratitude/humeur/sommeil/habitudes).

---

## 5 · Stats du repo

| Métrique | Valeur |
|---|---|
| Pages HTML | 20 |
| Fichiers JS `public/js/` | 26 |
| Cloud Functions | 3 (`addXp`, `setUserRole`, `getMyRole`) |
| API serverless | 3 (`coach`, `send-verification`, `verify-code`) |
| Vuln npm critiques | 0 (résolu) |
| Vuln npm restantes | 8 *low* transitives (`firebase-admin`) |

---

## 6 · Travail UI (session 2026-05-16)

- ✅ Bug : `codex` / `autoevaluation` utilisaient des variables CSS non définies → corrigé.
- ✅ `404.html` repassée aux couleurs de la marque.
- ✅ `login` / `verify-email` rendus responsive (media queries `≤480px`).
- ✅ Libellé du bouton retour unifié (« ← Mon espace ») sur 11 pages.
- ⏸ Toasts : 10 pages redéfinissent leur toast local — unification reportée
  (refactor invisible + risque de régression).

## 7 · Chantiers restants (prochaines sessions)

1. Connexion + deploy Firebase (cf. §4) — seul bloquant pour activer 100 % des fixes.
2. Bornes `firestore.rules` sur `bilans`/`codexNotes` (avec le schéma).
3. Tri du dossier `docs/` (historique vs bruit).
4. UI : unifier les toasts sur `.toast-notification`, `theme-color` `#00aaff` → `#0070f3`, remplacer les ~300 couleurs hardcodées par les variables du design system.
5. Décisions business : Tidio chat, compteurs landing.

---

## Méthode

Audit via `/audit` — 2 agents read-only en parallèle (sécurité / qualité-cohérence) + `npm audit`. Corrections appliquées en 3 blocs (A sécurité, B nettoyage, D mineurs) + un lot UI, sur 7 commits. Historique git réécrit pour purger un token v0.
