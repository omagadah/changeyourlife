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
// setupUserPanel removed — replaced by public/js/userMenu.js which provides a fresh modern menu.

/**
 * Met à jour l'icône globale de l'utilisateur avec l'avatar sauvegardé ou une initiale.
 * @param {string} initial - La lettre initiale de l'email de l'utilisateur.
 */
export function updateGlobalAvatar(initial) {
    const userPanelTrigger = document.querySelector('.user-panel-trigger');
    if (!userPanelTrigger) return;
    const avatarUrl = localStorage.getItem('userAvatarUrl');
    // We'll use an inline SVG logo as the single source-of-truth so it's identical on every page
    // and doesn't require an extra network round-trip. The SVG is marked with data-cyf-logo.
    const CYF_INLINE_LOGO = `
<svg data-cyf-logo="1" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <g stroke-width="3">
    <circle cx="60" cy="60" r="40" fill="black" stroke="#3399ff" stroke-width="8"/>
    <line x1="100" y1="60" x2="130" y2="30" stroke="white"/>
    <line x1="100" y1="60" x2="130" y2="60" stroke="white"/>
    <line x1="100" y1="60" x2="130" y2="90" stroke="white"/>
    <circle cx="150" cy="30" r="18" fill="none" stroke="white"/>
    <circle cx="150" cy="60" r="18" fill="none" stroke="white"/>
    <circle cx="150" cy="90" r="18" fill="none" stroke="white"/>
    <g fill="none" stroke="white" stroke-linecap="round">
      <circle cx="145" cy="30" r="3"/>
      <circle cx="155" cy="30" r="3"/>
      <line x1="145" y1="30" x2="155" y2="30"/>
      <path d="M 150 52 l 6 10 h -12 z" />
      <circle cx="150" cy="85" r="3"/>
      <circle cx="144" cy="95" r="3"/>
      <circle cx="156" cy="95" r="3"/>
      <line x1="150" y1="85" x2="144" y2="95"/>
      <line x1="150" y1="85" x2="156" y2="95"/>
    </g>
  </g>
</svg>`;

    // Inject a tiny style once to unify look & hover halo across pages (do this BEFORE any early return)
    const styleId = 'cyf-trigger-global-style';
    if (!document.getElementById(styleId)) {
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent = `
            .user-panel-trigger { width: 40px; height: 40px; background-color: transparent !important; border: none !important; border-radius: 8px; padding: 0 !important; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: transform 0.2s ease, box-shadow 0.2s ease; user-select: none; }
            .user-panel-trigger:hover { transform: scale(1.06); box-shadow: 0 0 14px rgba(255,255,255,0.55) !important; }
            .user-panel-trigger .cyf-logo-wrapper svg { width: 100%; height: 100%; display: block; border-radius: 6px; }
        `;
        document.head.appendChild(s);
    }

    // If we've already set up the logo once, avoid re-rendering to prevent flicker
    const alreadyReady = userPanelTrigger.getAttribute('data-cyf-ready') === '1';
    const existingInline = userPanelTrigger.querySelector('svg[data-cyf-logo]');
    if (alreadyReady && existingInline) {
        // Ensure only the logo remains
        Array.from(userPanelTrigger.children).forEach(ch => { if (!ch.querySelector?.('svg[data-cyf-logo]') && ch.tagName !== 'SVG') ch.remove?.(); });
        normalizeVantaAndHeader();
        return;
    }

    // Replace the trigger contents with our unified inline logo (idempotent)
    userPanelTrigger.innerHTML = `<span class="cyf-logo-wrapper" style="display:inline-block;width:100%;height:100%;">${CYF_INLINE_LOGO}</span>`;
    userPanelTrigger.setAttribute('data-cyf-ready', '1');

    // Make sure the inserted SVG scales nicely inside the trigger
    const svgEl = userPanelTrigger.querySelector('svg[data-cyf-logo]');
    if (svgEl) {
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.style.display = 'block';
    }

    // After injecting the logo, ensure Vanta and header stacking/context are normalized
    normalizeVantaAndHeader();
}

/**
 * Normalize Vanta background and header stacking so the animated background is always
 * full-viewport, behind UI, and never captures pointer events. Also raises header/menu z-index.
 */
export function normalizeVantaAndHeader() {
    try {
        const vbg = document.getElementById('vanta-birds-bg');
        if (vbg) {
            // apply important rules so inline page CSS won't accidentally float the canvas above the UI
            vbg.style.setProperty('position', 'fixed', 'important');
            vbg.style.setProperty('top', '0', 'important');
            vbg.style.setProperty('left', '0', 'important');
            vbg.style.setProperty('width', '100%', 'important');
            vbg.style.setProperty('height', '100vh', 'important');
            vbg.style.setProperty('z-index', '-1', 'important');
            vbg.style.setProperty('pointer-events', 'none', 'important');
        }
        const c = document.querySelector('#vanta-birds-bg canvas');
        if (c) {
            c.style.setProperty('position', 'absolute', 'important');
            c.style.setProperty('top', '0', 'important');
            c.style.setProperty('left', '0', 'important');
            c.style.setProperty('width', '100%', 'important');
            c.style.setProperty('height', '100%', 'important');
            c.style.setProperty('pointer-events', 'none', 'important');
            c.style.setProperty('z-index', '-1', 'important');
        }
        // Ensure header and panels are above Vanta
        const header = document.querySelector('.header');
        if (header) header.style.setProperty('z-index', '12000', 'important');
        const userPanel = document.querySelector('.user-panel');
        if (userPanel) userPanel.style.setProperty('z-index', '12001', 'important');
        const toast = document.querySelector('.toast-notification');
        if (toast) toast.style.setProperty('z-index', '12002', 'important');
    } catch (e) {
        // don't break pages if normalization fails
        console.warn('normalizeVantaAndHeader failed', e);
    }
}

// If running in the browser, proactively normalize Vanta and observe for canvas insertion
if (typeof window !== 'undefined') {
    try {
        // A short delay to let pages that initialize Vanta immediately finish
        setTimeout(() => { try { normalizeVantaAndHeader(); } catch (e) {} }, 80);

        // Observe DOM changes and normalize when the Vanta canvas appears (some pages create it after load)
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.addedNodes && m.addedNodes.length) {
                    if (document.querySelector('#vanta-birds-bg canvas')) { normalizeVantaAndHeader(); break; }
                }
            }
        });
        observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

        // Register service worker once globally, if supported and not already registered
        if ('serviceWorker' in navigator) {
            const swUrl = '/service-worker.js?v=4';
            const showUpdateToast = (msg = 'Nouvelle version disponible', action = 'Mettre à jour', onClick = () => location.reload()) => {
                if (document.getElementById('cyf-sw-toast')) return;
                const wrap = document.createElement('div');
                wrap.id = 'cyf-sw-toast';
                wrap.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:12003;background:rgba(30,30,30,0.9);backdrop-filter:blur(10px);color:#fff;padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);display:flex;gap:10px;align-items:center;box-shadow:0 8px 32px rgba(0,0,0,0.3)';
                const text = document.createElement('span'); text.textContent = msg;
                const btn = document.createElement('button'); btn.textContent = action; btn.style.cssText = 'margin-left:8px;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:#3b82f6;color:#fff;cursor:pointer;font-weight:600';
                btn.addEventListener('click', () => { try { onClick(); } catch(e) {} document.body.removeChild(wrap); });
                const close = document.createElement('button'); close.textContent = '×'; close.ariaLabel = 'Fermer'; close.style.cssText = 'margin-left:6px;padding:0 8px;border:none;background:transparent;color:#ccc;font-size:18px;cursor:pointer'; close.addEventListener('click', () => { document.body.removeChild(wrap); });
                wrap.appendChild(text); wrap.appendChild(btn); wrap.appendChild(close);
                document.body.appendChild(wrap);
            };

            navigator.serviceWorker.getRegistration().then((reg) => {
                if (!reg) {
                    navigator.serviceWorker.register(swUrl).then((registration) => {
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            if (!newWorker) return;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // Inform user a new version is available
                                    showUpdateToast();
                                }
                            });
                        });
                    }).catch(() => {/* silent */});
                } else {
                    // Proactively check for an update
                    reg.update().catch(() => {/* ignore */});
                    // If a new worker takes control, prompt the user
                    let prompted = false;
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (prompted) return; prompted = true; showUpdateToast('Le site a été mis à jour', 'Recharger');
                    });
                }
            }).catch(() => {/* ignore */});
        }
    } catch (e) { /* ignore in non-browser contexts */ }
}