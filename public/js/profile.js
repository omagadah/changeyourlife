import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCvEtaivyC5QD0dGyPKh97IgYU8U8QrrWg", authDomain: "changeyourlife-cc210.firebaseapp.com", projectId: "changeyourlife-cc210", storageBucket: "changeyourlife-cc210.appspot.com", messagingSenderId: "801720080785", appId: "1:801720080785:web:1a74aadba5755ea26c2230" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const avatarPreviewContainer = document.getElementById('avatar-preview-container');
const avatarControlsContainer = document.getElementById('avatar-controls-container');
const usernameInput = document.getElementById('username');
const bioInput = document.getElementById('bio');
const saveProfileButton = document.getElementById('save-profile-button');
const userPanelTrigger = document.querySelector('.user-panel-trigger');
const userPanel = document.getElementById('user-panel');
const panelLogoutButton = document.getElementById('panel-logout-button');

const avatarOptionsConfig = {
    topType: ['NoHair', 'Eyepatch', 'Hat', 'Hijab', 'Turban', 'WinterHat1', 'LongHairBigHair', 'LongHairBob', 'LongHairCurly', 'LongHairCurvy', 'LongHairDreads', 'LongHairFrida', 'LongHairFro', 'LongHairFroBand', 'LongHairNotTooLong', 'LongHairShavedSides', 'LongHairMiaWallace', 'LongHairStraight', 'LongHairStraight2', 'LongHairStraightStrand', 'ShortHairDreads01', 'ShortHairDreads02', 'ShortHairFrizzle', 'ShortHairShaggyMullet', 'ShortHairShortCurly', 'ShortHairShortFlat', 'ShortHairShortRound', 'ShortHairShortWaved', 'ShortHairSides', 'ShortHairTheCaesar', 'ShortHairTheCaesarSidePart'],
    accessoriesType: ['Blank', 'Kurt', 'Prescription01', 'Prescription02', 'Round', 'Sunglasses', 'Wayfarers'],
    hairColor: ['Auburn', 'Black', 'Blonde', 'BlondeGolden', 'Brown', 'BrownDark', 'PastelPink', 'Platinum', 'Red', 'SilverGray'],
    facialHairType: ['Blank', 'BeardMedium', 'BeardLight', 'BeardMajestic', 'MoustacheFancy', 'MoustacheMagnum'],
    clotheType: ['BlazerShirt', 'BlazerSweater', 'CollarSweater', 'GraphicShirt', 'Hoodie', 'Overall', 'ShirtCrewNeck', 'ShirtScoopNeck', 'ShirtVNeck'],
    eyeType: ['Close', 'Cry', 'Default', 'Dizzy', 'EyeRoll', 'Happy', 'Hearts', 'Side', 'Squint', 'Surprised', 'Wink', 'WinkWacky'],
    eyebrowType: ['Angry', 'AngryNatural', 'Default', 'DefaultNatural', 'FlatNatural', 'RaisedExcited', 'RaisedExcitedNatural', 'SadConcerned', 'SadConcernedNatural', 'UnibrowNatural', 'UpDown', 'UpDownNatural'],
    mouthType: ['Concerned', 'Default', 'Disbelief', 'Eating', 'Grimace', 'Sad', 'ScreamOpen', 'Serious', 'Smile', 'Tongue', 'Twinkle', 'Vomit'],
    skinColor: ['Tanned', 'Yellow', 'Pale', 'Light', 'Brown', 'DarkBrown', 'Black']
};

let currentUserData = {};

function generateAvatarUrl(options) {
    const params = new URLSearchParams(options);
    return `https://avataaars.io/?${params.toString()}`;
}

function updateAvatarPreview() {
    if (!currentUserData.avatar) return;
    const url = generateAvatarUrl(currentUserData.avatar);
    avatarPreviewContainer.innerHTML = `<img src="${url}" alt="Avatar preview" style="width:100%; height:100%;">`;
}

function populateAvatarControls() {
    avatarControlsContainer.innerHTML = '';
    for (const [key, values] of Object.entries(avatarOptionsConfig)) {
        const group = document.createElement('div');
        group.className = 'control-group';
        const label = document.createElement('label');
        label.textContent = key.replace(/([A-Z])/g, ' $1').trim();
        label.htmlFor = `select-${key}`;
        const select = document.createElement('select');
        select.id = `select-${key}`;
        select.dataset.option = key;
        values.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
        select.addEventListener('change', (e) => {
            currentUserData.avatar[key] = e.target.value;
            updateAvatarPreview();
        });
        group.appendChild(label);
        group.appendChild(select);
        avatarControlsContainer.appendChild(group);
    }
}

async function loadUserData(userId) {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    const defaultAvatar = { topType: 'ShortHairShortFlat', accessoriesType: 'Blank', hairColor: 'BrownDark', facialHairType: 'Blank', clotheType: 'Hoodie', eyeType: 'Default', eyebrowType: 'Default', mouthType: 'Smile', skinColor: 'Light' };

    if (userDoc.exists()) {
        const data = userDoc.data();
        currentUserData.username = data.username || '';
        currentUserData.bio = data.bio || '';
        currentUserData.avatar = data.avatar || defaultAvatar;
    } else {
        currentUserData.avatar = defaultAvatar;
    }
    usernameInput.value = currentUserData.username;
    bioInput.value = currentUserData.bio;
    
    for (const [key, value] of Object.entries(currentUserData.avatar)) {
        const select = document.getElementById(`select-${key}`);
        if (select) select.value = value;
    }
    updateAvatarPreview();
}

async function saveUserData(userId) {
    currentUserData.username = usernameInput.value;
    currentUserData.bio = bioInput.value;
    const userDocRef = doc(db, "users", userId);
    try {
        await setDoc(userDocRef, {
            username: currentUserData.username,
            bio: currentUserData.bio,
            avatar: currentUserData.avatar
        }, { merge: true });
        alert('Profil mis à jour avec succès !');
    } catch (error) {
        console.error("Erreur lors de la sauvegarde du profil:", error);
        alert('Une erreur est survenue.');
    }
}

userPanelTrigger.addEventListener('click', (event) => { event.stopPropagation(); userPanel.classList.toggle('active'); });
window.addEventListener('click', () => { if (userPanel.classList.contains('active')) { userPanel.classList.remove('active'); } });
panelLogoutButton.addEventListener('click', (e) => { e.preventDefault(); signOut(auth).catch(error => console.error("Erreur de déconnexion:", error)); });

onAuthStateChanged(auth, (user) => {
    if (user) {
        userPanelTrigger.textContent = (user.email || 'U').charAt(0).toUpperCase();
        populateAvatarControls();
        loadUserData(user.uid);
        saveProfileButton.addEventListener('click', () => saveUserData(user.uid));
    } else {
        window.location.href = '/login';
    }
});