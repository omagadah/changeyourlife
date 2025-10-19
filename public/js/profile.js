// Fichier : public/js/profile.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { setupThemeToggle, updateGlobalAvatar } from './common.js';
import { initUserMenu } from './userMenu.js';

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
let functions;
try { functions = getFunctions(app); } catch (e) { /* optional */ }

// DOM refs
const avatarPreviewContainer = document.getElementById('avatar-preview-container');
const usernameDisplay = document.getElementById('username-display');
const titleDisplay = document.getElementById('title-display');
const usernameInput = document.getElementById('username');
const profileTitleInput = document.getElementById('profile-title');
const saveProfileButton = document.getElementById('save-profile-button');
const randomAvatarBtn = document.getElementById('random-avatar-btn');
const fileInputEl = document.getElementById('avatar-file-input');
const initialInputEl = document.getElementById('avatar-initial-input');
const generateInitialBtn = document.getElementById('generate-initial-avatar');
const themeLabel = document.getElementById('theme-label');
const animToggle = document.getElementById('anim-toggle');
const animLabel = document.getElementById('anim-label');
const emailNotToggle = document.getElementById('emailnot-toggle');
const emailNotLabel = document.getElementById('emailnot-label');
const playerIdEl = document.getElementById('player-id');
const bioInput = document.getElementById('profile-bio');
const websiteInput = document.getElementById('profile-website');
const emailReadOnly = document.getElementById('profile-email');
const toastEl = document.getElementById('toast');
const themeDarkBtn = document.getElementById('theme-dark-btn');
const themeLightBtn = document.getElementById('theme-light-btn');
// Levels bars
const lvlEls = {
    body: { bar: document.getElementById('lvl-body'), label: document.getElementById('lvl-body-label') },
    mind: { bar: document.getElementById('lvl-mind'), label: document.getElementById('lvl-mind-label') },
    heart: { bar: document.getElementById('lvl-heart'), label: document.getElementById('lvl-heart-label') },
    order: { bar: document.getElementById('lvl-order'), label: document.getElementById('lvl-order-label') },
};

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

function wireAvatarInputs() {
    if (fileInputEl) {
        fileInputEl.addEventListener('change', (e) => {
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
    if (generateInitialBtn) {
        generateInitialBtn.addEventListener('click', () => {
            const initial = (initialInputEl && initialInputEl.value.trim()) || (usernameInput.value.trim().charAt(0) || 'U');
            const dataUrl = generateInitialAvatar(initial, 256);
            localStorage.setItem('userAvatarUrl', dataUrl);
            showAvatar(dataUrl);
            updateGlobalAvatar(initial.charAt(0).toUpperCase());
        });
    }
}

function defaultLevels() {
    return {
        body: { level: 0, xp: 0, nextXp: 100 },
        mind: { level: 0, xp: 0, nextXp: 100 },
        heart: { level: 0, xp: 0, nextXp: 100 },
        order: { level: 0, xp: 0, nextXp: 100 },
    };
}

function renderLevels(levels) {
    const l = levels || defaultLevels();
    for (const key of Object.keys(lvlEls)) {
        const cfg = l[key] || { level: 0, xp: 0, nextXp: 100 };
        const pct = Math.max(0, Math.min(100, Math.round((cfg.xp / Math.max(1, cfg.nextXp)) * 100)));
        if (lvlEls[key].bar) lvlEls[key].bar.style.width = pct + '%';
        if (lvlEls[key].label) lvlEls[key].label.textContent = `Niv. ${cfg.level} · ${cfg.xp} XP`;
    }
}

function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => { toastEl.classList.remove('show'); }, 2000);
}

async function loadUserData(uid, userDocRef, user) {
    try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
            const data = snap.data();
            usernameInput.value = data.displayName || '';
            profileTitleInput.value = data.profileTitle || '';
            usernameDisplay.textContent = data.displayName || '';
            titleDisplay.textContent = data.profileTitle || '';
            if (bioInput) bioInput.value = data.bio || '';
            if (websiteInput) websiteInput.value = data.website || '';
            const avatarUrl = data.avatarUrl || localStorage.getItem('userAvatarUrl');
            if (avatarUrl) {
                showAvatar(avatarUrl);
                updateGlobalAvatar((data.displayName || '').charAt(0).toUpperCase() || (data.email || 'U').charAt(0).toUpperCase());
            }
            // preferences
            const prefs = data.prefs || {};
            const animOn = prefs.animEnabled !== false; // default true
            const weekly = prefs.weeklyEmails === true; // default false
            if (animLabel) animLabel.textContent = animOn ? 'Actives' : 'Coupées';
            if (emailNotLabel) emailNotLabel.textContent = weekly ? 'Activés' : 'Désactivés';
            // theme label (from storage or prefs)
            const theme = localStorage.getItem('theme') || prefs.theme || 'dark';
            if (themeLabel) themeLabel.textContent = theme === 'light' ? 'Clair' : 'Sombre';
            // levels
            renderLevels(data.levels || defaultLevels());
        } else {
            // fallback to localStorage
            const avatarUrl = localStorage.getItem('userAvatarUrl');
            if (avatarUrl) showAvatar(avatarUrl);
            renderLevels(defaultLevels());
        }
        if (emailReadOnly && user?.email) emailReadOnly.value = user.email;
        if (playerIdEl && uid) playerIdEl.textContent = 'Player #' + uid.slice(-6).toUpperCase();
    } catch (err) {
        console.error('loadUserData error', err);
    }
}

async function saveUserData(uid) {
    if (!usernameInput || !profileTitleInput) return;
    const displayName = usernameInput.value.trim();
    const profileTitle = profileTitleInput.value.trim().substring(0, 12);
    const avatarUrl = localStorage.getItem('userAvatarUrl') || null;
    const bio = (bioInput && bioInput.value.trim()) || '';
    const website = (websiteInput && websiteInput.value.trim()) || '';
    const prefs = {
        theme: localStorage.getItem('theme') || 'dark',
        animEnabled: (animLabel && animLabel.textContent === 'Actives') ? true : false,
        weeklyEmails: (emailNotLabel && emailNotLabel.textContent === 'Activés') ? true : false,
    };
    const userDocRef = doc(db, 'users', uid);
    try {
        await setDoc(userDocRef, { displayName, profileTitle, avatarUrl, bio, website, prefs }, { merge: true });
        usernameDisplay.textContent = displayName;
        titleDisplay.textContent = profileTitle;
        showAvatar(avatarUrl || generateInitialAvatar(displayName.charAt(0) || 'U'));
        // update global avatar
        updateGlobalAvatar((displayName || 'U').charAt(0).toUpperCase());
        showToast('Profil mis à jour');
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
        initUserMenu();
        setupThemeToggle();
        // reflect theme in label
        const t = localStorage.getItem('theme') || 'dark';
        if (themeLabel) themeLabel.textContent = t === 'light' ? 'Clair' : 'Sombre';
        updateGlobalAvatar((user.email || 'U').charAt(0).toUpperCase());

        const userDocRef = doc(db, 'users', user.uid);
        wireAvatarInputs();
        loadUserData(user.uid, userDocRef, user);
        if (saveProfileButton) saveProfileButton.addEventListener('click', () => saveUserData(user.uid));

        // Tabs behavior
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            const section = document.getElementById('tab-' + target);
            if (section) section.classList.add('active');
        }));

        // Preferences toggles
        if (animToggle && animLabel) {
            animToggle.addEventListener('click', async () => {
                const nowActive = animLabel.textContent === 'Actives' ? false : true;
                animLabel.textContent = nowActive ? 'Actives' : 'Coupées';
                try { await setDoc(userDocRef, { prefs: { animEnabled: nowActive } }, { merge: true }); } catch(e) {}
            });
        }
        if (emailNotToggle && emailNotLabel) {
            emailNotToggle.addEventListener('click', async () => {
                const nowActive = emailNotLabel.textContent === 'Activés' ? false : true;
                emailNotLabel.textContent = nowActive ? 'Activés' : 'Désactivés';
                try { await setDoc(userDocRef, { prefs: { weeklyEmails: nowActive } }, { merge: true }); } catch(e) {}
            });
        }

        // Dev XP buttons (only show on localhost or if ?dev=1)
        const isDev = ["127.0.0.1","localhost"].includes(location.hostname) || /[?&]dev=1(&|$)/.test(location.search);
        if (isDev) {
            const note = document.getElementById('dev-note'); if (note) note.style.display = 'block';
            ['body','mind','heart','order'].forEach(domain => {
                const row = document.getElementById('dev-' + domain);
                if (row) {
                    row.style.display = 'flex';
                    const btn = row.querySelector('button[data-xp-domain]');
                    if (btn) btn.addEventListener('click', async () => {
                        try {
                            if (functions) {
                                const addXp = httpsCallable(functions, 'addXp');
                                await addXp({ domain, amount: 10 });
                            } else {
                                // fallback local transaction (dev only)
                                await runTransaction(db, async (tx) => {
                                    const ref = doc(db, 'users', user.uid);
                                    const snap = await tx.get(ref);
                                    const data = snap.exists() ? snap.data() : {};
                                    const levels = data.levels || defaultLevels();
                                    const cur = levels[domain] || { level:0, xp:0, nextXp:100 };
                                    let xp = cur.xp + 10, level = cur.level, nextXp = cur.nextXp || 100;
                                    while (xp >= nextXp) { xp -= nextXp; level += 1; nextXp = 100 + 20 * level; }
                                    levels[domain] = { level, xp, nextXp };
                                    tx.set(ref, { levels }, { merge: true });
                                });
                            }
                            // Reload view
                            const updated = await getDoc(doc(db, 'users', user.uid));
                            if (updated.exists()) renderLevels(updated.data().levels);
                            showToast('+10 XP ajouté à ' + domain);
                        } catch (e) {
                            console.error('dev addXp failed', e);
                            showToast('Erreur addXp');
                        }
                    });
                }
            });
        }
        // Theme label + persist preference when toggling
        if (themeDarkBtn) themeDarkBtn.addEventListener('click', async () => {
            if (themeLabel) themeLabel.textContent = 'Sombre';
            try { await setDoc(userDocRef, { prefs: { theme: 'dark' } }, { merge: true }); } catch(e) {}
        });
        if (themeLightBtn) themeLightBtn.addEventListener('click', async () => {
            if (themeLabel) themeLabel.textContent = 'Clair';
            try { await setDoc(userDocRef, { prefs: { theme: 'light' } }, { merge: true }); } catch(e) {}
        });
    } else {
        window.location.href = '/login';
    }
});