# 🚀 Reprendre le projet sur le Mac — guide simple

Ce guide te fait passer de « rien » à « je code et je déploie » en quelques minutes.
Suis les étapes dans l'ordre. Copie-colle les commandes dans le **Terminal** du Mac
(Applications → Utilitaires → Terminal).

---

## 1. À installer UNE SEULE FOIS

### a) Homebrew (le gestionnaire d'installation du Mac)
Colle ça dans le Terminal :
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
> Ça installe l'outil qui sert à installer les autres. Suis les instructions à l'écran.

### b) Git et Node.js
```bash
brew install git node
```
> **Git** = récupérer/envoyer le code. **Node.js** = faire tourner les outils du projet.

### c) Claude Code (pour bosser avec l'IA comme sur le PC)
```bash
npm install -g @anthropic-ai/claude-code
```
> Puis tu le lanceras avec la commande `claude` dans le dossier du projet.

### d) (Optionnel) Vercel & Firebase — seulement si tu déploies toi-même
```bash
npm install -g vercel firebase-tools
```

---

## 2. Récupérer le projet (le « clone »)

```bash
cd ~/Desktop
git clone https://github.com/omagadah/changeyourlife.git
cd changeyourlife
npm install
```

✅ Voilà, tu as **tout le projet** sur le Mac : le code, la doc, l'historique des
sessions, la config Claude. Exactement comme sur le PC.

---

## 3. Voir le site en local (sur ton Mac)

Le site est **statique** : pas besoin de secrets pour l'afficher.

Le plus simple :
```bash
cd ~/Desktop/changeyourlife/public
python3 -m http.server 8080
```
Puis ouvre ton navigateur sur **http://localhost:8080**

> Pour arrêter le serveur : `Ctrl + C` dans le Terminal.

---

## 4. Travailler au quotidien (la boucle magique)

1. Tu modifies des fichiers (dans VS Code, ou avec Claude Code).
2. Tu envoies tes changements sur GitHub :
```bash
git add .
git commit -m "ce que j'ai changé"
git push
```
3. **Vercel redéploie le site en prod tout seul** (~40 secondes). Rien d'autre à faire.

> 💡 Avant de commencer à bosser, récupère toujours la dernière version :
> ```bash
> git pull
> ```
> (utile car le projet peut avancer depuis le PC ou une session Claude)

---

## 5. Lancer Claude Code sur le projet

```bash
cd ~/Desktop/changeyourlife
claude
```
Il lit automatiquement `CLAUDE.md` et le dernier fichier de `docs/sessions/`,
donc il retrouve le contexte du projet. Les slash-commandes `/audit` et
`/session-end` fonctionnent pareil.

---

## 6. Les commandes utiles (mémo)

| Je veux… | Commande |
|---|---|
| Récupérer les dernières modifs | `git pull` |
| Envoyer mes modifs (déploie en prod) | `git add . && git commit -m "..." && git push` |
| Voir le site en local | `cd public && python3 -m http.server 8080` |
| Lancer l'IA Claude Code | `claude` |
| Formater le code proprement | `npm run format` |
| Déployer les règles Firebase | `firebase login` puis `npm run deploy:firestore` |

---

## 7. « Et les clés secrètes (API) ? »

Elles ne sont **PAS** dans GitHub (c'est voulu : le repo est public). Elles sont
déjà stockées **sur Vercel**, donc le site en ligne fonctionne à 100 %.

Tu n'en as besoin sur le Mac **que** si tu veux tester les fonctions `/api/*` en
local (SYL, traduction…). Dans ce cas :
```bash
vercel link      # relie le dossier à ton projet Vercel
vercel dev       # lance le site + les /api en local avec les bonnes clés
```

---

## ⚠️ Ce qui ne se transfère PAS automatiquement

- **`node_modules`** (les dépendances) → recréé par `npm install`. Normal.
- **La mémoire de Claude** de la machine PC (préférences perso mémorisées par l'IA)
  → elle reste sur le PC. Mais tout le contexte du projet (CLAUDE.md, ROADMAP.md,
  docs/sessions, AUDIT.md) est dans le repo, donc Claude s'y retrouve quand même.

---

## En cas de souci

- **« command not found »** → l'outil n'est pas installé, refais l'étape 1.
- **Le `git push` est refusé** → fais d'abord `git pull`, puis re-pousse.
- **Le site local ne s'affiche pas** → vérifie que tu es bien dans le dossier
  `public/` avant de lancer le serveur.

Bon travail 🌳
