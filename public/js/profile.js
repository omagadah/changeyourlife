// Fichier : public/js/profile.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { setupThemeToggle, setupUserPanel, updateGlobalAvatar } from './common.js';

// Reuse singleton firebase init if present (inscription.js already creates window._cyfFirebase)
let app, auth, db;
if (window._cyfFirebase) {
    ({ app, auth, db } = window._cyfFirebase);
} else {
    const firebaseConfig = { apiKey: "AIzaSyCvEtaivyC5QD0dGyPKh97IgYU8U8QrrWg", authDomain: "changeyourlife-cc210.firebaseapp.com", projectId: "changeyourlife-cc210", storageBucket: "changeyourlife-cc210.appspot.com", messagingSenderId: "801720080785", appId: "1:801720080785:web:1a74aadba5755ea26c2230" };
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    window._cyfFirebase = { app, auth, db };
}

// DOM refs
const avatarPreviewContainer = document.getElementById('avatar-preview-container');
const avatarControlsContainer = document.getElementById('avatar-controls-container');
const usernameDisplay = document.getElementById('username-display');
const titleDisplay = document.getElementById('title-display');
const usernameInput = document.getElementById('username');
const profileTitleInput = document.getElementById('profile-title');
const saveProfileButton = document.getElementById('save-profile-button');
const randomAvatarBtn = document.getElementById('random-avatar-btn');

// Utility: generate a simple initial-based avatar as data URL
function generateInitialAvatar(initial = 'U', size = 256, bg = null, fg = '#ffffff') {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!bg) {
        // choose a pleasant random pastel
        const h = Math.floor(Math.random() * 360);
        bg = `hsl(${h} 60% 35%)`;
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.floor(size * 0.45)}px "Segoe UI", Roboto, Arial`;
    ctx.fillText((initial || 'U').charAt(0).toUpperCase(), size / 2, size / 2 + 4);
    return canvas.toDataURL('image/png');
}

function showAvatar(dataUrl) {
    if (!avatarPreviewContainer) return;
    avatarPreviewContainer.innerHTML = '';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = 'Avatar';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '50%';
    avatarPreviewContainer.appendChild(img);
}

function populateAvatarControls() {
    if (!avatarControlsContainer) return;
    avatarControlsContainer.innerHTML = `
        <div class="control-group">
            <label>Télécharger un avatar</label>
            <input type="file" id="avatar-file-input" accept="image/*">
        </div>
        <div class="control-group">
            <label>Générer à partir d'une initiale</label>
            <div style="display:flex;gap:8px;align-items:center">
                <input id="avatar-initial-input" placeholder="A" style="padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);width:60px;text-align:center">
                <button id="generate-initial-avatar" class="random-btn">Générer</button>
            </div>
        </div>
    `;

    const fileInput = document.getElementById('avatar-file-input');
    const generateBtn = document.getElementById('generate-initial-avatar');
    const initialInput = document.getElementById('avatar-initial-input');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                localStorage.setItem('userAvatarUrl', dataUrl);
                showAvatar(dataUrl);
                updateGlobalAvatar('');
            };
            reader.readAsDataURL(file);
        });
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const initial = initialInput.value.trim() || (usernameInput.value.trim().charAt(0) || 'U');
            const dataUrl = generateInitialAvatar(initial, 256);
            localStorage.setItem('userAvatarUrl', dataUrl);
            showAvatar(dataUrl);
            updateGlobalAvatar(initial.charAt(0).toUpperCase());
        });
    }
}

async function loadUserData(uid, userDocRef) {
    try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
            const data = snap.data();
            usernameInput.value = data.displayName || '';
            profileTitleInput.value = data.profileTitle || '';
            usernameDisplay.textContent = data.displayName || '';
            titleDisplay.textContent = data.profileTitle || '';
            const avatarUrl = data.avatarUrl || localStorage.getItem('userAvatarUrl');
            if (avatarUrl) {
                showAvatar(avatarUrl);
                updateGlobalAvatar((data.displayName || '').charAt(0).toUpperCase() || (data.email || 'U').charAt(0).toUpperCase());
            }
        } else {
            // fallback to localStorage
            const avatarUrl = localStorage.getItem('userAvatarUrl');
            if (avatarUrl) showAvatar(avatarUrl);
        }
    } catch (err) {
        console.error('loadUserData error', err);
    }
}

async function saveUserData(uid) {
    if (!usernameInput || !profileTitleInput) return;
    const displayName = usernameInput.value.trim();
    const profileTitle = profileTitleInput.value.trim().substring(0, 12);
    const avatarUrl = localStorage.getItem('userAvatarUrl') || null;
    const userDocRef = doc(db, 'users', uid);
    try {
        await setDoc(userDocRef, { displayName, profileTitle, avatarUrl }, { merge: true });
        usernameDisplay.textContent = displayName;
        titleDisplay.textContent = profileTitle;
        showAvatar(avatarUrl || generateInitialAvatar(displayName.charAt(0) || 'U'));
        // update global avatar
        updateGlobalAvatar((displayName || 'U').charAt(0).toUpperCase());
    } catch (err) {
        console.error('saveUserData error', err);
    }
}

// Random avatar quick action
if (randomAvatarBtn) {
    randomAvatarBtn.addEventListener('click', () => {
        const initial = (usernameInput && usernameInput.value.trim().charAt(0)) || 'U';
        const dataUrl = generateInitialAvatar(initial || 'U', 256);
        localStorage.setItem('userAvatarUrl', dataUrl);
        showAvatar(dataUrl);
        updateGlobalAvatar(initial.toUpperCase());
    });
}

// Auth guard and wiring
onAuthStateChanged(auth, (user) => {
    if (user) {
        setupUserPanel(auth);
        setupThemeToggle();
        updateGlobalAvatar((user.email || 'U').charAt(0).toUpperCase());

        const userDocRef = doc(db, 'users', user.uid);
        populateAvatarControls();
        loadUserData(user.uid, userDocRef);
        if (saveProfileButton) saveProfileButton.addEventListener('click', () => saveUserData(user.uid));
    } else {
        window.location.href = '/login';
    }
});