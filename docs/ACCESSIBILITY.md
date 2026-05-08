# ♿ Guide d'Accessibilité - WCAG 2.1 AA

Ce document décrit les améliorations d'accessibilité pour atteindre la conformité WCAG 2.1 niveau AA.

## 📋 Checklist d'Accessibilité

### 1. Perception

#### 1.1 Alternatives textuelles
- [ ] Tous les images ont un `alt` descriptif
- [ ] Les icônes SVG ont des labels ARIA
- [ ] Les vidéos ont des sous-titres
- [ ] Les contenus audio ont des transcriptions

**Implémentation** :

```html
<!-- ✅ BON -->
<img src="logo.svg" alt="Logo Change Your Life">
<svg aria-label="Icône de méditation">...</svg>

<!-- ❌ MAUVAIS -->
<img src="logo.svg">
<svg>...</svg>
```

#### 1.2 Contrastes de couleur
- [ ] Ratio de contraste minimum 4.5:1 pour le texte
- [ ] Ratio de contraste minimum 3:1 pour les éléments graphiques

**Vérifier avec** : [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

#### 1.3 Adaptabilité
- [ ] Pas de dépendance à la couleur seule
- [ ] Responsive design
- [ ] Zoom jusqu'à 200% sans perte de fonctionnalité

### 2. Opérabilité

#### 2.1 Accessibilité au clavier
- [ ] Tous les éléments interactifs sont accessibles au clavier
- [ ] Ordre de tabulation logique
- [ ] Pas de pièges au clavier
- [ ] Raccourcis clavier documentés

**Implémentation** :

```html
<!-- ✅ BON -->
<button onclick="handleClick()">Cliquer</button>
<a href="/page">Lien</a>
<input type="text" aria-label="Recherche">

<!-- ❌ MAUVAIS -->
<div onclick="handleClick()">Cliquer</div>
<span role="button">Cliquer</span>
```

#### 2.2 Temps suffisant
- [ ] Pas de limite de temps stricte
- [ ] Possibilité de prolonger les délais
- [ ] Pas de contenu clignotant (> 3 fois/seconde)

#### 2.3 Crises et réactions physiques
- [ ] Pas de contenu clignotant dangereux
- [ ] Animations contrôlables

### 3. Compréhensibilité

#### 3.1 Lisibilité
- [ ] Langue de la page définie
- [ ] Mots inhabituels expliqués
- [ ] Abréviations expliquées
- [ ] Texte clair et simple

**Implémentation** :

```html
<!-- ✅ BON -->
<html lang="fr">
<abbr title="Application Web Progressive">PWA</abbr>

<!-- ❌ MAUVAIS -->
<html>
<abbr>PWA</abbr>
```

#### 3.2 Prévisibilité
- [ ] Navigation cohérente
- [ ] Comportement prévisible
- [ ] Pas de changements de contexte inattendus

#### 3.3 Assistance à la saisie
- [ ] Messages d'erreur clairs
- [ ] Suggestions de correction
- [ ] Confirmation avant actions irréversibles

**Implémentation** :

```html
<!-- ✅ BON -->
<input type="email" aria-label="Email" aria-describedby="email-error">
<span id="email-error" role="alert">Email invalide</span>

<!-- ❌ MAUVAIS -->
<input type="email">
<span>Email invalide</span>
```

### 4. Robustesse

#### 4.1 Compatibilité
- [ ] HTML valide
- [ ] Pas d'erreurs de parsing
- [ ] Attributs uniques
- [ ] Nesting correct

**Vérifier avec** : [W3C Validator](https://validator.w3.org/)

## 🎯 Améliorations à Implémenter

### 1. Formulaires

```html
<!-- ✅ ACCESSIBLE -->
<form>
  <div class="form-group">
    <label for="email">Email</label>
    <input 
      id="email" 
      type="email" 
      aria-label="Adresse email"
      aria-describedby="email-help"
      required
    >
    <small id="email-help">Format: user@example.com</small>
  </div>
  
  <div class="form-group">
    <label for="password">Mot de passe</label>
    <input 
      id="password" 
      type="password" 
      aria-label="Mot de passe"
      aria-describedby="password-requirements"
      required
    >
    <ul id="password-requirements" aria-live="polite">
      <li id="req-length">Au moins 8 caractères</li>
      <li id="req-upper">Au moins une majuscule</li>
    </ul>
  </div>
  
  <button type="submit" aria-label="Se connecter">Se connecter</button>
</form>
```

### 2. Navigation

```html
<!-- ✅ ACCESSIBLE -->
<nav aria-label="Navigation principale">
  <ul>
    <li><a href="/app" aria-current="page">Mon Espace</a></li>
    <li><a href="/profile">Mon Profil</a></li>
    <li><a href="/settings">Paramètres</a></li>
  </ul>
</nav>
```

### 3. Alertes et Notifications

```html
<!-- ✅ ACCESSIBLE -->
<div role="alert" aria-live="assertive" aria-atomic="true">
  Connexion réussie !
</div>

<div role="status" aria-live="polite" aria-atomic="true">
  Sauvegarde en cours...
</div>
```

### 4. Modales

```html
<!-- ✅ ACCESSIBLE -->
<div role="dialog" aria-labelledby="dialog-title" aria-modal="true">
  <h2 id="dialog-title">Confirmer l'action</h2>
  <p>Êtes-vous sûr ?</p>
  <button>Confirmer</button>
  <button>Annuler</button>
</div>
```

### 5. Graphes et Visualisations

```javascript
// ✅ ACCESSIBLE
const cy = cytoscape({
  // ... configuration ...
});

// Ajouter des descriptions textuelles
const description = document.createElement('div');
description.setAttribute('role', 'img');
description.setAttribute('aria-label', 'Graphe de compétences avec 15 nœuds');
description.textContent = 'Graphe interactif montrant vos compétences et leurs relations';
```

## 🧪 Tests d'Accessibilité

### Outils recommandés

1. **axe DevTools** : Extension Chrome/Firefox
2. **WAVE** : Extension Chrome/Firefox
3. **Lighthouse** : Intégré dans Chrome DevTools
4. **NVDA** : Lecteur d'écran gratuit (Windows)
5. **JAWS** : Lecteur d'écran (payant)

### Tests manuels

```bash
# Tester la navigation au clavier
# 1. Appuyer sur Tab pour naviguer
# 2. Appuyer sur Entrée/Espace pour activer
# 3. Appuyer sur Échap pour fermer les modales

# Tester avec un lecteur d'écran
# 1. Activer NVDA/JAWS
# 2. Naviguer avec les touches de raccourci
# 3. Vérifier que tout est annoncé correctement
```

## 📊 Audit d'Accessibilité

### Checklist WCAG 2.1 AA

| Critère | Statut | Notes |
|---------|--------|-------|
| 1.1.1 Contenu non textuel | ⚠️ À améliorer | Ajouter alt à toutes les images |
| 1.4.3 Contraste (minimum) | ✅ Conforme | Ratio 4.5:1 |
| 2.1.1 Clavier | ⚠️ À améliorer | Ajouter focus visible |
| 2.1.2 Pas de piège au clavier | ✅ Conforme | |
| 2.4.3 Ordre de focus | ⚠️ À améliorer | Vérifier l'ordre de tabulation |
| 2.4.7 Focus visible | ⚠️ À améliorer | Ajouter outline au focus |
| 3.1.1 Langue de la page | ✅ Conforme | `lang="fr"` |
| 3.3.1 Identification d'erreur | ⚠️ À améliorer | Ajouter messages d'erreur clairs |
| 3.3.4 Prévention des erreurs | ⚠️ À améliorer | Confirmation avant actions |
| 4.1.2 Nom, rôle, valeur | ⚠️ À améliorer | Ajouter ARIA labels |

## 🔧 Implémentation Progressive

### Phase 1 (Urgent)
- [ ] Ajouter `lang="fr"` à tous les HTML
- [ ] Ajouter `alt` à toutes les images
- [ ] Vérifier les contrastes de couleur
- [ ] Tester la navigation au clavier

### Phase 2 (Important)
- [ ] Ajouter ARIA labels aux formulaires
- [ ] Ajouter focus visible
- [ ] Ajouter role="alert" aux notifications
- [ ] Tester avec un lecteur d'écran

### Phase 3 (Souhaitable)
- [ ] Ajouter descriptions textuelles aux graphes
- [ ] Implémenter les raccourcis clavier
- [ ] Ajouter mode contraste élevé
- [ ] Audit externe

## 📚 Ressources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM](https://webaim.org/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project](https://www.a11yproject.com/)

## 🎓 Formation

- [Udacity Web Accessibility](https://www.udacity.com/course/web-accessibility--ud891)
- [Coursera Accessibility](https://www.coursera.org/learn/accessibility)
- [LinkedIn Learning Accessibility](https://www.linkedin.com/learning/topics/accessibility)

---

**L'accessibilité n'est pas une fonctionnalité, c'est un droit ! ♿✨**

Dernière mise à jour : 2025-01-16
