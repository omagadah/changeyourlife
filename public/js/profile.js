// Fichier : public/js/profile.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { setupThemeToggle, setupUserPanel, updateGlobalAvatar } from './common.js';

// ... (Le reste de votre code profile.js existant : firebaseConfig, app, auth, db, les éléments du DOM, avatarOptionsConfig, etc. est PARFAIT. Collez-le ici SANS CHANGEMENT)

// La seule modification est à la fin du fichier :

onAuthStateChanged(auth, (user) => {
    if (user) {
        // --- NOUVELLE FAÇON DE FAIRE ---
        setupUserPanel(auth);
        setupThemeToggle();
        updateGlobalAvatar((user.email || 'U').charAt(0).toUpperCase());
        
        const userDocRef = doc(db, "users", user.uid);
        populateAvatarControls();
        loadUserData(user.uid, userDocRef);
        saveProfileButton.addEventListener('click', () => saveUserData(user.uid));
    } else { window.location.href = '/login'; }
});