import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, GithubAuthProvider, sendPasswordResetEmail, getAdditionalUserInfo } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCvEtaivyC5QD0dGyPKh97IgYU8U8QrrWg", authDomain: "changeyourlife-cc210.firebaseapp.com", projectId: "changeyourlife-cc210", storageBucket: "changeyourlife-cc210.appspot.com", messagingSenderId: "801720080785", appId: "1:801720080785:web:1a74aadba5755ea26c2230" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const authForm = document.getElementById('auth-form'), emailInput = document.getElementById('email'), passwordInput = document.getElementById('password'), errorMessage = document.getElementById('error-message'), googleButton = document.getElementById('google-signin'), githubButton = document.getElementById('github-signin'), forgotPasswordLink = document.getElementById('forgot-password-link'), authTitle = document.getElementById('auth-title'), submitButton = document.getElementById('submit-button'), authToggleText = document.getElementById('auth-toggle-text'), authToggleLink = document.getElementById('auth-toggle-link'), notification = document.getElementById('notification');
let isLoginMode = true;

const clearError = () => errorMessage.textContent = '';
const displayError = (message) => errorMessage.textContent = message;
function showNotification(message, duration = 2000) { notification.textContent = message; notification.classList.add('show'); setTimeout(() => { notification.classList.remove('show'); }, duration + 500); }
function updateAuthView() {
    clearError();
    if (isLoginMode) {
        authTitle.textContent = 'Connexion';
        submitButton.textContent = 'Se connecter';
        authToggleText.textContent = 'Pas encore de compte ?';
        authToggleLink.textContent = 'Créer un compte';
        authToggleLink.classList.add('highlight-link');
        forgotPasswordLink.style.display = 'inline';
        passwordInput.autocomplete = 'current-password';
    } else {
        authTitle.textContent = 'Créer un compte';
        submitButton.textContent = 'S\'inscrire';
        authToggleText.textContent = 'Déjà un compte ?';
        authToggleLink.textContent = 'Se connecter';
        authToggleLink.classList.remove('highlight-link');
        forgotPasswordLink.style.display = 'none';
        passwordInput.autocomplete = 'new-password';
    }
}
updateAuthView();

authToggleLink.addEventListener('click', (e) => { e.preventDefault(); isLoginMode = !isLoginMode; updateAuthView(); });

async function createUserProfile(user) {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, { email: user.email, createdAt: new Date(), hasSeenTutorial: false, hasSeenProfileTutorial: false });
}

authForm.addEventListener('submit', (e) => {
    e.preventDefault(); clearError();
    const email = emailInput.value; const password = passwordInput.value;
    if (isLoginMode) {
        signInWithEmailAndPassword(auth, email, password)
            .then(userCredential => { showNotification(`Content de vous revoir, ${userCredential.user.email}.`); setTimeout(() => { window.location.href = '/app'; }, 2000); })
            .catch(error => { displayError("Email ou mot de passe incorrect."); });
    } else {
        createUserWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => {
                await createUserProfile(userCredential.user);
                showNotification(`Félicitations ! Bienvenue, ${userCredential.user.email}.`);
                setTimeout(() => { window.location.href = '/app'; }, 2000); 
            })
            .catch(error => {
                if (error.code === 'auth/email-already-in-use') displayError('Cette adresse e-mail est déjà utilisée.');
                else if (error.code === 'auth/weak-password') displayError('Le mot de passe doit contenir au moins 6 caractères.');
                else displayError("Une erreur est survenue.");
            });
    }
});

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();
const handleSocialSignIn = (provider) => {
    clearError();
    signInWithPopup(auth, provider)
        .then(async (result) => {
            if (getAdditionalUserInfo(result).isNewUser) {
                await createUserProfile(result.user);
            }
            showNotification(`Bienvenue, ${result.user.displayName || result.user.email}.`);
            setTimeout(() => { window.location.href = '/app'; }, 2000);
        })
        .catch((error) => {
            if (error.code === 'auth/account-exists-with-different-credential') { displayError('Cet e-mail est déjà utilisé avec une autre méthode de connexion.'); }
            else { displayError("La connexion a échoué. Veuillez réessayer."); }
        });
};
googleButton.addEventListener('click', () => handleSocialSignIn(googleProvider));
githubButton.addEventListener('click', () => handleSocialSignIn(githubProvider));
forgotPasswordLink.addEventListener('click', (e) => { e.preventDefault(); clearError(); const email = prompt("Veuillez entrer votre adresse e-mail pour réinitialiser le mot de passe :"); if (email) { sendPasswordResetEmail(auth, email).then(() => alert("Un e-mail de réinitialisation a été envoyé.")).catch((error) => { displayError("Impossible d'envoyer l'e-mail."); }); } });