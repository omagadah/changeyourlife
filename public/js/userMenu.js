// public/js/userMenu.js
// Lightweight modern user menu. Uses window._cyfFirebase.auth if available.
import { updateGlobalAvatar, normalizeVantaAndHeader } from './common.js';
import { getNotifs, markAllRead, unreadCount } from './notifications.js';

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24); return `il y a ${d} j`;
}

// ── Toggle thème (dark/light) global dans le bandeau supérieur ──────────────
// S'appuie sur le système existant (classe `light-mode` + localStorage 'theme').
export function initThemeToggle() {
    if (document.getElementById('cyf-theme-toggle')) return;

    const SUN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
    const MOON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

    const styleId = 'cyf-theme-toggle-style';
    if (!document.getElementById(styleId)) {
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent = `
            #cyf-theme-toggle {
                position: fixed; top: 18px; right: 72px; z-index: 10001;
                width: 36px; height: 36px; border-radius: 50%;
                display: inline-flex; align-items: center; justify-content: center;
                cursor: pointer; padding: 0;
                color: #e5eef8;
                background: rgba(8,16,28,0.55);
                border: 1px solid rgba(255,255,255,0.12);
                backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                transition: transform .2s var(--ease,cubic-bezier(.4,0,.2,1)), box-shadow .2s, background .2s, color .2s;
            }
            #cyf-theme-toggle:hover { transform: scale(1.08); box-shadow: 0 0 16px rgba(255,255,255,0.18); }
            #cyf-theme-toggle:active { transform: scale(0.94); }
            #cyf-theme-toggle svg { display: block; }
            body.light-mode #cyf-theme-toggle { color: #1a1a1a; background: rgba(255,255,255,0.7); border-color: rgba(0,0,0,0.12); }
            @media (max-width: 600px) { #cyf-theme-toggle { top: 14px; right: 56px; width: 32px; height: 32px; } }
        `;
        document.head.appendChild(s);
    }

    const btn = document.createElement('button');
    btn.id = 'cyf-theme-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Basculer le thème clair/sombre');
    btn.title = 'Thème clair / sombre';

    const isLight = () => (localStorage.getItem('theme') === 'light');
    const render = () => { btn.innerHTML = isLight() ? MOON : SUN; };
    render();

    btn.addEventListener('click', () => {
        const next = isLight() ? 'dark' : 'light';
        try { localStorage.setItem('theme', next); } catch (_) {}
        document.body.classList.toggle('light-mode', next === 'light');
        render();
        // Sync avec la page Paramètres si des boutons y sont présents
        try { window.dispatchEvent(new CustomEvent('cyf:theme-changed', { detail: next })); } catch (_) {}
    });

    document.body.appendChild(btn);
}

export function initUserMenu() {
    try { initThemeToggle(); } catch (e) { /* ignore */ }
    const trigger = document.querySelector('.user-panel-trigger');
    if (!trigger) return;

    // Prevent double-initialization (avoid multiple click handlers and flicker)
    if (trigger.getAttribute('data-cyf-menu-ready') === '1' && document.getElementById('cyf-user-menu')) {
        try { normalizeVantaAndHeader(); } catch (e) { /* ignore */ }
        return;
    }

    // Ensure the global logo is present in the trigger so the menu anchor looks identical everywhere
    try { updateGlobalAvatar(); } catch (e) { /* ignore */ }

    // also normalize Vanta/header stacking to avoid z-index issues
    try { normalizeVantaAndHeader(); } catch (e) { /* ignore */ }

    // ── Contextual nav links (defined per-page via window.CYF_NAV_LINKS) ──
    // Format: [{ href: '/journal/', label: '📔 Journal' }, ...]
    const ctxLinks = Array.isArray(window.CYF_NAV_LINKS) ? window.CYF_NAV_LINKS : [];

    // Chaque item porte un index --i (révélation en cascade à l'ouverture).
    let _i = 0;
    const vitem = (href, icon, label, extra = '') =>
        `<a class="cyf-vitem${extra}" href="${href}" style="--i:${_i++}">
            <span class="cyf-vicon">${icon}</span><span class="cyf-vlabel">${label}</span>
            <span class="cyf-vchev">›</span></a>`;

    const ctxHtml = ctxLinks.length
        ? ctxLinks.map(l => `<a class="cyf-vitem cyf-ctx" href="${l.href}" style="--i:${_i++}">
              <span class="cyf-vlabel">${l.label}</span><span class="cyf-vchev">›</span></a>`).join('')
          + '<div class="cyf-menu-sep cyf-ctx-sep"></div>'
        : '';

    // Build the vertical menu DOM (inserted once)
    let menu = document.getElementById('cyf-user-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'cyf-user-menu';
        menu.innerHTML = `
            <div class="cyf-menu-card">
                <div class="cyf-view cyf-view-main" data-view="main">
                    ${ctxHtml}
                    ${vitem('/app', '🏠', 'Mon Espace')}
                    <button class="cyf-vitem cyf-vbtn" id="cyf-open-notifs" type="button" style="--i:${_i++}">
                        <span class="cyf-vicon">🔔</span><span class="cyf-vlabel">Notifications</span>
                        <span class="cyf-vbadge" id="cyf-notif-badge" hidden>0</span>
                        <span class="cyf-vchev">›</span></button>
                    ${vitem('/profile', '👤', 'Mon Profil')}
                    ${vitem('/settings', '⚙️', 'Paramètres')}
                    <div class="cyf-menu-sep"></div>
                    <a class="cyf-vitem cyf-signout" href="#" id="cyf-signout" style="--i:${_i++}">
                        <span class="cyf-vicon">🚪</span><span class="cyf-vlabel">Se déconnecter</span></a>
                </div>
                <div class="cyf-view cyf-view-notifs" data-view="notifs" hidden>
                    <button class="cyf-back" id="cyf-notifs-back" type="button"><span class="cyf-back-arrow">‹</span> Notifications</button>
                    <div class="cyf-notifs-list" id="cyf-notifs-list">
                        <div class="cyf-notifs-empty"><span class="cyf-notifs-bell">🔕</span>Aucune notification pour l'instant.</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(menu);
    }

    // style minimally (kept in JS for isolation)
    const styleId = 'cyf-user-menu-style';
    if (!document.getElementById(styleId)) {
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent = `
            /* Menu vertical animé - toujours au-dessus des headers/canvas/toasts */
            #cyf-user-menu { position: fixed; top: 66px; right: 24px; z-index: 20000; display: none; }
            #cyf-user-menu.cyf-open { display: block; }
            .cyf-menu-card {
                position: relative; overflow: hidden;
                width: 244px; padding: 8px;
                background: linear-gradient(180deg, rgba(24,28,38,0.98), rgba(14,17,24,0.98));
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 16px;
                box-shadow: 0 18px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
                transform-origin: top right;
                transform: translateY(-8px) scale(0.96); opacity: 0;
                transition: transform .26s cubic-bezier(.16,1,.3,1), opacity .2s ease;
            }
            #cyf-user-menu.cyf-open .cyf-menu-card { transform: translateY(0) scale(1); opacity: 1; }

            .cyf-view { display: flex; flex-direction: column; gap: 2px; }
            .cyf-view[hidden] { display: none; }

            .cyf-vitem {
                display: flex; align-items: center; gap: 12px;
                width: 100%; padding: 11px 12px; border: none; background: transparent;
                border-radius: 10px; cursor: pointer; text-decoration: none;
                font-family: inherit; font-size: 0.9rem; font-weight: 650; text-align: left;
                color: #e5eef8;
                /* état de départ pour la cascade */
                opacity: 0; transform: translateX(10px);
            }
            #cyf-user-menu.cyf-open .cyf-view-main .cyf-vitem {
                opacity: 1; transform: none;
                transition: opacity .3s ease, transform .34s cubic-bezier(.16,1,.3,1), background .16s ease;
                transition-delay: calc(var(--i, 0) * 42ms + 60ms);
            }
            .cyf-vitem:hover { background: rgba(255,255,255,0.07); }
            .cyf-vitem:active { transform: scale(0.98); }
            .cyf-vicon { font-size: 1.15rem; width: 22px; text-align: center; flex-shrink: 0; }
            .cyf-vlabel { flex: 1; min-width: 0; }
            .cyf-vchev { color: rgba(255,255,255,0.28); font-size: 1.1rem; transition: transform .18s ease, color .18s ease; }
            .cyf-vitem:hover .cyf-vchev { color: rgba(255,255,255,0.6); transform: translateX(2px); }
            .cyf-vbadge {
                background: #ef4444; color: #fff; font-size: 0.66rem; font-weight: 800;
                min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
                display: inline-flex; align-items: center; justify-content: center;
            }

            .cyf-menu-sep { height: 1px; background: rgba(255,255,255,0.07); margin: 6px 4px; }
            .cyf-signout { color: #fca5a5; }
            .cyf-signout:hover { background: rgba(239,68,68,0.12); }
            .cyf-ctx .cyf-vlabel { color: #93c5fd; }
            .cyf-ctx:hover .cyf-vlabel { color: #bfdbfe; }
            .cyf-ctx-sep { background: rgba(59,130,246,0.18); }

            /* Vue Notifications */
            .cyf-back {
                display: flex; align-items: center; gap: 6px;
                width: 100%; padding: 9px 10px; margin-bottom: 4px;
                background: transparent; border: none; cursor: pointer;
                color: #cbd5e1; font-family: inherit; font-weight: 700; font-size: 0.86rem;
                border-radius: 9px;
            }
            .cyf-back:hover { background: rgba(255,255,255,0.06); }
            .cyf-back-arrow { font-size: 1.2rem; line-height: 1; }
            .cyf-notifs-list { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
            .cyf-notifs-empty {
                display: flex; flex-direction: column; align-items: center; gap: 8px;
                padding: 26px 12px; text-align: center;
                color: #8ba0b8; font-size: 0.82rem; line-height: 1.5;
            }
            .cyf-notifs-bell { font-size: 1.9rem; opacity: 0.7; }
            .cyf-notif { position: relative; display: flex; gap: 10px; padding: 10px 10px 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.03); }
            .cyf-notif.unread { background: rgba(124,58,237,0.12); }
            .cyf-notif.unread::before { content: ''; position: absolute; left: 4px; top: 50%; transform: translateY(-50%); width: 5px; height: 5px; border-radius: 50%; background: #a855f7; }
            .cyf-notif-ic { font-size: 1.15rem; flex-shrink: 0; line-height: 1.3; }
            .cyf-notif-body { min-width: 0; flex: 1; }
            .cyf-notif-title { font-size: 0.82rem; font-weight: 700; color: #eef2f8; line-height: 1.25; }
            .cyf-notif-text { font-size: 0.76rem; color: #a9b6c8; margin-top: 2px; line-height: 1.35; }
            .cyf-notif-time { font-size: 0.68rem; color: #6b7789; margin-top: 3px; }
            body.light-mode .cyf-notif { background: rgba(0,0,0,0.04); }
            body.light-mode .cyf-notif.unread { background: rgba(124,58,237,0.1); }
            body.light-mode .cyf-notif-title { color: #1a2230; }
            body.light-mode .cyf-notif-text { color: #556; }

            /* Thème clair */
            body.light-mode .cyf-menu-card { background: linear-gradient(180deg, #ffffff, #f2f4f7); border-color: rgba(0,0,0,0.08); box-shadow: 0 18px 50px rgba(0,0,0,0.18); }
            body.light-mode .cyf-vitem { color: #1a2230; }
            body.light-mode .cyf-vitem:hover { background: rgba(0,0,0,0.05); }
            body.light-mode .cyf-menu-sep { background: rgba(0,0,0,0.08); }
            body.light-mode .cyf-signout { color: #dc2626; }
            @media (prefers-reduced-motion: reduce) {
                .cyf-menu-card, #cyf-user-menu.cyf-open .cyf-view-main .cyf-vitem { transition: none !important; }
                .cyf-view-main .cyf-vitem { opacity: 1 !important; transform: none !important; }
            }
        `;
        document.head.appendChild(s);
    }

    const isOpen = () => menu.classList.contains('cyf-open');
    // Bascule sur les vues (main / notifs) sans fermer le menu.
    function showView(name) {
        menu.querySelectorAll('.cyf-view').forEach(v => { v.hidden = (v.dataset.view !== name); });
    }
    function showMenu() { showView('main'); menu.classList.add('cyf-open'); }
    function hideMenu() { menu.classList.remove('cyf-open'); }
    function toggleMenu() { isOpen() ? hideMenu() : showMenu(); }

    trigger.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
    // Keyboard accessibility: toggle with Enter/Space when trigger is focused
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(); }
    });

    // ── Vue Notifications (espace dédié, alimenté par notifications.js) ──
    const notifsBtn = document.getElementById('cyf-open-notifs');
    const notifsBack = document.getElementById('cyf-notifs-back');
    const notifBadge = document.getElementById('cyf-notif-badge');
    const notifsList = document.getElementById('cyf-notifs-list');

    // Pastille de non-lus directement sur le logo (visible sans ouvrir le menu).
    let triggerDot = trigger.querySelector('.cyf-trigger-dot');
    if (!triggerDot) {
        if (getComputedStyle(trigger).position === 'static') trigger.style.position = 'relative';
        triggerDot = document.createElement('span');
        triggerDot.className = 'cyf-trigger-dot';
        triggerDot.style.cssText = 'position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:#ef4444;border:2px solid rgba(8,16,28,0.9);box-shadow:0 0 8px rgba(239,68,68,0.7);display:none;pointer-events:none;';
        trigger.appendChild(triggerDot);
    }
    function refreshBadge() {
        const n = unreadCount();
        if (notifBadge) { notifBadge.textContent = n > 99 ? '99+' : String(n); notifBadge.hidden = n === 0; }
        if (triggerDot) triggerDot.style.display = n > 0 ? 'block' : 'none';
    }
    function renderNotifsList() {
        if (!notifsList) return;
        const items = getNotifs();
        if (!items.length) {
            notifsList.innerHTML = `<div class="cyf-notifs-empty"><span class="cyf-notifs-bell">🔕</span>Aucune notification pour l'instant.<br><span style="font-size:.74rem;opacity:.8">Tes actions (XP, giveaway...) apparaîtront ici.</span></div>`;
            return;
        }
        notifsList.innerHTML = items.map(n => `
            <div class="cyf-notif${n.read ? '' : ' unread'}">
                <span class="cyf-notif-ic">${escapeHtml(n.emoji || '🔔')}</span>
                <div class="cyf-notif-body">
                    <div class="cyf-notif-title">${escapeHtml(n.title)}</div>
                    ${n.body ? `<div class="cyf-notif-text">${escapeHtml(n.body)}</div>` : ''}
                    <div class="cyf-notif-time">${escapeHtml(timeAgo(n.ts))}</div>
                </div>
            </div>`).join('');
    }
    function openNotifs() {
        renderNotifsList();
        showView('notifs');
        markAllRead();       // vues → lues
        refreshBadge();
    }
    if (notifsBtn) notifsBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openNotifs(); });
    if (notifsBack) notifsBack.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showView('main'); });
    // MAJ live du badge + de la liste quand une notif arrive
    window.addEventListener('cyl:notifs-changed', () => {
        refreshBadge();
        if (menu.querySelector('.cyf-view-notifs') && !menu.querySelector('.cyf-view-notifs').hidden) renderNotifsList();
    });
    refreshBadge();

    // Click outside to close (ignore clicks inside trigger or menu)
    window.addEventListener('click', (e) => {
        try {
            const t = e.target;
            if (!menu) return;
            if (trigger.contains(t) || menu.contains(t)) return;
            if (isOpen()) hideMenu();
        } catch(_) { if (isOpen()) hideMenu(); }
    });

    // Close on Escape for convenience
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen()) hideMenu();
    });

    // Mark as initialized
    trigger.setAttribute('data-cyf-menu-ready', '1');

    // Sign out
    // bind sign-out after menu insertion (menu may be created earlier or later)
    function bindSignOut() {
        const signoutEl = document.getElementById('cyf-signout');
        if (!signoutEl) return;
        signoutEl.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const auth = window._cyfFirebase && window._cyfFirebase.auth;
                if (auth) await auth.signOut();
                window.location.href = '/login';
            } catch (err) { console.error('Sign out failed', err); }
        });
    }
    bindSignOut();

    // Hide current page's menu item for clarity (l'item lui-même, pas la vue)
    try {
        const path = (window.location.pathname || '/').replace(/\/$/, '');
        const anchors = menu.querySelectorAll('.cyf-view-main a.cyf-vitem');
        anchors.forEach(a => {
            try {
                const raw = a.getAttribute('href') || '';
                if (!raw || raw.startsWith('#')) return; // ne jamais masquer la déconnexion
                const hrefPath = new URL(raw, window.location.origin).pathname.replace(/\/$/, '');
                const normalizedHref = hrefPath === '' ? '/' : hrefPath;
                const normalizedPath = path === '' ? '/' : path;
                if (normalizedHref === normalizedPath || normalizedPath.startsWith(normalizedHref + '/')) {
                    a.style.display = 'none';
                }
            } catch(e){ /* ignore per-anchor errors */ }
        });
    } catch(e){ console.warn('userMenu hide current failed', e); }
}

export default { initUserMenu };
