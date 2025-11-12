/**
 * Système de validation robuste
 * Valide les emails, mots de passe, et autres données
 */

import { appConfig } from './config.js';
import { logger } from './logger.js';

/**
 * Résultats de validation
 */
export class ValidationResult {
  constructor(isValid = true, errors = []) {
    this.isValid = isValid;
    this.errors = errors;
  }

  addError(field, message) {
    this.isValid = false;
    this.errors.push({ field, message });
    return this;
  }

  getFirstError() {
    return this.errors[0]?.message || null;
  }

  getAllErrors() {
    return this.errors;
  }
}

/**
 * Validateur d'email
 */
export function validateEmail(email) {
  const result = new ValidationResult();

  if (!email || typeof email !== 'string') {
    return result.addError('email', 'L\'email est requis');
  }

  const trimmed = email.trim();

  if (trimmed.length === 0) {
    return result.addError('email', 'L\'email ne peut pas être vide');
  }

  if (trimmed.length > 254) {
    return result.addError('email', 'L\'email est trop long (max 254 caractères)');
  }

  if (!appConfig.emailRegex.test(trimmed)) {
    return result.addError('email', 'L\'email n\'est pas valide');
  }

  // Vérifier les domaines suspects
  const domain = trimmed.split('@')[1].toLowerCase();
  const suspiciousDomains = ['test.com', 'example.com', 'localhost'];
  if (suspiciousDomains.includes(domain)) {
    return result.addError('email', 'Veuillez utiliser un email valide');
  }

  return result;
}

/**
 * Validateur de mot de passe
 */
export function validatePassword(password) {
  const result = new ValidationResult();

  if (!password || typeof password !== 'string') {
    return result.addError('password', 'Le mot de passe est requis');
  }

  if (password.length < appConfig.passwordMinLength) {
    return result.addError('password', `Le mot de passe doit contenir au moins ${appConfig.passwordMinLength} caractères`);
  }

  if (password.length > 128) {
    return result.addError('password', 'Le mot de passe est trop long (max 128 caractères)');
  }

  // Vérifier la complexité
  if (!/[A-Z]/.test(password)) {
    return result.addError('password', 'Le mot de passe doit contenir au moins une majuscule');
  }

  if (!/[a-z]/.test(password)) {
    return result.addError('password', 'Le mot de passe doit contenir au moins une minuscule');
  }

  if (!/\d/.test(password)) {
    return result.addError('password', 'Le mot de passe doit contenir au moins un chiffre');
  }

  if (!/[@$!%*?&]/.test(password)) {
    return result.addError('password', 'Le mot de passe doit contenir au moins un caractère spécial (@$!%*?&)');
  }

  // Vérifier les mots de passe courants
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123'];
  if (commonPasswords.some(p => password.toLowerCase().includes(p))) {
    return result.addError('password', 'Ce mot de passe est trop courant. Veuillez en choisir un autre');
  }

  return result;
}

/**
 * Validateur de confirmation de mot de passe
 */
export function validatePasswordConfirmation(password, confirmation) {
  const result = new ValidationResult();

  if (!confirmation || typeof confirmation !== 'string') {
    return result.addError('passwordConfirmation', 'La confirmation du mot de passe est requise');
  }

  if (password !== confirmation) {
    return result.addError('passwordConfirmation', 'Les mots de passe ne correspondent pas');
  }

  return result;
}

/**
 * Validateur de contenu journal
 */
export function validateJournalEntry(content) {
  const result = new ValidationResult();

  if (!content || typeof content !== 'string') {
    return result.addError('content', 'Le contenu est requis');
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return result.addError('content', 'Veuillez écrire quelque chose');
  }

  if (trimmed.length < 10) {
    return result.addError('content', 'L\'entrée doit contenir au moins 10 caractères');
  }

  if (trimmed.length > appConfig.maxJournalEntryLength) {
    return result.addError('content', `L\'entrée ne peut pas dépasser ${appConfig.maxJournalEntryLength} caractères`);
  }

  return result;
}

/**
 * Validateur de label de nœud
 */
export function validateNodeLabel(label) {
  const result = new ValidationResult();

  if (!label || typeof label !== 'string') {
    return result.addError('label', 'Le label est requis');
  }

  const trimmed = label.trim();

  if (trimmed.length === 0) {
    return result.addError('label', 'Le label ne peut pas être vide');
  }

  if (trimmed.length > appConfig.maxNodeLabel) {
    return result.addError('label', `Le label ne peut pas dépasser ${appConfig.maxNodeLabel} caractères`);
  }

  return result;
}

/**
 * Validateur d'émotion
 */
export function validateEmotion(emotion) {
  const result = new ValidationResult();
  const validEmotions = ['joy', 'calm', 'grateful', 'worried', 'sad', 'angry', 'neutral'];

  if (!emotion || typeof emotion !== 'string') {
    return result.addError('emotion', 'L\'émotion est requise');
  }

  if (!validEmotions.includes(emotion)) {
    return result.addError('emotion', `L\'émotion doit être l\'une de: ${validEmotions.join(', ')}`);
  }

  return result;
}

/**
 * Validateur de domaine
 */
export function validateDomain(domain) {
  const result = new ValidationResult();
  const validDomains = ['body', 'heart', 'etre', 'order'];

  if (!domain || typeof domain !== 'string') {
    return result.addError('domain', 'Le domaine est requis');
  }

  if (!validDomains.includes(domain)) {
    return result.addError('domain', `Le domaine doit être l\'un de: ${validDomains.join(', ')}`);
  }

  return result;
}

/**
 * Validateur de priorité
 */
export function validatePriority(priority) {
  const result = new ValidationResult();
  const validPriorities = ['none', 'low', 'medium', 'high', 'urgent'];

  if (!priority || typeof priority !== 'string') {
    return result.addError('priority', 'La priorité est requise');
  }

  if (!validPriorities.includes(priority)) {
    return result.addError('priority', `La priorité doit être l\'une de: ${validPriorities.join(', ')}`);
  }

  return result;
}

/**
 * Validateur de couleur hexadécimale
 */
export function validateHexColor(color) {
  const result = new ValidationResult();

  if (!color || typeof color !== 'string') {
    return result.addError('color', 'La couleur est requise');
  }

  if (!/^#[0-9A-F]{6}$/i.test(color)) {
    return result.addError('color', 'La couleur doit être un code hexadécimal valide (#RRGGBB)');
  }

  return result;
}

/**
 * Validateur de formulaire d'inscription
 */
export function validateSignupForm(email, password, passwordConfirmation) {
  const result = new ValidationResult();

  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    result.addError('email', emailValidation.getFirstError());
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    result.addError('password', passwordValidation.getFirstError());
  }

  const confirmValidation = validatePasswordConfirmation(password, passwordConfirmation);
  if (!confirmValidation.isValid) {
    result.addError('passwordConfirmation', confirmValidation.getFirstError());
  }

  return result;
}

/**
 * Validateur de formulaire de connexion
 */
export function validateLoginForm(email, password) {
  const result = new ValidationResult();

  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    result.addError('email', emailValidation.getFirstError());
  }

  if (!password || password.length === 0) {
    result.addError('password', 'Le mot de passe est requis');
  }

  return result;
}

/**
 * Sanitizer pour prévenir les injections XSS
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Validateur générique
 */
export function validate(value, rules) {
  const result = new ValidationResult();

  for (const rule of rules) {
    if (!rule.test(value)) {
      result.addError(rule.field || 'field', rule.message);
    }
  }

  return result;
}

export default {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateJournalEntry,
  validateNodeLabel,
  validateEmotion,
  validateDomain,
  validatePriority,
  validateHexColor,
  validateSignupForm,
  validateLoginForm,
  sanitizeInput,
  validate,
  ValidationResult
};
