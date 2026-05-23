# ChangeYourLife.ai — refonte premium (web/)

App **Next.js 15 + React 19 + TypeScript + Tailwind v4 + Motion + Lenis + Three.js**.
Stack 100% gratuite (MIT/ISC) — **aucun GSAP, aucune dépendance payante**.

Construite **en parallèle** de l'ancien site (`../public/`), qui reste live sur
Vercel pendant toute la migration. Cf. [`../docs/PLAN-V2.md`](../docs/PLAN-V2.md).

## Lancer en local

```bash
cd web
npm install        # installe les dépendances (~1-2 min la 1re fois)
npm run dev        # démarre sur http://localhost:3000
```

Ouvre http://localhost:3000 — tu verras la nouvelle landing premium avec
l'arbre 3D porté, Lya, le scroll fluide (Lenis) et les animations (Motion).

## Build de prod (vérif avant tout déploiement)

```bash
npm run build      # build optimisé — doit passer sans erreur
npm run start      # sert le build en local pour valider
```

## Ce qui est fait (Sprint 0)

- ✅ Socle Next.js + Tailwind v4 (design tokens des 8 branches Maslow)
- ✅ Landing premium : hero plein écran, arbre 3D en fond, Lya, scroll fluide
- ✅ Arbre porté depuis le moteur vanilla (`lib/tree/tree-model.ts`), rendu identique
- ✅ Firebase client prêt (`lib/firebase/client.ts`) — mêmes comptes que l'ancien site

## À venir (cf. PLAN-V2.md)

- Phase 1 : arbre porté en R3F idiomatique + onboarding conversationnel
- Phase 2 : dashboard `/app`, tree-widget, auth pages
- Phase 3+ : modules, connecteurs, Lya v2

## Arborescence

```
web/
├── app/                 # App Router (layout, page = landing, globals.css)
├── components/
│   ├── tree/            # TreeCanvas (moteur 3D)
│   ├── lya/             # Lya (intro landing)
│   └── SmoothScroll.tsx # Lenis
├── lib/
│   ├── tree/            # tree-model.ts (géométrie procédurale)
│   ├── firebase/        # client.ts
│   └── utils.ts         # cn() (clsx + tailwind-merge)
└── ...config
```

> ⚠️ Ne pas déployer tant que l'owner n'a pas validé visuellement le rendu en local.
