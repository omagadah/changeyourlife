# 🔐 Guide de Sécurité - Change Your Life

Guide complet pour sécuriser l'application et protéger les données des utilisateurs.

## 📋 Table des matières

1. [Authentification](#authentification)
2. [Autorisation](#autorisation)
3. [Chiffrement](#chiffrement)
4. [Validation](#validation)
5. [Protection OWASP](#protection-owasp)
6. [Audit de Sécurité](#audit-de-sécurité)

---

## Authentification

### 1. Gestion des Mots de Passe

#### Exigences

```javascript
// ✅ BON - Exigences strictes
const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigits: true,
  requireSpecialChars: true,
  forbidCommonPasswords: true
};

// ❌ MAUVAIS - Exigences faibles
const weakPassword = 'password123'; // Trop simple
```

#### Hachage

```javascript
// Firebase gère automatiquement le hachage avec bcrypt
// Pas besoin de hacher manuellement

// ✅ BON - Laisser Firebase gérer
await createUserWithEmailAndPassword(auth, email, password);

// ❌ MAUVAIS - Hacher manuellement
const hashedPassword = sha256(password); // Dangereux !
```

### 2. Authentification Multi-Facteurs (MFA)

```javascript
// À implémenter : MFA avec Firebase
import { multiFactor, PhoneAuthProvider } from 'firebase/auth';

async function enableMFA(user) {
  const session = await multiFactor(user).getSession();
  const phoneAuthProvider = new PhoneAuthProvider(auth);
  
  const verificationId = await phoneAuthProvider.verifyPhoneNumber(
    '+33612345678',
    session
  );
  
  // Envoyer le code à l'utilisateur
  return verificationId;
}
```

### 3. Sessions

```javascript
// ✅ BON - Timeout de session
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

let lastActivity = Date.now();

window.addEventListener('mousemove', () => {
  lastActivity = Date.now();
});

setInterval(() => {
  if (Date.now() - lastActivity > SESSION_TIMEOUT) {
    auth.signOut();
    window.location.href = '/login';
  }
}, 60000);
```

---

## Autorisation

### 1. Contrôle d'Accès Basé sur les Rôles (RBAC)

```javascript
// Définir les rôles
const roles = {
  USER: 'user',
  ADMIN: 'admin',
  MODERATOR: 'moderator'
};

// Vérifier les permissions
function hasPermission(user, permission) {
  const userRole = user.role || roles.USER;
  const permissions = {
    [roles.USER]: ['read', 'write_own'],
    [roles.ADMIN]: ['read', 'write', 'delete', 'manage_users'],
    [roles.MODERATOR]: ['read', 'write', 'delete']
  };
  
  return permissions[userRole]?.includes(permission) || false;
}

// Utiliser
if (hasPermission(user, 'delete')) {
  // Permettre la suppression
}
```

### 2. Règles Firestore

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Fonctions d'aide
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Utilisateurs
    match /users/{userId} {
      allow read: if isSignedIn() && isOwner(userId);
      allow create: if isSignedIn() && isOwner(userId);
      allow update: if isSignedIn() && isOwner(userId);
      allow delete: if isAdmin();
      
      // Journal
      match /journal/{entryId} {
        allow read: if isSignedIn() && isOwner(userId);
        allow create: if isSignedIn() && isOwner(userId) && isValidJournalEntry();
        allow update: if isSignedIn() && isOwner(userId) && isValidJournalEntry();
        allow delete: if isSignedIn() && isOwner(userId);
      }
    }
    
    // Validation
    function isValidJournalEntry() {
      let data = request.resource.data;
      return data.content is string 
        && data.content.size() <= 50000
        && data.emotion in ['joy', 'calm', 'grateful', 'worried', 'sad', 'angry', 'neutral']
        && data.timestamp is timestamp
        && data.userId == request.auth.uid;
    }
  }
}
```

---

## Chiffrement

### 1. En Transit (HTTPS)

```javascript
// ✅ BON - Toujours utiliser HTTPS
const apiUrl = 'https://api.changeyourlife.ai/data';

// ❌ MAUVAIS - HTTP non sécurisé
const apiUrl = 'http://api.changeyourlife.ai/data';
```

### 2. Au Repos

```javascript
// Firebase chiffre automatiquement les données au repos
// Pas besoin de chiffrement manuel

// Pour les données sensibles supplémentaires :
import { encrypt, decrypt } from 'crypto-js';

function encryptData(data, key) {
  return encrypt(JSON.stringify(data), key).toString();
}

function decryptData(encrypted, key) {
  const decrypted = decrypt(encrypted, key).toString();
  return JSON.parse(decrypted);
}
```

### 3. Certificats SSL/TLS

```bash
# Vérifier le certificat SSL
openssl s_client -connect changeyourlife.ai:443

# Générer un certificat auto-signé (développement)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365
```

---

## Validation

### 1. Validation Côté Client

```javascript
import { validateEmail, validatePassword } from './validation.js';

// Valider avant d'envoyer
const emailValidation = validateEmail(email);
if (!emailValidation.isValid) {
  showError(emailValidation.getFirstError());
  return;
}
```

### 2. Validation Côté Serveur

```javascript
// Cloud Function
import * as functions from 'firebase-functions';
import { validateEmail, validatePassword } from './validation.js';

exports.createUser = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
  }
  
  // Valider les données
  const emailValidation = validateEmail(data.email);
  if (!emailValidation.isValid) {
    throw new functions.https.HttpsError('invalid-argument', emailValidation.getFirstError());
  }
  
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    throw new functions.https.HttpsError('invalid-argument', passwordValidation.getFirstError());
  }
  
  // Créer l'utilisateur
  // ...
});
```

### 3. Sanitization

```javascript
import { sanitizeInput } from './validation.js';

// Nettoyer les entrées utilisateur
const userInput = sanitizeInput(untrustedInput);

// Exemple
const comment = sanitizeInput('<script>alert("XSS")</script>');
// Résultat : &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;
```

---

## Protection OWASP

### 1. Injection (A03:2021)

```javascript
// ❌ MAUVAIS - Injection SQL
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ BON - Utiliser des requêtes paramétrées
const query = db.collection('users').where('email', '==', email);

// ❌ MAUVAIS - Injection XSS
document.innerHTML = userInput;

// ✅ BON - Utiliser textContent
document.textContent = userInput;
```

### 2. Authentification Cassée (A07:2021)

```javascript
// ✅ BON - Vérifier l'authentification
if (!user) {
  window.location.href = '/login';
  return;
}

// ✅ BON - Utiliser des tokens sécurisés
const token = await user.getIdToken();

// ❌ MAUVAIS - Stocker les mots de passe
localStorage.setItem('password', password);
```

### 3. Exposition de Données Sensibles (A02:2021)

```javascript
// ❌ MAUVAIS - Exposer les données sensibles
console.log('User:', { email, password, ssn });

// ✅ BON - Masquer les données sensibles
console.log('User:', { email, id: user.uid });

// ❌ MAUVAIS - Envoyer les données sensibles en clair
fetch('/api/user', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});

// ✅ BON - Utiliser HTTPS et chiffrer
fetch('https://api.changeyourlife.ai/user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email })
});
```

### 4. Contrôle d'Accès Cassé (A01:2021)

```javascript
// ❌ MAUVAIS - Pas de vérification d'accès
app.get('/api/users/:id', (req, res) => {
  const user = db.collection('users').doc(req.params.id).get();
  res.json(user);
});

// ✅ BON - Vérifier l'accès
app.get('/api/users/:id', (req, res) => {
  if (req.user.uid !== req.params.id && !req.user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const user = db.collection('users').doc(req.params.id).get();
  res.json(user);
});
```

### 5. Mauvaise Configuration de Sécurité (A05:2021)

```javascript
// ✅ BON - Configurer les headers de sécurité
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

---

## Audit de Sécurité

### 1. Checklist de Sécurité

- [ ] HTTPS activé
- [ ] Certificat SSL valide
- [ ] Mots de passe forts requis
- [ ] MFA disponible
- [ ] Validation côté client ET serveur
- [ ] Sanitization des entrées
- [ ] Règles Firestore strictes
- [ ] Pas de données sensibles en logs
- [ ] Chiffrement en transit
- [ ] Chiffrement au repos
- [ ] Audit logging activé
- [ ] Monitoring des anomalies
- [ ] Politique de confidentialité
- [ ] Consentement RGPD
- [ ] Droit à l'oubli implémenté

### 2. Outils d'Audit

```bash
# Vérifier les vulnérabilités npm
npm audit

# Scan de sécurité avec Snyk
npm install -g snyk
snyk test

# Vérifier les headers HTTP
curl -I https://changeyourlife.ai

# Scan SSL/TLS
openssl s_client -connect changeyourlife.ai:443 -tls1_2
```

### 3. Rapports de Sécurité

```bash
# Générer un rapport de sécurité
npm audit --json > security-report.json

# Vérifier les dépendances
npm outdated
```

---

## Incident Response

### 1. Plan de Réponse

```markdown
1. Détecter l'incident
2. Contenir la menace
3. Éradiquer la cause
4. Récupérer les systèmes
5. Analyser et apprendre
6. Communiquer avec les utilisateurs
```

### 2. Notification de Violation

```javascript
// Notifier les utilisateurs en cas de violation
async function notifyUsers(affectedUsers) {
  for (const user of affectedUsers) {
    await sendEmail(user.email, {
      subject: 'Notification de sécurité',
      body: 'Vos données ont pu être compromises. Veuillez changer votre mot de passe.'
    });
  }
}
```

---

## Ressources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security](https://firebase.google.com/docs/security)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [CWE Top 25](https://cwe.mitre.org/top25/)

---

**La sécurité n'est pas une fonctionnalité, c'est une responsabilité ! 🔐✨**

Dernière mise à jour : 2025-01-16
