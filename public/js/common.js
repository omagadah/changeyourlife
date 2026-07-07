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
// setupUserPanel removed - replaced by public/js/userMenu.js which provides a fresh modern menu.

/**
 * Met à jour l'icône globale de l'utilisateur avec l'avatar sauvegardé ou une initiale.
 * @param {string} initial - La lettre initiale de l'email de l'utilisateur.
 */
// Jolis emojis (Twemoji) sur toutes les pages qui chargent common.js.
try { if (!document.getElementById('cyl-emoji-js')) { const _e = document.createElement('script'); _e.id = 'cyl-emoji-js'; _e.src = '/js/emoji.js'; document.head.appendChild(_e); } } catch (_) {}

// ── Couche de POLISH visuel globale (toutes les pages) ──────────────────────
// Additive et douce : transitions, survols, focus accessible, halo de champs,
// léger relief des cartes, et scrollbars « premium » sombres. Aucun changement
// de mise en page -> sans risque.
try {
  if (!document.getElementById('cyl-polish-css')) {
    const s = document.createElement('style'); s.id = 'cyl-polish-css';
    s.textContent = `
      a, button, .stat-chip, .ring-card, .qa-item, .skill-card, .org-card, .ag-ev,
      input, textarea, select {
        transition: transform .18s ease, filter .18s ease, box-shadow .2s ease,
          border-color .2s ease, background-color .2s ease, color .2s ease;
      }
      button:hover { filter: brightness(1.07); }
      button:active { transform: translateY(1px); }
      :focus-visible { outline: 2px solid rgba(132,194,94,0.75); outline-offset: 2px; border-radius: 6px; }
      input:focus, textarea:focus, select:focus { box-shadow: 0 0 0 3px rgba(132,194,94,0.18); }
      .ring-card:hover, .skill-card:hover, .qa-item:hover { transform: translateY(-2px); }
      /* Boutons PREMIUM : relief + halo vert de marque + press, sur tout le site */
      .btn-primary, .btn-enter, .ag-btn, .ap-primary, .org-addcol, .org-lock,
      .btn-practice, .header-login, .lya-voice, .sug-chip, button[type="submit"],
      .auth-submit, .cta, .btn-cta {
        position: relative; will-change: transform;
      }
      .btn-primary:hover, .btn-enter:hover, .ag-btn:hover, .ap-primary:hover,
      .org-addcol:hover, .btn-practice:hover, .header-login:hover, .sug-chip:hover,
      button[type="submit"]:hover, .auth-submit:hover, .cta:hover, .btn-cta:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 28px rgba(0,0,0,0.40), 0 0 18px rgba(132,194,94,0.28);
        filter: brightness(1.08);
      }
      .btn-primary:active, .btn-enter:active, .ag-btn:active, .ap-primary:active,
      .org-addcol:active, .btn-practice:active, .header-login:active,
      button[type="submit"]:active, .auth-submit:active, .cta:active, .btn-cta:active {
        transform: translateY(0) scale(0.975);
      }
      /* scrollbars premium (sombres) */
      * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.22) transparent; }
      *::-webkit-scrollbar { width: 10px; height: 10px; }
      *::-webkit-scrollbar-track { background: transparent; }
      *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 8px;
        border: 2px solid transparent; background-clip: padding-box; }
      *::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.32); background-clip: padding-box; }
      @media (prefers-reduced-motion: reduce) { a, button, .ring-card, .skill-card, .qa-item { transition: none !important; } }
    `;
    document.head.appendChild(s);
  }
} catch (_) {}

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

    // Logo unifié = le favicon SVG propre (identique à l'accueil), pas l'ancien
    // SVG 200×120 qui s'écrasait dans le carré 40×40 (aspect « détraqué »).
    const CYF_LOGO_IMG = `<img data-cyf-logo="1" src="/favicon.svg" alt="ChangeYourLife.ai" style="width:100%;height:100%;object-fit:contain;display:block;" />`;

    // Badge personnel : si l'utilisateur a défini une photo de profil, son badge
    // pixel-art (généré et stocké par /profile) REMPLACE le logo en haut à droite,
    // sur tout le site -> l'espace devient le sien. Sinon, logo CYL par défaut.
    const badgeUrl = localStorage.getItem('userBadgeUrl');
    const BADGE_IMG = badgeUrl ? `<span data-cyf-logo="1" style="display:block;width:100%;height:100%;border-radius:50%;padding:2px;box-sizing:border-box;background:conic-gradient(from 210deg,#e7b15c,#84c25e,#7fd1ff,#e7b15c);">`
        + `<img src="${badgeUrl}" alt="Mon badge" style="width:100%;height:100%;border-radius:50%;display:block;object-fit:cover;image-rendering:pixelated;" /></span>` : null;
    const desired = BADGE_IMG || CYF_LOGO_IMG;
    const mode = badgeUrl ? 'badge' : 'logo';

    // Favicon dynamique (onglet du navigateur) = le badge perso aussi.
    if (badgeUrl) {
        try {
            let lk = document.getElementById('cyl-dyn-favicon');
            if (!lk) { lk = document.createElement('link'); lk.id = 'cyl-dyn-favicon'; lk.rel = 'icon'; lk.type = 'image/png'; document.head.appendChild(lk); }
            if (lk.href !== badgeUrl) lk.href = badgeUrl;
        } catch (_) {}
    }

    // Évite un re-render inutile (flicker) si déjà dans le bon mode.
    const alreadyReady = userPanelTrigger.getAttribute('data-cyf-ready') === '1';
    const existingInline = userPanelTrigger.querySelector('[data-cyf-logo]');
    if (alreadyReady && existingInline && userPanelTrigger.getAttribute('data-cyf-mode') === mode) {
        Array.from(userPanelTrigger.children).forEach(ch => { if (!ch.querySelector?.('[data-cyf-logo]') && !ch.matches?.('[data-cyf-logo]')) ch.remove?.(); });
        normalizeVantaAndHeader();
        return;
    }

    // Replace the trigger contents with the badge (or unified logo).
    userPanelTrigger.innerHTML = `<span class="cyf-logo-wrapper" style="display:inline-block;width:100%;height:100%;">${desired}</span>`;
    userPanelTrigger.setAttribute('data-cyf-ready', '1');
    userPanelTrigger.setAttribute('data-cyf-mode', mode);

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
        if (header) header.style.setProperty('z-index', '15000', 'important');
        const userPanel = document.querySelector('.user-panel');
        if (userPanel) userPanel.style.setProperty('z-index', '15001', 'important');
        // Also ensure new lightweight menu stays above everything
        const newMenu = document.getElementById('cyf-user-menu');
        if (newMenu) newMenu.style.setProperty('z-index', '20000', 'important');
        const toast = document.querySelector('.toast-notification');
        if (toast) toast.style.setProperty('z-index', '16000', 'important');
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
            const swUrl = '/service-worker.js?v=68';
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

// ── Helpers partagés : escapeHtml · toast · saveWithFeedback · offline ───────
// Source unique de vérité (avant : ~17 toasts + ~10 escapeHtml recopiés dans
// chaque page — surface XSS et écritures Firestore perdues en silence).
// Import : `import { escapeHtml, toast, saveWithFeedback } from '/js/common.js';`
// Ou via le namespace global (scripts non-module) : `window.cyl.toast(...)`.

/** Échappe le HTML d'une chaîne (protège contre le XSS sur contenu utilisateur). */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let _toastHostReady = false;
function _ensureToastHost() {
  if (_toastHostReady || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.id = 'cyl-toast-css';
  s.textContent = `
    #cyl-toast-host { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
      z-index: 30000; display: flex; flex-direction: column; gap: 10px; align-items: center;
      pointer-events: none; max-width: min(92vw, 460px); }
    .cyl-toast { pointer-events: auto; display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-radius: 12px; font-size: .94rem; line-height: 1.35;
      color: #f4efe1; background: rgba(16, 22, 16, .94); border: 1px solid rgba(132,194,94,.22);
      box-shadow: 0 12px 40px rgba(0,0,0,.45); backdrop-filter: blur(10px);
      opacity: 0; transform: translateY(12px); transition: opacity .25s ease, transform .25s ease; }
    .cyl-toast.show { opacity: 1; transform: translateY(0); }
    .cyl-toast--success { border-color: rgba(132,194,94,.55); }
    .cyl-toast--error   { border-color: rgba(224,122,95,.6); background: rgba(30,16,14,.95); }
    .cyl-toast__msg { flex: 1; }
    .cyl-toast__btn { flex: none; border: 1px solid rgba(244,239,225,.28); background: transparent;
      color: #f4efe1; border-radius: 8px; padding: 6px 12px; font: inherit; font-size: .85rem;
      cursor: pointer; transition: background .18s ease; }
    .cyl-toast__btn:hover { background: rgba(244,239,225,.12); }
    @media (prefers-reduced-motion: reduce) { .cyl-toast { transition: none; } }`;
  (document.head || document.documentElement).appendChild(s);
  const host = document.createElement('div');
  host.id = 'cyl-toast-host';
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  (document.body || document.documentElement).appendChild(host);
  _toastHostReady = true;
}

/**
 * Notification non-bloquante, XSS-safe (le message est posé via textContent).
 * @param {string} message
 * @param {{type?:'info'|'success'|'error', duration?:number, action?:{label:string,onClick:Function}}} [opts]
 */
export function toast(message, opts = {}) {
  if (typeof document === 'undefined') return;
  _ensureToastHost();
  const host = document.getElementById('cyl-toast-host');
  if (!host) return;
  const { type = 'info', duration = 4000, action = null } = opts;
  const el = document.createElement('div');
  el.className = 'cyl-toast cyl-toast--' + type;
  const span = document.createElement('span');
  span.className = 'cyl-toast__msg';
  span.textContent = message;               // XSS-safe
  el.appendChild(span);
  let timer = null;
  const dismiss = () => {
    if (timer) clearTimeout(timer);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  };
  if (action && typeof action.onClick === 'function') {
    const btn = document.createElement('button');
    btn.className = 'cyl-toast__btn';
    btn.type = 'button';
    btn.textContent = action.label || 'OK';
    btn.addEventListener('click', () => { dismiss(); try { action.onClick(); } catch (_) {} });
    el.appendChild(btn);
  }
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  if (duration > 0) timer = setTimeout(dismiss, duration + (action ? 3000 : 0));
  return dismiss;
}

/**
 * Enveloppe une écriture (Firestore ou autre promesse) avec un vrai retour visuel.
 * Avant : des `await setDoc(...)` hors try/catch et des `.catch(()=>{})` faisaient
 * perdre des sauvegardes en silence. Ici, l'échec est TOUJOURS signalé + réessayable.
 * @param {() => Promise<any>} run  fonction qui lance l'écriture (rappelable pour le retry)
 * @param {{successMsg?:string, errorMsg?:string, retry?:boolean}} [opts]
 * @returns {Promise<{ok:boolean, result?:any, error?:any}>}
 */
export async function saveWithFeedback(run, opts = {}) {
  const {
    successMsg = null,
    errorMsg = "Impossible d'enregistrer. Vérifie ta connexion — ton texte est conservé.",
    retry = true,
  } = opts;
  try {
    const result = await run();
    if (successMsg) toast(successMsg, { type: 'success' });
    return { ok: true, result };
  } catch (e) {
    console.warn('[saveWithFeedback] échec', (e && e.message) || e);
    toast(errorMsg, {
      type: 'error',
      duration: 9000,
      action: retry ? { label: 'Réessayer', onClick: () => saveWithFeedback(run, opts) } : null,
    });
    return { ok: false, error: e };
  }
}

// ── Bannière hors-ligne globale ─────────────────────────────────────────────
if (typeof window !== 'undefined') {
  const initOffline = () => {
    let banner = null;
    const show = () => {
      if (banner) return;
      banner = document.createElement('div');
      banner.id = 'cyl-offline-banner';
      banner.textContent = 'Tu es hors ligne — tes changements ne seront enregistrés qu’au retour de la connexion.';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:29000;padding:9px 16px;'
        + 'text-align:center;font-size:.88rem;color:#1a1206;background:#e7b15c;'
        + 'box-shadow:0 2px 12px rgba(0,0,0,.25);';
      (document.body || document.documentElement).appendChild(banner);
    };
    const hide = () => { if (banner) { banner.remove(); banner = null; } };
    window.addEventListener('offline', show);
    window.addEventListener('online', () => { hide(); toast('De retour en ligne', { type: 'success', duration: 2500 }); });
    if (navigator && navigator.onLine === false) show();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initOffline);
  else initOffline();
  // Namespace global pour les scripts non-module (pratique + rétro-compat).
  window.cyl = Object.assign(window.cyl || {}, { escapeHtml, toast, saveWithFeedback });
}

// ── SYL overlay (orb + chat) - chargée sur toutes les pages auth ────────────
// Pas sur la landing, login, signup, verify-email (pages publiques sans SYL).
(function maybeLoadSYLOverlay() {
  try {
    var p = location.pathname;
    if (p === '/' || p === '' || p.indexOf('/login') === 0 || p.indexOf('/signup') === 0 || p.indexOf('/verify-email') === 0
        || p.indexOf('/legal') === 0 || p.indexOf('/cgu') === 0 || p.indexOf('/confidentialite') === 0) return;
    // import dynamique : non bloquant si le module échoue
    import('/js/lya-overlay.js').catch(function (e) { try { console.warn('[lya-overlay]', e && e.message || e); } catch (_) {} });
  } catch (_) { /* ignore */ }
})();