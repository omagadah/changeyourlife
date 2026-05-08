# Audit changeyourlife.ai

> **Dernière MAJ :** 2026-05-08 (post audit profond + fixes)
> **Branche :** `main`
> **Type :** profond — sécurité, code mort, anomalies, perf, cohérence

---

## 1 · Verdict global

Repo en **bon état post-cleanup**. Les 3 critiques + 9 high de l'audit profond ont été corrigés ce 2026-05-08. Reste des éléments mineurs et des décisions long terme.

| Axe | Note | Évolution |
|---|:---:|---|
| Architecture | **B+** | ↗ — code mort supprimé (~2 000 LOC), singleton Firebase enrichi |
| Sécurité | **A−** | ↗↗ — XP server-side, Coach authentifié, Firestore rules durcies |
| Qualité code | **A−** | ↗ — XSS Codex + admin fixés, doublons supprimés |
| PWA / SEO | **A** | = |
| Maintenabilité | **A−** | ↗ — workflow CLAUDE.md + sessions + slash commands |

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
- ~~Compteurs landing inventés (12 400 / 84 000 / 43 000 / 98%)~~ → remplacés par garanties honnêtes (100% gratuit / 16 modules / PWA / EU)
- ~~ld+json `aggregateRating: 4.8 / 127`~~ → retiré
- ~~`api/coach.js` leak Gemini error~~ → message générique côté client, log côté serveur
- ~~Sitemap entrée `/signup/` redondante~~ → retirée
- ~~README.md obsolète~~ → réécrit selon réalité
- ~~Collection `roles/{uid}` sans rules~~ → rule ajoutée (read owner, write blocked → Custom Claims serveur)
- ~~Collection `coachRate/{uid}` non protégée~~ → rule `if false` (admin SDK only)
- ~~`@dataconnect/generated` dans package.json~~ → retiré

---

## 3 · Restants (pour les prochaines sessions)

### 🟡 À traiter quand possible

- **CSP `'unsafe-inline'` dans `script-src`** — nécessaire à court terme (scripts inline partout) mais annule la protection XSS HTML. Plan long terme : extraire les scripts inline + nonces CSP. Effort : 4-6h.
- **UID admin en dur côté client** ([public/settings/index.html:390](public/settings/index.html#L390)) — `ADMIN_UIDS` constante. Le bouton "Toggle Mod" écrit dans `roles/{uid}` mais la rule bloque désormais (correct). Pour réactiver les boutons admin, il faut implémenter Firebase Custom Claims + une Cloud Function callable `setRole(uid, role)`. Effort : 2h.
- **Firebase Functions `firebase-admin` versions divergentes** : `^12.0.0` racine vs `^12.6.0` dans `functions/`. Aligner.
- **Tidio chat externe** chargé dynamiquement après 3s sur landing. Décision business : garder ou retirer (perte d'autonomie côté UX).

### 🔵 Curiosités à valider côté UX
- `firestore.rules` : `assessments` et `codexNotes` ont `allow create` mais pas `allow update`. Donc impossible de modifier une note Codex (seulement supprimer + recréer). Confirmer si intentionnel.
- `vercel.json` autorise `frame-src https://v0.app` — vestige sans usage repéré, à enlever quand on est sûr que rien n'en dépend.
- `console.log` dans `service-worker.js` non muté par l'override `console.log = () => {}` de `index.html` (hors scope window). Logs SW visibles dans DevTools.

### ⏸ Décisions business (à toi Romain)
- Re-câbler les compteurs landing à des vraies stats Firestore (vs garanties statiques actuelles) ?
- Ajouter un programme de témoignages / avis vérifiés pour utiliser à nouveau le ld+json `aggregateRating` honnêtement ?
- Implémenter `allow update` sur `codexNotes` pour permettre l'édition des notes ?

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

## 5 · Stats du repo (post-cleanup)

| Métrique | Avant | Après |
|---|---|---|
| Code source total | ~14 700 LOC | ~12 700 LOC (−14%) |
| Fichiers JS dans `public/js/` | 16 | 6 |
| Dossiers de generated code | 2 | 0 |
| `package.json` racine deps | 4 | 3 |
| `.md` à la racine | 17 | 3 (README, CLAUDE, AUDIT) |
| Code mort identifié restant | ~2 000 LOC | 0 |

**Top 5 fichiers (hors lock & images) :**
1. `public/settings/index.html` — 60 KB / 1 087 LOC
2. `public/app/index.html` — 66 KB / 1 053 LOC
3. `public/index.html` — 41 KB / 815 LOC
4. `public/coach/index.html` — 31 KB / 695 LOC
5. `public/codex/index.html` — 36 KB / 504 LOC

---

## 6 · Prochains chantiers recommandés

1. **Custom Claims pour admins** (effort 2h) — pour réactiver les boutons "Toggle Mod" du panneau Settings
2. **Aligner versions firebase-admin** (effort 5 min)
3. **Extraire scripts inline** (effort 4-6h) — supprime le besoin d'`unsafe-inline` dans la CSP, gain XSS

Aucun n'est bloquant.

---

## Méthode de l'audit

Audit lancé via Claude Agent en read-only, scan complet du codebase :
- Recherche patterns dangereux (`eval`, `document.write`, `innerHTML` user-controlled, secrets en clair)
- Détection imports inutilisés, code mort, doublons désynchronisés
- Lecture intégrale `firestore.rules`, `vercel.json`, `package.json`, `.gitignore`
- `npm audit` racine + functions
- Cross-référence service-worker / sitemap / pages réelles

Refaire un audit : taper `/audit` dans Claude Code.
