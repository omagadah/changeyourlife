// Fichier : public/js/common.js

/**
 * Applique le thème sauvegardé au chargement initial de la page.
 * À appeler dans une balise <script> dans le <head> pour éviter le "flash".
 */
export function applyInitialTheme() {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
    }
}

/**
 * Initialise les boutons du sélecteur de thème.
 */
export function setupThemeToggle() {
    const darkBtn = document.getElementById('theme-dark-btn');
    const lightBtn = document.getElementById('theme-light-btn');

    if (!darkBtn || !lightBtn) return;

    function setTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            lightBtn.classList.add('active');
            darkBtn.classList.remove('active');
        } else {
            document.body.classList.remove('light-mode');
            darkBtn.classList.add('active');
            lightBtn.classList.remove('active');
        }
    }

    darkBtn.addEventListener('click', () => { localStorage.setItem('theme', 'dark'); setTheme('dark'); });
    lightBtn.addEventListener('click', () => { localStorage.setItem('theme', 'light'); setTheme('light'); });

    // Initialise l'état des boutons
    setTheme(localStorage.getItem('theme') || 'dark');
}

/**
 * Gère l'ouverture/fermeture du panel utilisateur et la déconnexion.
 * @param {object} auth - L'instance d'authentification Firebase.
 */
export function setupUserPanel(auth) {
    const userPanelTrigger = document.querySelector('.user-panel-trigger');
    const userPanel = document.getElementById('user-panel');
    const panelLogoutButton = document.getElementById('panel-logout-button');

    if (!userPanelTrigger || !userPanel || !panelLogoutButton) {
        console.debug('setupUserPanel: missing elements', { userPanelTrigger: !!userPanelTrigger, userPanel: !!userPanel, panelLogoutButton: !!panelLogoutButton });
        return;
    }

    console.debug('setupUserPanel: wiring user panel handlers');
    userPanelTrigger.addEventListener('click', (event) => {
        console.debug('user-panel-trigger clicked (common.setupUserPanel)');
        event.stopPropagation();
        userPanel.classList.toggle('active');
    });

    window.addEventListener('click', () => {
        if (userPanel.classList.contains('active')) {
            userPanel.classList.remove('active');
        }
    });

    panelLogoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        auth.signOut().then(() => {
            localStorage.removeItem('userAvatarUrl');
            window.location.href = "/login";
        }).catch(error => console.error("Erreur de déconnexion:", error));
    });
}

/**
 * Met à jour l'icône globale de l'utilisateur avec l'avatar sauvegardé ou une initiale.
 * @param {string} initial - La lettre initiale de l'email de l'utilisateur.
 */
export function updateGlobalAvatar(initial) {
    const userPanelTrigger = document.querySelector('.user-panel-trigger');
    if (!userPanelTrigger) return;
    const avatarUrl = localStorage.getItem('userAvatarUrl');

    if (avatarUrl) {
        userPanelTrigger.innerHTML = `<img src="${avatarUrl}" alt="User Avatar" style="width:100%; height:100%; border-radius: 50%;">`;
    } else {
        userPanelTrigger.textContent = initial || 'U';
    }
}