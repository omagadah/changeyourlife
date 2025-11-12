// Modules Firebase nécessaires
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Initialisation Firebase
let app, auth, db;
if (!window._cyfFirebase) {
    const firebaseConfig = {
        apiKey: "AIzaSyCvEtaivyC5QD0dGyPKh97IgYU8U8QrrWg",
        authDomain: "changeyourlife-cc210.firebaseapp.com",
        projectId: "changeyourlife-cc210",
        storageBucket: "changeyourlife-cc210.appspot.com",
        messagingSenderId: "801720080785",
        appId: "1:801720080785:web:1a74aadba5755ea26c2230"
    };
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    window._cyfFirebase = { app, auth, db };
} else {
    ({ app, auth, db } = window._cyfFirebase);
}

// Éléments du DOM
const entriesList = document.getElementById('entries');
const startEntryBtn = document.getElementById('start-entry');
const entryEditor = document.getElementById('entry-editor');
const closeEditorBtn = document.getElementById('close-editor');
const entryContent = document.getElementById('entry-content');
const saveEntryBtn = document.getElementById('save-entry');
const cancelEntryBtn = document.getElementById('cancel-entry');
const emotionBtns = document.querySelectorAll('.emotion-btn');

let selectedEmotion = null;
let currentUser = null;

// Écouteur d'authentification
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        loadEntries();
    } else {
        window.location.href = '/login';
    }
});

// Gérer les émotions
emotionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        emotionBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedEmotion = btn.dataset.emotion;
    });
});

// Ouvrir l'éditeur
startEntryBtn.addEventListener('click', () => {
    entryEditor.style.display = 'block';
    entryContent.focus();
});

// Fermer l'éditeur
[closeEditorBtn, cancelEntryBtn].forEach(btn => {
    btn.addEventListener('click', () => {
        entryEditor.style.display = 'none';
        entryContent.value = '';
        selectedEmotion = null;
        emotionBtns.forEach(btn => btn.classList.remove('selected'));
    });
});

// Sauvegarder une entrée
saveEntryBtn.addEventListener('click', async () => {
    if (!entryContent.value.trim()) {
        alert('Veuillez écrire quelque chose avant de sauvegarder.');
        return;
    }

    const content = entryContent.value.trim();
    
    try {
        // Créer l'entrée dans Firestore
        const entry = {
            content,
            emotion: selectedEmotion || 'neutral',
            timestamp: new Date().toISOString(),
            userId: currentUser.uid
        };

        // Appel à l'API GenAI pour l'analyse (à implémenter)
        const aiInsight = await analyzeEntry(content);
        if (aiInsight) {
            entry.aiInsight = aiInsight;
        }

        await addDoc(collection(db, 'users', currentUser.uid, 'journal'), entry);

        // Réinitialiser l'éditeur
        entryContent.value = '';
        selectedEmotion = null;
        emotionBtns.forEach(btn => btn.classList.remove('selected'));
        entryEditor.style.display = 'none';

        // Recharger les entrées
        loadEntries();

    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        alert('Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.');
    }
});

// Charger les entrées
async function loadEntries() {
    try {
        const entriesQuery = query(
            collection(db, 'users', currentUser.uid, 'journal'),
            orderBy('timestamp', 'desc')
        );

        const snapshot = await getDocs(entriesQuery);
        
        entriesList.innerHTML = ''; // Vider la liste

        snapshot.forEach(doc => {
            const entry = doc.data();
            const date = new Date(entry.timestamp);
            
            const entryElement = document.createElement('div');
            entryElement.className = 'entry-card';
            entryElement.innerHTML = `
                <div class="entry-header">
                    <span class="entry-date">${formatDate(date)}</span>
                    <div class="mood-indicator">
                        <span class="mood-emoji">${getEmotionEmoji(entry.emotion)}</span>
                        <span>${capitalizeFirst(entry.emotion)}</span>
                    </div>
                </div>
                <div class="entry-content">
                    ${marked.parse(entry.content)}
                </div>
                ${entry.aiInsight ? `
                    <div class="ai-insight">
                        <strong>💡 Analyse IA:</strong><br>
                        ${entry.aiInsight}
                    </div>
                ` : ''}
            `;

            entriesList.appendChild(entryElement);
        });

    } catch (error) {
        console.error('Erreur lors du chargement des entrées:', error);
    }
}

// Utilitaires
function formatDate(date) {
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function getEmotionEmoji(emotion) {
    const emojis = {
        joy: '😊',
        calm: '😌',
        grateful: '🙏',
        worried: '😟',
        sad: '😢',
        angry: '😠',
        neutral: '😐'
    };
    return emojis[emotion] || '😐';
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Fonction d'analyse IA (à implémenter avec l'API appropriée)
async function analyzeEntry(content) {
    // TODO: Implémenter l'analyse avec l'API GenAI
    return "Cette entrée reflète un état d'esprit positif avec une tendance à l'introspection. Continuez à explorer vos pensées et émotions de cette manière.";
}