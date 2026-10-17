// /js/settings.js - bootstrap pour /settings/ (dashboard & paramètres).
// Module ESM externalisé depuis settings/index.html.

import { onAuthStateChanged, updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser, reauthenticateWithPopup, GoogleAuthProvider, GithubAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, limit, getDocs, getCountFromServer, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { updateGlobalAvatar, saveWithFeedback, toast } from "/js/common.js";
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
        // L'UID et l'email etaient AUSSI ecrits en console. C'etait un doublon
        // pur : les deux lignes juste au-dessus les affichent deja dans la page,
        // en clair. Les repeter dans la console ne servait qu'a les laisser
        // trainer dans les journaux du navigateur.
    }
}

// Feedback visuel pour les actions admin
function showAdminFeedback(message, success = true) {
    toast(message, { type: success ? 'success' : 'error', duration: 3500 });
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

            // 7J - daily
            const labels7 = [], data7 = [];
            for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); labels7.push(d.toLocaleDateString('fr-FR', {weekday:'narrow'})); data7.push(avgMood(entries.filter(e => localIso(entryTs(e)) === localIso(d)))); }
            chartDataSets['7J'] = { labels: labels7, data: data7 };

            // 30J - daily
            const labels30 = [], data30 = [];
            for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); labels30.push(i % 5 === 0 ? d.toLocaleDateString('fr-FR', {day:'numeric',month:'short'}) : ''); data30.push(avgMood(entries.filter(e => localIso(entryTs(e)) === localIso(d)))); }
            chartDataSets['30J'] = { labels: labels30, data: data30 };

            // 3M - weekly average
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

            // ── Réglages de CYL ────────────────────────────────────────────
            // Même module que le panneau latéral : une seule source, deux
            // portes d'entrée. amorcerDepuisCompte() ne sert qu'à un appareil
            // neuf (rien en local) - ensuite chaque appareil est autonome,
            // donc il n'y a jamais de conflit à arbitrer entre deux machines.
            try {
                const prefs = await import("/js/cyl-prefs.js");
                await prefs.amorcerDepuisCompte(db, user.uid);
                const hote = document.getElementById("cyl-prefs-host");
                if (hote) prefs.rendre(hote, {});
            } catch (e) { console.warn("[cyl-prefs]", e && e.message || e); }
            
            // ── Fallback admin (CHOIX INTENTIONNEL - pas une dette technique) ──
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
                // L'onglet Admin est un bouton du segment : on le dévoile, sans
                // forcer un display qui casserait la rangée.
                const adminTab = document.getElementById("admin-nav-section");
                if (adminTab) adminTab.hidden = false;
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
            document.querySelectorAll(".nav-item").forEach(i => { i.classList.remove("active"); i.setAttribute("aria-selected", "false"); });
            item.classList.add("active");
            item.setAttribute("aria-selected", "true");
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
        titleEl.textContent = `Humeur du journal (${suffix})`;
    }
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: chartDataSets[defaultPeriod].labels,
            datasets: [{
                label: "Score ChangeYourLife.ai",
                data: chartDataSets[defaultPeriod].data,
                borderColor: "#8dca67",
                backgroundColor: "rgba(132,194,94, 0.1)",
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: "#8dca67",
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
                    ticks: { color: "#afa99c" },
                    grid: { color: "rgba(255, 255, 255, 0.05)" }
                },
                x: {
                    ticks: { color: "#afa99c" },
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
    toast(msg, { type: ok ? 'success' : 'error', duration: 4000 });
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
            if (!newEmail) { setSecurityFeedback("Entre un nouvel email", false); return; }
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
                    setSecurityFeedback("Action sensible : reconnecte-toi puis réessaie.", false);
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
                    setSecurityFeedback("Action sensible : reconnecte-toi puis réessaie.", false);
                } else {
                    setSecurityFeedback("Échec de la mise à jour du mot de passe.", false);
                }
            }
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
});

// ----- Préférences (thème/animations/notifications) -----
async function initSettingsToggles(uid) {
    try {
        const ref = doc(db, 'users', uid);
        const snap = await getDoc(ref);
        const prefs = (snap.exists() && snap.data().prefs) || {};
        // Defaults. Le thème est un réglage d'appareil : localStorage d'abord
        // (c'est ce que pose le bouton de la barre), le compte sert de repli.
        const theme = (localStorage.getItem('theme') || prefs.theme || 'dark');
        const animations = (prefs.animEnabled !== false); // default true
        const weeklyEmails = (prefs.weeklyEmails === true); // default false
        const dailyReminders = (prefs.dailyReminders === true); // default false

        // Reflect UI
        const themeCk = document.getElementById('light-theme');
        const animCk = document.getElementById('animations');
        const dailyCk = document.getElementById('daily-reminders');
        const emailCk = document.getElementById('email-notifications');
        if (themeCk) themeCk.checked = (theme === 'light'); // checked = clair
        if (animCk) animCk.checked = animations;
        applyMotion(animations);
        if (dailyCk) dailyCk.checked = dailyReminders;
        if (emailCk) emailCk.checked = weeklyEmails;

        // Apply theme immediately
        applyTheme(theme);
        // Persist normalized theme into localStorage for consistency across pages
        localStorage.setItem('theme', theme);

        // Wire events
        if (themeCk) themeCk.addEventListener('change', async () => {
            const newTheme = themeCk.checked ? 'light' : 'dark';
            applyTheme(newTheme);
            try { localStorage.setItem('theme', newTheme); } catch (_) {}
            // Même événement que le bouton de la barre (userMenu.js) : tout ce
            // qui écoute le thème suit.
            try { window.dispatchEvent(new CustomEvent('cyf:theme-changed', { detail: newTheme })); } catch (_) {}
            await saveWithFeedback(() => setDoc(ref, { prefs: { theme: newTheme } }, { merge: true }), { errorMsg: "Ton thème n'a pas pu être enregistré. Vérifie ta connexion." });
        });
        // Si le thème change ailleurs (bouton de la barre), l'interrupteur suit.
        window.addEventListener('cyf:theme-changed', (e) => {
            if (themeCk) themeCk.checked = (e && e.detail) === 'light';
        });
        if (animCk) animCk.addEventListener('change', async () => {
            const val = !!animCk.checked;
            applyMotion(val);
            await saveWithFeedback(() => setDoc(ref, { prefs: { animEnabled: val } }, { merge: true }), { errorMsg: "Ta préférence d'animations n'a pas pu être enregistrée." });
        });
        if (dailyCk) dailyCk.addEventListener('change', async () => {
            const val = !!dailyCk.checked;
            await saveWithFeedback(() => setDoc(ref, { prefs: { dailyReminders: val } }, { merge: true }), { errorMsg: "Ta préférence de rappels n'a pas pu être enregistrée." });
        });
        if (emailCk) emailCk.addEventListener('change', async () => {
            const val = !!emailCk.checked;
            await saveWithFeedback(() => setDoc(ref, { prefs: { weeklyEmails: val } }, { merge: true }), { errorMsg: "Ta préférence d'emails n'a pas pu être enregistrée." });
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
// Animations désactivées -> body.no-motion. Rien d'autre ne lit cette classe
// pour l'instant : c'est un point d'accroche, pas encore un câblage global.
function applyMotion(enabled) {
    try { document.body.classList.toggle('no-motion', !enabled); } catch (e) { /* ignore */ }
}

// ----- Tes données : export, puis suppression (api/delete-account.js) -----
// AVANT : le navigateur effacait ce que les regles Firestore lui ouvrent, et
// laissait derriere lui verificationCodes (avec l'email), chatRate, briefRate,
// roles et la participation au tirage. L'Admin SDK voit tout. Le client ne
// fait plus que se re-authentifier (connexion recente exigee par l'API) et
// appeler.
async function reauthentifier(user) {
    const providers = (user.providerData || []).map(p => p.providerId);
    if (providers.includes('google.com')) return reauthenticateWithPopup(user, new GoogleAuthProvider());
    if (providers.includes('github.com')) return reauthenticateWithPopup(user, new GithubAuthProvider());
    if (providers.includes('password')) {
        const pwd = window.prompt('Entre ton mot de passe pour confirmer :');
        if (!pwd) throw new Error('cancelled');
        return reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pwd));
    }
    throw new Error('no-provider');
}
async function appelerCompte(user, action) {
    const idToken = await user.getIdToken(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 40_000);
    try {
        const r = await fetch('/api/delete-account', {
            method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
            body: JSON.stringify({ idToken, action }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(data.error || 'echec'), { code: data.code });
        return data;
    } finally { clearTimeout(t); }
}
document.addEventListener('DOMContentLoaded', () => {
    const expBtn = document.getElementById('export-my-data-btn');
    if (expBtn) expBtn.addEventListener('click', async () => {
        const user = auth && auth.currentUser;
        if (!user) return;
        expBtn.disabled = true;
        try {
            const data = await appelerCompte(user, 'export');
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'changeyourlife-mes-donnees-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            toast('Tes données sont téléchargées.', { type: 'success' });
        } catch (e) {
            toast(e && e.message ? e.message : "L'export a échoué. Réessaie.", { type: 'error' });
        } finally { expBtn.disabled = false; }
    });

    const delBtn = document.getElementById('delete-account-btn');
    if (!delBtn) return;
    delBtn.addEventListener('click', async () => {
        const user = auth && auth.currentUser;
        if (!user) return;
        if (!window.confirm('Tu veux vraiment supprimer ton compte ? Cette action est irréversible.')) return;
        const confirm2 = window.prompt('Tape « SUPPRIMER » pour confirmer');
        if ((confirm2 || '').toUpperCase() !== 'SUPPRIMER') return;
        delBtn.disabled = true;
        try {
            // Connexion recente exigee par l'API (auth_time < 5 min).
            await reauthentifier(user);
            await appelerCompte(user, 'delete');
            try { localStorage.removeItem('userAvatarUrl'); localStorage.removeItem('userBadgeUrl'); } catch (_) {}
            try { document.cookie = 'cyl_in=; Max-Age=0; path=/; Secure; SameSite=Lax'; } catch (_) {}
            window.location.href = '/';
        } catch (err) {
            if (err && err.message === 'cancelled') { delBtn.disabled = false; return; }
            console.error('delete account failed', err);
            toast(err && err.code === 'RECENT_LOGIN'
                ? 'Reconnecte-toi puis réessaie : la suppression exige une connexion récente.'
                : "Échec de la suppression. Tes données n'ont pas été touchées, réessaie plus tard.", { type: 'error', duration: 6000 });
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
            document.querySelectorAll('[data-admin-range]').forEach(b => { b.classList.remove('primary'); b.setAttribute('aria-pressed', 'false'); });
            btn.classList.add('primary');
            btn.setAttribute('aria-pressed', 'true');
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

                    const strong = document.createElement('strong');
                    strong.textContent = u.displayName || '(sans nom)';
                    const emailSpan = document.createElement('span');
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
        el.className = 'modal-veil';
        el.innerHTML = `<div id="admin-modal" class="modal" style="width:min(640px,100%)">
            <div class="card-head"><h3>Détail utilisateur</h3><button type="button" id="admin-modal-close" class="btn sm">Fermer</button></div>
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
                        <button type="button" id="toggle-mod" class="btn ${isMod ? '' : 'primary'}" ${isAdminTarget ? 'disabled' : ''}>${isMod?'Retirer modérateur':'Promouvoir modérateur'}</button>
                    </div>
                    <div class="note">Les rôles sont gérés via Custom Claims (Cloud Function <code>setUserRole</code>). Le miroir <code>roles/{uid}</code> est en lecture seule côté client.</div>
                </div>
            </div>
            <div class="card" style="margin-top:12px">
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
    function setFB(msg, ok=true){ toast(msg, { type: ok ? 'success' : 'error', duration: 3500 }); }
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
