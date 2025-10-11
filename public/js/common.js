// Ce fichier gère la logique partagée par toutes les pages connectées.

// --- GESTION DU THÈME ---
export function setupTheme() {
    const darkBtn = document.getElementById('theme-dark-btn');
    const lightBtn = document.getElementById('theme-light-btn');

    if (!darkBtn || !lightBtn) return;

    function setTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
            lightBtn.classList.add('active');
            darkBtn.classList.remove('active');
        } else {
            document.body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
            darkBtn.classList.add('active');
            lightBtn.classList.remove('active');
        }
    }
    darkBtn.addEventListener('click', () => setTheme('dark'));
    lightBtn.addEventListener('click', () => setTheme('light'));
    setTheme(localStorage.getItem('theme') || 'dark');
}

// --- GESTION DU PANEL UTILISATEUR ---
export function setupUserPanel(auth) {
    const userPanelTrigger = document.querySelector('.user-panel-trigger');
    const userPanel = document.getElementById('user-panel');
    const panelLogoutButton = document.getElementById('panel-logout-button');

    if (!userPanelTrigger || !userPanel || !panelLogoutButton) return;

    userPanelTrigger.addEventListener('click', (event) => {
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
            localStorage.removeItem('userAvatarUrl'); // Nettoyer l'avatar au logout
            window.location.href = "/login";
        }).catch(error => console.error("Erreur de déconnexion:", error));
    });
}

// --- MISE À JOUR DE L'AVATAR GLOBAL ---
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