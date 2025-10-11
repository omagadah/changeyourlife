// Fichier : public/js/profile.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { setupTheme, setupUserPanel, updateGlobalAvatar } from './common.js';

const firebaseConfig = { apiKey: "AIzaSyCvEtaivyC5QD0dGyPKh97IgYU8U8QrrWg", authDomain: "changeyourlife-cc210.firebaseapp.com", projectId: "changeyourlife-cc210", storageBucket: "changeyourlife-cc210.appspot.com", messagingSenderId: "801720080785", appId: "1:801720080785:web:1a74aadba5755ea26c2230" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const avatarPreviewContainer = document.getElementById('avatar-preview-container');
const avatarControlsContainer = document.getElementById('avatar-controls-container');
const usernameInput = document.getElementById('username');
const titleInput = document.getElementById('profile-title');
const saveProfileButton = document.getElementById('save-profile-button');
const randomAvatarBtn = document.getElementById('random-avatar-btn');
const usernameDisplay = document.getElementById('username-display');
const titleDisplay = document.getElementById('title-display');

const avatarOptionsConfig = {
    topType: ['NoHair', 'Eyepatch', 'Hat', 'Hijab', 'Turban', 'WinterHat1', 'LongHairBigHair', 'LongHairBob', 'LongHairCurly', 'LongHairCurvy', 'LongHairDreads', 'LongHairFrida', 'LongHairFro', 'LongHairFroBand', 'LongHairNotTooLong', 'LongHairShavedSides', 'LongHairMiaWallace', 'LongHairStraight', 'LongHairStraight2', 'LongHairStraightStrand', 'ShortHairDreads01', 'ShortHairDreads02', 'ShortHairFrizzle', 'ShortHairShaggyMullet', 'ShortHairShortCurly', 'ShortHairShortFlat', 'ShortHairShortRound', 'ShortHairShortWaved', 'ShortHairSides', 'ShortHairTheCaesar', 'ShortHairTheCaesarSidePart'],
    hatColor: ['Black', 'Blue01', 'Blue02', 'Blue03', 'Gray01', 'Gray02', 'Heather', 'PastelBlue', 'PastelGreen', 'PastelOrange', 'PastelRed', 'PastelYellow', 'Pink', 'Red', 'White'],
    accessoriesType: ['Blank', 'Kurt', 'Prescription01', 'Prescription02', 'Round', 'Sunglasses', 'Wayfarers'],
    hairColor: ['Auburn', 'Black', 'Blonde', 'BlondeGolden', 'Brown', 'BrownDark', 'PastelPink', 'Platinum', 'Red', 'SilverGray'],
    facialHairType: ['Blank', 'BeardMedium', 'BeardLight', 'BeardMajestic', 'MoustacheFancy', 'MoustacheMagnum'],
    facialHairColor: ['Auburn', 'Black', 'Blonde', 'BlondeGolden', 'Brown', 'BrownDark', 'Platinum', 'Red'],
    clotheType: ['BlazerShirt', 'BlazerSweater', 'CollarSweater', 'GraphicShirt', 'Hoodie', 'Overall', 'ShirtCrewNeck', 'ShirtScoopNeck', 'ShirtVNeck'],
    clotheColor: ['Black', 'Blue01', 'Blue02', 'Blue03', 'Gray01', 'Gray02', 'Heather', 'PastelBlue', 'PastelGreen', 'PastelOrange', 'PastelRed', 'PastelYellow', 'Pink', 'Red', 'White'],
    eyeType: ['Close', 'Cry', 'Default', 'Dizzy', 'EyeRoll', 'Happy', 'Hearts', 'Side', 'Squint', 'Surprised', 'Wink', 'WinkWacky'],
    eyebrowType: ['Angry', 'AngryNatural', 'Default', 'DefaultNatural', 'FlatNatural', 'RaisedExcited', 'RaisedExcitedNatural', 'SadConcerned', 'SadConcernedNatural', 'UnibrowNatural', 'UpDown', 'UpDownNatural'],
    mouthType: ['Concerned', 'Default', 'Disbelief', 'Eating', 'Grimace', 'Sad', 'ScreamOpen', 'Serious', 'Smile', 'Tongue', 'Twinkle', 'Vomit'],
    skinColor: ['Tanned', 'Yellow', 'Pale', 'Light', 'Brown', 'DarkBrown', 'Black']
};

let currentUserData = {};

function generateAvatarUrl(options) { const params = new URLSearchParams(options); return `https://avataaars.io/?${params.toString()}`; }
function updateAvatarPreview() { if (!currentUserData.avatar) return; const url = generateAvatarUrl(currentUserData.avatar); avatarPreviewContainer.innerHTML = `<img src="${url}" alt="Avatar preview" style="width:100%; height:100%;">`; }

function populateAvatarControls() {
    avatarControlsContainer.innerHTML = '';
    for (const [key, values] of Object.entries(avatarOptionsConfig)) {
        const group = document.createElement('div'); group.className = 'control-group';
        const label = document.createElement('label'); label.textContent = key.replace(/([A-Z])/g, ' $1').trim();
        const select = document.createElement('select'); select.id = `select-${key}`;
        values.forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; select.appendChild(option); });
        select.addEventListener('change', (e) => { currentUserData.avatar[key] = e.target.value; updateAvatarPreview(); });
        group.appendChild(label); group.appendChild(select); avatarControlsContainer.appendChild(group);
    }
}

function randomizeAvatar() {
    for (const key of Object.keys(avatarOptionsConfig)) {
        const options = avatarOptionsConfig[key];
        currentUserData.avatar[key] = options[Math.floor(Math.random() * options.length)];
    }
    for (const [key, value] of Object.entries(currentUserData.avatar)) {
        const select = document.getElementById(`select-${key}`);
        if (select) select.value = value;
    }
    updateAvatarPreview();
}

async function loadUserData(userId, userDocRef) {
    const userDoc = await getDoc(userDocRef);
    const defaultAvatar = { topType: 'ShortHairShortFlat', accessoriesType: 'Blank', hairColor: 'BrownDark', facialHairType: 'Blank', clotheType: 'Hoodie', clotheColor: 'Gray01', eyeType: 'Default', eyebrowType: 'Default', mouthType: 'Smile', skinColor: 'Light' };

    if (userDoc.exists()) {
        const data = userDoc.data();
        currentUserData.username = data.username || '';
        currentUserData.title = data.title || '';
        currentUserData.avatar = { ...defaultAvatar, ...data.avatar };
        if (data.hasSeenProfileTutorial !== true) {
            setTimeout(() => startProfileTutorial(userDocRef), 500); // Léger délai pour être sûr que tout est chargé
        }
    } else {
        currentUserData.username = '';
        currentUserData.title = '';
        currentUserData.avatar = defaultAvatar;
        setTimeout(() => startProfileTutorial(userDocRef), 500);
    }

    usernameInput.value = currentUserData.username;
    titleInput.value = currentUserData.title;
    
    for (const [key, value] of Object.entries(currentUserData.avatar)) {
        const select = document.getElementById(`select-${key}`);
        if (select) select.value = value;
    }
    updateAvatarPreview();
    updateUserDisplay();
}

async function saveUserData(userId) {
    currentUserData.username = usernameInput.value;
    currentUserData.title = titleInput.value;
    const userDocRef = doc(db, "users", userId);
    try {
        await setDoc(userDocRef, { username: currentUserData.username, title: currentUserData.title, avatar: currentUserData.avatar }, { merge: true });
        localStorage.setItem('userAvatarUrl', generateAvatarUrl(currentUserData.avatar));
        updateUserDisplay();
        updateGlobalAvatar();
        alert('Profil mis à jour avec succès !');
    } catch (error) { console.error("Erreur de sauvegarde:", error); alert('Une erreur est survenue.'); }
}

function updateUserDisplay() {
    usernameDisplay.textContent = usernameInput.value || "Votre nom d'utilisateur";
    titleDisplay.textContent = titleInput.value || "Votre titre";
}

function startProfileTutorial(userDocRef) {
    const tour = new Shepherd.Tour({ useModalOverlay: true, defaultStepOptions: { classes: 'shepherd-element', scrollTo: { behavior: 'smooth', block: 'center' } } });
    tour.addStep({ title: 'Personnalisez votre Profil', text: 'Bienvenue ! Ici, vous pouvez créer un avatar unique qui vous représente.', attachTo: { element: '.avatar-creator', on: 'right' }, buttons: [{ action: tour.next, text: 'Suivant' }] });
    tour.addStep({ title: 'Changez de Look', text: 'Utilisez ces menus pour modifier chaque partie de votre avatar. L\'aperçu se met à jour en temps réel.', attachTo: { element: '.avatar-controls', on: 'right' }, buttons: [{ action: tour.back, text: 'Retour' }, { action: tour.next, text: 'Génial !' }] });
    tour.addStep({ title: 'Adaptez l\'Interface', text: 'Si vous rencontrez un problème d\'affichage, changez le thème ici. Votre choix sera sauvegardé sur tout le site.', attachTo: { element: '#theme-selector', on: 'bottom' }, highlightClass: 'shepherd-highlight-red', buttons: [{ action: tour.back, text: 'Retour' }, { action: tour.next, text: 'Compris !' }] });
    tour.addStep({ title: 'N\'oubliez pas de sauvegarder', text: 'Une fois que vous êtes satisfait, modifiez votre pseudo ou votre titre, puis cliquez ici pour tout enregistrer. Votre avatar remplacera l\'icône en haut à droite.', attachTo: { element: '.button-group', on: 'top' }, buttons: [{ action: tour.complete, text: 'Terminer' }] });

    const markTutorialAsSeen = () => setDoc(userDocRef, { hasSeenProfileTutorial: true }, { merge: true });
    tour.on('complete', markTutorialAsSeen);
    tour.on('cancel', markTutorialAsSeen);
    tour.start();
}

randomAvatarBtn.addEventListener('click', randomizeAvatar);
usernameInput.addEventListener('input', updateUserDisplay);
titleInput.addEventListener('input', updateUserDisplay);

onAuthStateChanged(auth, (user) => {
    if (user) {
        setupUserPanel(auth);
        setupTheme();
        updateGlobalAvatar((user.email || 'U').charAt(0).toUpperCase());
        
        const userDocRef = doc(db, "users", user.uid);
        populateAvatarControls();
        loadUserData(user.uid, userDocRef);
        saveProfileButton.addEventListener('click', () => saveUserData(user.uid));
    } else { window.location.href = '/login'; }
});