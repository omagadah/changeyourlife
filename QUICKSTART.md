# 🚀 Guide de Démarrage Rapide - Change Your Life

Commencez en 5 minutes !

---

## ⚡ Installation Rapide

### 1. Cloner le Repository

```bash
git clone https://github.com/yourusername/changeyourlife.git
cd changeyourlife
```

### 2. Installer les Dépendances

```bash
npm install
```

### 3. Configurer les Variables d'Environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env.local

# Éditer .env.local avec vos clés Firebase
nano .env.local
```

### 4. Démarrer le Serveur

```bash
npm run dev
```

L'application sera disponible à `http://localhost:3000`

---

## 📚 Documentation Rapide

### Pour les Utilisateurs
- 📖 [README_IMPROVED.md](./README_IMPROVED.md) - Vue d'ensemble
- ❓ [FAQ.md](./FAQ.md) - Questions courantes

### Pour les Développeurs
- 📖 [DOCUMENTATION.md](./DOCUMENTATION.md) - Documentation technique
- 🔐 [SECURITY.md](./SECURITY.md) - Sécurité
- 🧪 [TESTING.md](./TESTING.md) - Tests

### Pour les DevOps
- 🚀 [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Déploiement
- 🔐 [SECURITY.md](./SECURITY.md) - Sécurité

---

## 🔑 Configuration Firebase

### 1. Créer un Projet Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Créez un nouveau projet
3. Activez Authentication (Email/Password, Google, GitHub)
4. Créez une base de données Firestore

### 2. Récupérer les Clés

1. Allez dans Paramètres du Projet
2. Copiez la configuration Firebase
3. Collez dans `.env.local`

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## 🧪 Tests Rapides

### Tests Unitaires

```bash
npm test
```

### Tests E2E

```bash
npm run test:e2e
```

### Linting

```bash
npm run lint
```

---

## 🚀 Déploiement Rapide

### Vercel

```bash
# Installer Vercel CLI
npm install -g vercel

# Déployer
vercel
```

### Firebase

```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Déployer
firebase deploy
```

---

## 🔍 Vérification Rapide

### Checklist de Démarrage

- [ ] Repository cloné
- [ ] Dépendances installées
- [ ] `.env.local` configuré
- [ ] Serveur démarré
- [ ] Application accessible à `http://localhost:3000`
- [ ] Authentification testée
- [ ] Données sauvegardées

---

## 📁 Structure du Projet

```
changeyourlife/
├── public/              # Fichiers statiques
│   ├── js/             # Modules JavaScript
│   ├── css/            # Feuilles de style
│   └── index.html      # Page d'accueil
├── functions/          # Cloud Functions
├── DOCUMENTATION.md    # Documentation technique
├── SECURITY.md         # Guide de sécurité
├── TESTING.md          # Guide de test
└── package.json        # Dépendances
```

---

## 🆘 Dépannage Rapide

### Problème : "Firebase config not found"

**Solution** : Vérifier que `.env.local` existe et contient les bonnes variables.

### Problème : "Port 3000 already in use"

**Solution** : 
```bash
# Utiliser un autre port
npm run dev -- --port 3001
```

### Problème : "Module not found"

**Solution** :
```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

---

## 📞 Besoin d'Aide ?

- 📖 [DOCUMENTATION.md](./DOCUMENTATION.md) - Documentation complète
- ❓ [FAQ.md](./FAQ.md) - Questions courantes
- 🐛 [GitHub Issues](https://github.com/yourusername/changeyourlife/issues) - Signaler un bug
- 💬 [GitHub Discussions](https://github.com/yourusername/changeyourlife/discussions) - Poser une question

---

## 🎯 Prochaines Étapes

1. **Lire la documentation** : [DOCUMENTATION.md](./DOCUMENTATION.md)
2. **Contribuer** : [CONTRIBUTING.md](./CONTRIBUTING.md)
3. **Tester** : [TESTING.md](./TESTING.md)
4. **Déployer** : [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

---

**Bon développement ! 🚀✨**

Dernière mise à jour : 2025-01-16
