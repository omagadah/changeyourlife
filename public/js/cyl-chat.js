// /js/cyl-chat.js - Bulle de chat CYL (assistant de vie propulsé par Claude).
// S'affiche en bas à droite quand l'utilisateur est connecté. Parle à /api/chat
// (sécurisé par ID token Firebase) et oriente vers les modules du site.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

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
      .cyl-panel{position:fixed;right:20px;bottom:20px;z-index:99991;width:min(380px,calc(100vw - 32px));
        height:min(560px,calc(100vh - 40px));display:none;flex-direction:column;border-radius:18px;overflow:hidden;
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
      @media (max-width:600px){ .cyl-panel{right:8px;bottom:8px;height:min(72vh,560px);} .cyl-fab{right:14px;bottom:14px;} }
    `;
    document.head.appendChild(s);
  }

  const history = [];   // {role:'user'|'assistant', content}
  let panel, msgsEl, inputEl, sendBtn, started = false;

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
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  function build() {
    injectCSS();
    const fab = document.createElement('button');
    fab.className = 'cyl-fab'; fab.title = 'Parler à CYL'; fab.setAttribute('aria-label', 'Ouvrir CYL');
    fab.innerHTML = `<span class="cyl-fab-orb">💬</span>`;

    panel = document.createElement('div'); panel.className = 'cyl-panel';
    panel.innerHTML =
      `<div class="cyl-head"><div class="cyl-head-orb"></div>` +
        `<div class="cyl-head-id"><div class="cyl-head-name">CYL</div>` +
        `<div class="cyl-head-sub">Ton assistant de vie</div></div>` +
        `<button class="cyl-x" aria-label="Fermer">✕</button></div>` +
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
