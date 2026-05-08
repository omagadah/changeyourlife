# Change Your Life

> Une PWA gratuite de santé mentale optimisée par l'IA — méditation, journal, objectifs, coach IA, trackers de bien-être.

🔗 **Live :** [changeyourlife.ai](https://changeyourlife.ai)

## Stack

- **Frontend** : HTML/CSS/JS vanilla, ESM modules, **aucun build step**
- **Hosting** : Vercel (auto-deploy sur push `main`)
- **Backend** : Firebase Authentication + Firestore + Cloud Functions (TypeScript)
- **API serverless** : Vercel Functions Node dans `/api/`
- **IA Coach** : Google Gemini 2.0 Flash
- **Email** : Resend (`noreply@changeyourlife.ai`)
- **PWA** : Service Worker + Manifest, fonctionne hors-ligne, installable mobile/desktop

## Modules (16 pages)

| Catégorie | Modules |
|---|---|
| Réflexion | Journal · Coach IA · Codex de connaissance · Autoévaluation (Roue de Vie) · Bilan hebdo |
| Action | Objectifs · Habitudes · Méditation guidée · Your Life (Pyramide de Maslow) |
| Trackers | Humeur · Sommeil · Gratitude |
| Compte | Login · Verify-email · Profile · Settings (incl. panneau admin) |

## Structure du repo

```
.
├── api/                   Serverless functions Vercel (Node)
├── public/                Frontend statique servi par Vercel
│   ├── index.html         Landing
│   ├── app/               Dashboard logged-in
│   ├── {module}/          1 dossier par module
│   ├── js/firebase.js     Singleton Firebase + helper awardXp
│   ├── css/main.min.css   Design system v2
│   └── service-worker.js  PWA offline
├── functions/             Firebase Functions (TS)
├── firestore.rules        Règles Firestore
├── vercel.json            Headers + CSP + redirects
├── AUDIT.md               État courant du code (mis à jour à chaque audit)
├── CLAUDE.md              Contexte permanent pour Claude Code
└── docs/sessions/         Log incrémental session par session
```

## Développement local

Pas de build step — il suffit de servir `public/` statiquement.

```bash
# Option 1 : avec Vercel CLI (recommandé, simule les /api/)
npx vercel dev

# Option 2 : avec n'importe quel serveur statique
npx serve public/
```

## Déploiement

```bash
git push origin main
```

Vercel auto-deploy en ~40s. Vérifier le déploiement sur le dashboard Vercel ou via l'extension VSCode officielle.

Pour les Firebase Functions :
```bash
cd functions
npm run deploy
```

## Variables d'environnement

À configurer dans Vercel → Project → Settings → Environment Variables :

| Variable | Usage |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON service account (pour `/api/send-verification`, `/api/coach`) |
| `RESEND_API_KEY` | Envoi des emails OTP |
| `GEMINI_API_KEY` | Clé Gemini API (gratuit sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) |

## Sécurité

- Firebase apiKey publique (web standard, sécurité = Firestore rules + App Check)
- OTP 6 chiffres via `crypto.randomInt` (CSPRNG), expire en 15 min, rate-limit 60s
- IA Coach authentifié (idToken) + rate-limit 10 req/min/uid
- XP via Cloud Function `addXp` uniquement (impossible de tricher en console)
- CSP stricte dans `vercel.json` (frame-ancestors none, etc.)
- Firestore rules restrictives par défaut, voir [firestore.rules](firestore.rules)

Cf. [docs/SECURITY.md](docs/SECURITY.md) pour la politique complète.

## Audit & qualité

- [AUDIT.md](AUDIT.md) — état des lieux courant (tenu à jour à chaque scan)
- [docs/sessions/](docs/sessions/) — log chronologique des sessions de développement

## Workflow Claude Code

Le repo intègre [Claude Code](https://claude.com/claude-code) :
- [CLAUDE.md](CLAUDE.md) — contexte permanent (lu auto à chaque session)
- `/audit` — relance un audit profond
- `/session-end` — clôture une session avec log

## License

Code propriétaire. © Romain — `romain@changeyourlife.ai`

## Urgence

Si toi ou un proche est en détresse psychologique, appelle le **3114** (numéro national de prévention du suicide, 24/7, gratuit, anonyme).
