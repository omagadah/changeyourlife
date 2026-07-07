# DEPLOY.md — Runbook de déploiement ChangeYourLife.ai

> Comment mettre en production. Le frontend se déploie tout seul par `git push`.
> Le backend Firebase (rules + functions) se déploie **à la main** avec la CLI.

## 0. Prérequis outillage (Mac) — fait le 2026-07-07

```bash
# Node 22 (moteur exigé par functions/) + CLIs
brew install node@22
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"   # déjà ajouté à ~/.zshrc
npm install -g vercel firebase-tools
```

Vérifier : `node -v` (v22.x), `firebase --version`, `vercel --version`, `git --version`.

## 1. Frontend → Vercel (automatique)

Rien à lancer : **`git push origin main`** déclenche le déploiement Vercel prod (~40 s).
Aucun build (site statique). Vérifier ensuite sur https://changeyourlife.ai.

> ⚠️ À chaque modif de `/public/css` ou `/public/js`, le `CACHE_NAME` du
> service worker (`public/service-worker.js`) doit être bumpé (déjà à **v148**).

## 2. Backend → Firebase (manuel) — EN RETARD DEPUIS MAI, À FAIRE

Les `firestore.rules` du repo ne sont **pas** celles qui tournent en prod
(bornes bilans/codexNotes, noXpTampering, chatRate/translateRate, deny des
nouvelles collections). À déployer :

```bash
firebase login                       # une fois
firebase deploy --only firestore:rules,firestore:indexes
# (optionnel, si les functions ont changé)
npm run deploy:functions             # = firebase deploy --only functions
```

Scripts npm équivalents : `npm run deploy:firestore` · `npm run deploy:firebase`.

## 3. Variables d'environnement (Vercel — dashboard projet)

Nécessaires au bon fonctionnement des API serverless :

| Variable | Utilité | Requis |
|---|---|---|
| `API_ANTHROPIC_CHATBOT` (ou `ANTHROPIC_API_KEY`) | SYL (`/api/chat`) | pour activer SYL |
| `GROQ_API_KEY` | Coach + traduction (`/api/coach`, `/api/translate`) | recommandé |
| `GEMINI_API_KEY` (ou équiv.) | fallback coach/traduction | optionnel |
| `RESEND_API_KEY` | emails de vérification | pour le signup email |

`api/chat.js` lit `ANTHROPIC_API_KEY || API_ANTHROPIC_CHATBOT`. Sans clé, SYL reste inactif (dégradé propre).

## 4. Checklist avant chaque push prod

- [ ] `CACHE_NAME` bumpé si `/css` ou `/js` modifié.
- [ ] `node --check` OK sur les `.js` touchés (pas de suite de tests auto).
- [ ] Smoke test manuel : accueil se charge (le voile se lève), login, une sauvegarde (gratitude), XP visible.
- [ ] Si `firestore.rules` a changé → `firebase deploy --only firestore` APRÈS le push.

## 5. Sécurité (rappels)

- La config Firebase web (`public/js/firebase.js`) est **publique par nature** — ce n'est pas un secret.
- La clé API Firebase est restreinte par referrers (Google Cloud) — garder `firebaseapp.com` autorisé.
- Aucun secret ne doit entrer dans `public/` ni dans `api/` en dur : tout par variable d'env Vercel.
