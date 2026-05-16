# Audit changeyourlife.ai

> **Dernière MAJ :** 2026-05-16 (reprise projet — toolchain réparé + audit complet)
> **Branche :** `main` (synchro avec `origin/main`, commit `2747816`)
> **Type :** profond — sécurité, code mort, anomalies, cohérence, deps

---

## 1 · Verdict global

Repo en **bon état**, backend solide. Mais l'audit révèle une **régression XSS** (4 modules trackers injectent du contenu utilisateur non échappé) et une **vuln npm critique** (`protobufjs`). Aucun bloquant fonctionnel, mais 6 chantiers prioritaires à traiter.

| Axe | Note | Évolution |
|---|:---:|---|
| Architecture | **A−** | = |
| Sécurité | **B+** | ↘ — régression XSS 4 trackers + vuln npm critique |
| Qualité code | **B+** | ↘ — imports morts, deps inutiles, docs obsolètes |
| PWA / SEO | **A** | = |
| Maintenabilité | **A−** | = |

---

## 2 · Findings

### 🔴 Critique

- **`protobufjs` — vuln critique (npm)** — `npm audit` racine : `protobufjs <=7.5.5`, code execution + prototype pollution + DoS (GHSA-xq3m-2v4x-88gg & al.). Dépendance transitive (via `firebase` / `firebase-admin`). Fix : `npm audit fix`. Voir aussi le retrait de la dep `firebase` (inutilisée, §Mineur).

### 🟠 Important

- **XSS stocké — 4 modules trackers.** Contenu utilisateur injecté brut dans `innerHTML` :
  - `public/js/gratitude.js:177-179` — champs `g1`/`g2`/`g3`
  - `public/js/humeur.js:204` — `e.note`
  - `public/js/sommeil.js:203` — `l.note`
  - `public/js/habitudes.js:129-131` — `h.name`, `h.emoji`
  - Impact : données owner-only (un user ne s'attaque que lui-même) → sévérité Important, pas Critique. Devient sérieux si un panneau admin affiche un jour ces données.
  - Fix : factoriser un `escapeHtml()` partagé (pattern déjà présent dans `codex.js` `esc()` et `settings.js` `escAdmin()`).
- **7 fichiers — imports Firebase morts.** Symboles importés jamais appelés (le code utilise le singleton) :
  - `app.js:4` (`signOut`,`getAuth`) · `coach.js:5-7` (`initializeApp`,`getAuth`,`getFirestore`) · `journal.js:6-7` (`initializeApp`,`getAuth`) · `yourlife.js:5-6` (`initializeApp`,`getAuth`) · `habitudes.js:3` (`getAuth`) · `meditation.js:6` (`getAuth`) · `objectifs.js:6` (`getAuth`)
- **`functions/package.json` — deps mortes + script cassé.** `express` (l.19) et `genkit` (l.22) jamais importés ; script `genkit:start` (l.4) pointe vers `src/genkit-sample.ts` **inexistant**.
- **`docs/INDEX.md` obsolète.** Référence ~9 fichiers inexistants, email fictif, repo `yourusername/changeyourlife`, date 2025. À réécrire ou supprimer.

### 🟡 Mineur

- `public/js/coach.js:405-408` — `showToast()` définie, jamais appelée (+ `<div id="toast">` + CSS `.toast` inertes).
- `public/js/xp.js:37-58` — `showLevelUp()` exportée, jamais importée (+ CSS `.levelup-*` `main.min.css:319-335`).
- `public/css/main.min.css` — bloc `.user-panel*` (l.171-200) = CSS legacy (`setupUserPanel` retiré) + utilitaires non utilisés (`.btn-ghost`, `.input-base`, `.skeleton`, `.anim-fadeup/scalein`, `.text-blue`, `.font-800`).
- `api/send-verification.js:171` — fuite `err.message` brut au client (les autres endpoints renvoient un message générique).
- Dépendance CDN `vanta@latest` non pinnée sur ~13 pages (risque supply-chain). Pinner ex. `vanta@0.5.24`.
- `firestore.rules` — `bilans`, `gratitude`, `codexNotes` : `allow write/create` sans borne de taille des champs texte.
- `vercel.json` — `style-src 'unsafe-inline'` (connu, accepté) + `img-src https:` large (tracking pixel possible).
- `functions/src/index.ts` — 3 callables en `cors: true` (origine ouverte ; pas une faille car auth via idToken, mais restreignable).
- `package.json` racine — dep `firebase` jamais importée (frontend = CDN gstatic). `tsx` (devDep functions) lié au script `genkit:start` mort.
- `docs/` — ~15 fichiers historiques jamais référencés (`AUDIT_FINAL.md`, `COMPLETION_REPORT.md`, `VANTA_IMPLEMENTATION.md`, `SUMMARY.txt`…) à trier.

### 🔵 Curiosités

- `service-worker.js:1` — commentaire `// v21` désynchro (`CACHE_NAME` est bien `v22`).
- `public/js/common.js:45` — commentaire orphelin « setupUserPanel removed ».
- `public/logo.svg`, `public/og-image.svg` — aucun HTML ne les référence (`og-image.png` utilisé partout).
- `console.log` dans `service-worker.js` reste visible (scope worker).

### ✅ Sections clean

- Aucun `eval` / `new Function` / `document.write`.
- Aucun secret en clair (apiKey Firebase web = publique par design).
- Aucune URL d'exfiltration. CDN allowlistés cohérents avec la CSP.
- `script-src` sans `unsafe-inline`/`unsafe-eval` (durcissement 2026-05-08 tenu, zéro `<script>` inline / `onclick=`).
- `api/coach.js`, `verify-code.js`, `send-verification.js` — auth, rate-limit, validation OK.
- `functions/src/index.ts` — `addXp`/`setUserRole`/`getMyRole` correctement protégées.
- `firestore.rules` — deny-all par défaut, owner-only, `noXpTampering()`, collections backend verrouillées.
- Service Worker `CACHE_NAME` v22 cohérent avec `common.js`. Manifest PWA : icônes existent. Aucun doublon `.min.js`. Aucune page orpheline.

---

## 3 · État du toolchain (reprise 2026-05-16)

| Outil | État |
|---|---|
| Git | ✅ Réparé — `.git` reconstruit, remote `origin` = `omagadah/changeyourlife`, branche `main` synchro |
| Git Credential Manager | ✅ Présent — auth GitHub au 1er push (popup navigateur) |
| Node.js / npm | ✅ Installé — v24.15.0 / npm 11.12.1 |
| Vercel CLI | ✅ Installé v54.1.0 — ⚠️ non connecté (`vercel login`) |
| Firebase CLI | ✅ Installé v15.18.0 — ⚠️ non connecté (`firebase login`) |
| Deploy Vercel | ✅ Auto via intégration GitHub (push `main` → build). CLI Vercel non requise pour ce flux. |

---

## 4 · Actions manuelles en attente (héritées du 2026-05-08, non confirmées)

1. `firebase deploy --only firestore` — pour activer `noXpTampering()` + locks `coachRate`/`roles`.
2. `firebase deploy --only functions` — pour `addXp` + `setUserRole` + `getMyRole`.
3. Révoquer le token v0 sur v0.app (était commité dans `external/v0-app/`, supprimé du HEAD mais reste dans l'historique git public).

---

## 5 · Stats du repo

| Métrique | Valeur |
|---|---|
| Pages HTML | 20 (18 `index.html` + signup + 404) |
| Fichiers JS `public/js/` | 26 |
| Cloud Functions | 3 (`addXp`, `setUserRole`, `getMyRole`) |
| API serverless | 3 (`coach`, `send-verification`, `verify-code`) |
| Vuln npm racine | 2 (1 critique `protobufjs`, 1 modérée) |
| Vuln npm functions | non testée (`functions/node_modules` absent) |

---

## 6 · Prochains chantiers recommandés (ordre)

1. `npm audit fix` racine — résout la vuln critique `protobufjs`.
2. Corriger les 4 XSS trackers via un `escapeHtml()` partagé.
3. Nettoyer imports Firebase morts (7 fichiers) + deps `express`/`genkit`/`tsx`/`firebase` + script `genkit:start`.
4. Réécrire/supprimer `docs/INDEX.md` + trier `docs/`.
5. Mineurs : `showToast`/`showLevelUp`/CSS legacy, pin `vanta`, fuite `send-verification.js:171`.
6. Connexion Firebase CLI + deploy `firestore`/`functions` (actions manuelles owner).

---

## Méthode

Audit lancé via `/audit` — 2 agents read-only en parallèle (sécurité / qualité-cohérence) + `npm audit`. Scan complet `public/`, `api/`, `functions/`, `firestore.rules`, `vercel.json`, `package.json`, `docs/`.
