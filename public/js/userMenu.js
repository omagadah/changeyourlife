// public/js/userMenu.js
// Lightweight modern user menu. Uses window._cyfFirebase.auth if available.
import { updateGlobalAvatar, normalizeVantaAndHeader } from './common.js';

export function initUserMenu() {
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

    // Build a minimal menu DOM (inserted once)
    let menu = document.getElementById('cyf-user-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'cyf-user-menu';
        menu.innerHTML = `
            <div class="cyf-menu-card">
                <div class="cyf-menu-item"><a href="/app">Mon Espace</a></div>
                <div class="cyf-menu-item"><a href="/profile">Mon Profil</a></div>
                <div class="cyf-menu-item"><a href="/settings">Paramètres</a></div>
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
            #cyf-user-menu { position: fixed; top: 70px; right: 30px; z-index: 12000; display: none; }
            .cyf-menu-card { background: rgba(20,20,20,0.95); padding: 12px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.6); min-width: 200px; border: 1px solid rgba(255,255,255,0.04); }
            .cyf-menu-item { padding: 8px 10px; }
            .cyf-menu-item a { color: #e5eef8; text-decoration: none; font-weight: 600; display: flex; align-items: center; justify-content: space-between; }
            .cyf-menu-item a:hover { text-decoration: underline; }
            .cyf-menu-sep { height: 1px; background: rgba(255,255,255,0.03); margin: 8px 0; }
            .cyf-signout { color: #ffdddd; }
            .cyf-door { display:inline-block; width:20px; height:20px; vertical-align:middle; margin-left:8px; }
        `;
        document.head.appendChild(s);
    }

    function showMenu() { menu.style.display = 'block'; }
    function hideMenu() { menu.style.display = 'none'; }

    trigger.addEventListener('click', (e) => { e.stopPropagation(); menu.style.display = (menu.style.display === 'block') ? 'none' : 'block'; });
    // click outside to close
    window.addEventListener('click', () => { if (menu.style.display === 'block') hideMenu(); });

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
