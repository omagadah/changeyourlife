# PLAN-PRODUCTION.md — Audit complet 2026-07-07

> Feuille de route exécutable pour Claude Code (VSCode). Issue d'un audit total
> (sécurité + code/architecture + UX/UI) du 2026-07-07.
> Méthode : traiter dans l'ordre P0 → P1 → P2. Une tâche = un commit.
> Rappels projet : vanilla JS sans build · bump `CACHE_NAME` du SW à chaque modif js/css ·
> commits signés `Omagadah <noreply@changeyourlife.ai>` + Co-Authored-By Claude.

## ✅ Session Opus 4.8 (2026-07-07 soir) — réalisé

Tout committé sur `main` (6 commits), **rien poussé** (à toi de valider le push → deploy Vercel).

**P0 — bloquants : TOUS traités.**
- **P0-1 CSP accueil** : 3 scripts inline → `home-aura.js` / `home-auth-modal.js` / `home-failsafe.js`. Le failsafe `tree-ready` remarche (plus de risque d'accueil noir).
- **P0-2 Fiabilité** : socle `common.js` (`saveWithFeedback` + `toast` XSS-safe + `escapeHtml` + bannière offline). Écritures silencieuses corrigées : gratitude, organizer, plan, skills, **habitudes** (le pire : faux succès), objectifs, yourlife, coach.
- **P0-3 Données** : avatar redimensionné 256px avant stockage (LE vrai risque 1 Mo). `meditation.history` déjà borné (20).
- **P0-4 Légal** : `/legal/ /cgu/ /confidentialite/` (tiers listés = pilier "données non vendues") + footer accueil + consentement SYL 1re ouverture + case signup (accueil + /login/).
- **P0-5 Deploy** : `DEPLOY.md` créé. À lancer par toi : `firebase deploy --only firestore`.

**P2 — anti-IA (démarré) :** ~75 emojis décoratifs retirés (titres/toasts/boutons) sur 32 fichiers ; sélecteurs d'humeur/pickers/**maps de données** préservés. Titre/OG accueil réécrit ("pour de vrai"). Tutoiement verify-email + settings.

**P1 :** token GCal → sessionStorage. Doc à jour (CLAUDE.md, DEPLOY.md).

## ⏭️ Reste à faire — pour Claude dans VSCode (ordre conseillé)

**1. DÉPLOYER les règles Firestore** (avant tout) : `firebase deploy --only firestore` — cf. `DEPLOY.md`. Pas faisable ici (Firebase non authentifié sur ce Mac).

**2. Fiabilité — écritures encore silencieuses** (même recette `saveWithFeedback` du socle) :
- `settings.js:498/499` : suppression compte (`users/{uid}` + `roles/{uid}`) dans catch vides → signaler l'échec (**sensible** : la promesse "données supprimées" doit être fiable).
- `profile.js:241/248/254/282/377` (badges/titres/displayName), `journal.js:569` (delete), `autoevaluation.js:304`, `codex.js:248` : échec avalé.
- `settings.js:460-472` (prefs), `app.js:53`, `branche.js:66` : mineurs/heartbeats.

**3. Modèle de données (finir P0-3)** : migrer `organizer` (gros), `goals`, `habits` du mono-doc `users/{uid}` vers des sous-collections + bornes rules. Migration lazy au login. (avatar + meditation.history déjà OK.)

**4. UX anti-IA — le gros morceau restant (P2), À FAIRE AVEC REVUE VISUELLE** :
- **Couleurs** : 769 hex inline, dont Tailwind par défaut (#3b82f6 ×43, #a78bfa ×31, #6366f1 ×17…). Porter la palette organique de l'accueil en variables CSS puis remplacer. Page par page (risque de casser le design). Points chauds : app (123), journal (75), organizer (59), objectifs (44).
- **Icônes** : remplacer les emojis de DONNÉES (domaines/branches/badges) et labels restants par un set SVG trait fin unique (Lucide/Phosphor) + mapping.
- **Fontes** : aucune fonte chargée. Paire auto-hébergée dans `public/fonts/` (pas Google Fonts, RGPD). Nécessite les .woff2.
- **9 pages** sans `main.min.css` (pas 4) : autoevaluation, codex, login, verify-email + index, signup, 404, tree-preview, tree-lab.

**5. P1 restants** : App Check (reCAPTCHA v3), retirer `ROOT_ADMIN_UID`, unifier Lya/SYL (3 stacks IA), purger ~3,5 Mo morts (retirer du précache SW AVANT suppression : `tree-widget.js`/`tree-lab.js` y sont), trancher `web/` (2,7 Mo Next.js), factoriser 17 toasts/10 escapeHtml locaux → `common.js` (socle prêt), CSP à durcir (SRI), `ipwho.is` à déclarer/remplacer.

---

## État des lieux (résumé)

- Local = `origin/main` = prod Vercel (dernier commit 2026-06-08). GitHub OK.
- 32 pages HTML (doc dit 16), 52 JS dans `public/js/` (doc dit 26), 5 API (doc dit 3).
- Sécurité API sérieuse dans l'ensemble (auth idToken, rate-limits fail-closed, OTP crypto,
  rules deny-all, zéro secret dans le code et l'historique git).
- MAIS : 1 faille critique corrigée ce jour, des écritures Firestore silencieusement perdues,
  un modèle de données mono-document qui va plafonner, une CSP qui casse le failsafe de
  l'accueil, zéro page légale, et une UX qui « signe IA » (~700 emojis, palette Tailwind).

## ✅ Corrigé ce jour (session Cowork 2026-07-07) — À COMMITTER PUIS DÉPLOYER

- [x] CRITIQUE `api/translate.js` : endpoint public sans auth ni rate-limit (quota Groq/Gemini
      vidable par n'importe qui). Ajouté : rate-limit 4 req/min/IP + plafond global 400/jour
      (Firestore `translateRate`, fail-closed) + contrôle d'origine.
- [x] `api/chat.js`, `api/coach.js`, `api/translate.js` : suppression des fuites `details` /
      `status` provider dans les réponses d'erreur (loggé serveur uniquement).
- [x] `vercel.json` : `X-XSS-Protection` obsolète → `0`.
- [x] `firestore.rules` : blocs explicites `chatRate` + `translateRate` (deny).
- [x] `LICENSE` : licence « source visible, tous droits réservés » (transparence anti-revente
      de données SANS droit de copie).
- [ ] → **Commit + push de ces changements** (demander confirmation à l'owner avant push).
- [ ] → **`firebase deploy --only firestore`** (les rules du repo n'ont PAS été déployées
      depuis mai : bornes bilans/codexNotes, noXpTampering, chatRate/translateRate).
      Vérifier aussi `--only functions`.

---

## P0 — Bloquant production

### P0-1 · CSP casse 3 scripts inline de l'accueil (connu depuis le 08/06)
`public/index.html:736,777,821` bloqués par `script-src` sans hash/nonce (`vercel.json:38`).
Conséquence grave : le failsafe `tree-ready` (5 s) est mort → si `arbre3d.js` ne charge pas,
le voile « l'arbre s'éveille » ne se lève JAMAIS (accueil noir définitif). Le contrôleur du
modal d'auth est mort aussi (dégradé vers /login/, pas cassé).
**Fix** : sortir les 3 blocs en fichiers externes `public/js/…` (+ bump SW), OU ajouter les
hash CSP dans `vercel.json`. Tester : accueil avec JS module désactivé → le voile se lève.

### P0-2 · Écritures Firestore silencieusement perdues
L'utilisateur croit avoir sauvegardé, rien n'est écrit, aucun signal :
- `public/js/gratitude.js:203` : `await setDoc` hors try/catch.
- `public/js/organizer.js:74` : `.catch(() => {})` — le board entier peut ne jamais persister.
- `public/js/plan.js:101`, `public/js/skills.js:38,48,68` : catch vides.
- `navigator.onLine` : 0 occurrence dans tout le code.
**Fix** : helper commun `saveWithFeedback(promise)` dans `common.js` (toast erreur + retry),
l'appliquer à TOUTES les écritures Firestore de tous les modules + bannière offline globale.

### P0-3 · Modèle de données mono-document = plafond à 1 Mo
Tout vit dans `users/{uid}` : `goals`, `habits`, `plan`, `skills`, `organizer` (board+canvas),
`meditation.history` (tableau NON borné, `meditation.js:366-379`), `tree`, avatar en data-URL.
Un utilisateur actif atteint 1 Mo → TOUTES les sauvegardes échouent d'un coup (et en silence,
cf. P0-2). `firestore.rules` ne borne aucun de ces nouveaux champs.
**Fix** : migrer `organizer`, `meditation.history`, `goals`, `habits` en sous-collections
(`users/{uid}/organizer/…` etc.) avec script de migration lazy au login + bornes dans les
rules. Sortir l'avatar data-URL du doc (ou le borner fortement).

### P0-4 · Légal : rien n'existe
Produit de bien-être mental avec IA, données santé (sommeil, humeur, détresse), tiers US
(Anthropic, Groq, Gemini, ipwho.is, Tidio ?). Aucune CGU, mentions légales, politique de
confidentialité, ni consentement 1re ouverture SYL. Bloquant pour ouvrir au public en France.
**Fix** : pages `/legal/` (mentions), `/cgu/`, `/confidentialite/` (lister TOUS les tiers et
ce qui leur est envoyé — c'est LE pilier de la promesse « données non vendues, vérifiable ») ;
liens footer ; consentement stocké à la 1re ouverture de SYL (« SYL ne remplace pas un
professionnel ») ; case à cocher au signup.

### P0-5 · Déploiement Firebase en retard (cf. section « corrigé ce jour »)
Les rules et functions du repo ne sont pas celles qui tournent. À faire AVANT tout le reste.

---

## P1 — Important (avant d'inviter de vrais utilisateurs)

### Sécurité / robustesse
- [ ] **Token OAuth Google Calendar en localStorage** (`agenda.js:13`, `agenda-page.js:16`,
      scopes écriture) : volable par XSS. → mémoire/sessionStorage + scopes réduits en
      lecture seule si l'écriture n'est pas indispensable.
- [ ] **CSP à durcir** (`vercel.json:38`) : retirer les CDN non indispensables de `script-src`
      (`unpkg.com` ? `code.tidio.co` si Tidio abandonné), self-hoster ce qui peut l'être dans
      `public/vendor/` (déjà utilisé pour three), ajouter SRI sur ce qui reste.
- [ ] **Firebase App Check** (aucune trace actuellement) : activer reCAPTCHA v3 / attestation
      → bloque l'abus scripté des API même avec un compte valide.
- [ ] **`ROOT_ADMIN_UID`** (`functions/src/index.ts:124-135`) : créer l'admin réel via custom
      claim puis retirer l'env var (prévu depuis mai).
- [ ] **XP côté client** (`firebase.js:44-63` + rules qui ne bornent pas les valeurs de
      `tree`/`levels`) : acceptable tant qu'il n'y a pas de social/leaderboard. À migrer vers
      la Cloud Function `addXp` au passage en plan Blaze. Documenter la dette.
- [ ] **`ipwho.is`** (`arbre3d.js:261`) : géoloc IP envoyée à un tiers sans consentement →
      à déclarer dans la politique de confidentialité ou remplacer par un choix manuel.

### Architecture / dette
- [ ] **Unifier Lya/SYL — LE cœur du produit existe en 3 exemplaires** :
      `lya-overlay.js` (partout, backend `/api/coach` Groq/Gemini) vs `syl-chat.js` (/app,
      backend `/api/chat` Anthropic) vs page `/coach/` (Gemini). Un seul nom (SYL, déjà le
      seul visible), un seul widget, un seul backend (`/api/chat`), un seul prompt système.
      Rediriger `/coach/` ou la fusionner. Renommer les classes/fichiers `lya-*` ensuite.
- [ ] **Purger les morts (~3,5 Mo de public/, 30 %)** — ordre impératif : retirer d'abord du
      précache SW (`service-worker.js:54` liste `tree-widget.js` — `addAll` est atomique, une
      404 casse l'install), bump `CACHE_NAME`, puis supprimer :
      `js/arbre.svg.legacy.js`, `js/landing.js`, `js/tree-widget.js`, `logo.svg`,
      `og-image.svg`, `models/tree-hd.glb` (1,5 Mo), `models/tree.glb`,
      `models/tree-preview.html`, `vendor/three/jsm/loaders/GLTFLoader.js`,
      `textures/stars-milky-way.jpg`, `textures/téléchargement.jpg`.
      Retirer `/tree-lab/` du précache (page de dev servie en prod).
- [ ] **Trancher le sort de `web/`** (2,7 Mo de prototype Next.js tracké dans git, jamais
      documenté, contredit « vanilla sans build ») : le sortir du repo ou le documenter.
- [ ] **Factoriser dans `common.js`** : `escapeHtml` (10 copies) et toast (17 copies — c'est
      aussi une surface XSS : chaque page ré-implémente l'échappement à la main).
- [ ] **Perf accueil mobile** : ez-tree vendored = 3,9 Mo NON minifié → minifier (~1 Mo),
      `<link rel="modulepreload">` sur three/ez-tree, alléger le précache SW (60 URLs à
      l'install, excessif).
- [ ] **MAJ doc** : CLAUDE.md (16→32 pages, 3→5 API, modules agenda/organizer/plan/
      competences/branches), AUDIT.md, ROADMAP.md — la carte actuelle est fausse pour tout
      contributeur (humain ou IA).

### Anti-copie (repo public)
- [x] LICENSE ajoutée (source visible, tous droits réservés).
- [ ] Décision owner : garder le repo public intégral (transparence maximale, tout copiable
      de facto) OU repo privé + miroir public minimal (`firestore.rules`, politique données,
      api/ anonymisée) qui suffit à prouver « on ne vend pas les données ». Noter : le JS
      restera de toute façon lisible en prod dans le navigateur. Les prompts système de SYL
      sont actuellement publics dans `api/chat.js:31` — les déplacer en variable d'env si
      considérés stratégiques.

---

## P2 — Refonte « ne pas sentir l'IA » (chantier UX/UI complet)

> Référence qualité : templates v0.app. Direction : l'identité ORGANIQUE de la landing
> (fond forêt nocturne `#0a0f0a`, vert feuille `#84c25e`, or `#e7b15c`, blanc chaud
> `#f4efe1`) est la meilleure du site — c'est ELLE qu'on généralise. Le problème n'est pas
> la landing, ce sont les pages internes (design system navy v2 + 769 hex hardcodés).

### 1 · Palette unique
- [ ] Porter la palette organique de `index.html` dans `css/main.min.css` en variables CSS.
- [ ] Purger les **769 couleurs hex hardcodées** des `<style>` embarqués (app: 123,
      journal: 75, objectifs: 44, login: 31, meditation: 29, coach: 28…). On y trouve la
      palette Tailwind par défaut (`#3b82f6 #a78bfa #6366f1 #a855f7 #ec4899…`) = signature
      « généré par IA » immédiate. Interdire tout hex hors variables.
- [ ] Supprimer les dégradés multicolores des cartes (`app/index.html:356-420` : chaque carte
      a son dégradé pastel + glow — pattern v0-naïf par excellence). Surfaces unies
      `--bg-surface`, bordure 1px, accent uniquement sur liseré/icône.
- [ ] 4 pages n'importent même pas `main.min.css` : `autoevaluation`, `codex`, `login`,
      `verify-email` → les rebrancher sur le design system.

### 2 · Zéro emoji décoratif (~700 emojis au total)
- [ ] Supprimer l'emoji de TOUS les h1/h2/CTA/toasts — le tic IA n°1. Liste des h1 :
      `meditation:202` (🧘) · `sommeil:143` (🌙) · `objectifs:255` (🎯) · `plan:127` (🌅) ·
      `humeur:206` (😌) · `organizer:169` (🗂️) · `codex:140` (📚) · `habitudes:148` (✅) ·
      `agenda:83` (📅) · `gratitude:179` (🌟) · `bilan:187` (📊) · `competences:98` (🧗) ·
      `app:338` (👋) + boutons (`journal:283,356`, `profile:565`…) + toasts
      (`verify-email.js:140,187` « 🎉 », « 📧 ») + carte XP (`xp-reward.js:8-15`) +
      cartes dashboard (`app/index.html:356-410`) + entêtes profile (~30).
- [ ] Remplacer par un set d'icônes SVG unique, trait fin 1.5px, monochrome `currentColor`
      (style Lucide/Phosphor — cohérent avec la référence v0/Linear).
- [ ] GARDER les emojis légitimes : picker d'icône d'habitude (contenu utilisateur,
      `habitudes:172-187`), sélecteurs d'humeur (`meditation:214-219`, `/humeur/`).
- [ ] Gros fichiers à traiter : `competences.js` (42), `habitudes/index.html` (41),
      `app/index.html` (36), `branche.js` (33), `profile.js` (33), `objectifs.js` (32).

### 3 · Typographie
- [ ] Aucune fonte n'est chargée aujourd'hui (system stack partout, « Inter » cité mais
      jamais importé). Ajouter une paire distinctive AUTO-HÉBERGÉE (`public/fonts/`, pas de
      Google Fonts — cohérent RGPD) : une serif chaleureuse pour les titres + une sans
      neutre pour l'UI. C'est le changement qui casse le plus vite le look template.

### 4 · Ton & copywriting
- [ ] `index.html:6` <title> « Construis la meilleure version de toi-même » = cliché dev
      perso n°1, contredit le bon hero (« Chaque action te fait grandir. Pour de vrai. »).
      Réécrire title/OG dans la voix du hero.
- [ ] Réécrire les sous-titres « impératif + bénéfice vague » (meditation : « Trouve ta
      sérénité, respire, progresse », objectifs : « Transforme tes intentions… », etc.) au
      format concret « Pour de vrai ».
- [ ] Tutoiement PARTOUT : corriger `settings/index.html:484,536` et
      `verify-email.js:140,147` (vouvoient).
- [ ] Une seule langue par écran : renommer « ORGANIZER » (`organizer:169`), « Dashboard »
      (`settings:462`), « Your Life ».
- [ ] Donner à SYL une voix cohérente sur toutes ses lignes (`coach.js:375` « Salut ! Je
      suis ton coach IA… » = présentation générique de chatbot ; la ligne de meditation
      « Avant de méditer - comment te sens-tu, là, maintenant ? » est le bon registre).

### 5 · Structure
- [ ] Décliner l'ADN visuel de la landing dans `/app/` (le passage landing → app casse
      l'univers : organique → navy générique).
- [ ] Factoriser les 3 cartes-CTA au markup copié-collé (`app/index.html:356,366,376`).
- [ ] Activer la migration `/yourlife/` → arbre (prête depuis mai, `ROADMAP.md:126`) et
      supprimer la pyramide statique (doublon avec les 8 pages de branches).

### À PRÉSERVER (déjà humain, différenciant)
L'arbre 3D landing + timeline de croissance · la plaque de Pioneer cliquable · le satellite
vie privée (« Tes données restent sur ton appareil. Rien n'est revendu. ») · le hero copy ·
le concept XP-branches Maslow · l'accueil SYL de /meditation/.

---

## P3 — Qualité continue

- [ ] Smoke test Playwright minimal (login → save gratitude → XP visible) avant chaque push
      — zéro test aujourd'hui, pas de staging.
- [ ] Accessibilité : quasi aucun `aria-*` sur /app/ (3 occurrences) ; audit clavier des
      modals/panneaux 3D.
- [ ] Versioning : choisir entre busting manuel (`inscription.js?v=18`) et SW network-first.
- [ ] i18n : `SRC_VERSION` manuel (`i18n.js:390`) fragile.
- [ ] Nettoyer `docs/` (~14 fichiers historiques, signalé depuis mai).
- [ ] `sitemap.xml` : retirer les pages loggées, ajouter les pages légales.

## Vision (rappel pour les arbitrages)

`/app/` reste un dashboard classique à cartes + l'arbre EN PLUS. La vision (docs/VISION.md)
dit : l'arbre EST l'interface, pas de menu traditionnel. Chaque chantier UI ci-dessus doit
rapprocher de ça, pas re-consolider le dashboard. Prochaine grande marche produit après
P0/P1 : navigation par l'arbre par défaut sur /app/, dashboard en repli.
