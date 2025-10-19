// public/js/inscription.js
// Gestion de l'authentification sur la page d'inscription / connexion
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Singleton Firebase init (évite les redéclarations)
let app, auth;
if (!window._cyfFirebase) {
  const firebaseConfig = { apiKey: "AIzaSyCvEtaivyC5QD0dGyPKh97IgYU8U8QrrWg", authDomain: "changeyourlife-cc210.firebaseapp.com", projectId: "changeyourlife-cc210", storageBucket: "changeyourlife-cc210.appspot.com", messagingSenderId: "801720080785", appId: "1:801720080785:web:1a74aadba5755ea26c2230" };
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  const db = getFirestore(app);
  window._cyfFirebase = { app, auth, db };
} else {
  ({ app, auth } = window._cyfFirebase);
}

// If already authenticated, bounce away from /login immediately
try {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Use replace to avoid keeping /login in history
      window.location.replace('/app');
    }
  });
} catch (e) {
  // non-blocking: auth might not be ready yet, main flow below initializes it
}

const form = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const notification = document.getElementById('notification');
const authToggleLink = document.getElementById('auth-toggle-link');
const authToggleText = document.getElementById('auth-toggle-text');
let isRegister = false;

function showError(msg) { if (!errorMessage) return; errorMessage.textContent = msg; }
function showNotification(msg) { if (!notification) return; notification.textContent = msg; notification.classList.add('show'); setTimeout(() => notification.classList.remove('show'), 3500); }

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) { showError('Veuillez renseigner vos identifiants'); return; }
    try {
      if (!isRegister) {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('Connexion réussie — redirection...');
        setTimeout(() => { window.location.href = '/app'; }, 900);
      } else {
        // Register
        await createUserWithEmailAndPassword(auth, email, password);
        showNotification('Compte créé — redirection...');
        setTimeout(() => { window.location.href = '/app'; }, 900);
      }
    } catch (err) {
      console.error('Auth error', err);
      showError(err.message || 'Erreur lors de la connexion');
    }
  });
}

// Google
const googleBtn = document.getElementById('google-signin');
if (googleBtn) {
  googleBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showNotification('Connexion Google réussie — redirection...');
      setTimeout(() => { window.location.href = '/app'; }, 900);
    } catch (err) {
      console.error('Google sign-in error', err);
      // UX: show immediate alert to user and fallback to redirect when popup blocked or environment doesn't support popups
      const code = err && err.code ? err.code : '';
      if (code === 'auth/unauthorized-domain') {
        alert('Domaine non autorisé pour OAuth. Ajoute ton domaine dans la console Firebase (Authorized domains).');
        showError('Domaine non autorisé pour OAuth — vérifie Firebase Console');
        return;
      }
      if (code === 'auth/operation-not-supported-in-this-environment' || code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // essayer sign-in redirect en fallback
        try {
          await signInWithRedirect(auth, provider);
          // redirect will navigate away; no further UI
        } catch (err2) {
          console.error('Google redirect fallback failed', err2);
          alert('Connexion via popup bloquée, et fallback redirect a échoué. Voir la console pour plus d\'informations.');
          showError(err2.message || 'Erreur lors du fallback Google');
        }
        return;
      }
      alert(err.message || 'Erreur lors de la connexion Google');
      showError(err.message || 'Erreur lors de la connexion Google');
    }
  });
}

// GitHub
const githubBtn = document.getElementById('github-signin');
if (githubBtn) {
  githubBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const provider = new GithubAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showNotification('Connexion GitHub réussie — redirection...');
      setTimeout(() => { window.location.href = '/app'; }, 900);
    } catch (err) {
      console.error('GitHub sign-in error', err);
      const code = err && err.code ? err.code : '';
      if (code === 'auth/unauthorized-domain') {
        alert('Domaine non autorisé pour OAuth. Ajoute ton domaine dans la console Firebase (Authorized domains).');
        showError('Domaine non autorisé pour OAuth — vérifie Firebase Console');
        return;
      }
      if (code === 'auth/operation-not-supported-in-this-environment' || code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(auth, provider);
        } catch (err2) {
          console.error('GitHub redirect fallback failed', err2);
          alert('Connexion via popup bloquée, et fallback redirect a échoué. Voir la console pour plus d\'informations.');
          showError(err2.message || 'Erreur lors du fallback GitHub');
        }
        return;
      }
      alert(err.message || 'Erreur lors de la connexion GitHub');
      showError(err.message || 'Erreur lors de la connexion GitHub');
    }
  });
}

// forgot-password link (simple flow)
const forgotLink = document.getElementById('forgot-password-link');
if (forgotLink) {
  forgotLink.addEventListener('click', (e) => { e.preventDefault(); showNotification('Fonction mot de passe oublié — à implémenter'); });
}

// Toggle login/register
if (authToggleLink) {
  authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isRegister = !isRegister;
    if (isRegister) {
      authToggleText.textContent = 'Vous avez déjà un compte ?';
      authToggleLink.textContent = 'Se connecter';
      document.getElementById('auth-title').textContent = 'Créer un compte';
      document.getElementById('submit-button').textContent = 'Créer un compte';
    } else {
      authToggleText.textContent = 'Pas encore de compte ?';
      authToggleLink.textContent = 'Créer un compte';
      document.getElementById('auth-title').textContent = 'Connexion';
      document.getElementById('submit-button').textContent = 'Se connecter';
    }
  });
}

export default {};

// Handle redirect results (used when falling back to redirect sign-in)
(async function handleRedirectResult(){
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      console.log('Redirect sign-in result:', result.user);
      showNotification('Connexion réussie — redirection...');
      setTimeout(() => { window.location.href = '/app'; }, 800);
    }
  } catch (err) {
    console.warn('No redirect result or error:', err);
    // show non-blocking message
    if (err && err.code === 'auth/unauthorized-domain') {
      showError('Domaine non autorisé pour OAuth — vérifie Firebase Console');
    }
  }
})();