# 🧪 Guide de Test - Change Your Life

Guide complet pour tester l'application avec Jest, Playwright et tests manuels.

## 📋 Table des matières

1. [Tests Unitaires](#tests-unitaires)
2. [Tests E2E](#tests-e2e)
3. [Tests Manuels](#tests-manuels)
4. [Performance](#performance)
5. [Sécurité](#sécurité)

---

## Tests Unitaires

### Installation

```bash
npm install --save-dev jest @babel/preset-env babel-jest
```

### Configuration Jest

Créer `jest.config.js` :

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/public/js/$1'
  },
  collectCoverageFrom: [
    'public/js/**/*.js',
    '!public/js/**/*.min.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### Exemple de Test - Validation

Créer `public/js/__tests__/validation.test.js` :

```javascript
import {
  validateEmail,
  validatePassword,
  validateSignupForm,
  ValidationResult
} from '../validation.js';

describe('Validation', () => {
  describe('validateEmail', () => {
    test('accepte un email valide', () => {
      const result = validateEmail('user@example.com');
      expect(result.isValid).toBe(true);
    });

    test('rejette un email vide', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.getFirstError()).toContain('requis');
    });

    test('rejette un email sans @', () => {
      const result = validateEmail('userexample.com');
      expect(result.isValid).toBe(false);
      expect(result.getFirstError()).toContain('valide');
    });

    test('rejette un email trop long', () => {
      const result = validateEmail('a'.repeat(255) + '@example.com');
      expect(result.isValid).toBe(false);
    });

    test('rejette les domaines suspects', () => {
      const result = validateEmail('user@test.com');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    test('accepte un mot de passe valide', () => {
      const result = validatePassword('MyPassword123!');
      expect(result.isValid).toBe(true);
    });

    test('rejette un mot de passe trop court', () => {
      const result = validatePassword('Pass1!');
      expect(result.isValid).toBe(false);
      expect(result.getFirstError()).toContain('8 caractères');
    });

    test('rejette un mot de passe sans majuscule', () => {
      const result = validatePassword('mypassword123!');
      expect(result.isValid).toBe(false);
      expect(result.getFirstError()).toContain('majuscule');
    });

    test('rejette un mot de passe sans chiffre', () => {
      const result = validatePassword('MyPassword!');
      expect(result.isValid).toBe(false);
      expect(result.getFirstError()).toContain('chiffre');
    });

    test('rejette un mot de passe sans caractère spécial', () => {
      const result = validatePassword('MyPassword123');
      expect(result.isValid).toBe(false);
      expect(result.getFirstError()).toContain('spécial');
    });

    test('rejette les mots de passe courants', () => {
      const result = validatePassword('Password123!');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateSignupForm', () => {
    test('accepte un formulaire valide', () => {
      const result = validateSignupForm(
        'user@example.com',
        'MyPassword123!',
        'MyPassword123!'
      );
      expect(result.isValid).toBe(true);
    });

    test('rejette si les mots de passe ne correspondent pas', () => {
      const result = validateSignupForm(
        'user@example.com',
        'MyPassword123!',
        'DifferentPassword123!'
      );
      expect(result.isValid).toBe(false);
    });
  });
});
```

### Exemple de Test - Logger

Créer `public/js/__tests__/logger.test.js` :

```javascript
import { Logger, LogLevel } from '../logger.js';

describe('Logger', () => {
  let logger;
  let consoleSpy;

  beforeEach(() => {
    logger = new Logger('Test');
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('log info', () => {
    logger.info('Test message');
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('log error', () => {
    const error = new Error('Test error');
    logger.error('Error occurred', error);
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('mesurer les performances', () => {
    const timer = logger.time('Operation');
    // Simuler une opération
    setTimeout(() => {}, 100);
    const duration = timer.end();
    expect(duration).toBeGreaterThan(0);
  });

  test('setUser', () => {
    logger.setUser('user123', 'user@example.com', 'username');
    // Vérifier que les données sont stockées
    expect(logger).toBeDefined();
  });
});
```

### Lancer les tests

```bash
# Tous les tests
npm test

# Tests en mode watch
npm test -- --watch

# Couverture de code
npm test -- --coverage

# Test spécifique
npm test -- validation.test.js
```

---

## Tests E2E

### Installation

```bash
npm install --save-dev @playwright/test
```

### Configuration Playwright

Créer `playwright.config.js` :

```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Exemple de Test E2E - Authentification

Créer `e2e/auth.spec.js` :

```javascript
import { test, expect } from '@playwright/test';

test.describe('Authentification', () => {
  test('affiche la page de connexion', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Connexion');
  });

  test('valide un email invalide', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'invalid-email');
    await page.fill('#password', 'Password123!');
    await page.click('#submit-button');
    
    const error = page.locator('#error-message');
    await expect(error).toContainText('valide');
  });

  test('affiche les exigences du mot de passe en mode inscription', async ({ page }) => {
    await page.goto('/login');
    await page.click('#auth-toggle-link');
    
    const requirements = page.locator('#password-requirements');
    await expect(requirements).toBeVisible();
  });

  test('valide la correspondance des mots de passe', async ({ page }) => {
    await page.goto('/login');
    await page.click('#auth-toggle-link');
    
    await page.fill('#password', 'MyPassword123!');
    await page.fill('#password-confirm', 'DifferentPassword123!');
    
    const hint = page.locator('#password-confirm-hint');
    await expect(hint).toContainText('ne correspondent pas');
  });

  test('affiche un message d\'erreur pour email déjà utilisé', async ({ page }) => {
    await page.goto('/login');
    await page.click('#auth-toggle-link');
    
    await page.fill('#email', 'existing@example.com');
    await page.fill('#password', 'MyPassword123!');
    await page.fill('#password-confirm', 'MyPassword123!');
    await page.click('#submit-button');
    
    // Attendre le message d'erreur
    const error = page.locator('#error-message');
    await expect(error).toBeVisible();
  });
});
```

### Exemple de Test E2E - Tableau de bord

Créer `e2e/dashboard.spec.js` :

```javascript
import { test, expect } from '@playwright/test';

test.describe('Tableau de bord', () => {
  test.beforeEach(async ({ page }) => {
    // Se connecter avant chaque test
    await page.goto('/login');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'TestPassword123!');
    await page.click('#submit-button');
    await page.waitForURL('/app');
  });

  test('affiche le message de bienvenue', async ({ page }) => {
    const welcome = page.locator('h1');
    await expect(welcome).toContainText('Bienvenue');
  });

  test('affiche les cartes d\'outils', async ({ page }) => {
    const cards = page.locator('.tool-card');
    await expect(cards).toHaveCount(5);
  });

  test('navigue vers Your Life', async ({ page }) => {
    await page.click('a[href="/yourlife"]');
    await page.waitForURL('/yourlife');
    await expect(page.locator('h1')).toContainText('Arbre de compétences');
  });

  test('ouvre le menu utilisateur', async ({ page }) => {
    await page.click('.user-panel-trigger');
    const menu = page.locator('#cyf-user-menu');
    await expect(menu).toBeVisible();
  });

  test('se déconnecte', async ({ page }) => {
    await page.click('.user-panel-trigger');
    await page.click('#cyf-signout');
    await page.waitForURL('/login');
    await expect(page.locator('h1')).toContainText('Connexion');
  });
});
```

### Lancer les tests E2E

```bash
# Tous les tests E2E
npm run test:e2e

# Mode debug
npm run test:e2e -- --debug

# Afficher le rapport HTML
npm run test:e2e -- --reporter=html
npx playwright show-report
```

---

## Tests Manuels

### Checklist de Test Fonctionnel

#### Authentification
- [ ] Connexion avec email/mot de passe valides
- [ ] Connexion avec email/mot de passe invalides
- [ ] Inscription avec données valides
- [ ] Inscription avec email déjà utilisé
- [ ] Connexion Google
- [ ] Connexion GitHub
- [ ] Redirection automatique si déjà connecté
- [ ] Déconnexion

#### Tableau de bord
- [ ] Affichage du message de bienvenue
- [ ] Affichage des cartes d'outils
- [ ] Navigation vers les outils
- [ ] Menu utilisateur
- [ ] Thème clair/sombre

#### Your Life (Éditeur de graphe)
- [ ] Ajouter un nœud
- [ ] Supprimer un nœud
- [ ] Renommer un nœud
- [ ] Changer la couleur d'un nœud
- [ ] Créer un lien entre nœuds
- [ ] Supprimer un lien
- [ ] Marquer comme accompli
- [ ] Mettre en sommeil une branche
- [ ] Undo/Redo
- [ ] Sauvegarde automatique
- [ ] Centrer le graphe

#### Responsive
- [ ] Desktop (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] Zoom jusqu'à 200%

#### Performance
- [ ] Temps de chargement < 3s
- [ ] Pas de lag lors des interactions
- [ ] Pas de memory leak

#### Sécurité
- [ ] Pas de XSS
- [ ] Pas d'injection SQL
- [ ] Pas d'accès non autorisé
- [ ] Données chiffrées en transit

---

## Performance

### Lighthouse

```bash
# Générer un rapport Lighthouse
npm run lighthouse
```

### Critères

- Performance : > 90
- Accessibilité : > 90
- Bonnes pratiques : > 90
- SEO : > 90

### Optimisations

```javascript
// Lazy loading des images
<img loading="lazy" src="image.jpg" alt="Description">

// Code splitting
import { lazy, Suspense } from 'react';
const Component = lazy(() => import('./Component'));

// Compression
npm install --save-dev compression-webpack-plugin
```

---

## Sécurité

### Tests de Sécurité

#### OWASP Top 10

- [ ] Injection SQL
- [ ] Authentification cassée
- [ ] Exposition de données sensibles
- [ ] Entités externes XML (XXE)
- [ ] Contrôle d'accès cassé
- [ ] Mauvaise configuration de sécurité
- [ ] XSS
- [ ] Désérialisation non sécurisée
- [ ] Utilisation de composants avec vulnérabilités connues
- [ ] Logging et monitoring insuffisants

### Outils

```bash
# Vérifier les vulnérabilités npm
npm audit

# Fixer les vulnérabilités
npm audit fix

# Scan de sécurité avec Snyk
npm install -g snyk
snyk test
```

---

## CI/CD

### GitHub Actions

Créer `.github/workflows/test.yml` :

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test -- --coverage
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Rapports

### Couverture de Code

```bash
npm test -- --coverage

# Afficher le rapport HTML
open coverage/lcov-report/index.html
```

### Rapports Playwright

```bash
npx playwright show-report
```

---

**Tester c'est construire en confiance ! 🧪✨**

Dernière mise à jour : 2025-01-16
