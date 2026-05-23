# PLAN V2 — Refonte premium ChangeYourLife.ai (stack 2026)

> Document de planification. Avant approbation owner, ne pas commencer le code.
> Croise [VISION.md](VISION.md) (la cible) et [AUDIT.md](../AUDIT.md) (l'état actuel).
> Décision pivot demandée à la fin du document.
> Date : 2026-05-23.

---

## 0 · Objectif

Faire passer le site du brouillon « version −200 » à un produit **digne d'un site
premium 10 000 € tier Awwwards / Linear / Anthropic / Vercel**, sans renier la
vision (arbre + Lya), sans casser ce qui marche (XP, Firebase, modules), avec
une stack 2026 industrie-standard qui tient la route 5 ans.

Trois exigences owner :
1. **Design premium** (skill design, niveau des plus grands sites 2026).
2. **Framer Motion** (intégré au produit).
3. **Bibliothèque de composants pros** (database de composants premium dans laquelle piocher).

Ce document arbitre les trois en un seul système cohérent.

---

## 1 · Constat de départ (mai 2026)

Le site est plus avancé que ne le laisse penser « version −200 » :

| Ce qui existe déjà | État |
|---|---|
| Arbre 3D procédural Three.js (`arbre3d.js` 584 LOC) sur landing + dashboard | ✅ fonctionne |
| 8 branches Maslow câblées Firestore (`tree-data.js`, `tree-model.js`, `tree-widget.js`) | ✅ figé |
| XP de bout en bout : 10 modules → bonne branche → carte de récompense | ✅ fonctionne |
| Lya overlay persistant sur toutes les pages (Groq + Gemini fallback) | ✅ fonctionne |
| Onboarding conversationnel (Lya pose 1 question, plante la 1re branche) | ✅ fonctionne |
| Auth Firebase + Cloud Functions + Firestore rules + sécurité durcie | ✅ propre |
| 16 modules (login, app, journal, méditation, objectifs, etc.) | ✅ couvre la surface |
| Stack : HTML/CSS/JS vanilla, aucun build step, Vercel + Firebase | 🟡 plafond visuel |

**Ce qui plafonne la qualité visuelle** : pas de framework component-based, donc :
- pas d'accès à shadcn/Aceternity/Magic UI (tous React),
- pas de Motion (Framer Motion) — uniquement animations CSS / Three.js maison,
- pas de Tailwind (≈300 couleurs hardcodées notées dans `AUDIT.md`),
- 26 fichiers JS plats sans typage, dette structurelle qui freinera Phase 4-5.

C'est ce plafond qu'on lève maintenant.

---

## 2 · Le stack 2026 — ce que font Linear, Anthropic, Vercel, Cursor

Issu de la recherche web (sources en fin de doc). Aucun de ces sites n'est en
vanilla JS. Le standard 2026 pour un site premium est :

| Couche | Choix industrie 2026 | Pourquoi |
|---|---|---|
| Framework | **Next.js 15** (App Router, RSC) | Le défaut pour React + Vercel, code splitting auto, ISR, image optimization |
| Langage | **React 19 + TypeScript** | Typage = moins de bugs sur 16 modules. RSC = perf et SEO |
| Styling | **Tailwind CSS v4** | Standard 2026, oxide engine, design tokens propres |
| Composants base | **shadcn/ui** | Devenu *de facto* standard (gov, Vercel, Anthropic). Accessible, customisable, copy-paste — pas une dépendance qu'on suit |
| Composants wow | **Aceternity UI + Magic UI** | Les composants signature des sites SaaS 2025-2026 (3D cards, spotlight, beams, meteors, marquees animées) |
| Animation | **Motion** (ex Framer Motion, `motion/react`) | Standard React. v12 supporte oklch, scroll hardware-accelerated, layout animations |
| Scroll | **Lenis** (3 KB) + **GSAP ScrollTrigger** | Le combo « scroll cinéma » Awwwards |
| 3D | **React Three Fiber + Drei** | Wrapper React de Three.js (sans casser le code Three actuel — on porte) |
| Icônes | **Lucide React** | Standard avec shadcn |
| Forms | **React Hook Form + Zod** | Validation typée |
| Voix | **Web Speech API** puis **ElevenLabs** | Pour Lya (incarnée) |

Tout ça **coexiste avec Firebase** (Auth, Firestore, Cloud Functions) inchangé,
et **se déploie sur Vercel** comme actuellement. Le backend ne bouge pas.

### Choix tranchant : on migre à Next.js

C'est inévitable. Toutes les briques premium 2026 sont React. Rester vanilla =
plafonner la qualité. La seule alternative crédible serait Motion One (3.8 KB,
vanilla, même API que Motion) + composants adaptés à la main depuis Aceternity
— mais on perdrait 80 % du catalogue et on devrait tout réécrire à chaque
nouvelle pépite repérée. Mauvais ROI sur 5 ans.

**Décision proposée : migration progressive vers Next.js 15, page par page,
sans big bang.** L'existant continue de tourner pendant la migration.

---

## 3 · Stratégie composants — la « bande » demandée

Tu voulais une **database complète dans laquelle piocher**. Voici le combo
optimal pour ChangeYourLife.ai, classé par rôle :

### 3.1 · Fondations (shadcn/ui — gratuit, MIT)

Le squelette propre du site. À installer en premier (`npx shadcn add`).
Utilisé pour : boutons, dialogs, dropdowns, forms, tabs, cards, sheets,
tooltips, command palette, toasts, calendar, data tables.

→ Couvre 100 % des écrans « app » : settings, profile, login, dashboard.

### 3.2 · Effets premium (Aceternity UI + Magic UI — gratuit pour le core)

Pour la landing et les pages vitrine.
- **Aceternity** : `BackgroundBeams`, `Spotlight`, `3DCard`, `Meteors`, `Vortex`,
  `Wavy Background`, `Sparkles`, `Globe`, `Lamp`, `Aurora Background`,
  `Animated Tooltip`, `Text Generate Effect`, `Hero Parallax`.
- **Magic UI** : `Marquee`, `AnimatedList`, `Particles`, `Globe`, `Border Beam`,
  `Shimmer Button`, `Animated Beam`, `Number Ticker`, `Animated Gradient Text`,
  `Hero Video Dialog`, `Confetti`.

→ Ce sont les composants qu'on voit sur les sites Awwwards. Tous copy-paste
(pas de dépendance lourde), tous basés sur Motion + Tailwind.

### 3.3 · Animation custom (Motion + GSAP)

- **Motion (`motion/react`)** : composants animés (fade, slide, scale, layout
  animations, shared element transitions entre branches de l'arbre).
- **GSAP + ScrollTrigger + Lenis** : scroll narratif sur la landing (la
  croissance de l'arbre scroll-driven, parallax, pin sections).

### 3.4 · 3D (React Three Fiber + Drei + Three.js)

- **R3F** wrappe Three.js dans React. Notre `arbre3d.js` (584 LOC vanilla)
  devient un composant `<TreeCanvas>` propre.
- **Drei** : OrbitControls, Environment, Float, MeshTransmissionMaterial,
  Sparkles, Text3D — sans les réécrire.
- **EZ-Tree** (déjà repéré dans `docs/ARBRE-3D-RECHERCHE.md`) : on l'intègre
  via R3F en Phase 2, pour passer du « tronc + branches stylisées » au « chêne
  AAA avec feuilles et vent ».

### 3.5 · Spécialisés

- **Lucide React** : icônes (cohérent avec shadcn).
- **Sonner** : toasts (recommandé par shadcn, remplace les 10 toasts locaux notés dans AUDIT.md).
- **cmdk** : command palette (`⌘K` — accélère la navigation par les branches).
- **React Hook Form + Zod** : forms (login, signup, settings, objectifs).
- **next-themes** : dark/light mode propre.
- **Vaul** : drawers mobile (panneau d'une branche en bas d'écran sur mobile).
- **Recharts** ou **Tremor** : graphes KPIs (« +5 % muscles », « +5 % intelligence Khan »).

---

## 4 · L'Arbre — la décision technique

L'arbre est le cœur du produit. Trois choix possibles, un seul tient la route.

| Option | Effort | Plafond visuel | Effort futur |
|---|---|---|---|
| A · Garder Three.js vanilla actuel, wrapper en composant React | 3 j | 7/10 | Moyen |
| B · Migrer en React Three Fiber + Drei (réécrit propre, R3F idiomatique) | 7-10 j | 8/10 | Faible |
| C · Intégrer **EZ-Tree** (Dan Greenheck) via R3F, paramètres 7 branches | 10-14 j | **10/10** | Faible |

**Recommandation : C en cible, B en jalon intermédiaire.**

Plan tree :
1. **Étape 1** (1 semaine) : porter `arbre3d.js` actuel en R3F (option B). Même
   rendu, code propre, mémoization, React DevTools. On gagne le foncier.
2. **Étape 2** (2 semaines, après Phase 1 stack) : intégrer EZ-Tree comme
   moteur de génération, mapper les 8 branches Maslow sur `branch.children[0]`,
   pousser nos meshes custom (Lya, fruits, racines/frise) par-dessus.
3. **Étape 3** (continu) : shaders custom (vent, croissance scroll-driven,
   branche cassée = matériau émissif rouge, vitalité = HSL des feuilles).

L'arbre fini = une scène R3F orchestrée par Motion (transitions entre vues) et
GSAP ScrollTrigger (croissance liée au scroll sur la landing).

---

## 5 · Lya — l'incarnation à 10 000 €

État actuel : orb chat en bas à droite, conversation IA branchée. C'est
correct mais pas incarné.

Cible Phase 1+ (post-migration) :
- **Visage 3D stylisé** (R3F + GLTF) en coin d'écran, animé subtilement
  (blink, breathing, head tracking sur mouvement souris) — alternative légère :
  SVG morphing animé via Motion si la 3D s'avère trop lourde mobile.
- **Voix** : Web Speech API pour démarrer (gratuit), ElevenLabs en Phase 2
  pour une vraie voix Lya.
- **États visuels** : Observatrice (yeux mi-clos, posture calme), Guide (regarde
  l'utilisateur, indicateur lumineux), Coach d'intervention (pose plus
  attentive, lumière chaude).
- **Streaming** : réponses qui s'écrivent en direct (effet « elle écrit »),
  trivial à brancher avec Vercel AI SDK.
- **Mémoire long-terme** : Firestore `users/{uid}.lyaMemory` (résumés
  d'échanges, événements de vie marquants détectés). Lue à chaque session.
- **Tool-use** : Lya peut directement créer un objectif, planifier un jalon,
  ouvrir un module — via fonctions exposées par l'app.

---

## 6 · Mapping module-par-module

Aucun module n'est jeté. Chacun gagne un nouvel habillage premium.

| Module | Sort | Composants premium à utiliser |
|---|---|---|
| `/` landing | Refonte totale | Aceternity `Hero Parallax`, `Spotlight`, `Aurora`, `Lamp`, `Globe`. Magic UI `Marquee`, `Border Beam`, `Number Ticker`. R3F arbre en hero. Lenis + GSAP pour scroll-driven growth. |
| `/app/` dashboard | Refonte | shadcn `Card`, `Tabs`, `Sheet`. Tree-widget R3F en haut. Tremor pour les stats. Magic UI `Animated List` pour le flux d'actions récentes. |
| `/login/`, `/signup/`, `/verify-email/` | Refonte | shadcn `Card`, `Input`, `Button`. RHF + Zod. Aceternity `Background Beams` discrets. |
| `/profile/`, `/settings/` | Refonte | shadcn `Tabs`, `Form`, `Avatar`, `Switch`, `Slider`. Section connecteurs en cartes shadcn. |
| `/journal/` | Refonte | shadcn `Textarea`, `Calendar`. Magic UI `Animated List` pour les entrées passées. Motion shared element entre liste et détail. |
| `/meditation/` | Refonte | Aceternity `Vortex` ou `Wavy Background` comme fond pendant la session. Motion pour le timer respiratoire. |
| `/objectifs/` | Refonte | shadcn `Card`, `Progress`, `Calendar`. Frise jalons custom (Motion). Aceternity `Sparkles` à la complétion. |
| `/coach/` | Devient Lya plein écran | R3F visage + chat shadcn. Vercel AI SDK streaming. |
| `/codex/` | Refonte | shadcn `Command` (Cmd+K), `Accordion`. Magic UI `Animated Beam` entre concepts liés. |
| `/autoevaluation/` | Refonte roue 8 axes | Recharts radar 8 axes + Motion. |
| `/bilan/` | Refonte | shadcn `Form` étapes, Tremor charts. |
| `/humeur/`, `/sommeil/`, `/habitudes/`, `/gratitude/` | Refonte trackers | shadcn `Card`, `Calendar heatmap` custom, Magic UI `Number Ticker` pour les streaks. |
| `/yourlife/` (pyramide Maslow legacy) | **Supprimé** (déjà décidé dans ARCHITECTURE) | — |

Note : tout le mapping ci-dessus passe par la métaphore de l'arbre. Aucune
feature n'est ajoutée juste pour faire joli — chaque module reste rattaché à
sa branche Maslow, c'est la cohérence narrative qui prime.

---

## 7 · Roadmap par phases — 10 à 14 semaines

Pensée pour ne **pas casser l'existant**. Le site actuel reste live pendant
toute la migration (Vercel sert l'ancien en attendant le nouveau).

### Phase 0 · Setup (3-5 jours)
- Init Next.js 15 + TypeScript + Tailwind v4 dans `/web` (dossier parallèle au `/public` actuel).
- Installer shadcn/ui CLI, ajouter les composants de base.
- Brancher Firebase client (`firebase.js` adapté → hook `useAuth`, `useUser`).
- Brancher Vercel : routes Next coexistent avec `/public/*` ancien (via `vercel.json`).
- Design tokens (Tailwind config) : palette des 8 branches Maslow + dark mode + typo.
- Setup Motion + Lenis + GSAP licences (GSAP a un free tier qui couvre nos besoins).

### Phase 1 · Landing premium + arbre R3F (2 semaines)
- Refonte complète `/` avec Aceternity / Magic UI + Lenis + GSAP.
- Port `arbre3d.js` → R3F (étape 1 du §4).
- Hero scroll-driven : l'arbre pousse au scroll.
- Onboarding conversationnel en Next.js (Lya pose les questions, l'arbre réagit).
- Déploiement Vercel : la nouvelle landing remplace l'ancienne.

### Phase 2 · App + dashboard + tree-widget premium (2 semaines)
- Refonte `/app/` (dashboard) avec shadcn + Tremor.
- Tree-widget devient le hero du dashboard, R3F.
- Lya overlay refait propre (composant React partagé).
- Migration auth pages (`/login`, `/signup`, `/verify-email`).

### Phase 3 · Modules trackers + journal + meditation (2-3 semaines)
- Migration `/journal`, `/humeur`, `/sommeil`, `/habitudes`, `/gratitude`, `/meditation`.
- Chaque module : composant Next.js, branchement XP inchangé, animations Motion.

### Phase 4 · Modules cognitifs (2 semaines)
- Migration `/codex`, `/autoevaluation`, `/bilan`, `/objectifs`, `/profile`, `/settings`.
- Intégration EZ-Tree dans l'arbre (étape 2 du §4).

### Phase 5 · Polish + retrait ancien code (1-2 semaines)
- Connecteurs Google Calendar + Trello dans `/settings` (premier vrai connecteur).
- Lya v2 : streaming, mémoire long-terme, tool-use basique.
- Retrait progressif de `/public/*` ancien : pages migrées redirigent vers les routes Next.
- Audit SEO, perfs, accessibilité.

### Phase 6+ · Suite (cf. VISION §15)
- Racines / frise chronologique (mémoire longue).
- Scénarios de crise.
- Communauté + blockchain (Phase 5 vision).

**Estimation totale : 10 à 14 semaines en solo dev temps plein, ~20 semaines en
temps partiel.** Aucune feature jetée, aucune régression utilisateur,
incrément visible chaque semaine.

---

## 8 · Architecture cible (dossiers)

```
.
├── web/                          # ← NOUVEAU : app Next.js 15
│   ├── app/                      # App Router
│   │   ├── (marketing)/          # landing, /about, /pricing (futur)
│   │   ├── (app)/                # routes authentifiées
│   │   │   ├── app/              # dashboard
│   │   │   ├── journal/
│   │   │   ├── meditation/
│   │   │   └── ...
│   │   ├── login/
│   │   ├── signup/
│   │   ├── verify-email/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                   # shadcn primitives
│   │   ├── aceternity/           # composants Aceternity choisis
│   │   ├── magicui/              # composants Magic UI choisis
│   │   ├── tree/                 # R3F : TreeCanvas, Branch, Leaf, Root, Fruit
│   │   ├── lya/                  # Lya face, chat, voice, overlay
│   │   └── modules/              # composants spécifiques aux modules
│   ├── lib/
│   │   ├── firebase/             # singleton + hooks (useAuth, useUser, useTree)
│   │   ├── tree/                 # tree-data, tree-model portés en TS
│   │   ├── ai/                   # Vercel AI SDK + providers Groq/Gemini/Anthropic
│   │   └── connectors/           # Google Calendar, Trello (Phase 5)
│   ├── styles/                   # globals.css (Tailwind), tokens
│   └── public/                   # assets
├── public/                       # ANCIEN site, conservé pendant migration
├── api/                          # serverless functions Vercel (inchangé)
├── functions/                    # Cloud Functions Firebase (inchangé)
└── docs/
```

`vercel.json` arbitre les routes : `/web/*` sert Next.js, les routes anciennes
non encore migrées renvoient vers `/public/*`. Migration sans interruption.

---

## 9 · Risques et garde-fous

| Risque | Mitigation |
|---|---|
| Migration big bang qui casse le site | **Migration progressive page par page**, ancien et nouveau cohabitent sur Vercel |
| Régression sur les modules qui marchent | Garder les routes anciennes live jusqu'au cutover de chaque page |
| 3D R3F trop lourde mobile | Fallback SVG procédural (déjà existant) si `prefers-reduced-motion` ou device faible |
| GSAP licence pro | Free tier suffit pour tous nos usages (sauf ScrollSmoother pro — on utilise Lenis à la place) |
| ElevenLabs coût voix Lya | Phase 2, Web Speech API gratuit en attendant |
| Aceternity blocks payants ($199 lifetime) | Non bloquant : 70 % du catalogue est gratuit, on n'achète que si ROI clair |
| Dérive scope (« encore une feature ») | Garde-fou VISION : si ce n'est pas une partie de l'arbre, ça n'entre pas |

---

## 10 · Décisions à confirmer (owner)

Avant que je commence à coder, j'ai besoin de **valider 4 points** :

1. **Migration Next.js validée ?** (cf. §2)
   → Si oui : on init `/web/` cette semaine. Si non : on bascule sur Motion One vanilla + composants Aceternity portés à la main (plafond visuel plus bas).

2. **GSAP free tier suffisant ?** (cf. §3.3)
   → Probablement oui. À vérifier si on a besoin de ScrollSmoother pro (alors achat licence ~99$/an).

3. **Aceternity Pro ($199 lifetime) — achat ?** (cf. §3.2)
   → Recommandation : NON pour démarrer. 70 % du catalogue est gratuit. On y revient si besoin clair pour une feature qu'on ne sait pas reproduire.

4. **Cible de l'arbre — EZ-Tree dès la Phase 2 ?** (cf. §4)
   → Recommandation : OUI. C'est la différence entre « joli arbre stylisé » et « arbre AAA Awwwards ». Effort 10-14 jours en plus, mais c'est l'identité du produit.

---

## 11 · Premier livrable concret (si Go)

Si tu valides ce plan, le premier sprint produit :

**Sprint 0 (cette semaine) — preuve par l'exemple**
- Init `/web/` Next.js 15 + TS + Tailwind v4 + shadcn + Motion + Lenis + R3F.
- Refonte **uniquement** la landing `/` : nouveau hero, nouvel arbre R3F (port direct de l'ancien), scroll-driven growth, Lya overlay React.
- Déploiement Vercel sur un sous-domaine de test (`preview.changeyourlife.ai`) pour valider visuellement.

Tu vois le rendu, tu valides ou pas. Si rendu validé → on enchaîne les phases.
Si rendu pas convaincant → on ajuste avant d'étendre. Aucune semaine de
travail jetée.

---

## 12 · Sources (recherche 2026)

- Aceternity UI — https://ui.aceternity.com/ — composants Tailwind + Motion premium
- Magic UI — https://magicui.design/ — composants animés modernes
- shadcn/ui — https://ui.shadcn.com/ — base de facto en 2026
- Motion — https://motion.dev/ — ex Framer Motion, `motion/react`
- Motion One — https://motion.dev/ — variante vanilla 3.8 KB
- Lenis — https://lenis.dev/ — smooth scroll Darkroom Engineering
- GSAP — https://gsap.com/ — ScrollTrigger, le standard scroll-driven
- React Three Fiber — https://r3f.docs.pmnd.rs/ — Three.js + React
- EZ-Tree — https://github.com/dgreenheck/ez-tree — déjà repéré dans `docs/ARBRE-3D-RECHERCHE.md`
- Vercel AI SDK — https://sdk.vercel.ai/ — streaming + tool-use
