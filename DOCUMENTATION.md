# 📚 Documentation - Change Your Life

## Table des matières

1. [Architecture](#architecture)
2. [Configuration](#configuration)
3. [Modules](#modules)
4. [API](#api)
5. [Sécurité](#sécurité)
6. [Déploiement](#déploiement)
7. [Dépannage](#dépannage)

---

## Architecture

### Structure du projet

```
changeyourlife/
├── public/                    # Fichiers statiques
│   ├── js/                   # Modules JavaScript
│   │   ├── config.js         # Configuration centralisée
│   │   ├── logger.js         # Système de logging
│   │   ├── validation.js     # Validation des données
│   │   ├── network.js        # Gestion réseau avec retry
│   │   ├── common.js         # Utilitaires communs
│   │   ├── userMenu.js       # Menu utilisateur
│   │   ├── inscription.js    # Authentification
│   │   └── yourlife-editor.js # Éditeur de graphe
│   ├── css/                  # Feuilles de style
│   ├── index.html            # Page d'accueil
│   ├── login/                # Page de connexion
│   ├── app/                  # Tableau de bord
│   └── manifest.json         # PWA manifest
├── functions/                # Cloud Functions
├── firestore.rules           # Règles Firestore
├── firebase.json             # Configuration Firebase
├── .env.example              # Variables d'environnement (exemple)
└── .env.local                # Variables d'environnement (local)
```

### Stack technologique

- **Frontend** : HTML5, CSS3, JavaScript ES6+
- **Backend** : Firebase (Auth, Firestore, Functions)
- **Déploiement** : Vercel + Firebase
- **PWA** : Service Worker, Manifest
- **Monitoring** : Sentry (optionnel)

---

## Configuration

### Variables d'environnement

Créez un fichier `.env.local` à la racine du projet :

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Sentry Configuration (optionnel)
VITE_SENTRY_DSN=your_sentry_dsn

# Environment
VITE_ENV=development
```

### Configuration Firebase

Le fichier `public/js/config.js` centralise toute la configuration :

```javascript
import { firebaseConfig, sentryConfig, appConfig } from './config.js';

// Accéder à la configuration
console.log(firebaseConfig.projectId);
console.log(appConfig.isDev);
```

---

## Modules

### 1. Logger (`logger.js`)

Système de logging centralisé avec support Sentry.

```javascript
import { logger } from './logger.js';

// Logs
logger.debug('Message de débogage');
logger.info('Information');
logger.warn('Avertissement');
logger.error('Erreur', error, context);
logger.critical('Erreur critique', error, context);

// Mesurer les performances
const timer = logger.time('Operation');
// ... faire quelque chose ...
timer.end(); // Affiche le temps écoulé

// Contexte utilisateur
logger.setUser(userId, email, username);
logger.setTag('feature', 'journal');
logger.setContext('custom', { key: 'value' });
```

### 2. Validation (`validation.js`)

Validation robuste des données avec messages d'erreur détaillés.

```javascript
import { 
  validateEmail, 
  validatePassword, 
  validateSignupForm,
  ValidationResult 
} from './validation.js';

// Valider un email
const emailResult = validateEmail('user@example.com');
if (!emailResult.isValid) {
  console.error(emailResult.getFirstError());
}

// Valider un mot de passe
const pwdResult = validatePassword('MyPassword123!');
if (!pwdResult.isValid) {
  pwdResult.getAllErrors().forEach(err => {
    console.error(`${err.field}: ${err.message}`);
  });
}

// Valider un formulaire d'inscription
const signupResult = validateSignupForm(email, password, passwordConfirm);
if (!signupResult.isValid) {
  showError(signupResult.getFirstError());
}
```

### 3. Network (`network.js`)

Gestion réseau avec retry automatique et gestion des erreurs.

```javascript
import { 
  fetchWithRetry, 
  fetchJSON, 
  isOnline,
  withRetryAndFallback,
  monitorConnectivity 
} from './network.js';

// Requête avec retry automatique
const response = await fetchWithRetry('/api/data', {}, 3);

// Requête JSON avec retry
const data = await fetchJSON('/api/users', {}, 3);

// Vérifier la connectivité
if (isOnline()) {
  console.log('En ligne');
}

// Opération avec retry et fallback
const result = await withRetryAndFallback(
  async () => {
    return await fetch('/api/data').then(r => r.json());
  },
  async () => {
    return localStorage.getItem('cached_data');
  }
);

// Monitorer la connectivité
const unsubscribe = monitorConnectivity((isOnline) => {
  console.log('Connectivité:', isOnline);
});
```

### 4. Common (`common.js`)

Utilitaires communs pour tous les modules.

```javascript
import { 
  updateGlobalAvatar, 
  normalizeVantaAndHeader,
  setupThemeToggle,
  applyInitialTheme 
} from './common.js';

// Mettre à jour l'avatar utilisateur
updateGlobalAvatar('J');

// Normaliser Vanta et header
normalizeVantaAndHeader();

// Gérer le thème
setupThemeToggle();
applyInitialTheme();
```

### 5. User Menu (`userMenu.js`)

Menu utilisateur moderne et léger.

```javascript
import { initUserMenu } from './userMenu.js';

// Initialiser le menu
initUserMenu();
```

---

## API

### Authentification

#### Connexion

```javascript
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const user = await signInWithEmailAndPassword(auth, email, password);
```

#### Inscription

```javascript
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const user = await createUserWithEmailAndPassword(auth, email, password);
```

#### Connexion OAuth

```javascript
import { GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const provider = new GoogleAuthProvider();
const result = await signInWithPopup(auth, provider);
```

### Firestore

#### Lire un document

```javascript
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const snap = await getDoc(doc(db, 'users', userId));
if (snap.exists()) {
  console.log(snap.data());
}
```

#### Écrire un document

```javascript
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

await setDoc(doc(db, 'users', userId), {
  email: 'user@example.com',
  createdAt: new Date()
}, { merge: true });
```

#### Requête

```javascript
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const q = query(
  collection(db, 'users'),
  where('email', '==', 'user@example.com')
);
const snapshot = await getDocs(q);
```

---

## Sécurité

### Règles Firestore

Les règles Firestore sont définies dans `firestore.rules` :

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    match /users/{userId} {
      allow read: if isSignedIn() && isOwner(userId);
      allow create: if isSignedIn() && isOwner(userId);
      allow update: if isSignedIn() && isOwner(userId);
    }
  }
}
```

### Validation des données

Toujours valider les données côté client ET côté serveur :

```javascript
// Côté client
const validation = validateEmail(email);
if (!validation.isValid) {
  showError(validation.getFirstError());
  return;
}

// Côté serveur (Cloud Functions)
if (!isValidEmail(email)) {
  throw new functions.https.HttpsError('invalid-argument', 'Invalid email');
}
```

### Protection contre les injections XSS

Utiliser la fonction `sanitizeInput` :

```javascript
import { sanitizeInput } from './validation.js';

const userInput = sanitizeInput(untrustedInput);
```

---

## Déploiement

### Déploiement sur Vercel

1. Connecter le repository GitHub à Vercel
2. Ajouter les variables d'environnement dans les paramètres Vercel
3. Déployer automatiquement à chaque push sur `main`

### Déploiement Firebase

```bash
# Déployer les Cloud Functions
firebase deploy --only functions

# Déployer les règles Firestore
firebase deploy --only firestore:rules

# Déployer tout
firebase deploy
```

### Variables d'environnement Vercel

Ajouter dans les paramètres Vercel :

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_SENTRY_DSN=...
VITE_ENV=production
```

---

## Dépannage

### Problème : "Firebase config not found"

**Solution** : Vérifier que `.env.local` existe et contient les bonnes variables.

### Problème : "Sentry not initialized"

**Solution** : C'est normal si `VITE_SENTRY_DSN` n'est pas défini. Sentry est optionnel.

### Problème : "Service Worker not registered"

**Solution** : Vérifier que le navigateur supporte les Service Workers (HTTPS requis en production).

### Problème : "Offline mode"

**Solution** : L'application utilise le cache Service Worker. Les données sont synchronisées quand la connexion revient.

### Déboguer avec la console

```javascript
// Accéder à la configuration
window.__YourLifeDebug.getGraph();

// Forcer une sauvegarde
window.__YourLifeDebug.saveNow();

// Tester la connectivité
window.__YourLifeDebug.testWriteRead();
```

---

## Support

Pour toute question ou problème, consultez :

- [Documentation Firebase](https://firebase.google.com/docs)
- [Documentation Vercel](https://vercel.com/docs)
- [Documentation Sentry](https://docs.sentry.io)

---

**Dernière mise à jour** : 2025-01-16  
**Version** : 1.4.0
