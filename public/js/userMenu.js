// public/js/userMenu.js
// Lightweight modern user menu. Uses window._cyfFirebase.auth if available.
import { updateGlobalAvatar, normalizeVantaAndHeader } from './common.js';

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
                position: fixed; top: 18px; right: 76px; z-index: 10001;
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
            @media (max-width: 600px) { #cyf-theme-toggle { top: 14px; right: 62px; width: 32px; height: 32px; } }
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

    const ctxHtml = ctxLinks.length
        ? ctxLinks.map(l => `<div class="cyf-menu-item cyf-ctx-item"><a href="${l.href}">${l.label}</a></div>`).join('')
          + '<div class="cyf-menu-sep cyf-ctx-sep"></div>'
        : '';

    // Build a minimal menu DOM (inserted once)
    let menu = document.getElementById('cyf-user-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'cyf-user-menu';
        menu.innerHTML = `
            <div class="cyf-menu-card">
                ${ctxHtml}
                <div class="cyf-menu-item"><a href="/app">🏠 Mon Espace</a></div>
                <div class="cyf-menu-item"><a href="/profile">👤 Mon Profil</a></div>
                <div class="cyf-menu-item"><a href="/settings">⚙️ Paramètres</a></div>
                <div class="cyf-menu-sep"></div>
                <div class="cyf-menu-item"><a href="#" id="cyf-signout" class="cyf-signout">Se déconnecter <span class="cyf-door"> </span></a></div>
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
            /* Ensure the menu always renders above headers, canvases, toasts, etc. */
            #cyf-user-menu { position: fixed; top: 70px; right: 30px; z-index: 20000; display: none; }
            .cyf-menu-card { background: rgba(20,20,20,0.95); padding: 12px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.6); min-width: 200px; border: 1px solid rgba(255,255,255,0.04); }
            .cyf-menu-item { padding: 8px 10px; }
            .cyf-menu-item a { color: #e5eef8; text-decoration: none; font-weight: 600; display: flex; align-items: center; justify-content: space-between; }
            .cyf-menu-item a:hover { text-decoration: underline; }
            .cyf-menu-sep { height: 1px; background: rgba(255,255,255,0.03); margin: 8px 0; }
            .cyf-signout { color: #ffdddd; }
            .cyf-door { display:inline-block; width:20px; height:20px; vertical-align:middle; margin-left:8px; }
            /* Contextual links styling */
            .cyf-ctx-item a { color: #93c5fd !important; }
            .cyf-ctx-item a:hover { color: #bfdbfe !important; }
            .cyf-ctx-sep { background: rgba(59,130,246,0.15) !important; height: 1px; }
        `;
        document.head.appendChild(s);
    }

    function showMenu() { menu.style.display = 'block'; }
    function hideMenu() { menu.style.display = 'none'; }

    trigger.addEventListener('click', (e) => { e.stopPropagation(); menu.style.display = (menu.style.display === 'block') ? 'none' : 'block'; });
    // Keyboard accessibility: toggle with Enter/Space when trigger is focused
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
        }
    });
    // Click outside to close (ignore clicks inside trigger or menu)
    window.addEventListener('click', (e) => {
        try {
            const t = e.target;
            if (!menu) return;
            if (trigger.contains(t) || menu.contains(t)) return;
            if (menu.style.display === 'block') hideMenu();
        } catch(_) { if (menu.style.display === 'block') hideMenu(); }
    });

    // Close on Escape for convenience
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu.style.display === 'block') hideMenu();
    });

    // Mark as initialized
    trigger.setAttribute('data-cyf-menu-ready', '1');

    // Sign out
    // bind sign-out after menu insertion (menu may be created earlier or later)
    function bindSignOut() {
        const signoutEl = document.getElementById('cyf-signout');
        if (!signoutEl) return;
        // inject a small door+arrow SVG into the .cyf-door span for clarity
        const doorSpan = signoutEl.querySelector('.cyf-door');
        if (doorSpan && doorSpan.innerHTML.trim() === '') {
            doorSpan.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M3 12v6a2 2 0 0 0 2 2h10"></path><path d="M10 12V8a2 2 0 0 1 2-2h4"></path><path d="M16 16l4-4"></path><path d="M20 12l-4-4"></path></svg>`;
        }
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

    // Hide current page's menu item for clarity
    try {
        const path = (window.location.pathname || '/').replace(/\/$/, '');
        const anchors = menu.querySelectorAll('a');
        anchors.forEach(a => {
            try {
                // Resolve anchor href reliably even if it's absolute or relative
                const hrefPath = new URL(a.getAttribute('href') || a.href, window.location.origin).pathname.replace(/\/$/, '');
                // Consider also index/home mappings
                const normalizedHref = hrefPath === '' ? '/' : hrefPath;
                const normalizedPath = path === '' ? '/' : path;
                // If the anchor points to the same path (or to a deeper fragment of same page), hide it
                if (normalizedHref === normalizedPath || normalizedPath.startsWith(normalizedHref + '/')) {
                    a.parentElement.style.display = 'none';
                }
            } catch(e){ /* ignore per-anchor errors */ }
        });
    } catch(e){ console.warn('userMenu hide current failed', e); }
}

export default { initUserMenu };
