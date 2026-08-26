# CLAUDE.md

> Contexte permanent pour Claude Code travaillant sur changeyourlife.ai.
> Lu automatiquement à chaque session. Si tu modifies des conventions du projet, mets à jour ce fichier.
> Dernière vérification contre le code : **2026-08-26** (SW v201).

## ⚠️ Vision produit - à lire en premier

La cible du projet est décrite dans **[docs/VISION.md](docs/VISION.md)** : un
assistant de vie incarné où l'interface **est un arbre vivant**, piloté par une
IA-coach **CYL**, alimenté par des connecteurs. Le site actuel est un
**brouillon** qui doit converger vers cette vision. Toute proposition de feature
doit s'inscrire dans la métaphore de l'arbre.
**Lire `docs/VISION.md` avant toute décision produit.**

Le cap opérationnel le plus récent est **[docs/CAP-2026-08-26.md](docs/CAP-2026-08-26.md)** :
diagnostic de l'espace connecté, huit axes, ordre d'exécution.

## Projet
- **Nom** : Change Your Life · `changeyourlife.ai`
- **Type** : PWA HTML/CSS/JS vanilla, **aucun build step**
- **Stack** : Frontend statique → Vercel · Backend Firebase (Auth + Firestore + Functions) · API serverless `/api/*.js` · Email via Resend
- **Repo GitHub** : `omagadah/changeyourlife` (public, branche `main`)
- **Auto-deploy** : push sur `main` → Vercel deploy en production (≈40 sec)

## Identité
- **Owner** : anonyme (FR), tutoiement OK
- **Git author** : `Omagadah <noreply@changeyourlife.ai>` - toujours signer avec cette identité (l'owner souhaite rester anonyme)
- **Compte GitHub** : avant tout push, vérifier que c'est bien `omagadah` qui pousse (la machine porte aussi un compte `Lead2Deal` qui n'a **pas** les droits sur ce repo et renvoie un 403)
- **Email Resend** : `noreply@changeyourlife.ai`

## Structure du repo

```
.
├── api/                     # 7 serverless functions Vercel (Node)
├── functions/               # 3 Cloud Functions Firebase (TypeScript)
├── public/                  # Frontend statique servi par Vercel
│   ├── bienvenue.html       # Vitrine publique (servie à « / » sans le témoin cyl_in)
│   ├── app/                 # Espace connecté (servi à « / » AVEC le témoin cyl_in)
│   ├── {module}/            # 1 dossier par module
│   ├── js/                  # ~70 modules JS (firebase.js singleton, common.js, sidebar.js, …)
│   ├── vendor/              # Libs tierces hébergées en local - AUCUN CDN de script
│   ├── css/main.min.css     # Design system v2 unique
│   ├── manifest.json        # PWA manifest
│   ├── service-worker.js    # SW offline
│   └── sitemap.xml
├── firestore.rules          # Sécurité Firestore
├── vercel.json              # Headers + CSP + redirects + rewrites
├── ROADMAP.md               # Checklist opérationnelle (fait vs à faire)
├── HISTORIQUE.md            # Décisions structurantes, à ne pas remettre en cause à la légère
├── AUDIT.md                 # État courant (mis à jour à chaque audit)
├── web/                     # Refonte Next.js 15 GELÉE - ne pas y toucher sans décision
├── _claude-project/         # Privé, gitignoré (projet claude.ai) - ne jamais committer
└── docs/
    ├── VISION.md            # Vision narrative
    ├── CAP-2026-08-26.md    # Cap produit courant
    ├── ARCHITECTURE.md      # Architecture de l'arbre
    ├── BASE-DE-DONNEES.md   # Modèle de données
    ├── sessions/            # Log incrémental - 1 .md par session + INDEX.md
    └── …                    # Anciens audits / FAQ / SECURITY (historique)
```

## Routage : ce qui est servi à « / »

Point de confusion fréquent, à connaître avant de toucher à `vercel.json` :

- `public/index.html` **n'existe pas**, volontairement. Sur Vercel l'ordre est
  redirections → système de fichiers → réécritures : tant qu'un fichier
  répondait à « / », la réécriture n'était jamais atteinte.
- Témoin `cyl_in` posé par `firebase.js` au changement d'état d'auth →
  « / » sert `/app/index.html`. Sinon → `/bienvenue.html`.
- Ce cookie **n'est pas une authentification** : il choisit une page, rien de plus.
- `/app` et `/app/` **redirigent vers « / »** : l'adresse ne s'affiche plus nulle part.
- Conséquence : ne jamais décider quoi que ce soit à partir de l'adresse « / ».
  C'est le **contenu servi** qui tranche (`.app-container` n'existe que sur l'espace).

## Modules frontend (37 pages HTML · 7 API serverless · 3 Cloud Functions)

> API `/api/*` : `chat` (CYL/Anthropic), `coach` (CYL/Groq+Gemini),
> `cyl-brief` (brief du jour), `translate` (Groq+Gemini + cache Firestore
> partagé), `send-verification`, `verify-code`, `giveaway-draw`.
> Cloud Functions : `addXp`, `getMyRole`, `setUserRole`.

| Module | Route | Notes |
|---|---|---|
| Vitrine | `/` (visiteur) | `bienvenue.html`, arbre 3D + mode léger mobile |
| Espace | `/` (connecté) | `app/`, le tableau de bord |
| Login | `/login/` | Connexion + signup |
| Verify-email | `/verify-email/` | OTP 6 chiffres |
| Profile | `/profile/` | Profil utilisateur |
| Settings | `/settings/` | Dashboard & paramètres |
| Your Life | `/yourlife/` | Pyramide de Maslow interactive |
| Frise | `/frise/` | Trois vues sur la même vie : axe, carte mentale, piliers |
| Journal | `/journal/` | Journal quotidien |
| Méditation | `/meditation/` | Sessions guidées, lit l'humeur du jour |
| Objectifs | `/objectifs/` | OKR / suivi |
| Coach | `/coach/` | **Orphelin** : aucun lien entrant, décision en attente |
| Codex | `/codex/` | Base de connaissance + notes user |
| Autoévaluation | `/autoevaluation/` | Roue de vie 4 axes |
| Bilan | `/bilan/` | Récap hebdo |
| Humeur, Sommeil, Habitudes, Gratitude | `/humeur/`, `/sommeil/`, `/habitudes/`, `/gratitude/` | Trackers |
| Plan (Aujourd'hui) | `/plan/` | Poste de pilotage quotidien |
| Organizer | `/organizer/` | Board Eisenhower + vue Canvas / connecteurs |
| Agenda | `/agenda/` | Vue semaine + sync Google Calendar (OAuth) |
| Compétences | `/competences/` | Compétences qui montent en niveau avec l'usage |
| Branches Maslow | `/physio/` … `/transcendance/` | 8 pages de drill-down par branche |
| Admin giveaway | `/admin/giveaway/` | Back-office tirage (réservé admin) |
| Légal | `/legal/`, `/cgu/`, `/confidentialite/` | Mentions, CGU, confidentialité |

## Conventions

### Écriture
- **JAMAIS de tiret long** (le caractère « em dash », U+2014). Toujours le trait
  d'union `-`. Vaut pour le code, les commits, la doc et l'interface. C'est une
  décision de projet (cf. HISTORIQUE.md), et elle dérive régulièrement : vérifier
  avec `grep -c $'—' fichier.md` avant de committer un document.
- **L'IA du site s'appelle CYL** depuis le 2026-08-16. Les noms `Lya`, `SYL` et
  « Coach IA » sont morts : ne jamais les réintroduire.
- **CYL ne dirige jamais** : elle constate, propose, n'ordonne pas et ne note
  pas une vie. Règle **non négociable** (protection juridique de l'owner).

### Commits
Format : `<type>(<scope>): <résumé court>` puis description détaillée qui
explique **pourquoi**, pas seulement quoi. Types : `feat`, `fix`, `chore`,
`docs`. Scope : nom du module ou domaine (`nav`, `security`, `audit`).

Toujours signer les commits faits par Claude avec le modèle réellement utilisé :
```
Co-Authored-By: Claude <modèle> <noreply@anthropic.com>
```

### Code
- Vanilla JS via ESM modules - pas de framework
- **Singleton Firebase** : `import { auth, db } from '/js/firebase.js'` - JAMAIS de config inline
- **Service Worker** : bump `CACHE_NAME = 'changeyourlife-vXX'` à chaque modif de `/css` ou `/js`
- **L'enregistrement du SW vit dans `common.js`** (pages connectées) et
  `home-boot.js` (vitrine). Il a déjà été perdu une fois lors d'une refonte de
  `common.js` : vérifier qu'il y est toujours après y avoir touché.
- **Aucun script depuis un CDN.** Toute lib tierce va dans `public/vendor/`.
  La CSP n'autorise plus que `'self'` + gstatic/apis.google (Firebase, OAuth).
- **User content** : `escapeHtml()` ou `textContent`, jamais d'`innerHTML` brut sur input user
- **OTP / random sécurisé** : `crypto.randomInt`, jamais `Math.random`
- **Helpers partagés** : `escapeHtml`, `toast`, `saveWithFeedback` viennent de
  `/js/common.js`. Ne pas en recopier une variante locale.
- **Thème** : uniquement via les tokens CSS. Un module qui code une couleur en
  dur casse le thème.
- **L'ordre du DOM est l'ordre visuel** : pas de réordonnancement en CSS
  (`order:`), ça casse le tab-order et les lecteurs d'écran.
- **WebGL** : `prefers-reduced-motion` doit être lu en JS (`matchMedia`), la
  media query CSS n'atteint pas un canvas.

### Navigation
La nav est une **barre latérale verticale** (`/js/sidebar.js`, 17 entrées en
3 groupes), chargée par `common.js` sur toutes les pages où l'utilisateur est
chez lui. Le compte est à plat dans son pied : plus de menu déroulant.

Une page qui pose son propre cadre plein écran (`position:fixed`) doit porter
`data-cyl-shell` pour hériter du décalage, sinon elle passe sous la barre.

### Rôles & permissions
- Auth via Firebase Custom Claims (`role: 'admin' | 'mod' | 'user'`)
- Cloud Function `setUserRole({ uid, role })` - réservée aux admins
- Cloud Function `getMyRole()` - récupère le rôle courant
- Bootstrap : env var `ROOT_ADMIN_UID` côté Cloud Functions (à retirer une fois un admin créé via custom claim)
- Miroir Firestore `roles/{uid}` en read-only client (pour cache UI)

### Scripts npm utiles
| Commande | Effet |
|---|---|
| `npm run dev` | Vercel dev local avec /api/* simulé |
| `npm run format` | Prettier sur tout le projet |
| `npm run deploy:functions` | Deploy Cloud Functions Firebase |
| `npm run deploy:firestore` | Deploy `firestore.rules` + indexes |
| `npm run deploy:firebase` | Deploy functions + firestore (tout sauf hosting) |
| `npm run audit:security` | npm audit racine + functions |
| `npm run logs:functions` | Tail logs Cloud Functions |

### Tests
Pas de suite automatisée. Validation = redeploy Vercel + smoke test manuel par l'owner.
Avant de pousser : `node --check` sur les fichiers JS modifiés, et vérifier que
les entrées du précache du SW existent toutes sur disque (`cache.addAll()` est
atomique : une seule manquante fait échouer l'installation pour tout le monde).

## Workflow Claude Code

| Étape | Action |
|---|---|
| Début session | Je lis ce `CLAUDE.md` + dernier fichier dans `docs/sessions/` |
| Pendant | Tasks via `TodoWrite`, edits ciblés, commits autonomes si demandé |
| Fin session | Slash command `/session-end` - crée/MAJ `docs/sessions/YYYY-MM-DD.md` + INDEX |
| Audit | Slash command `/audit` - relance un scan complet et MAJ `AUDIT.md` |

## Préférences communication
- Réponses en **français**, format **court**, pas de blabla
- Pas de blocs de code longs sauf nécessaire
- Pas d'emoji (sauf si demandé)
- Avant action destructive ou push, demander confirmation
- Quand je dis « on continue » : tu reprends depuis le dernier session log

## Ressources
- **[ROADMAP.md](ROADMAP.md) - checklist opérationnelle (fait vs à faire)**
- **[HISTORIQUE.md](HISTORIQUE.md) - décisions structurantes et leur pourquoi**
- [docs/VISION.md](docs/VISION.md) - vision narrative (lue à chaque session)
- [docs/CAP-2026-08-26.md](docs/CAP-2026-08-26.md) - cap produit courant
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - architecture de l'arbre
- [docs/BASE-DE-DONNEES.md](docs/BASE-DE-DONNEES.md) - modèle de données
- [AUDIT.md](AUDIT.md) - état actuel du code (toujours à jour)
- [docs/sessions/](docs/sessions/) - log chronologique des sessions
- [README.md](README.md) - pitch projet
