# CLAUDE.md

> Contexte permanent pour Claude Code travaillant sur changeyourlife.ai.
> Lu automatiquement à chaque session. Si tu modifies des conventions du projet, mets à jour ce fichier.

## Projet
- **Nom** : Change Your Life · `changeyourlife.ai`
- **Type** : PWA HTML/CSS/JS vanilla, **aucun build step**
- **Stack** : Frontend statique → Vercel · Backend Firebase (Auth + Firestore + Functions) · API serverless `/api/*.js` · Email via Resend
- **Repo GitHub** : `omagadah/changeyourlife` (public, branche `main`)
- **Auto-deploy** : push sur `main` → Vercel deploy en production (≈40 sec)

## Identité
- **Owner** : Romain (FR)
- **Git author** : `Romain <romain@changeyourlife.ai>` — utiliser cette identité pour tous les commits
- **Email Resend** : `noreply@changeyourlife.ai`

## Structure du repo

```
.
├── api/                     # Serverless functions Vercel (Node)
├── public/                  # Frontend statique servi par Vercel
│   ├── index.html           # Landing page (publique)
│   ├── app/                 # Dashboard logged-in
│   ├── {module}/            # 1 dossier par module
│   ├── js/                  # JS partagés (firebase.js singleton, common.js, userMenu.js, …)
│   ├── css/main.min.css     # Design system v2 unique
│   ├── manifest.json        # PWA manifest
│   ├── service-worker.js    # SW offline
│   └── sitemap.xml
├── functions/               # Firebase Functions (TypeScript)
├── firestore.rules          # Sécurité Firestore
├── vercel.json              # Headers + CSP + redirects
├── AUDIT.md                 # État courant (mis à jour à chaque audit)
└── docs/
    ├── sessions/            # Log incrémental — 1 .md par session
    └── …                    # Anciens audits / FAQ / SECURITY (historique)
```

## Modules frontend (16 pages)

| Module | Route | Notes |
|---|---|---|
| Landing | `/` | Public, vitrine |
| App | `/app/` | Dashboard logged-in |
| Login | `/login/` | Connexion + signup |
| Verify-email | `/verify-email/` | OTP 6 chiffres |
| Profile | `/profile/` | Profil utilisateur |
| Settings | `/settings/` | Dashboard & paramètres |
| Your Life | `/yourlife/` | Pyramide de Maslow interactive |
| Journal | `/journal/` | Journal quotidien |
| Méditation | `/meditation/` | Sessions guidées |
| Objectifs | `/objectifs/` | OKR / suivi |
| Coach | `/coach/` | IA coach (Gemini 2.0) |
| Codex | `/codex/` | Base de connaissance + notes user |
| Autoévaluation | `/autoevaluation/` | Roue de vie 4 axes |
| Bilan | `/bilan/` | Récap hebdo |
| Humeur, Sommeil, Habitudes, Gratitude | `/humeur/`, `/sommeil/`, `/habitudes/`, `/gratitude/` | Trackers |

## Conventions

### Commits
Format : `<type>(<scope>): <résumé court>` puis description détaillée.
Types : `feat`, `fix`, `chore`, `docs`. Scope : nom du module ou domaine (`nav`, `security`, `audit`).

Toujours signer les commits faits par Claude :
```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

### Code
- Vanilla JS via ESM modules — pas de framework
- **Singleton Firebase** : `import { auth, db } from '/js/firebase.js'` — JAMAIS de config inline
- **Service Worker** : bump `CACHE_NAME = 'changeyourlife-vXX'` à chaque modif de `/css` ou `/js`
- **User content** : `escapeHtml()` ou `textContent`, jamais d'`innerHTML` brut sur input user
- **OTP / random sécurisé** : `crypto.randomInt`, jamais `Math.random`
- **CSP** : respecter `vercel.json`. Pas de `unsafe-eval`.

### User menu trigger (logo CYL)
Deux patterns valides :
- `<nav class="site-nav">` avec back button + trigger (flex space-between)
- `<header class="header">` avec juste le trigger (CSS global le place top-right fixed)

### Tests
Pas de suite automatisée. Validation = redeploy Vercel + smoke test manuel par Romain.

## Workflow Claude Code

| Étape | Action |
|---|---|
| Début session | Je lis ce `CLAUDE.md` + dernier fichier dans `docs/sessions/` |
| Pendant | Tasks via `TodoWrite`, edits ciblés, commits autonomes si demandé |
| Fin session | Slash command `/session-end` — crée/MAJ `docs/sessions/YYYY-MM-DD.md` |
| Audit | Slash command `/audit` — relance un scan complet et MAJ `AUDIT.md` |

## Préférences Romain
- Réponses en **français**, format **court**, pas de blabla
- Pas de blocs de code longs sauf nécessaire
- Pas d'emoji (sauf si demandé)
- Avant action destructive ou push, demander confirmation
- Quand je dis « on continue » : tu reprends depuis le dernier session log

## Ressources
- [AUDIT.md](AUDIT.md) — état actuel du code (toujours à jour)
- [docs/sessions/](docs/sessions/) — log chronologique des sessions
- [README.md](README.md) — pitch projet
- [docs/](docs/) — historique audits / SECURITY / FAQ
