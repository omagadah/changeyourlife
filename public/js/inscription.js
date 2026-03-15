// public/js/inscription.js — v17
// Gestion de l'authentification : connexion / inscription / vérification email

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail,
  GoogleAuthProvider, GithubAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ─── Firebase singleton ───────────────────────────────────────────────────────
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

// ─── Auth guard: redirect logged-in users away from /login ───────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  const isEmailProvider = user.providerData.some(p => p.providerId === 'password');
  if (isEmailProvider && !user.emailVerified) {
    window.location.replace('/verify-email');
  } else {
    window.location.replace('/app');
  }
});

// ─── Disposable / fake email domain blocklist ─────────────────────────────────
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','throwaway.email','tempmail.com',
  'yopmail.com','sharklasers.com','guerrillamailblock.com','grr.la',
  'guerrillamail.info','guerrillamail.biz','guerrillamail.de','guerrillamail.net',
  'guerrillamail.org','spam4.me','trashmail.com','trashmail.at','trashmail.io',
  'trashmail.me','trashmail.net','trashmail.xyz','fakeinbox.com','maildrop.cc',
  'dispostable.com','mailnull.com','spamgourmet.com','spamgourmet.net',
  'spamgourmet.org','crap.la','mailexpire.com','spamfree24.org','spamfree24.de',
  'spamfree24.eu','spamfree24.info','spamfree24.com','yopmail.fr','cool.fr.nf',
  'jetable.fr.nf','nospam.ze.tc','nomail.xl.cx','mega.zik.dj','speed.1s.fr',
  'courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf','monmail.fr.nf',
  '10minutemail.com','10minutemail.net','10minutemail.org','10minutemail.co.uk',
  'throwam.com','temp-mail.org','tempemail.com','tempinbox.com','tempinbox.co.uk',
  'spamherelots.com','spamhereplease.com','spam.la','spam.nl','spam.su',
  'spamavert.com','spambox.us','spamcon.org','spamcorptastic.com','spamcowboy.com',
  'spamcowboy.net','spamcowboy.org','spamday.com','spamex.com','spamflorist.com',
  'spamfree.eu','spaml.com','spaml.de','spammotel.com','spamobox.com',
  'spamoff.de','spamslicer.com','spamsub.com','spamthisplease.com','spamtroll.net',
  'spamwc.de','spamzilla.com','spoofmail.de','temporaryemail.net',
  'temporaryforwarding.com','temporaryinbox.com','trash2009.com','trash2010.com',
  'trash2011.com','trash-mail.com','trashdevil.com','trashdevil.de','trashemail.de',
  'nwldx.com','odaymail.com','discard.email','discardmail.com','discardmail.de',
  'anonmails.de','anonymousemail.me','anonymous-email.net','anonymousmail.me',
  'bccto.me','binkmail.com','bugmenot.com','casualdx.com','chitthi.in',
  'clixser.com','courrieltemporaire.com','curryworld.de','dacoolest.com',
  'dayrep.com','dcemail.com','deadaddress.com','deadletter.ga','despam.it',
  'devnullmail.com','dispostable.com','dodgeit.com','dodgit.com','donemail.ru',
  'dontmail.net','dontreg.com','dontsendmespam.de','drdrb.net','dump-email.info',
  'dumpandfuck.com','dumpmail.de','dumpyemail.com','e4ward.com','emailias.com',
  'emailinfive.com','emailisvalid.com','emailmiser.com','emailsensei.com',
  'emailtemporario.com.br','emailto.de','emailwarden.com','emz.net','enterto.com',
  'ephemail.net','etranquil.com','etranquil.net','etranquil.org','explodemail.com',
  'eyepaste.com','fakeemail.de','fakeinformation.com','fakemail.fr','fastacura.com',
  'fastchevy.com','fastchrysler.com','fastnissan.com','fasttoyota.com','filzmail.com',
  'flyspam.com','footard.com','forgetmail.com','fr33mail.info','frapmail.com',
  'fudgerub.com','fux0ringduh.com','garliclife.com','gishpuppy.com','get1mail.com',
  'getonemail.com','ghosttexter.de','girlsundertheinfluence.com','gishpuppy.com',
  'gotmail.net','gotmail.org','gotti.otherinbox.com','grandmamail.com',
  'grapevinemail.com','great-host.in','greensloth.com','haltospam.com',
  'hatespam.org','herewego.asia','hidemail.de','hidzz.com','hochsitze.com',
  'hopemail.biz','hulapla.de','ieatspam.eu','ieatspam.info','ieh-mail.de',
  'inboxbear.com','inboxclean.com','inboxclean.org','inoutmail.de','inoutmail.eu',
  'inoutmail.info','inoutmail.net','insorg.org','insurer.com','internet-e-mail.de',
  'internet-mail.org','internetemails.net','internetmailing.net','ironiebehindert.de',
  'itaggz.com','itcompu.com','ivecombating.me','iwi.net','janewatson.org',
  'jetable.com','jetable.fr.nf','jetable.net','jetable.org','jnxjn.com',
  'junk1.tk','junkemail.com','junkmail.com','junkmail.ga','junkmail.gq',
]);

// ─── Validation helpers ───────────────────────────────────────────────────────
function hasVowel(s) { return /[aeiou]/i.test(s); }

function validateEmailAddress(email) {
  if (!email) return 'Adresse email requise';
  const t = email.trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,255}$/.test(t)) return 'Format email invalide';
  const atIdx = t.lastIndexOf('@');
  const local = t.slice(0, atIdx);
  const domain = t.slice(atIdx + 1);
  const dotIdx = domain.lastIndexOf('.');
  if (dotIdx < 1) return 'Format email invalide';
  const tld = domain.slice(dotIdx + 1);
  const domainName = domain.slice(0, dotIdx).replace(/\./g, '');
  // TLD suspiciously long (> 6 chars)
  if (tld.length > 6) return 'Extension email non reconnue (.com, .fr, .net…)';
  // Known disposable domains
  if (DISPOSABLE_DOMAINS.has(domain)) return 'Les adresses email jetables ne sont pas acceptées';
  // Random-string domain heuristic: no vowels and length ≥ 5
  if (domainName.length >= 5 && !hasVowel(domainName)) return 'Veuillez utiliser une adresse email valide (domaine suspect)';
  // Random-string local part heuristic: no vowels and length ≥ 8
  if (local.length >= 8 && !hasVowel(local)) return 'Veuillez utiliser une adresse email valide';
  return null; // valid
}

function validatePasswordStrength(pwd) {
  if (!pwd || pwd.length < 8) return 'Au moins 8 caractères requis';
  if (!/[A-Z]/.test(pwd)) return 'Au moins une majuscule requise (A-Z)';
  if (!/[a-z]/.test(pwd)) return 'Au moins une minuscule requise (a-z)';
  if (!/\d/.test(pwd)) return 'Au moins un chiffre requis (0-9)';
  if (!/[@$!%*?&]/.test(pwd)) return 'Au moins un caractère spécial requis (@$!%*?&)';
  return null; // valid
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
const form = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const passwordConfirmInput = document.getElementById('password-confirm');
const errorMessage = document.getElementById('error-message');
const notification = document.getElementById('notification');
const authToggleLink = document.getElementById('auth-toggle-link');
const authToggleText = document.getElementById('auth-toggle-text');
const emailHint = document.getElementById('email-hint');
const passwordHint = document.getElementById('password-hint');
const passwordConfirmHint = document.getElementById('password-confirm-hint');

let isRegister = false;

function showError(msg) { if (errorMessage) errorMessage.textContent = msg; }
function showNotification(msg, color = '#28a745') {
  if (!notification) return;
  notification.textContent = msg;
  notification.style.backgroundColor = color;
  notification.classList.add('show');
  setTimeout(() => notification.classList.remove('show'), 4000);
}
function setHint(el, msg, ok = false) {
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? '#10b981' : '#ff6b6b';
}

// ─── Real-time password requirements visual feedback ─────────────────────────
function updateReqItem(id, satisfied) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.color = satisfied ? '#10b981' : '#bbb';
  el.style.textDecoration = satisfied ? 'line-through' : 'none';
}

function refreshPasswordRequirements(pwd) {
  updateReqItem('req-length',  pwd.length >= 8);
  updateReqItem('req-upper',   /[A-Z]/.test(pwd));
  updateReqItem('req-lower',   /[a-z]/.test(pwd));
  updateReqItem('req-digit',   /\d/.test(pwd));
  updateReqItem('req-special', /[@$!%*?&]/.test(pwd));
}

if (passwordInput) {
  passwordInput.addEventListener('input', () => {
    if (isRegister) refreshPasswordRequirements(passwordInput.value);
  });
}

// ─── Form submit ──────────────────────────────────────────────────────────────
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    if (emailHint) emailHint.textContent = '';
    if (passwordHint) passwordHint.textContent = '';
    if (passwordConfirmHint) passwordConfirmHint.textContent = '';

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const submitButton = document.getElementById('submit-button');

    if (!email || !password) { showError('Veuillez renseigner vos identifiants'); return; }

    if (isRegister) {
      // ── Full validation on registration ──
      const emailErr = validateEmailAddress(email);
      if (emailErr) { setHint(emailHint, emailErr); return; }

      const pwdErr = validatePasswordStrength(password);
      if (pwdErr) { setHint(passwordHint, pwdErr); return; }

      const confirm = passwordConfirmInput ? passwordConfirmInput.value : '';
      if (password !== confirm) { setHint(passwordConfirmHint, 'Les mots de passe ne correspondent pas'); return; }
    } else {
      // ── Light validation on login (basic format only) ──
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setHint(emailHint, 'Format email invalide'); return; }
    }

    if (submitButton) { submitButton.textContent = isRegister ? 'Création…' : 'Connexion…'; submitButton.disabled = true; }

    try {
      if (!isRegister) {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('Connexion réussie — redirection…');
        // onAuthStateChanged handles redirect
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        showNotification('Compte créé ! Vérifiez votre boîte mail 📧', '#0070f3');
        setTimeout(() => window.location.replace('/verify-email'), 1800);
      }
    } catch (err) {
      console.error('Auth error', err);
      const code = err?.code || '';
      let msg = 'Une erreur est survenue. Réessayez.';
      if (code === 'auth/email-already-in-use')      msg = 'Cette adresse email est déjà utilisée.';
      else if (code === 'auth/invalid-email')         msg = 'Adresse email invalide.';
      else if (code === 'auth/user-not-found')        msg = 'Aucun compte trouvé avec cet email.';
      else if (code === 'auth/wrong-password')        msg = 'Mot de passe incorrect.';
      else if (code === 'auth/invalid-credential')    msg = 'Email ou mot de passe incorrect.';
      else if (code === 'auth/too-many-requests')     msg = 'Trop de tentatives. Réessayez dans quelques minutes.';
      else if (code === 'auth/weak-password')         msg = 'Mot de passe trop faible (min. 8 caractères).';
      else if (code === 'auth/network-request-failed') msg = 'Erreur réseau. Vérifiez votre connexion.';
      showError(msg);
      if (submitButton) { submitButton.textContent = isRegister ? 'Créer un compte' : 'Se connecter'; submitButton.disabled = false; }
    }
  });
}

// ─── Google sign-in ───────────────────────────────────────────────────────────
const googleBtn = document.getElementById('google-signin');
if (googleBtn) {
  googleBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showNotification('Connexion Google réussie — redirection…');
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/unauthorized-domain') {
        showError('Domaine non autorisé — vérifie les Authorized domains dans Firebase Console');
        return;
      }
      if (['auth/operation-not-supported-in-this-environment','auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(code)) {
        try { await signInWithRedirect(auth, provider); } catch (err2) { showError(err2.message || 'Erreur fallback Google'); }
        return;
      }
      showError(err.message || 'Erreur lors de la connexion Google');
    }
  });
}

// ─── GitHub sign-in ───────────────────────────────────────────────────────────
const githubBtn = document.getElementById('github-signin');
if (githubBtn) {
  githubBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const provider = new GithubAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showNotification('Connexion GitHub réussie — redirection…');
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/unauthorized-domain') {
        showError('Domaine non autorisé — vérifie les Authorized domains dans Firebase Console');
        return;
      }
      if (['auth/operation-not-supported-in-this-environment','auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(code)) {
        try { await signInWithRedirect(auth, provider); } catch (err2) { showError(err2.message || 'Erreur fallback GitHub'); }
        return;
      }
      showError(err.message || 'Erreur lors de la connexion GitHub');
    }
  });
}

// ─── Forgot password ──────────────────────────────────────────────────────────
const forgotLink = document.getElementById('forgot-password-link');
if (forgotLink) {
  forgotLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = emailInput ? emailInput.value.trim() : '';
    if (!email) {
      showError('Entrez votre email ci-dessus pour recevoir un lien de réinitialisation');
      return;
    }
    const fmtErr = validateEmailAddress(email);
    if (fmtErr) { setHint(emailHint, fmtErr); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      showNotification(`Email de réinitialisation envoyé à ${email} 📧`, '#0070f3');
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/user-not-found') { showError('Aucun compte trouvé avec cet email.'); }
      else { showError('Impossible d\'envoyer l\'email. Réessayez.'); }
    }
  });
}

// ─── Toggle login / register ──────────────────────────────────────────────────
if (authToggleLink) {
  authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isRegister = !isRegister;
    showError('');
    if (emailHint) emailHint.textContent = '';
    if (passwordHint) passwordHint.textContent = '';
    if (passwordConfirmHint) passwordConfirmHint.textContent = '';

    const titleEl = document.getElementById('auth-title');
    const submitEl = document.getElementById('submit-button');
    const passwordReqEl = document.getElementById('password-requirements');
    const passwordConfirmEl = document.getElementById('password-confirm-group');

    if (isRegister) {
      if (authToggleText) authToggleText.textContent = 'Vous avez déjà un compte ?';
      authToggleLink.textContent = 'Se connecter';
      if (titleEl) titleEl.textContent = 'Créer un compte';
      if (submitEl) submitEl.textContent = 'Créer un compte';
      if (passwordReqEl) passwordReqEl.style.display = 'block';
      if (passwordConfirmEl) passwordConfirmEl.style.display = 'block';
      if (emailInput) emailInput.placeholder = 'votre@email.com';
      if (passwordInput) { passwordInput.placeholder = 'Mot de passe sécurisé'; refreshPasswordRequirements(''); }
    } else {
      if (authToggleText) authToggleText.textContent = 'Pas encore de compte ?';
      authToggleLink.textContent = 'Créer un compte';
      if (titleEl) titleEl.textContent = 'Connexion';
      if (submitEl) submitEl.textContent = 'Se connecter';
      if (passwordReqEl) passwordReqEl.style.display = 'none';
      if (passwordConfirmEl) passwordConfirmEl.style.display = 'none';
      if (emailInput) emailInput.placeholder = 'Adresse e-mail';
      if (passwordInput) passwordInput.placeholder = 'Mot de passe';
    }
  });
}

// ─── Handle redirect results (Google / GitHub redirect fallback) ──────────────
(async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      showNotification('Connexion réussie — redirection…');
      // onAuthStateChanged will handle the redirect
    }
  } catch (err) {
    if (err?.code === 'auth/unauthorized-domain') {
      showError('Domaine non autorisé pour OAuth — vérifie Firebase Console');
    }
  }
})();

export default {};
