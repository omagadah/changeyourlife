// public/js/inscription-v2.js
// Gestion de l'authentification avec validation robuste
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './config.js';
import { logger } from './logger.js';
import { validateLoginForm, validateSignupForm, validatePassword } from './validation.js';

// Singleton Firebase init
let app, auth;
if (!window._cyfFirebase) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  const db = getFirestore(app);
  window._cyfFirebase = { app, auth, db };
  logger.info('Firebase initialized');
} else {
  ({ app, auth } = window._cyfFirebase);
}

// Redirection si déjà authentifié
try {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.replace('/app');
    }
  });
} catch (e) {
  logger.warn('Auth state check failed', e);
}

// Éléments du DOM
const form = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const passwordConfirmInput = document.getElementById('password-confirm');
const errorMessage = document.getElementById('error-message');
const notification = document.getElementById('notification');
const authToggleLink = document.getElementById('auth-toggle-link');
const authToggleText = document.getElementById('auth-toggle-text');
const passwordRequirements = document.getElementById('password-requirements');
const passwordConfirmGroup = document.getElementById('password-confirm-group');
const submitButton = document.getElementById('submit-button');

let isRegister = false;

/**
 * Afficher une erreur
 */
function showError(msg) {
  if (!errorMessage) return;
  errorMessage.textContent = msg;
  errorMessage.style.display = msg ? 'block' : 'none';
}

/**
 * Afficher une notification
 */
function showNotification(msg) {
  if (!notification) return;
  notification.textContent = msg;
  notification.classList.add('show');
  setTimeout(() => notification.classList.remove('show'), 3500);
}

/**
 * Mettre à jour les exigences du mot de passe
 */
function updatePasswordRequirements(password) {
  if (!isRegister) return;

  const requirements = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    special: /[@$!%*?&]/.test(password)
  };

  // Mettre à jour l'affichage
  const updateReq = (id, met) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.color = met ? '#9effc5' : '#bbb';
      el.style.textDecoration = met ? 'line-through' : 'none';
    }
  };

  updateReq('req-length', requirements.length);
  updateReq('req-upper', requirements.upper);
  updateReq('req-lower', requirements.lower);
  updateReq('req-digit', requirements.digit);
  updateReq('req-special', requirements.special);

  return Object.values(requirements).every(v => v);
}

/**
 * Basculer entre connexion et inscription
 */
function toggleAuthMode() {
  isRegister = !isRegister;

  if (isRegister) {
    authToggleText.textContent = 'Vous avez déjà un compte ?';
    authToggleLink.textContent = 'Se connecter';
    document.getElementById('auth-title').textContent = 'Créer un compte';
    submitButton.textContent = 'Créer un compte';
    passwordRequirements.style.display = 'block';
    passwordConfirmGroup.style.display = 'block';
  } else {
    authToggleText.textContent = 'Pas encore de compte ?';
    authToggleLink.textContent = 'Créer un compte';
    document.getElementById('auth-title').textContent = 'Connexion';
    submitButton.textContent = 'Se connecter';
    passwordRequirements.style.display = 'none';
    passwordConfirmGroup.style.display = 'none';
  }

  showError('');
  form.reset();
}

/**
 * Gérer la soumission du formulaire
 */
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput?.value || '';

    try {
      // Validation
      if (isRegister) {
        const validation = validateSignupForm(email, password, passwordConfirm);
        if (!validation.isValid) {
          showError(validation.getFirstError());
          logger.warn('Signup validation failed', { errors: validation.getAllErrors() });
          return;
        }
      } else {
        const validation = validateLoginForm(email, password);
        if (!validation.isValid) {
          showError(validation.getFirstError());
          logger.warn('Login validation failed', { errors: validation.getAllErrors() });
          return;
        }
      }

      // Désactiver le bouton
      submitButton.disabled = true;
      submitButton.textContent = isRegister ? 'Création en cours...' : 'Connexion en cours...';

      if (!isRegister) {
        // Connexion
        await signInWithEmailAndPassword(auth, email, password);
        logger.info('Login successful', { email });
        showNotification('Connexion réussie — redirection...');
        setTimeout(() => { window.location.href = '/app'; }, 900);
      } else {
        // Inscription
        await createUserWithEmailAndPassword(auth, email, password);
        logger.info('Signup successful', { email });
        showNotification('Compte créé — redirection...');
        setTimeout(() => { window.location.href = '/app'; }, 900);
      }
    } catch (err) {
      submitButton.disabled = false;
      submitButton.textContent = isRegister ? 'Créer un compte' : 'Se connecter';

      logger.error('Auth error', err, { email, isRegister });

      // Gérer les erreurs Firebase
      let errorMsg = 'Une erreur est survenue';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Cet email est déjà utilisé';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Le mot de passe est trop faible';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'L\'email n\'est pas valide';
      } else if (err.code === 'auth/user-not-found') {
        errorMsg = 'Cet email n\'existe pas';
      } else if (err.code === 'auth/wrong-password') {
        errorMsg = 'Le mot de passe est incorrect';
      } else if (err.code === 'auth/too-many-requests') {
        errorMsg = 'Trop de tentatives. Veuillez réessayer plus tard';
      } else if (err.message) {
        errorMsg = err.message;
      }

      showError(errorMsg);
    }
  });
}

/**
 * Mettre à jour les exigences en temps réel
 */
if (passwordInput) {
  passwordInput.addEventListener('input', () => {
    updatePasswordRequirements(passwordInput.value);
  });

  passwordInput.addEventListener('focus', () => {
    if (isRegister) {
      passwordRequirements.style.display = 'block';
    }
  });
}

/**
 * Vérifier la correspondance des mots de passe
 */
if (passwordConfirmInput) {
  passwordConfirmInput.addEventListener('input', () => {
    const hint = document.getElementById('password-confirm-hint');
    if (hint) {
      if (passwordConfirmInput.value && passwordInput.value !== passwordConfirmInput.value) {
        hint.textContent = '❌ Les mots de passe ne correspondent pas';
        hint.style.color = '#ff9aa2';
      } else if (passwordConfirmInput.value && passwordInput.value === passwordConfirmInput.value) {
        hint.textContent = '✓ Les mots de passe correspondent';
        hint.style.color = '#9effc5';
      } else {
        hint.textContent = '';
      }
    }
  });
}

/**
 * Basculer mode connexion/inscription
 */
if (authToggleLink) {
  authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthMode();
  });
}

/**
 * Connexion Google
 */
const googleBtn = document.getElementById('google-signin');
if (googleBtn) {
  googleBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const provider = new GoogleAuthProvider();

    try {
      googleBtn.disabled = true;
      googleBtn.textContent = 'Connexion en cours...';

      await signInWithPopup(auth, provider);
      logger.info('Google sign-in successful');
      showNotification('Connexion Google réussie — redirection...');
      setTimeout(() => { window.location.href = '/app'; }, 900);
    } catch (err) {
      googleBtn.disabled = false;
      googleBtn.textContent = 'Continuer avec Google';

      logger.error('Google sign-in error', err);

      const code = err?.code || '';
      if (code === 'auth/unauthorized-domain') {
        showError('Domaine non autorisé pour OAuth');
      } else if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(auth, provider);
        } catch (err2) {
          logger.error('Google redirect fallback failed', err2);
          showError('Connexion Google échouée');
        }
      } else if (code !== 'auth/popup-closed-by-user') {
        showError(err.message || 'Erreur lors de la connexion Google');
      }
    }
  });
}

/**
 * Connexion GitHub
 */
const githubBtn = document.getElementById('github-signin');
if (githubBtn) {
  githubBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const provider = new GithubAuthProvider();

    try {
      githubBtn.disabled = true;
      githubBtn.textContent = 'Connexion en cours...';

      await signInWithPopup(auth, provider);
      logger.info('GitHub sign-in successful');
      showNotification('Connexion GitHub réussie — redirection...');
      setTimeout(() => { window.location.href = '/app'; }, 900);
    } catch (err) {
      githubBtn.disabled = false;
      githubBtn.textContent = 'Continuer avec GitHub';

      logger.error('GitHub sign-in error', err);

      const code = err?.code || '';
      if (code === 'auth/unauthorized-domain') {
        showError('Domaine non autorisé pour OAuth');
      } else if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(auth, provider);
        } catch (err2) {
          logger.error('GitHub redirect fallback failed', err2);
          showError('Connexion GitHub échouée');
        }
      } else if (code !== 'auth/popup-closed-by-user') {
        showError(err.message || 'Erreur lors de la connexion GitHub');
      }
    }
  });
}

/**
 * Mot de passe oublié
 */
const forgotLink = document.getElementById('forgot-password-link');
if (forgotLink) {
  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    showNotification('Fonction mot de passe oublié — à implémenter');
  });
}

/**
 * Gérer les résultats de redirection OAuth
 */
(async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      logger.info('Redirect sign-in successful');
      showNotification('Connexion réussie — redirection...');
      setTimeout(() => { window.location.href = '/app'; }, 800);
    }
  } catch (err) {
    logger.warn('Redirect result error', err);
    if (err?.code === 'auth/unauthorized-domain') {
      showError('Domaine non autorisé pour OAuth');
    }
  }
})();

export default {};
