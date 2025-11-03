# 🤝 Guide de Contribution - Change Your Life

Merci de votre intérêt pour contribuer à Change Your Life ! Ce guide vous aidera à contribuer efficacement.

## 📋 Table des matières

1. [Code de Conduite](#code-de-conduite)
2. [Comment Contribuer](#comment-contribuer)
3. [Processus de Pull Request](#processus-de-pull-request)
4. [Standards de Code](#standards-de-code)
5. [Commit Messages](#commit-messages)
6. [Tests](#tests)
7. [Documentation](#documentation)

---

## 📜 Code de Conduite

### Notre Engagement

Nous nous engageons à fournir un environnement accueillant et inclusif pour tous.

### Comportement Attendu

- Soyez respectueux et inclusif
- Acceptez les critiques constructives
- Concentrez-vous sur ce qui est meilleur pour la communauté
- Montrez de l'empathie envers les autres membres

### Comportement Inacceptable

- Harcèlement ou discrimination
- Langage ou images offensantes
- Attaques personnelles
- Spam ou auto-promotion

---

## 🚀 Comment Contribuer

### 1. Fork le Repository

```bash
# Cloner votre fork
git clone https://github.com/YOUR_USERNAME/changeyourlife.git
cd changeyourlife

# Ajouter le repository original comme remote
git remote add upstream https://github.com/ORIGINAL_OWNER/changeyourlife.git
```

### 2. Créer une Branche

```bash
# Mettre à jour main
git fetch upstream
git checkout main
git merge upstream/main

# Créer une branche pour votre feature
git checkout -b feature/amazing-feature
```

### 3. Faire vos Changements

```bash
# Éditer les fichiers
# Tester vos changements
# Committer vos changements
git add .
git commit -m "Add amazing feature"
```

### 4. Pousser vers votre Fork

```bash
git push origin feature/amazing-feature
```

### 5. Créer une Pull Request

- Allez sur GitHub
- Cliquez sur "New Pull Request"
- Sélectionnez votre branche
- Remplissez la description
- Cliquez sur "Create Pull Request"

---

## 📝 Processus de Pull Request

### Template de PR

```markdown
## Description
Brève description de vos changements

## Type de Changement
- [ ] Bug fix
- [ ] Nouvelle fonctionnalité
- [ ] Breaking change
- [ ] Documentation

## Changements
- Changement 1
- Changement 2

## Tests
- [ ] Tests unitaires ajoutés
- [ ] Tests E2E ajoutés
- [ ] Tous les tests passent

## Checklist
- [ ] Code suit les standards
- [ ] Documentation mise à jour
- [ ] Pas de breaking changes
- [ ] Accessible (WCAG 2.1)
```

### Critères d'Acceptation

- ✅ Code suit les standards
- ✅ Tests passent
- ✅ Documentation mise à jour
- ✅ Pas de breaking changes
- ✅ Accessible
- ✅ Approuvé par au moins 1 reviewer

---

## 💻 Standards de Code

### JavaScript

```javascript
// ✅ BON
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ MAUVAIS
function calc(i) {
  let s = 0;
  for (let x = 0; x < i.length; x++) {
    s += i[x].p;
  }
  return s;
}
```

### Nommage

```javascript
// ✅ BON
const userEmail = 'user@example.com';
const isAuthenticated = true;
function validateEmail(email) {}

// ❌ MAUVAIS
const ue = 'user@example.com';
const auth = true;
function ve(e) {}
```

### Commentaires

```javascript
// ✅ BON
// Valider l'email avant de l'envoyer
const validation = validateEmail(email);

// ❌ MAUVAIS
// Valider
const v = validateEmail(email);
```

### Formatage

```javascript
// ✅ BON - Utiliser Prettier
const config = {
  name: 'Change Your Life',
  version: '1.4.0',
  features: ['meditation', 'journal', 'goals']
};

// ❌ MAUVAIS - Formatage inconsistant
const config = {
  name: 'Change Your Life',
    version: '1.4.0',
  features: ['meditation', 'journal', 'goals']
};
```

### Linting

```bash
# Installer ESLint
npm install --save-dev eslint

# Créer configuration
npx eslint --init

# Linter le code
npm run lint

# Fixer automatiquement
npm run lint -- --fix
```

---

## 📝 Commit Messages

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: Nouvelle fonctionnalité
- `fix`: Correction de bug
- `docs`: Documentation
- `style`: Formatage
- `refactor`: Refactorisation
- `perf`: Amélioration de performance
- `test`: Tests
- `chore`: Maintenance

### Exemples

```bash
# ✅ BON
git commit -m "feat(auth): add email validation"
git commit -m "fix(journal): prevent duplicate entries"
git commit -m "docs: update README"

# ❌ MAUVAIS
git commit -m "fix stuff"
git commit -m "WIP"
git commit -m "asdf"
```

---

## 🧪 Tests

### Avant de Committer

```bash
# Linter
npm run lint

# Tests unitaires
npm test

# Tests E2E
npm run test:e2e

# Build
npm run build
```

### Ajouter des Tests

```javascript
// Créer un fichier de test
// public/js/__tests__/myfeature.test.js

import { myFunction } from '../myfeature.js';

describe('MyFeature', () => {
  test('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

### Couverture de Code

```bash
# Générer un rapport de couverture
npm test -- --coverage

# Vérifier la couverture
npm test -- --coverage --coverageThreshold='{"global":{"lines":70}}'
```

---

## 📚 Documentation

### Mettre à Jour la Documentation

1. **README.md** : Changements visibles pour les utilisateurs
2. **DOCUMENTATION.md** : Changements techniques
3. **Code Comments** : Logique complexe
4. **Commit Messages** : Raison du changement

### Exemple

```markdown
## Nouvelle Fonctionnalité

### Description
Brève description de la fonctionnalité

### Utilisation
```javascript
import { newFeature } from './newfeature.js';

const result = newFeature(options);
```

### API
- `newFeature(options)` : Description
  - `options.param1` : Description
  - `options.param2` : Description
```

---

## 🔍 Processus de Review

### Ce que les Reviewers Vérifieront

- ✅ Code suit les standards
- ✅ Tests sont complets
- ✅ Documentation est à jour
- ✅ Pas de breaking changes
- ✅ Performance acceptable
- ✅ Accessible
- ✅ Sécurisé

### Répondre aux Commentaires

1. Lire attentivement le commentaire
2. Discuter si vous n'êtes pas d'accord
3. Faire les changements demandés
4. Committer et pousser
5. Répondre au commentaire

---

## 🐛 Signaler des Bugs

### Template de Bug Report

```markdown
## Description
Brève description du bug

## Étapes pour Reproduire
1. Aller à...
2. Cliquer sur...
3. Voir l'erreur...

## Comportement Attendu
Ce qui devrait se passer

## Comportement Actuel
Ce qui se passe réellement

## Environnement
- OS: [e.g. Windows 10]
- Navigateur: [e.g. Chrome 90]
- Version: [e.g. 1.4.0]

## Logs
```
[Coller les logs ici]
```

## Screenshots
[Ajouter des screenshots si applicable]
```

---

## 💡 Suggérer des Améliorations

### Template de Feature Request

```markdown
## Description
Brève description de l'amélioration

## Problème
Quel problème cela résout-il ?

## Solution Proposée
Comment cela devrait fonctionner ?

## Alternatives Considérées
Autres solutions possibles

## Contexte Supplémentaire
Informations additionnelles
```

---

## 📞 Questions ?

- 📧 Email : support@changeyourlife.ai
- 💬 Discussions : GitHub Discussions
- 🐛 Issues : GitHub Issues

---

## 🙏 Remerciements

Merci de contribuer à Change Your Life ! Votre aide est précieuse pour rendre cette application meilleure. 🚀✨

---

**Heureux de contribuer ! 🎉**

Dernière mise à jour : 2025-01-16
