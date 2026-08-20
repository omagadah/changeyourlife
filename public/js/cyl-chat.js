// /js/cyl-chat.js - Bulle de chat CYL (assistant de vie propulsé par Claude).
// S'affiche en bas à droite quand l'utilisateur est connecté. Parle à /api/chat
// (sécurisé par ID token Firebase) et oriente vers les modules du site.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { mountAvatar, setThinking } from '/js/cyl-avatar.js';

let auth;
if (window._cyfFirebase) { ({ auth } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth } = window._cyfFirebase); }

if (window.__cylChat) { /* déjà chargé */ } else {
  window.__cylChat = true;

  const MODULE_LABELS = {
    meditation: 'Méditation', journal: 'Journal', objectifs: 'Objectifs', habitudes: 'Habitudes',
    sommeil: 'Sommeil', humeur: 'Humeur', gratitude: 'Gratitude', bilan: 'Bilan',
    autoevaluation: 'Roue de vie', codex: 'Codex', organizer: 'ORGANIZER', plan: 'Mon plan',
    competences: 'Compétences', agenda: 'Agenda', yourlife: 'Ma pyramide',
    physio: 'Physiologique', securite: 'Sécurité', appartenance: 'Appartenance', estime: 'Estime',
    cognitif: 'Cognitif', esthetique: 'Esthétique', accomplissement: 'Accomplissement', transcendance: 'Transcendance',
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function injectCSS() {
    if (document.getElementById('cyl-chat-css')) return;
    const s = document.createElement('style'); s.id = 'cyl-chat-css';
    s.textContent = `
      .cyl-fab{position:fixed;right:20px;bottom:20px;z-index:99990;width:58px;height:58px;border-radius:50%;
        border:none;cursor:pointer;padding:0;box-shadow:0 10px 30px rgba(0,0,0,.45);transition:transform .2s, filter .2s;}
      .cyl-fab:hover{transform:translateY(-3px) scale(1.04);filter:brightness(1.08);}
      .cyl-fab-orb{width:100%;height:100%;border-radius:50%;
        background:radial-gradient(circle at 36% 32%,#fbe6b0,#e7b15c 40%,#4a7a3a 100%);
        box-shadow:inset 0 0 12px rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;}
      /* La taille vit dans deux variables : la poignee les ecrit, le stockage
         local les relit d'une visite a l'autre. Les bornes empechent de reduire
         la fenetre a un timbre ou de la faire deborder de l'ecran. */
      .cyl-panel{position:fixed;right:20px;bottom:20px;z-index:99991;
        --cw:380px; --ch:560px;
        width:min(var(--cw),calc(100vw - 32px));
        height:min(var(--ch),calc(100vh - 40px));display:none;flex-direction:column;border-radius:18px;overflow:hidden;
        background:rgba(8,16,28,0.96);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.12);
        box-shadow:0 24px 64px rgba(0,0,0,.55);}
      .cyl-panel.open{display:flex;animation:cylUp .26s cubic-bezier(.4,0,.2,1);}
      @keyframes cylUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:none;}}
      .cyl-head{display:flex;align-items:center;gap:11px;padding:13px 15px;border-bottom:1px solid rgba(255,255,255,0.08);}
      .cyl-head-orb{width:34px;height:34px;border-radius:50%;flex-shrink:0;
        background:radial-gradient(circle at 36% 32%,#fbe6b0,#e7b15c 40%,#4a7a3a 100%);box-shadow:0 0 14px rgba(231,177,92,.4);}
      .cyl-head-id{flex:1;}
      .cyl-head-name{font:800 13px Segoe UI,Roboto,sans-serif;letter-spacing:1px;color:#fff;}
      .cyl-head-sub{font:500 10.5px Segoe UI,Roboto,sans-serif;color:#8fb3a0;margin-top:1px;}
      .cyl-x{width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);
        color:#aab7cf;cursor:pointer;font-size:1rem;line-height:1;}
      .cyl-x:hover{background:rgba(255,255,255,0.1);color:#fff;}
      .cyl-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}
      .cyl-msg{max-width:84%;padding:9px 12px;border-radius:14px;font:500 13.5px Segoe UI,Roboto,sans-serif;line-height:1.5;white-space:pre-wrap;}
      .cyl-msg.user{align-self:flex-end;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border-bottom-right-radius:5px;}
      .cyl-msg.cyl{align-self:flex-start;background:rgba(255,255,255,0.06);color:#e8eef7;border:1px solid rgba(255,255,255,0.07);border-bottom-left-radius:5px;}
      .cyl-msg.typing{color:#8fb3a0;font-style:italic;}
      .cyl-mods{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:84%;margin-top:-3px;}
      .cyl-mod{font:700 11.5px Segoe UI,Roboto,sans-serif;text-decoration:none;padding:6px 11px;border-radius:99px;
        background:rgba(132,194,94,0.12);border:1px solid rgba(132,194,94,0.35);color:#a7e08a;transition:all .15s;}
      .cyl-mod:hover{background:rgba(132,194,94,0.22);}
      .cyl-form{display:flex;gap:8px;padding:11px;border-top:1px solid rgba(255,255,255,0.08);}
      .cyl-input{flex:1;resize:none;max-height:90px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);
        background:rgba(255,255,255,0.05);color:#eef4ff;font:500 13.5px Segoe UI,Roboto,sans-serif;font-family:inherit;}
      .cyl-input:focus{outline:none;border-color:rgba(231,177,92,0.5);}
      .cyl-send{width:42px;flex-shrink:0;border:none;border-radius:12px;cursor:pointer;color:#0c130a;font-size:1.1rem;
        background:linear-gradient(135deg,#f1cd92,#e7b15c);transition:filter .2s;}
      .cyl-send:hover{filter:brightness(1.08);}
      .cyl-send:disabled{opacity:.5;cursor:default;}
      .cyl-disc{padding:7px 12px 9px;font:500 10px Segoe UI,Roboto,sans-serif;color:#7e9ab5;text-align:center;
        border-top:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.18);line-height:1.4;}
      .cyl-disc b{color:#9fb2cb;}
      /* Écran de consentement (1re ouverture) */
      .cyl-consent{position:absolute;inset:0;z-index:5;display:none;flex-direction:column;padding:22px 20px;gap:14px;
        background:rgba(8,16,28,0.98);overflow-y:auto;}
      .cyl-consent.show{display:flex;animation:cylUp .22s ease;}
      .cyl-consent-orb{width:52px;height:52px;border-radius:50%;align-self:center;flex-shrink:0;
        background:radial-gradient(circle at 36% 32%,#fbe6b0,#e7b15c 40%,#4a7a3a 100%);box-shadow:0 0 18px rgba(231,177,92,.45);}
      .cyl-consent-title{font:800 16px Segoe UI,Roboto,sans-serif;color:#fff;text-align:center;}
      .cyl-consent-body{font:500 12.7px Segoe UI,Roboto,sans-serif;color:#c3d2e6;line-height:1.55;}
      .cyl-consent-body ul{margin:8px 0 0;padding-left:18px;}
      .cyl-consent-body li{margin-bottom:5px;}
      .cyl-consent-body b{color:#fbe6b0;}
      .cyl-consent-check{display:flex;gap:9px;align-items:flex-start;font:500 12px Segoe UI,Roboto,sans-serif;color:#c3d2e6;cursor:pointer;}
      .cyl-consent-check input{margin-top:2px;width:16px;height:16px;flex-shrink:0;accent-color:#84c25e;cursor:pointer;}
      .cyl-consent-ok{margin-top:2px;padding:11px;border:none;border-radius:12px;cursor:pointer;font:800 13.5px Segoe UI,Roboto,sans-serif;
        color:#0c130a;background:linear-gradient(135deg,#f1cd92,#e7b15c);transition:filter .2s,opacity .2s;}
      .cyl-consent-ok:hover{filter:brightness(1.07);}
      .cyl-consent-ok:disabled{opacity:.45;cursor:default;}

      /* ── Poignee de redimensionnement ──
         En haut a GAUCHE : la fenetre est ancree en bas a droite, c est donc
         le coin oppose qui bouge quand on l agrandit. */
      .cyl-grip{position:absolute;top:0;left:0;width:22px;height:22px;cursor:nwse-resize;z-index:6;
        touch-action:none;}
      .cyl-grip::before{content:"";position:absolute;top:7px;left:7px;width:9px;height:9px;
        border-top:2px solid rgba(255,255,255,.3);border-left:2px solid rgba(255,255,255,.3);
        border-radius:3px 0 0 0;transition:border-color .16s;}
      .cyl-grip:hover::before{border-color:rgba(231,177,92,.9);}
      .cyl-panel.sizing{user-select:none;}
      .cyl-panel.sizing .cyl-msgs{pointer-events:none;}

      /* ── Reglages ── */
      .cyl-tool{width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);
        background:rgba(255,255,255,0.05);color:#aab7cf;cursor:pointer;font-size:.9rem;line-height:1;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      .cyl-tool:hover{background:rgba(255,255,255,0.1);color:#fff;}
      .cyl-tool.on{background:rgba(231,177,92,.18);border-color:rgba(231,177,92,.5);color:#f1cd92;}
      .cyl-head-btns{display:flex;gap:6px;align-items:center;}

      .cyl-set{position:absolute;top:56px;right:12px;z-index:8;width:214px;border-radius:13px;
        background:rgba(10,18,30,.99);border:1px solid rgba(255,255,255,.14);padding:11px 12px;
        box-shadow:0 14px 38px rgba(0,0,0,.6);display:none;}
      .cyl-set.show{display:block;}
      .cyl-set-lb{font:800 9.5px Segoe UI,Roboto,sans-serif;letter-spacing:.08em;text-transform:uppercase;
        color:#7d8ea6;margin:0 0 6px;}
      .cyl-set-row{display:flex;gap:5px;margin-bottom:11px;}
      .cyl-set-row:last-child{margin-bottom:0;}
      .cyl-set-b{flex:1;padding:6px 4px;border-radius:8px;border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.04);color:#aab7cf;cursor:pointer;
        font:700 11px Segoe UI,Roboto,sans-serif;}
      .cyl-set-b:hover{background:rgba(255,255,255,.1);color:#fff;}
      .cyl-set-b.on{background:rgba(132,194,94,.2);border-color:rgba(132,194,94,.5);color:#bfe3a6;}
      .cyl-set-b.danger:hover{background:rgba(224,120,95,.2);border-color:rgba(224,120,95,.5);color:#f0a68f;}

      /* Trois tailles de texte : le confort de lecture n est pas le meme a 20
         ans sur un portable et a 60 sur un ecran de bureau. */
      .cyl-panel[data-fs="s"] .cyl-msg{font-size:12.5px;}
      .cyl-panel[data-fs="l"] .cyl-msg{font-size:15px;}
      .cyl-panel[data-fs="l"] .cyl-input{font-size:14.5px;}

      /* Plein ecran : pour relire une longue conversation sans la lire par
         la fenetre d une boite aux lettres. */
      .cyl-panel.max{right:16px;bottom:16px;top:16px;left:16px;width:auto;height:auto;
        max-width:none;border-radius:20px;}
      .cyl-panel.max .cyl-grip{display:none;}
      .cyl-panel.max .cyl-msgs{align-items:center;}
      .cyl-panel.max .cyl-msg{max-width:min(84%,720px);}
      .cyl-panel.max .cyl-mods{max-width:min(84%,720px);}
      @media (max-width:600px){ .cyl-panel{right:8px;bottom:8px;height:min(72vh,560px);} .cyl-fab{right:14px;bottom:14px;} }
    `;
    document.head.appendChild(s);
  }

  const history = [];   // {role:'user'|'assistant', content}
  let panel, msgsEl, inputEl, sendBtn, started = false;
  let avatarSvg = null;   // le visage de l'entete, anime pendant l'attente

  function addMsg(role, text) {
    const el = document.createElement('div');
    el.className = 'cyl-msg ' + (role === 'user' ? 'user' : 'cyl');
    el.textContent = text;
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
  }
  function addModules(mods) {
    if (!mods || !mods.length) return;
    const wrap = document.createElement('div'); wrap.className = 'cyl-mods';
    wrap.innerHTML = mods.map((m) => `<a class="cyl-mod" href="${esc(m.href)}">${esc(MODULE_LABELS[m.key] || m.key)} -></a>`).join('');
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  async function send() {
    const text = inputEl.value.trim();
    if (!text || sendBtn.disabled) return;
    inputEl.value = '';
    addMsg('user', text);
    history.push({ role: 'user', content: text });
    sendBtn.disabled = true;
    const typing = addMsg('cyl', 'CYL réfléchit...'); typing.classList.add('typing');
    setThinking(avatarSvg, true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('not-signed-in');
      const idToken = await user.getIdToken();
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, messages: history.slice(-10) }),
      });
      const data = await r.json().catch(() => ({}));
      typing.remove();
      if (!r.ok) {
        addMsg('cyl', data.error || 'Je suis momentanément indisponible. Reessaie dans un instant.');
      } else {
        addMsg('cyl', data.reply);
        addModules(data.modules);
        history.push({ role: 'assistant', content: data.reply });
      }
    } catch (e) {
      typing.remove();
      addMsg('cyl', 'Connexion impossible pour le moment. Reessaie dans un instant.');
    } finally {
      setThinking(avatarSvg, false);
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  function build() {
    injectCSS();
    const fab = document.createElement('button');
    fab.className = 'cyl-fab'; fab.title = 'Parler à CYL'; fab.setAttribute('aria-label', 'Ouvrir CYL');
    fab.innerHTML = `<span class="cyl-fab-orb"></span>`;
    mountAvatar(fab.querySelector('.cyl-fab-orb'), { size: 58, ring: true });

    panel = document.createElement('div'); panel.className = 'cyl-panel';
    panel.innerHTML =
      `<div class="cyl-grip" title="Redimensionner"></div>` +
      `<div class="cyl-head"><div class="cyl-head-orb"></div>` +
        `<div class="cyl-head-id"><div class="cyl-head-name">CYL</div>` +
        `<div class="cyl-head-sub">Ton assistant de vie</div></div>` +
        `<div class="cyl-head-btns">` +
          `<button class="cyl-tool cyl-gear" aria-label="Réglages" title="Réglages" aria-expanded="false">⚙</button>` +
          `<button class="cyl-tool cyl-max" aria-label="Plein écran" title="Plein écran" aria-pressed="false">⛶</button>` +
          `<button class="cyl-x" aria-label="Fermer">✕</button>` +
        `</div></div>` +
      `<div class="cyl-set" role="dialog" aria-label="Réglages de CYL">` +
        `<p class="cyl-set-lb">Taille du texte</p>` +
        `<div class="cyl-set-row">` +
          `<button class="cyl-set-b" data-fs="s">Petit</button>` +
          `<button class="cyl-set-b" data-fs="m">Normal</button>` +
          `<button class="cyl-set-b" data-fs="l">Grand</button>` +
        `</div>` +
        `<p class="cyl-set-lb">Fenêtre</p>` +
        `<div class="cyl-set-row"><button class="cyl-set-b" data-act="reset">Taille par défaut</button></div>` +
        `<p class="cyl-set-lb">Conversation</p>` +
        `<div class="cyl-set-row"><button class="cyl-set-b danger" data-act="clear">Tout effacer</button></div>` +
      `</div>` +
      `<div class="cyl-msgs"></div>` +
      `<div class="cyl-form"><textarea class="cyl-input" rows="1" placeholder="Ecris à CYL..."></textarea>` +
        `<button class="cyl-send" aria-label="Envoyer">↑</button></div>` +
      `<div class="cyl-disc">CYL t'écoute et t'aide à clarifier TES choix - il ne décide pas à ta place et ne remplace pas un professionnel. Urgence : <b>3114</b> · <b>15</b></div>` +
      `<div class="cyl-consent" role="dialog" aria-label="Avant de parler à CYL">
        <div class="cyl-consent-orb"></div>
        <div class="cyl-consent-title">Avant de commencer</div>
        <div class="cyl-consent-body">
          CYL est un <b>assistant de vie</b>, pas un professionnel. Pour ton bien :
          <ul>
            <li>CYL <b>ne remplace pas</b> un médecin, psychologue ou tout autre professionnel de santé.</li>
            <li>Il <b>ne décide pas à ta place</b> : il t'aide à clarifier TES propres choix.</li>
            <li>Il ne donne pas de conseil médical, juridique ou financier prescriptif.</li>
            <li>En cas de détresse : <b>3114</b> (souffrance, prévention suicide), <b>15</b> (SAMU), <b>112</b> (urgences).</li>
          </ul>
        </div>
        <label class="cyl-consent-check"><input type="checkbox" id="cyl-consent-cb"/>
          <span>J'ai compris que CYL ne remplace pas un professionnel et ne décide pas à ma place.</span></label>
        <button class="cyl-consent-ok" id="cyl-consent-ok" disabled>Commencer à parler à CYL</button>
      </div>`;

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    msgsEl = panel.querySelector('.cyl-msgs');
    inputEl = panel.querySelector('.cyl-input');
    sendBtn = panel.querySelector('.cyl-send');


    // ── REGLAGES ET TAILLE ────────────────────────────────────────────────
    // Le panneau etait fige : ni redimensionnable, ni reglable. On ne lit pas
    // une conversation de vingt echanges dans une fenetre de 380 par 560.
    const headOrb = panel.querySelector('.cyl-head-orb');
    avatarSvg = mountAvatar(headOrb, { size: 34, ring: true });

    const SIZE_KEY = 'cyl_chat_size', FS_KEY = 'cyl_chat_fs', MAX_KEY = 'cyl_chat_max';
    const MINW = 320, MINH = 380;
    const setEl = panel.querySelector('.cyl-set');
    const gear = panel.querySelector('.cyl-gear');
    const maxBtn = panel.querySelector('.cyl-max');
    const grip = panel.querySelector('.cyl-grip');

    function readNum(k, d) { try { const v = parseInt(localStorage.getItem(k) || '', 10); return Number.isFinite(v) ? v : d; } catch (_) { return d; } }
    function applySize(w, h) {
      // Bornes hautes calculees sur l ecran courant : une taille enregistree sur
      // un grand moniteur ne doit pas deborder sur un portable.
      const W = Math.max(MINW, Math.min(w, window.innerWidth - 32));
      const H = Math.max(MINH, Math.min(h, window.innerHeight - 40));
      panel.style.setProperty('--cw', W + 'px');
      panel.style.setProperty('--ch', H + 'px');
      return { W, H };
    }
    applySize(readNum(SIZE_KEY + '_w', 380), readNum(SIZE_KEY + '_h', 560));

    function applyFs(v) {
      const val = ['s', 'm', 'l'].includes(v) ? v : 'm';
      panel.dataset.fs = val;
      setEl.querySelectorAll('[data-fs]').forEach((b) => b.classList.toggle('on', b.dataset.fs === val));
      try { localStorage.setItem(FS_KEY, val); } catch (_) {}
    }
    let fs0 = 'm';
    try { fs0 = localStorage.getItem(FS_KEY) || 'm'; } catch (_) {}
    applyFs(fs0);

    function applyMax(on) {
      panel.classList.toggle('max', !!on);
      maxBtn.setAttribute('aria-pressed', String(!!on));
      maxBtn.classList.toggle('on', !!on);
      maxBtn.textContent = on ? '⤡' : '⛶';
      maxBtn.title = on ? 'Réduire' : 'Plein écran';
      try { localStorage.setItem(MAX_KEY, on ? '1' : '0'); } catch (_) {}
    }
    let max0 = false;
    try { max0 = localStorage.getItem(MAX_KEY) === '1'; } catch (_) {}
    applyMax(max0);

    function closeSet() { setEl.classList.remove('show'); gear.setAttribute('aria-expanded', 'false'); gear.classList.remove('on'); }
    gear.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = !setEl.classList.contains('show');
      setEl.classList.toggle('show', on);
      gear.setAttribute('aria-expanded', String(on));
      gear.classList.toggle('on', on);
    });
    maxBtn.addEventListener('click', () => { applyMax(!panel.classList.contains('max')); closeSet(); });
    // Un clic hors du volet le referme, mais PAS un clic dedans - sinon changer
    // la taille du texte fermerait le volet a chaque essai.
    panel.addEventListener('click', (e) => { if (!e.target.closest('.cyl-set, .cyl-gear')) closeSet(); });

    setEl.addEventListener('click', (e) => {
      const f = e.target.closest('[data-fs]');
      if (f) { applyFs(f.dataset.fs); return; }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'reset') {
        applyMax(false);
        const r = applySize(380, 560);
        try { localStorage.setItem(SIZE_KEY + '_w', r.W); localStorage.setItem(SIZE_KEY + '_h', r.H); } catch (_) {}
        closeSet();
      } else if (a.dataset.act === 'clear') {
        if (!confirm('Effacer toute la conversation avec CYL ?')) return;
        history.length = 0;
        msgsEl.replaceChildren();
        started = false;
        startChat();
        closeSet();
      }
    });

    // ── Poignee ──
    // Pointer Events avec capture : le geste continue meme si le curseur sort
    // du panneau, ce qui arrive des qu'on agrandit vite.
    grip.addEventListener('pointerdown', (e) => {
      if (panel.classList.contains('max')) return;
      e.preventDefault();
      const r = panel.getBoundingClientRect();
      const x0 = e.clientX, y0 = e.clientY, w0 = r.width, h0 = r.height;
      panel.classList.add('sizing');
      try { grip.setPointerCapture(e.pointerId); } catch (_) {}
      const move = (ev) => { applySize(w0 - (ev.clientX - x0), h0 - (ev.clientY - y0)); };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
        panel.classList.remove('sizing');
        const rr = panel.getBoundingClientRect();
        try {
          localStorage.setItem(SIZE_KEY + '_w', Math.round(rr.width));
          localStorage.setItem(SIZE_KEY + '_h', Math.round(rr.height));
        } catch (_) {}
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });

    // Un ecran retreci ne doit pas laisser la fenetre dehors.
    window.addEventListener('resize', () => {
      const r = panel.getBoundingClientRect();
      applySize(r.width, r.height);
    });

    // ── Consentement (1re ouverture, exigence de conformité) ────────────────
    const CONSENT_KEY = 'cyl_consent_v1';
    const consentEl = panel.querySelector('.cyl-consent');
    const consentCb = panel.querySelector('#cyl-consent-cb');
    const consentOk = panel.querySelector('#cyl-consent-ok');
    const hasConsent = () => { try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch (_) { return false; } };
    consentCb.addEventListener('change', () => { consentOk.disabled = !consentCb.checked; });
    consentOk.addEventListener('click', () => {
      try { localStorage.setItem(CONSENT_KEY, '1'); } catch (_) {}
      consentEl.classList.remove('show');
      startChat();
      inputEl.focus();
    });

    function startChat() {
      if (!started) { started = true; addMsg('cyl', 'Bonjour, je suis CYL, ton assistant de vie. Comment te sens-tu aujourd\'hui ?'); }
    }

    const open = () => {
      panel.classList.add('open'); fab.style.display = 'none';
      if (!hasConsent()) { consentEl.classList.add('show'); return; }
      startChat();
      inputEl.focus();
    };
    const close = () => { panel.classList.remove('open'); fab.style.display = ''; };
    fab.onclick = open;
    panel.querySelector('.cyl-x').onclick = close;
    sendBtn.onclick = send;
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    // Permet au module Urgence (urgence.js) d'ouvrir CYL directement.
    window.cylChat = { open, close };

    // Ouverture depuis un autre module (hub ORGANIZER, brief du jour…) avec un
    // message pré-rempli : CYL propose, l'utilisateur garde la main (il peut
    // relire, modifier ou effacer avant d'envoyer - jamais d'envoi automatique).
    openChat = (prefill) => {
      // Sans message pré-rempli, l'appel se comporte en BASCULE : recliquer sur
      // l'encart CYL referme le chat, au lieu d'obliger à viser la croix.
      // Avec un prefill (« CYL, aide-moi à trier », une analyse cliquée), on
      // ouvre toujours : l'intention est explicite, refermer serait absurde.
      if (!prefill && panel.classList.contains('open')) { close(); return; }
      open();
      if (prefill) {
        inputEl.value = prefill;
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(160, inputEl.scrollHeight) + 'px';
      }
    };
    // Une demande arrivée pendant le chargement du module n'est pas perdue.
    if (pendingOpen) { const p = pendingOpen; pendingOpen = null; openChat(p.prefill); }
  }

  // Le listener vit AU NIVEAU DU MODULE, pas dans build() : le chat est chargé
  // en import dynamique puis construit seulement après `onAuthStateChanged`.
  // Un clic sur « CYL, aide-moi à trier » avant ce moment partait dans le vide.
  let openChat = null;
  let pendingOpen = null;
  document.addEventListener('cyl:chat-open', (e) => {
    const prefill = (e.detail && e.detail.prefill) || null;
    if (openChat) openChat(prefill);
    else pendingOpen = { prefill };
  });

  onAuthStateChanged(auth, (user) => {
    if (user && !document.querySelector('.cyl-fab')) build();
  });
}
