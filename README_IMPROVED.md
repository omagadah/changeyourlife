# 🚀 Change Your Life - Application Web Progressive

Une application web progressive (PWA) de santé mentale conçue pour vous aider à transformer votre vie en la voyant comme un jeu avec des quêtes et des succès à débloquer.

## ✨ Caractéristiques

### 🎮 Gamification
- **Arbre de compétences** : Construisez votre modèle de vie avec un éditeur interactif
- **Système XP** : Gagnez des points en accomplissant vos objectifs
- **Catégories** : Body, Heart, Être, Order
- **Priorités** : Gérez vos tâches par niveau d'urgence

### 🧘 Bien-être
- **Méditation guidée** : Séances personnalisées avec guidage vocal IA
- **Journal** : Enregistrez vos pensées et émotions
- **Objectifs** : Définissez et suivez vos objectifs avec l'aide de l'IA

### 📱 Technologie
- **PWA** : Fonctionne hors ligne avec Service Worker
- **Responsive** : Optimisé pour tous les appareils
- **Sécurisé** : Authentification Firebase avec OAuth
- **Rapide** : Cache intelligent et optimisations de performance

## 🛠️ Stack Technologique

- **Frontend** : HTML5, CSS3, JavaScript ES6+
- **Backend** : Firebase (Auth, Firestore, Functions)
- **Déploiement** : Vercel + Firebase
- **Monitoring** : Sentry (optionnel)
- **Graphe** : Cytoscape.js

## 📋 Prérequis

- Node.js 16+
- npm ou yarn
- Compte Firebase
- Compte Vercel (optionnel)

## 🚀 Installation

### 1. Cloner le repository

```bash
git clone https://github.com/yourusername/changeyourlife.git
cd changeyourlife
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

Créez un fichier `.env.local` à la racine du projet :

```bash
cp .env.example .env.local
```

Remplissez les variables avec vos clés Firebase :

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_ENV=development
```

### 4. Démarrer le serveur de développement

```bash
npm run dev
```

L'application sera disponible à `http://localhost:3000`

## 📚 Documentation

Consultez la [documentation complète](./DOCUMENTATION.md) pour :

- Architecture du projet
- Guide des modules
- API Firestore
- Règles de sécurité
- Guide de déploiement
- Dépannage

## 🔐 Sécurité

### Authentification

- ✅ Authentification par email/mot de passe
- ✅ Connexion OAuth (Google, GitHub)
- ✅ Validation robuste des données
- ✅ Protection contre les injections XSS
- ✅ Règles Firestore strictes

### Bonnes pratiques

- ✅ Variables d'environnement pour les clés sensibles
- ✅ Validation côté client ET serveur
- ✅ Logging centralisé avec Sentry
- ✅ Retry automatique avec backoff exponentiel
- ✅ Gestion des erreurs complète

## 📊 Monitoring

### Sentry

Pour activer le monitoring avec Sentry :

1. Créer un compte [Sentry](https://sentry.io)
2. Créer un projet JavaScript
3. Ajouter le DSN à `.env.local` :

```
VITE_SENTRY_DSN=your_sentry_dsn
```

### Logs

Accéder aux logs via la console du navigateur :

```javascript
import { logger } from './js/logger.js';

logger.info('Message');
logger.error('Erreur', error);
```

## 🧪 Tests

### Tests unitaires (à implémenter)

```bash
npm run test
```

### Tests E2E (à implémenter)

```bash
npm run test:e2e
```

## 📦 Déploiement

### Vercel

1. Connecter le repository GitHub à Vercel
2. Ajouter les variables d'environnement
3. Déployer automatiquement

```bash
vercel deploy
```

### Firebase

```bash
firebase deploy
```

## 🤝 Contribution

Les contributions sont les bienvenues ! Veuillez :

1. Fork le repository
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit vos changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](./LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Firebase](https://firebase.google.com) pour le backend
- [Vercel](https://vercel.com) pour l'hébergement
- [Cytoscape.js](https://cytoscape.org) pour le graphe interactif
- [Vanta.js](https://www.vantajs.com) pour les animations de fond

## 📞 Support

Pour toute question ou problème :

- 📧 Email : support@changeyourlife.ai
- 🐛 Issues : [GitHub Issues](https://github.com/yourusername/changeyourlife/issues)
- 💬 Discussions : [GitHub Discussions](https://github.com/yourusername/changeyourlife/discussions)

## 🗺️ Roadmap

- [ ] Tests unitaires et E2E
- [ ] Système de notifications push
- [ ] Partage de graphes avec d'autres utilisateurs
- [ ] Intégration avec des APIs de santé (Apple Health, Google Fit)
- [ ] Application mobile native (React Native)
- [ ] Système de coaching IA avancé
- [ ] Communauté et défis collectifs

## 📈 Statistiques

- ⭐ Stars : [GitHub](https://github.com/yourusername/changeyourlife)
- 📥 Forks : [GitHub](https://github.com/yourusername/changeyourlife)
- 👥 Contributeurs : [GitHub](https://github.com/yourusername/changeyourlife/graphs/contributors)

---

**Faites de votre vie une aventure épique ! 🎮✨**

Dernière mise à jour : 2025-01-16  
Version : 1.4.0
