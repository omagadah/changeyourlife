// /js/settings.js — bootstrap pour /settings/ (dashboard & paramètres).
// Module ESM externalisé depuis settings/index.html.

import { onAuthStateChanged, updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser, reauthenticateWithPopup, GoogleAuthProvider, GithubAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, limit, getDocs, getCountFromServer, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { updateGlobalAvatar } from "/js/common.js";
import { initUserMenu } from "/js/userMenu.js";

let auth, db, functions;
let myRole = "user"; // résolu via getMyRole callable au début de la session

// Affiche les informations de l'utilisateur admin
function showAdminInfo(user) {
    const infoDiv = document.getElementById('admin-user-info');
    const emailSpan = document.getElementById('admin-email');
    const uidSpan = document.getElementById('admin-uid-display');
    
    if (infoDiv && user) {
        emailSpan.textContent = `Connecté en tant qu'admin : ${user.email || 'Utilisateur inconnu'}`;
        uidSpan.textContent = user.uid;
        infoDiv.style.display = 'block';
        
        // Log l'UID dans la console pour faciliter la configuration
        console.log(`%c🔧 ADMIN UID: ${user.uid}`, 'background: #3b82f6; color: white; padding: 8px; border-radius: 4px; font-weight: bold;');
        console.log(`%c📧 ADMIN EMAIL: ${user.email}`, 'background: #10b981; color: white; padding: 8px; border-radius: 4px;');
    }
}

// Feedback visuel pour les actions admin
function showAdminFeedback(message, success = true) {
    const feedbackDiv = document.getElementById('admin-feedback');
    if (feedbackDiv) {
        feedbackDiv.textContent = message;
        feedbackDiv.style.backgroundColor = success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        feedbackDiv.style.color = success ? '#10b981' : '#ef4444';
        feedbackDiv.style.border = success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)';
        feedbackDiv.style.display = 'block';
        setTimeout(() => { feedbackDiv.style.display = 'none'; }, 3500);
    }
}

// Chargement des stats dashboard depuis Firestore
const MOOD_SCORE_MAP = { joy:9, grateful:8, calm:7, neutral:5, worried:4, sad:3, angry:2 };
async function loadDashboardStats(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        const data = userDoc.exists() ? userDoc.data() : {};

        // Objectifs complétés
        const goals = Array.isArray(data.goals) ? data.goals : [];
        const el_hab = document.getElementById('stat-habitudes');
        if (el_hab) el_hab.textContent = goals.filter(g => g.completed).length;

        // Minutes de méditation
        const medMin = (data.meditation && data.meditation.totalMinutes) || 0;
        const el_focus = document.getElementById('stat-focus');
        if (el_focus) el_focus.textContent = medMin;

        // Journal entries
        const jSnap = await getDocs(query(collection(db, 'users', uid, 'journal'), limit(200)));
        const entries = jSnap.docs.map(d => d.data());
        const el_journal = document.getElementById('stat-journal');
        if (el_journal) el_journal.textContent = entries.length;

        // Humeur moyenne
        const el_humeur = document.getElementById('stat-humeur');
        if (el_humeur && entries.length) {
            const avg = entries.reduce((s, e) => s + (MOOD_SCORE_MAP[e.emotion] || 5), 0) / entries.length;
            el_humeur.textContent = avg.toFixed(1) + '/10';
        }

        // Mise à jour du graphique avec les données réelles
        if (entries.length && chartInstance) {
            const localIso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const entryTs = e => { const ts = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt || 0); return ts; };
            const avgMood = list => list.length ? Math.round(list.reduce((s, e) => s + (MOOD_SCORE_MAP[e.emotion]||5), 0) / list.length * 10) / 10 : null;

            // 7J — daily
            const labels7 = [], data7 = [];
            for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); labels7.push(d.toLocaleDateString('fr-FR', {weekday:'narrow'})); data7.push(avgMood(entries.filter(e => localIso(entryTs(e)) === localIso(d)))); }
            chartDataSets['7J'] = { labels: labels7, data: data7 };

            // 30J — daily
            const labels30 = [], data30 = [];
            for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); labels30.push(i % 5 === 0 ? d.toLocaleDateString('fr-FR', {day:'numeric',month:'short'}) : ''); data30.push(avgMood(entries.filter(e => localIso(entryTs(e)) === localIso(d)))); }
            chartDataSets['30J'] = { labels: labels30, data: data30 };

            // 3M — weekly average
            const labels3M = [], data3M = [];
            for (let w = 11; w >= 0; w--) {
                const wEnd = new Date(); wEnd.setDate(wEnd.getDate() - w * 7);
                const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 6);
                const wIso = d => localIso(d);
                const weekEntries = entries.filter(e => { const iso = localIso(entryTs(e)); return iso >= wIso(wStart) && iso <= wIso(wEnd); });
                labels3M.push(w % 4 === 0 ? wEnd.toLocaleDateString('fr-FR', {day:'numeric',month:'short'}) : '');
                data3M.push(avgMood(weekEntries));
            }
            chartDataSets['3M'] = { labels: labels3M, data: data3M };

            // Update active period
            const activePeriod = document.querySelector('.filter-btn.active')?.textContent?.trim() || '7J';
            const active = chartDataSets[activePeriod] || chartDataSets['7J'];
            chartInstance.data.labels = active.labels;
            chartInstance.data.datasets[0].data = active.data;
            chartInstance.data.datasets[0].spanGaps = true;
            chartInstance.update();
        }
    } catch(e) { console.warn('loadDashboardStats failed', e); }
}

// Initialisation de l'authentification
function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            initUserMenu();
            updateGlobalAvatar((user.email || "U").charAt(0).toUpperCase());
            
            // ── Fallback admin (CHOIX INTENTIONNEL — pas une dette technique) ──
            // Firebase est en plan Spark (gratuit), donc Secret Manager indisponible.
            // Plutôt que de payer Blaze pour stocker ROOT_ADMIN_UID côté serveur,
            // on garde la liste ici. Un UID Firebase n'est pas un secret (inutile
            // sans le mot de passe Google associé). Pour ajouter un admin :
            // ajouter son UID ici + redeploy Vercel.
            // Cf. AUDIT.md section "Stratégie admin" et docs/sessions/.
            const BOOTSTRAP_ADMIN_UIDS = ["PvDinfGc2hRribdPE4JW9Bv5Ip42"];

            // Récupère le rôle via Cloud Function getMyRole (custom claims)
            // Fallback : miroir Firestore roles/{uid}, puis bootstrap UIDs.
            try {
                const getMyRole = httpsCallable(functions, 'getMyRole');
                const res = await getMyRole();
                myRole = (res?.data?.role) || 'user';
            } catch (e) {
                try { const r = await getDoc(doc(db, 'roles', user.uid)); myRole = (r.exists() && r.data().role) || 'user'; } catch(_) { myRole = 'user'; }
            }
            // Bootstrap : si pas encore admin via Custom Claims mais dans la liste, on accorde.
            if (myRole === 'user' && BOOTSTRAP_ADMIN_UIDS.includes(user.uid)) {
                myRole = 'admin';
            }
            const isAdmin = myRole === 'admin';
            const isMod   = myRole === 'mod' || isAdmin;
            if (isAdmin || isMod) {
                document.getElementById("admin-nav-section").style.display = "block";
                showAdminInfo(user);
            }
            
            // Affiche/masque les options de sécurité selon le fournisseur d'identité
            try {
                const providers = (user.providerData || []).map(p => p.providerId);
                const isPasswordUser = providers.includes('password');
                const ssoInfo = document.getElementById('security-sso-info');
                const credSection = document.getElementById('security-cred-section');
                const provEl = document.getElementById('security-sso-provider');
                if (isPasswordUser) {
                    if (credSection) credSection.style.display = 'block';
                    if (ssoInfo) ssoInfo.style.display = 'none';
                } else {
                    if (credSection) credSection.style.display = 'none';
                    if (ssoInfo) ssoInfo.style.display = 'block';
                    if (provEl) provEl.textContent = `Fournisseur détecté: ${providers.join(', ') || 'inconnu'}`;
                }
            } catch(e) { console.warn('Provider check failed', e); }
            // Stats: marquer l'activité
            try { await setDoc(doc(db, 'users', user.uid), { lastActive: serverTimestamp(), email: user.email || null }, { merge: true }); } catch(e) {}

            // Charger les préférences depuis Firestore et brancher les toggles
            initSettingsToggles(user.uid);
            loadDashboardStats(user.uid);

            initChart();
            initNavigation();

            // Initialiser les features admin
            if (isAdmin || isMod) {
                try { await updateAdminStats(); } catch(e) {}
                bindAdminHandlers();
            }
        } else {
            if (!["127.0.0.1", "localhost"].includes(location.hostname)) {
                window.location.href = "/login";
                return;
            }
            initChart();
            initNavigation();
        }
    });
}

// Navigation entre les sections
function initNavigation() {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            const section = item.getAttribute("data-section");
            document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
            item.classList.add("active");
            document.querySelectorAll(".settings-section").forEach(s => s.classList.remove("active"));
            document.getElementById(section)?.classList.add("active");
        });
    });
}

// Initialisation du graphique Chart.js
// Chart period data (all zero for now, ready for future dynamic stats)
const chartDataSets = {
    '7J': {
        labels: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
        data: [0, 0, 0, 0, 0, 0, 0]
    },
    '30J': {
        labels: Array.from({length: 30}, (_, i) => `J${i+1}`),
        data: Array(30).fill(0)
    },
    '3M': {
        labels: ["Jan", "Fév", "Mar"],
        data: [0, 0, 0]
    }
};
let chartInstance = null;
function initChart() {
    const canvas = document.getElementById("monkyChart");
    if (!canvas || !window.Chart) return;
    const ctx = canvas.getContext("2d");
    const defaultPeriod = '7J';
    const titleEl = document.getElementById('chart-title');
    const titleByPeriod = {
        '7J': '7 derniers jours',
        '30J': '30 derniers jours',
        '3M': '3 derniers mois'
    };
    function updateTitle(period) {
        if (!titleEl) return;
        const suffix = titleByPeriod[period] || '7 derniers jours';
        titleEl.textContent = `Évolution ChangeYourLife.ai (${suffix})`;
    }
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: chartDataSets[defaultPeriod].labels,
            datasets: [{
                label: "Score ChangeYourLife.ai",
                data: chartDataSets[defaultPeriod].data,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: "#3b82f6",
                pointBorderColor: "#fff",
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "rgba(31, 41, 55, 0.9)",
                    padding: 12,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 10,
                    ticks: { color: "#9ca3af" },
                    grid: { color: "rgba(255, 255, 255, 0.05)" }
                },
                x: {
                    ticks: { color: "#9ca3af" },
                    grid: { color: "rgba(255, 255, 255, 0.05)" }
                }
            }
        }
    });
    // Set correct initial title
    updateTitle(defaultPeriod);
    // Chart period filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const period = btn.textContent.trim();
            if (chartInstance && chartDataSets[period]) {
                chartInstance.data.labels = chartDataSets[period].labels;
                chartInstance.data.datasets[0].data = chartDataSets[period].data;
                chartInstance.update();
            }
            updateTitle(period);
        });
    });
}

// Gestion des actions Sécurité (email / mot de passe)
function setSecurityFeedback(msg, ok = true) {
    const el = document.getElementById('security-feedback');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.background = ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';
    el.style.border = ok ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(239,68,68,0.35)';
    el.style.color = ok ? '#10b981' : '#ef4444';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
    const emailBtn = document.getElementById('update-email-btn');
    const pwdBtn = document.getElementById('update-password-btn');
    if (emailBtn) {
        emailBtn.addEventListener('click', async () => {
            const user = auth && auth.currentUser;
            if (!user) return;
            const newEmail = (document.getElementById('new-email') || {}).value?.trim();
            const currentPwd = (document.getElementById('current-password-email') || {}).value;
            if (!newEmail) { setSecurityFeedback("Veuillez entrer un nouvel email", false); return; }
            try {
                if (currentPwd) {
                    const cred = EmailAuthProvider.credential(user.email, currentPwd);
                    await reauthenticateWithCredential(user, cred);
                }
                await updateEmail(user, newEmail);
                setSecurityFeedback("Email mis à jour avec succès.");
            } catch (e) {
                console.error(e);
                if (e?.code === 'auth/requires-recent-login') {
                    setSecurityFeedback("Action sensible: veuillez vous reconnecter puis réessayer.", false);
                } else if (e?.code === 'auth/email-already-in-use') {
                    setSecurityFeedback("Cet email est déjà utilisé.", false);
                } else {
                    setSecurityFeedback("Échec de la mise à jour de l'email.", false);
                }
            }
        });
    }
    if (pwdBtn) {
        pwdBtn.addEventListener('click', async () => {
            const user = auth && auth.currentUser;
            if (!user) return;
            const currentPwd = (document.getElementById('current-password') || {}).value;
            const newPwd = (document.getElementById('new-password') || {}).value;
            const confirm = (document.getElementById('confirm-password') || {}).value;
            if (!newPwd || newPwd.length < 6) { setSecurityFeedback("Le nouveau mot de passe doit contenir au moins 6 caractères.", false); return; }
            if (newPwd !== confirm) { setSecurityFeedback("Les mots de passe ne correspondent pas.", false); return; }
            try {
                if (currentPwd) {
                    const cred = EmailAuthProvider.credential(user.email, currentPwd);
                    await reauthenticateWithCredential(user, cred);
                }
                await updatePassword(user, newPwd);
                setSecurityFeedback("Mot de passe mis à jour avec succès.");
                // Efface les champs
                ['current-password','new-password','confirm-password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            } catch (e) {
                console.error(e);
                if (e?.code === 'auth/requires-recent-login') {
                    setSecurityFeedback("Action sensible: veuillez vous reconnecter puis réessayer.", false);
                } else {
                    setSecurityFeedback("Échec de la mise à jour du mot de passe.", false);
                }
            }
        });
    }
});

// Gestion du bouton de téléchargement des données
document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('download-user-data-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const uidInput = document.getElementById('admin-uid');
            const uid = uidInput?.value.trim();
            
            if (!uid) {
                showAdminFeedback('Veuillez entrer un UID utilisateur', false);
                return;
            }
            
            showAdminFeedback('Téléchargement en cours...');
            
            // Simulation - À remplacer par une vraie requête API
            setTimeout(() => {
                showAdminFeedback(`Données de l'utilisateur ${uid} téléchargées avec succès !`);
            }, 2000);
        });
    }
});

// Initialisation de Firebase via singleton centralisé
if (window._cyfFirebase) {
    ({ auth, db, functions } = window._cyfFirebase);
    initAuth();
} else {
    import("/js/firebase.js").then(() => {
        ({ auth, db, functions } = window._cyfFirebase);
        initAuth();
    });
}

// Gestion du menu utilisateur (idempotent)
window.addEventListener("DOMContentLoaded", () => { 
  try { updateGlobalAvatar(); } catch (e) {} 
  try { initUserMenu(); } catch (e) {} 
  try {
    if (window.VANTA && window.VANTA.BIRDS) {
      window.VANTA.BIRDS({
        el: '#vanta-birds-bg',
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 1.0,
        scaleMobile: 1.0,
        quantity: 4.0,
        backgroundColor: 0x07192f
      });
    }
  } catch (e) { console.log('Vanta init error:', e); }
});

// ----- Préférences (thème/animations/notifications) -----
async function initSettingsToggles(uid) {
    try {
        const ref = doc(db, 'users', uid);
        const snap = await getDoc(ref);
        const prefs = (snap.exists() && snap.data().prefs) || {};
        // Defaults
        const theme = (prefs.theme || localStorage.getItem('theme') || 'dark');
        const animations = (prefs.animEnabled !== false); // default true
        const weeklyEmails = (prefs.weeklyEmails === true); // default false
        const dailyReminders = (prefs.dailyReminders === true); // default false

        // Reflect UI
        const themeCk = document.getElementById('dark-theme');
        const animCk = document.getElementById('animations');
        const dailyCk = document.getElementById('daily-reminders');
        const emailCk = document.getElementById('email-notifications');
        if (themeCk) themeCk.checked = (theme !== 'light'); // checked = dark
        if (animCk) animCk.checked = animations;
        if (dailyCk) dailyCk.checked = dailyReminders;
        if (emailCk) emailCk.checked = weeklyEmails;

        // Apply theme immediately
        applyTheme(theme);
        // Persist normalized theme into localStorage for consistency across pages
        localStorage.setItem('theme', theme);

        // Wire events
        if (themeCk) themeCk.addEventListener('change', async () => {
            const newTheme = themeCk.checked ? 'dark' : 'light';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
            try { await setDoc(ref, { prefs: { theme: newTheme } }, { merge: true }); } catch(e) { console.warn('save theme failed', e); }
        });
        if (animCk) animCk.addEventListener('change', async () => {
            const val = !!animCk.checked;
            try { await setDoc(ref, { prefs: { animEnabled: val } }, { merge: true }); } catch(e) {}
        });
        if (dailyCk) dailyCk.addEventListener('change', async () => {
            const val = !!dailyCk.checked;
            try { await setDoc(ref, { prefs: { dailyReminders: val } }, { merge: true }); } catch(e) {}
        });
        if (emailCk) emailCk.addEventListener('change', async () => {
            const val = !!emailCk.checked;
            try { await setDoc(ref, { prefs: { weeklyEmails: val } }, { merge: true }); } catch(e) {}
        });
    } catch (e) {
        console.warn('initSettingsToggles failed', e);
    }
}

function applyTheme(theme) {
    try {
        if (theme === 'light') document.body.classList.add('light-mode');
        else document.body.classList.remove('light-mode');
    } catch(e) { /* ignore */ }
}

// ----- Danger Zone: suppression du compte -----
document.addEventListener('DOMContentLoaded', () => {
    const delBtn = document.getElementById('delete-account-btn');
    if (!delBtn) return;
    delBtn.addEventListener('click', async () => {
        const user = auth && auth.currentUser;
        if (!user) return;
        if (!window.confirm('Voulez-vous vraiment supprimer votre compte ? Cette action est irréversible.')) return;
        const confirm2 = window.prompt('Tapez "SUPPRIMER" pour confirmer');
        if ((confirm2 || '').toUpperCase() !== 'SUPPRIMER') return;
        delBtn.disabled = true;
        try {
            try { await deleteDoc(doc(db, 'users', user.uid)); } catch(_) {}
            try { await deleteDoc(doc(db, 'roles', user.uid)); } catch(_) {}
            try {
                await deleteUser(user);
            } catch (e) {
                if (e?.code === 'auth/requires-recent-login') {
                    // reauth by provider
                    const providers = (user.providerData || []).map(p => p.providerId);
                    if (providers.includes('google.com')) {
                        await reauthenticateWithPopup(user, new GoogleAuthProvider());
                    } else if (providers.includes('github.com')) {
                        await reauthenticateWithPopup(user, new GithubAuthProvider());
                    } else if (providers.includes('password')) {
                        const pwd = window.prompt('Veuillez entrer votre mot de passe pour confirmer:');
                        if (!pwd) throw new Error('cancelled');
                        const cred = EmailAuthProvider.credential(user.email, pwd);
                        await reauthenticateWithCredential(user, cred);
                    } else {
                        throw e;
                    }
                    await deleteUser(user);
                } else { throw e; }
            }
            try { localStorage.removeItem('userAvatarUrl'); } catch(_) {}
            window.location.href = '/signup';
        } catch (err) {
            console.error('delete account failed', err);
            alert('Échec de la suppression du compte. Réessayez plus tard.');
            delBtn.disabled = false;
        }
    });
});

// ----- Admin helpers -----
let ADMIN_FILTER_DAYS = 7;
async function updateAdminStats() {
    try {
        const usersColl = collection(db, 'users');
        const total = await getCountFromServer(usersColl);
        const totalEl = document.getElementById('admin-users');
        if (totalEl) totalEl.textContent = String(total.data().count || 0);
        // actifs selon filtre
        const start = new Date(Date.now() - ADMIN_FILTER_DAYS*24*60*60*1000);
        const q = query(usersColl, where('lastActive', '>=', start));
        const active = await getCountFromServer(q);
        const activeEl = document.getElementById('admin-active');
        if (activeEl) activeEl.textContent = String(active.data().count || 0);
    } catch (e) { console.warn('updateAdminStats failed', e); }
}

function bindAdminHandlers() {
    // Filtres période
    document.querySelectorAll('[data-admin-range]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const days = parseInt(btn.getAttribute('data-admin-range') || '7', 10);
            ADMIN_FILTER_DAYS = days;
            document.querySelectorAll('[data-admin-range]').forEach(b => b.classList.remove('btn-primary'));
            btn.classList.add('btn-primary');
            try { await updateAdminStats(); } catch(e) {}
        });
    });

    // Recherche
    const searchBtn = document.getElementById('search-user-btn');
    const searchInput = document.getElementById('search-user');
    const resultsEl = document.getElementById('admin-search-results');
    if (searchBtn && searchInput && resultsEl) {
        searchBtn.addEventListener('click', async () => {
            const term = (searchInput.value || '').trim();
            if (!term) return;
            resultsEl.textContent = 'Recherche...';
            try {
                const usersColl = collection(db, 'users');
                let docsRes = [];
                if (term.includes('@')) {
                    const q1 = query(usersColl, where('email', '==', term), limit(10));
                    docsRes = (await getDocs(q1)).docs;
                } else {
                    const end = term + '\\uf8ff';
                    const q2 = query(usersColl, where('displayName', '>=', term), where('displayName', '<=', end), limit(10));
                    docsRes = (await getDocs(q2)).docs;
                }
                if (!docsRes.length) { resultsEl.textContent = 'Aucun résultat.'; return; }
                resultsEl.innerHTML = '';
                docsRes.forEach(d => {
                    const u = d.data() || {};
                    const uid = d.id;
                    const row = document.createElement('div');
                    row.dataset.userUid = uid;
                    row.className = 'admin-user-row';
                    row.style.cssText = 'padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer';
                    const strong = document.createElement('strong');
                    strong.textContent = u.displayName || '(sans nom)';
                    const emailSpan = document.createElement('span');
                    emailSpan.style.color = '#6b7280';
                    emailSpan.textContent = u.email || '';
                    const uidSmall = document.createElement('small');
                    uidSmall.textContent = 'UID: ' + uid;
                    row.appendChild(strong);
                    row.appendChild(document.createTextNode(' '));
                    row.appendChild(emailSpan);
                    row.appendChild(document.createElement('br'));
                    row.appendChild(uidSmall);
                    resultsEl.appendChild(row);
                });
                // open detail modal
                resultsEl.querySelectorAll('.admin-user-row').forEach(row => {
                    row.addEventListener('click', () => {
                        const uid = row.getAttribute('data-user-uid');
                        openUserDetailModal(uid);
                    });
                });
            } catch (e) { resultsEl.textContent = 'Erreur de recherche.'; }
        });
    }
    // Export CSV
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                const usersColl = collection(db, 'users');
                const start = new Date(Date.now() - ADMIN_FILTER_DAYS*24*60*60*1000);
                const q = query(usersColl, where('lastActive', '>=', start));
                const snap = await getDocs(q);
                const rows = [];
                rows.push(['uid','email','displayName','lastActive','lvl_body','lvl_etre','lvl_heart','lvl_order','badgesCount']);
                snap.forEach(d => {
                    const u = d.data() || {};
                    const lv = (u.levels || {});
                    const lvn = { body: lv.body?.level || 0, etre: (lv.etre?.level || (lv.mind?.level || 0)), heart: lv.heart?.level || 0, order: lv.order?.level || 0 };
                    const last = u.lastActive?.toDate ? u.lastActive.toDate() : (u.lastActive || null);
                    const lastIso = last ? new Date(last).toISOString() : '';
                    const badgesCount = Array.isArray(u.badges) ? u.badges.length : 0;
                    rows.push([d.id, u.email||'', u.displayName||'', lastIso, lvn.body, lvn.etre, lvn.heart, lvn.order, badgesCount]);
                });
                const csv = rows.map(r => r.map(x => String(x).replaceAll('"','""')).map(x => `"${x}"`).join(',')).join('\r\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `users_${ADMIN_FILTER_DAYS}j.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                showAdminFeedback('CSV exporté.');
            } catch (e) { showAdminFeedback('Échec export CSV', false); }
        });
    }
    // Modération

// Modal helpers
function ensureModalRoot() {
    let el = document.getElementById('admin-modal-root');
    if (!el) {
        el = document.createElement('div');
        el.id = 'admin-modal-root';
        el.style.position = 'fixed'; el.style.inset = '0'; el.style.display = 'none'; el.style.alignItems = 'center'; el.style.justifyContent = 'center'; el.style.background = 'rgba(0,0,0,0.5)'; el.style.zIndex = '99999';
        el.innerHTML = `<div id="admin-modal" style="max-width:640px;width:92%;background:rgba(31,41,55,0.95);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:18px;color:#e5eef8">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3>Détail utilisateur</h3><button id="admin-modal-close" class="btn btn-secondary">Fermer</button></div>
            <div id="admin-modal-content" style="max-height:60vh;overflow:auto"></div>
        </div>`;
        document.body.appendChild(el);
        el.addEventListener('click', (e) => { if (e.target === el) el.style.display='none'; });
        el.querySelector('#admin-modal-close').addEventListener('click', ()=> { el.style.display='none'; });
    }
    return el;
}

async function openUserDetailModal(uid) {
    const root = ensureModalRoot();
    const content = root.querySelector('#admin-modal-content');
    content.innerHTML = '<div class="note">Chargement...</div>';
    root.style.display = 'flex';
    try {
        const uref = doc(db,'users',uid);
        const rref = doc(db,'roles',uid);
        const [usnap, rsnap] = await Promise.all([getDoc(uref), getDoc(rref)]);
        const u = usnap.exists() ? usnap.data() : {};
        const targetRole = (rsnap.exists() && rsnap.data().role) || 'user';
        const isMod = targetRole === 'mod' || targetRole === 'admin';
        const isAdminTarget = targetRole === 'admin';
        const lv = u.levels || {};
        const lvn = { body: lv.body?.level || 0, etre: (lv.etre?.level || (lv.mind?.level || 0)), heart: lv.heart?.level || 0, order: lv.order?.level || 0 };
        const badges = Array.isArray(u.badges) ? u.badges : [];
        const escAdmin = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
        const safeName = escAdmin(u.displayName || '(sans nom)');
        const safeEmail = escAdmin(u.email || '');
        const safeUid = escAdmin(uid);
        const safeBadges = badges.map(b => `<span class="pill">${escAdmin(b)}</span>`).join('') || '<span class="subtle">Aucun badge</span>';
        content.innerHTML = `
            <div class="grid-2">
                <div>
                    <div class="input-group"><div class="input-label">Nom</div><div>${safeName}</div></div>
                    <div class="input-group"><div class="input-label">Email</div><div>${safeEmail}</div></div>
                    <div class="input-group"><div class="input-label">UID</div><div><code>${safeUid}</code></div></div>
                </div>
                <div>
                    <div class="input-group"><div class="input-label">Rôle actuel</div>
                        <div><span class="pill">${isAdminTarget ? 'admin' : (isMod ? 'mod' : 'user')}</span></div>
                    </div>
                    <div class="input-group"><div class="input-label">Modifier</div>
                        <button id="toggle-mod" class="btn ${isMod? 'btn-secondary':'btn-primary'}" ${isAdminTarget ? 'disabled' : ''}>${isMod?'Retirer modérateur':'Promouvoir modérateur'}</button>
                    </div>
                    <div class="note">Les rôles sont gérés via Custom Claims (Cloud Function <code>setUserRole</code>). Le miroir <code>roles/{uid}</code> est en lecture seule côté client.</div>
                </div>
            </div>
            <div class="settings-group" style="margin-top:12px">
                <h3 class="settings-group-title">Niveaux</h3>
                <div class="grid-2">
                    <div>Corps: <strong>${Number(lvn.body)||0}</strong></div>
                    <div>Être: <strong>${Number(lvn.etre)||0}</strong></div>
                    <div>Cœur: <strong>${Number(lvn.heart)||0}</strong></div>
                    <div>Ordre: <strong>${Number(lvn.order)||0}</strong></div>
                </div>
            </div>
            <div class="settings-group">
                <h3 class="settings-group-title">Badges (${badges.length})</h3>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">${safeBadges}</div>
            </div>
        `;
        const btn = root.querySelector('#toggle-mod');
        if (btn && !isAdminTarget) {
            btn.addEventListener('click', async () => {
                try {
                    const setUserRole = httpsCallable(functions, 'setUserRole');
                    const newRole = isMod ? 'user' : 'mod';
                    await setUserRole({ uid, role: newRole });
                    showAdminFeedback(isMod ? 'Modérateur retiré' : 'Modérateur promu');
                    root.style.display = 'none';
                } catch (e) {
                    showAdminFeedback('Action rôle refusée (admin requis)', false);
                }
            });
        }
    } catch (e) {
        content.innerHTML = '<div class="note">Erreur de chargement.</div>';
    }
}
    const addBtn = document.getElementById('add-mod-btn');
    const remBtn = document.getElementById('remove-mod-btn');
    const uidInput = document.getElementById('mod-uid');
    const fb = document.getElementById('admin-roles-feedback');
    function setFB(msg, ok=true){ if(!fb) return; fb.style.display='block'; fb.textContent=msg; fb.style.background= ok? 'rgba(16,185,129,0.12)':'rgba(239,68,68,0.12)'; fb.style.border= ok? '1px solid rgba(16,185,129,0.35)':'1px solid rgba(239,68,68,0.35)'; fb.style.color= ok? '#10b981':'#ef4444'; setTimeout(()=>{fb.style.display='none';},3500); }
    if (addBtn && uidInput) addBtn.addEventListener('click', async () => {
        const target=(uidInput.value||'').trim(); if(!target) return;
        try { const setUserRole = httpsCallable(functions, 'setUserRole'); await setUserRole({ uid: target, role: 'mod' }); setFB('Modérateur promu.'); }
        catch(e){ setFB('Refus : admin requis (' + (e?.message||'') + ')', false); }
    });
    if (remBtn && uidInput) remBtn.addEventListener('click', async () => {
        const target=(uidInput.value||'').trim(); if(!target) return;
        try { const setUserRole = httpsCallable(functions, 'setUserRole'); await setUserRole({ uid: target, role: 'user' }); setFB('Modérateur rétrogradé.'); }
        catch(e){ setFB('Refus : admin requis', false); }
    });
}
