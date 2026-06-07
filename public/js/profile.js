// Fichier : public/js/profile.js

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { setupThemeToggle, updateGlobalAvatar } from './common.js';
import { initUserMenu } from './userMenu.js';
import './firebase.js';

const { app, auth, db } = window._cyfFirebase;
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
const playerIdEl = document.getElementById('player-id');
const bioInput = document.getElementById('profile-bio');
const websiteInput = document.getElementById('profile-website');
const emailReadOnly = document.getElementById('profile-email');
const toastEl = document.getElementById('toast');
// Badges/Titles UI
const badgesGrid = document.getElementById('badges-grid');
const badgesCountEl = document.getElementById('badges-count');
const titlesGrid = document.getElementById('titles-grid');
// Levels bars
const lvlEls = {
    body: { bar: document.getElementById('lvl-body'), label: document.getElementById('lvl-body-label') },
    // UI rename: mind -> etre (keep data backward compatibility elsewhere)
    etre: { bar: document.getElementById('lvl-etre'), label: document.getElementById('lvl-etre-label') },
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

// ── Level computation from raw XP ─────────────────────────────────────────
const XP_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 4000, 8000, Infinity];
const LEVEL_TITLES = ['Novice','Apprenti','Initié','Pratiquant','Avancé','Expert','Maître','Légende','Maître Absolu'];

function xpToLevel(rawXp) {
    const xp = typeof rawXp === 'number' ? rawXp : (rawXp?.xp || 0);
    let lvl = 0;
    while (lvl < XP_THRESHOLDS.length - 2 && xp >= XP_THRESHOLDS[lvl + 1]) lvl++;
    const nextXp = XP_THRESHOLDS[Math.min(lvl + 1, XP_THRESHOLDS.length - 2)];
    const prevXp = XP_THRESHOLDS[lvl];
    const pct = nextXp === Infinity ? 100 : Math.round((xp - prevXp) / (nextXp - prevXp) * 100);
    return { level: lvl + 1, xp, nextXp, prevXp, pct, title: LEVEL_TITLES[Math.min(lvl, LEVEL_TITLES.length-1)] };
}

function defaultLevels() {
    return { body: { xp: 0 }, etre: { xp: 0 }, heart: { xp: 0 }, order: { xp: 0 } };
}

function normalizeLevels(levels) {
    const l = levels || {};
    if (!l.etre && l.mind) l.etre = l.mind;
    const base = defaultLevels();
    return { ...base, ...l };
}

function renderLevels(levels) {
    const l = normalizeLevels(levels);
    for (const key of Object.keys(lvlEls)) {
        const cfg = xpToLevel(l[key]);
        if (lvlEls[key].bar) {
            setTimeout(() => { if (lvlEls[key].bar) lvlEls[key].bar.style.width = cfg.pct + '%'; }, 200);
        }
        if (lvlEls[key].label) {
            lvlEls[key].label.textContent = `${cfg.title} · Niv. ${cfg.level} · ${cfg.xp} XP`;
        }
    }
    // Update global stats row
    const cfgs = ['body','etre','heart','order'].map(k => xpToLevel(l[k]));
    const totalXP = cfgs.reduce((s, c) => s + c.xp, 0);
    const avgLevel = Math.round(cfgs.reduce((s, c) => s + c.level, 0) / cfgs.length);
    const el = document.getElementById('profile-total-xp');
    if (el) el.textContent = '⚡ ' + totalXP.toLocaleString('fr-FR') + ' XP total';
    // Hero stats (new pro layout)
    const heroXp = document.getElementById('hero-stat-xp');
    if (heroXp) heroXp.textContent = totalXP.toLocaleString('fr-FR');
    const heroAvg = document.getElementById('hero-stat-avg');
    if (heroAvg) heroAvg.textContent = String(avgLevel);
}

// Badge definitions: { id, emoji, name, desc, check(userData) }
const BADGE_DEFS = [
    { id:'first_step',   emoji:'🌱', name:'Premier pas',      desc:'Bienvenue sur ChangeYourLife !',            check: () => true },
    { id:'meditant',     emoji:'🧘', name:'Méditant',         desc:'Complète ta première séance de méditation',  check: d => (d.meditation?.totalSessions||0) >= 1 },
    { id:'scribe',       emoji:'📔', name:'Scribe',           desc:'Écris 5 entrées dans ton journal',           check: d => (d._journalCount||0) >= 5 },
    { id:'determined',   emoji:'🎯', name:'Déterminé',        desc:'Complète ton premier objectif',              check: d => (d.goals||[]).some(g => g.completed) },
    { id:'streak7',      emoji:'🔥', name:'Semaine de feu',   desc:'7 jours consécutifs de méditation',          check: d => (d.meditation?.streak||0) >= 7 },
    { id:'xp100',        emoji:'⚡', name:'Chargé',           desc:'Atteins 100 XP au total',                    check: d => ['body','etre','heart','order'].reduce((s,k)=>s+(d.levels?.[k]?.xp||0),0) >= 100 },
    { id:'xp500',        emoji:'💪', name:'Énergisé',         desc:'Atteins 500 XP au total',                    check: d => ['body','etre','heart','order'].reduce((s,k)=>s+(d.levels?.[k]?.xp||0),0) >= 500 },
    { id:'xp2000',       emoji:'🏆', name:'Champion',         desc:'Atteins 2000 XP au total',                   check: d => ['body','etre','heart','order'].reduce((s,k)=>s+(d.levels?.[k]?.xp||0),0) >= 2000 },
    { id:'balanced',     emoji:'⚖️', name:'Équilibré',        desc:'Atteins 250 XP dans chaque domaine',         check: d => ['body','etre','heart','order'].every(k=>(d.levels?.[k]?.xp||0)>=250) },
    { id:'master',       emoji:'🌟', name:'Maître',           desc:'Atteins 1000 XP dans un domaine',            check: d => ['body','etre','heart','order'].some(k=>(d.levels?.[k]?.xp||0)>=1000) },
    { id:'habitiste',    emoji:'✅', name:'Habitiste',        desc:'Crée au moins 3 habitudes',                  check: d => (d.habits||[]).length >= 3 },
];

function computeBadges(userData) {
    return BADGE_DEFS.filter(b => { try { return b.check(userData); } catch(e) { return false; } }).map(b => b.id);
}

function getBadgeDef(id) { return BADGE_DEFS.find(b => b.id === id) || { emoji:'🏅', name:id, desc:'' }; }

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
            // levels
            renderLevels(data.levels || defaultLevels());
                // Compute + merge badges
                const earnedIds = computeBadges(data);
                const storedIds = Array.isArray(data.badges) ? data.badges : [];
                const mergedIds = Array.from(new Set([...storedIds, ...earnedIds]));
                if (mergedIds.length > storedIds.length) {
                    setDoc(doc(db,'users',uid), { badges: mergedIds }, { merge: true }).catch(()=>{});
                }
                renderBadges(mergedIds);
                // titles
                // Réclamation du titre Fondateur via /profile#fondateur (réservé au fondateur).
                if (!data.founder && (location.hash || '').toLowerCase() === '#fondateur') {
                    data.founder = true;
                    setDoc(doc(db,'users',uid), { founder: true }, { merge: true }).catch(()=>{});
                }
                const earnedTitles = computeTitles(data);
                const storedTitles = Array.isArray(data.titles) ? data.titles : [];
                const mergedTitles = Array.from(new Set([...storedTitles, ...earnedTitles]));
                if (mergedTitles.length > storedTitles.length) {
                    setDoc(doc(db,'users',uid), { titles: mergedTitles }, { merge: true }).catch(()=>{});
                }
                renderTitles(mergedTitles, data.selectedTitle || null, uid);
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

function renderBadges(badgeIds) {
    if (!badgesGrid) return;
    badgesGrid.innerHTML = '';
    const list = Array.isArray(badgeIds) ? badgeIds : [];
    if (badgesCountEl) badgesCountEl.textContent = `${list.length} / ${BADGE_DEFS.length}`;
    const heroBadges = document.getElementById('hero-stat-badges');
    if (heroBadges) heroBadges.textContent = String(list.length);
    // Show all badges, greyed out if not earned
    BADGE_DEFS.forEach(def => {
        const earned = list.includes(def.id);
        const item = document.createElement('div');
        item.style.cssText = `background:rgba(255,255,255,${earned?'0.06':'0.02'});border:1px solid rgba(255,255,255,${earned?'0.12':'0.05'});border-radius:12px;padding:10px;display:flex;gap:10px;align-items:center;opacity:${earned?'1':'0.4'};transition:opacity .2s;`;
        item.title = def.desc;
        const icon = document.createElement('div');
        icon.style.cssText = `width:36px;height:36px;border-radius:8px;background:${earned?'linear-gradient(135deg,#3b82f6,#8b5cf6)':'rgba(255,255,255,0.06)'};display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;`;
        icon.textContent = def.emoji;
        const text = document.createElement('div');
        const title = document.createElement('div'); title.style.cssText = 'font-weight:700;font-size:.82rem;'; title.textContent = def.name;
        const subtitle = document.createElement('div'); subtitle.style.cssText = 'font-size:.72rem;color:#7e9ab5;margin-top:2px;'; subtitle.textContent = def.desc;
        text.appendChild(title); text.appendChild(subtitle);
        item.appendChild(icon); item.appendChild(text);
        badgesGrid.appendChild(item);
    });
}

// ── Titres : liste intelligente liée à l'arbre (8 branches Maslow) + XP ──────
// XP par branche (source de vérité = users/{uid}.tree.branches), repli levels.
const TREE_BRANCHES = ['physio','securite','appartenance','estime','cognitif','esthetique','accomplissement','transcendance'];
function branchXp(d, key) {
    const b = d && d.tree && d.tree.branches && d.tree.branches[key];
    return (b && Number(b.xp)) || 0;
}
function totalXp(d) {
    let t = TREE_BRANCHES.reduce((s, k) => s + branchXp(d, k), 0);
    if (!t && d && d.levels) t = ['body','etre','heart','order'].reduce((s, k) => s + ((d.levels[k] && d.levels[k].xp) || 0), 0);
    return t;
}
function activeBranches(d) { return TREE_BRANCHES.filter((k) => branchXp(d, k) > 0).length; }
const BRANCH_T = 300;   // ~niveau 3 d'une branche

// { id, emoji, name, desc, check(userData) } — l'ordre = ordre d'affichage.
const TITLE_DEFS = [
    { id:'fondateur',   emoji:'👑', name:'Fondateur',          desc:'Bâtisseur de ChangeYourLife',                check:d => d.founder === true || d.role === 'admin' },
    { id:'graine',      emoji:'🌱', name:'Graine éveillée',    desc:'Gagne ton premier XP',                       check:d => totalXp(d) >= 1 },
    { id:'pousse',      emoji:'🌿', name:'Jeune pousse',       desc:'Atteins 100 XP',                             check:d => totalXp(d) >= 100 },
    { id:'jardinier',   emoji:'🪴', name:'Jardinier de soi',   desc:'Fais vivre au moins 4 branches',             check:d => activeBranches(d) >= 4 },
    { id:'gardien',     emoji:'💪', name:'Gardien du corps',   desc:'Développe la branche Physiologique',         check:d => branchXp(d,'physio') >= BRANCH_T },
    { id:'ancre',       emoji:'🛡️', name:'Ancré',              desc:'Développe la branche Sécurité',              check:d => branchXp(d,'securite') >= BRANCH_T },
    { id:'tisseur',     emoji:'🤝', name:'Tisseur de liens',   desc:'Développe la branche Appartenance',          check:d => branchXp(d,'appartenance') >= BRANCH_T },
    { id:'eclaire',     emoji:'🧠', name:'Esprit éclairé',     desc:'Développe la branche Cognitif',              check:d => branchXp(d,'cognitif') >= BRANCH_T },
    { id:'createur',    emoji:'🎨', name:'Créateur',           desc:'Développe la branche Esthétique',            check:d => branchXp(d,'esthetique') >= BRANCH_T },
    { id:'batisseur',   emoji:'🚀', name:'Bâtisseur',          desc:'Développe la branche Accomplissement',       check:d => branchXp(d,'accomplissement') >= BRANCH_T },
    { id:'sage',        emoji:'✨', name:'Sage',               desc:'Développe la branche Transcendance',         check:d => branchXp(d,'transcendance') >= BRANCH_T },
    { id:'equilibre',   emoji:'⚖️', name:'Équilibriste',       desc:'Garde les 8 branches vivantes',              check:d => activeBranches(d) >= 8 },
    { id:'constant',    emoji:'🔥', name:'Constant',           desc:'Tiens une série de 7 jours',                 check:d => (d.meditation?.streak||0) >= 7 || (d.habits||[]).some(h=>(h.streak||0)>=7) },
    { id:'accompli',    emoji:'🎯', name:'Accompli',           desc:'Termine 5 objectifs',                        check:d => (d.goals||[]).filter(g=>g.completed).length >= 5 },
    { id:'chene',       emoji:'🌳', name:'Cœur de chêne',      desc:'Atteins 2 000 XP cumulés',                   check:d => totalXp(d) >= 2000 },
    { id:'centenaire',  emoji:'🏛️', name:'Arbre centenaire',   desc:'Atteins 12 000 XP cumulés',                  check:d => totalXp(d) >= 12000 },
];
function computeTitles(d) {
    return TITLE_DEFS.filter(t => { try { return t.check(d || {}); } catch(e){ return false; } }).map(t => t.name);
}
// Compat : anciens appels passant `levels`
function deriveTitlesFromLevels(levels) { return computeTitles({ levels }); }

function renderTitles(unlockedNames, selectedTitle, uid) {
    if (!titlesGrid) return;
    titlesGrid.innerHTML = '';
    const unlocked = new Set(Array.isArray(unlockedNames) ? unlockedNames : []);
    titlesGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
    TITLE_DEFS.forEach(def => {
        const isUnlocked = unlocked.has(def.name);
        const pill = document.createElement('button');
        pill.className = 'title-pill' + (isUnlocked ? '' : ' locked');
        pill.title = def.desc;
        pill.innerHTML = `<span style="margin-right:6px">${def.emoji}</span>${def.name}`;
        pill.style.cssText = 'border:1px solid rgba(255,255,255,0.14);padding:8px 13px;border-radius:999px;background:transparent;color:#e5eef8;cursor:pointer;font-weight:600;font-size:.84rem;transition:background .15s,border-color .15s,opacity .15s;';
        if (!isUnlocked) { pill.style.opacity = '0.38'; pill.style.cursor = 'default'; }
        if (def.id === 'fondateur' && isUnlocked) { pill.style.borderColor = 'rgba(231,177,92,0.6)'; pill.style.color = '#f1cd92'; }
        if (selectedTitle === def.name) { pill.style.background = 'rgba(59,130,246,0.2)'; pill.style.borderColor = 'rgba(59,130,246,0.5)'; }
        if (isUnlocked) {
            pill.addEventListener('click', async () => {
                try {
                    await setDoc(doc(db,'users',uid), { selectedTitle: def.name }, { merge: true });
                    if (titleDisplay) titleDisplay.textContent = def.name;
                    showToast('Titre sélectionné : ' + def.name);
                    renderTitles(Array.from(unlocked), def.name, uid);
                } catch(e){}
            });
        }
        titlesGrid.appendChild(pill);
    });
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

        // Dev XP buttons (only show on localhost or if ?dev=1)
        const isDev = ["127.0.0.1","localhost"].includes(location.hostname) || /[?&]dev=1(&|$)/.test(location.search);
        if (isDev) {
            const note = document.getElementById('dev-note'); if (note) note.style.display = 'block';
            ['body','etre','heart','order'].forEach(domain => {
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
                                    let levels = normalizeLevels(data.levels || defaultLevels());
                                    const cur = levels[domain] || { level:0, xp:0, nextXp:100 };
                                    let xp = cur.xp + 10, level = cur.level, nextXp = cur.nextXp || 100;
                                    while (xp >= nextXp) { xp -= nextXp; level += 1; nextXp = 100 + 20 * level; }
                                    levels[domain] = { level, xp, nextXp };
                                    tx.set(ref, { levels }, { merge: true });
                                });
                            }
                            // Reload view
                            const userRef = doc(db, 'users', user.uid);
                            const updated = await getDoc(userRef);
                            if (updated.exists()) {
                                const data = updated.data();
                                renderLevels(data.levels);
                                // badges
                                try {
                                    const newBadges = computeBadges(data.levels);
                                    const existing = Array.isArray(data.badges) ? data.badges : [];
                                    const merged = Array.from(new Set([...(existing||[]), ...newBadges]));
                                    if (merged.length !== existing.length) {
                                        await setDoc(userRef, { badges: merged }, { merge: true });
                                    }
                                    renderBadges(merged);
                                } catch(e) { /* non-blocking */ }
                                // titles
                                const earnedT = computeTitles(data);
                                const storedT = Array.isArray(data.titles) ? data.titles : [];
                                const mergedT = Array.from(new Set([...storedT, ...earnedT]));
                                if (mergedT.length !== storedT.length) { await setDoc(userRef, { titles: mergedT }, { merge: true }); }
                                renderTitles(mergedT, data.selectedTitle || null, user.uid);
                            }
                            showToast('+10 XP ajouté à ' + domain);
                        } catch (e) {
                            console.error('dev addXp failed', e);
                            showToast('Erreur addXp');
                        }
                    });
                }
            });
        }
    } else {
        window.location.href = '/login';
    }
});