// /js/syl-chat.js - Bulle de chat SYL (assistant de vie propulsé par Claude).
// S'affiche en bas à droite quand l'utilisateur est connecté. Parle à /api/chat
// (sécurisé par ID token Firebase) et oriente vers les modules du site.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

let auth;
if (window._cyfFirebase) { ({ auth } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth } = window._cyfFirebase); }

if (window.__sylChat) { /* déjà chargé */ } else {
  window.__sylChat = true;

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
    if (document.getElementById('syl-chat-css')) return;
    const s = document.createElement('style'); s.id = 'syl-chat-css';
    s.textContent = `
      .syl-fab{position:fixed;right:20px;bottom:20px;z-index:99990;width:58px;height:58px;border-radius:50%;
        border:none;cursor:pointer;padding:0;box-shadow:0 10px 30px rgba(0,0,0,.45);transition:transform .2s, filter .2s;}
      .syl-fab:hover{transform:translateY(-3px) scale(1.04);filter:brightness(1.08);}
      .syl-fab-orb{width:100%;height:100%;border-radius:50%;
        background:radial-gradient(circle at 36% 32%,#fbe6b0,#e7b15c 40%,#4a7a3a 100%);
        box-shadow:inset 0 0 12px rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;}
      .syl-panel{position:fixed;right:20px;bottom:20px;z-index:99991;width:min(380px,calc(100vw - 32px));
        height:min(560px,calc(100vh - 40px));display:none;flex-direction:column;border-radius:18px;overflow:hidden;
        background:rgba(8,16,28,0.96);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.12);
        box-shadow:0 24px 64px rgba(0,0,0,.55);}
      .syl-panel.open{display:flex;animation:sylUp .26s cubic-bezier(.4,0,.2,1);}
      @keyframes sylUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:none;}}
      .syl-head{display:flex;align-items:center;gap:11px;padding:13px 15px;border-bottom:1px solid rgba(255,255,255,0.08);}
      .syl-head-orb{width:34px;height:34px;border-radius:50%;flex-shrink:0;
        background:radial-gradient(circle at 36% 32%,#fbe6b0,#e7b15c 40%,#4a7a3a 100%);box-shadow:0 0 14px rgba(231,177,92,.4);}
      .syl-head-id{flex:1;}
      .syl-head-name{font:800 13px Segoe UI,Roboto,sans-serif;letter-spacing:1px;color:#fff;}
      .syl-head-sub{font:500 10.5px Segoe UI,Roboto,sans-serif;color:#8fb3a0;margin-top:1px;}
      .syl-x{width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);
        color:#aab7cf;cursor:pointer;font-size:1rem;line-height:1;}
      .syl-x:hover{background:rgba(255,255,255,0.1);color:#fff;}
      .syl-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}
      .syl-msg{max-width:84%;padding:9px 12px;border-radius:14px;font:500 13.5px Segoe UI,Roboto,sans-serif;line-height:1.5;white-space:pre-wrap;}
      .syl-msg.user{align-self:flex-end;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border-bottom-right-radius:5px;}
      .syl-msg.syl{align-self:flex-start;background:rgba(255,255,255,0.06);color:#e8eef7;border:1px solid rgba(255,255,255,0.07);border-bottom-left-radius:5px;}
      .syl-msg.typing{color:#8fb3a0;font-style:italic;}
      .syl-mods{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:84%;margin-top:-3px;}
      .syl-mod{font:700 11.5px Segoe UI,Roboto,sans-serif;text-decoration:none;padding:6px 11px;border-radius:99px;
        background:rgba(132,194,94,0.12);border:1px solid rgba(132,194,94,0.35);color:#a7e08a;transition:all .15s;}
      .syl-mod:hover{background:rgba(132,194,94,0.22);}
      .syl-form{display:flex;gap:8px;padding:11px;border-top:1px solid rgba(255,255,255,0.08);}
      .syl-input{flex:1;resize:none;max-height:90px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);
        background:rgba(255,255,255,0.05);color:#eef4ff;font:500 13.5px Segoe UI,Roboto,sans-serif;font-family:inherit;}
      .syl-input:focus{outline:none;border-color:rgba(231,177,92,0.5);}
      .syl-send{width:42px;flex-shrink:0;border:none;border-radius:12px;cursor:pointer;color:#0c130a;font-size:1.1rem;
        background:linear-gradient(135deg,#f1cd92,#e7b15c);transition:filter .2s;}
      .syl-send:hover{filter:brightness(1.08);}
      .syl-send:disabled{opacity:.5;cursor:default;}
      .syl-disc{padding:7px 12px 9px;font:500 10px Segoe UI,Roboto,sans-serif;color:#7e9ab5;text-align:center;
        border-top:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.18);line-height:1.4;}
      .syl-disc b{color:#9fb2cb;}
      /* Écran de consentement (1re ouverture) */
      .syl-consent{position:absolute;inset:0;z-index:5;display:none;flex-direction:column;padding:22px 20px;gap:14px;
        background:rgba(8,16,28,0.98);overflow-y:auto;}
      .syl-consent.show{display:flex;animation:sylUp .22s ease;}
      .syl-consent-orb{width:52px;height:52px;border-radius:50%;align-self:center;flex-shrink:0;
        background:radial-gradient(circle at 36% 32%,#fbe6b0,#e7b15c 40%,#4a7a3a 100%);box-shadow:0 0 18px rgba(231,177,92,.45);}
      .syl-consent-title{font:800 16px Segoe UI,Roboto,sans-serif;color:#fff;text-align:center;}
      .syl-consent-body{font:500 12.7px Segoe UI,Roboto,sans-serif;color:#c3d2e6;line-height:1.55;}
      .syl-consent-body ul{margin:8px 0 0;padding-left:18px;}
      .syl-consent-body li{margin-bottom:5px;}
      .syl-consent-body b{color:#fbe6b0;}
      .syl-consent-check{display:flex;gap:9px;align-items:flex-start;font:500 12px Segoe UI,Roboto,sans-serif;color:#c3d2e6;cursor:pointer;}
      .syl-consent-check input{margin-top:2px;width:16px;height:16px;flex-shrink:0;accent-color:#84c25e;cursor:pointer;}
      .syl-consent-ok{margin-top:2px;padding:11px;border:none;border-radius:12px;cursor:pointer;font:800 13.5px Segoe UI,Roboto,sans-serif;
        color:#0c130a;background:linear-gradient(135deg,#f1cd92,#e7b15c);transition:filter .2s,opacity .2s;}
      .syl-consent-ok:hover{filter:brightness(1.07);}
      .syl-consent-ok:disabled{opacity:.45;cursor:default;}
      @media (max-width:600px){ .syl-panel{right:8px;bottom:8px;height:min(72vh,560px);} .syl-fab{right:14px;bottom:14px;} }
    `;
    document.head.appendChild(s);
  }

  const history = [];   // {role:'user'|'assistant', content}
  let panel, msgsEl, inputEl, sendBtn, started = false;

  function addMsg(role, text) {
    const el = document.createElement('div');
    el.className = 'syl-msg ' + (role === 'user' ? 'user' : 'syl');
    el.textContent = text;
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
  }
  function addModules(mods) {
    if (!mods || !mods.length) return;
    const wrap = document.createElement('div'); wrap.className = 'syl-mods';
    wrap.innerHTML = mods.map((m) => `<a class="syl-mod" href="${esc(m.href)}">${esc(MODULE_LABELS[m.key] || m.key)} -></a>`).join('');
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
    const typing = addMsg('syl', 'SYL réfléchit...'); typing.classList.add('typing');
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
        addMsg('syl', data.error || 'Je suis momentanément indisponible. Reessaie dans un instant.');
      } else {
        addMsg('syl', data.reply);
        addModules(data.modules);
        history.push({ role: 'assistant', content: data.reply });
      }
    } catch (e) {
      typing.remove();
      addMsg('syl', 'Connexion impossible pour le moment. Reessaie dans un instant.');
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  function build() {
    injectCSS();
    const fab = document.createElement('button');
    fab.className = 'syl-fab'; fab.title = 'Parler à SYL'; fab.setAttribute('aria-label', 'Ouvrir SYL');
    fab.innerHTML = `<span class="syl-fab-orb">💬</span>`;

    panel = document.createElement('div'); panel.className = 'syl-panel';
    panel.innerHTML =
      `<div class="syl-head"><div class="syl-head-orb"></div>` +
        `<div class="syl-head-id"><div class="syl-head-name">SYL</div>` +
        `<div class="syl-head-sub">Ton assistant de vie</div></div>` +
        `<button class="syl-x" aria-label="Fermer">✕</button></div>` +
      `<div class="syl-msgs"></div>` +
      `<div class="syl-form"><textarea class="syl-input" rows="1" placeholder="Ecris à SYL..."></textarea>` +
        `<button class="syl-send" aria-label="Envoyer">↑</button></div>` +
      `<div class="syl-disc">SYL t'écoute et t'aide à clarifier TES choix - il ne décide pas à ta place et ne remplace pas un professionnel. Urgence : <b>3114</b> · <b>15</b></div>` +
      `<div class="syl-consent" role="dialog" aria-label="Avant de parler à SYL">
        <div class="syl-consent-orb"></div>
        <div class="syl-consent-title">Avant de commencer</div>
        <div class="syl-consent-body">
          SYL est un <b>assistant de vie</b>, pas un professionnel. Pour ton bien :
          <ul>
            <li>SYL <b>ne remplace pas</b> un médecin, psychologue ou tout autre professionnel de santé.</li>
            <li>Il <b>ne décide pas à ta place</b> : il t'aide à clarifier TES propres choix.</li>
            <li>Il ne donne pas de conseil médical, juridique ou financier prescriptif.</li>
            <li>En cas de détresse : <b>3114</b> (souffrance, prévention suicide), <b>15</b> (SAMU), <b>112</b> (urgences).</li>
          </ul>
        </div>
        <label class="syl-consent-check"><input type="checkbox" id="syl-consent-cb"/>
          <span>J'ai compris que SYL ne remplace pas un professionnel et ne décide pas à ma place.</span></label>
        <button class="syl-consent-ok" id="syl-consent-ok" disabled>Commencer à parler à SYL</button>
      </div>`;

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    msgsEl = panel.querySelector('.syl-msgs');
    inputEl = panel.querySelector('.syl-input');
    sendBtn = panel.querySelector('.syl-send');

    // ── Consentement (1re ouverture, exigence de conformité) ────────────────
    const CONSENT_KEY = 'cyl_syl_consent_v1';
    const consentEl = panel.querySelector('.syl-consent');
    const consentCb = panel.querySelector('#syl-consent-cb');
    const consentOk = panel.querySelector('#syl-consent-ok');
    const hasConsent = () => { try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch (_) { return false; } };
    consentCb.addEventListener('change', () => { consentOk.disabled = !consentCb.checked; });
    consentOk.addEventListener('click', () => {
      try { localStorage.setItem(CONSENT_KEY, '1'); } catch (_) {}
      consentEl.classList.remove('show');
      startChat();
      inputEl.focus();
    });

    function startChat() {
      if (!started) { started = true; addMsg('syl', 'Bonjour, je suis SYL, ton assistant de vie. Comment te sens-tu aujourd\'hui ?'); }
    }

    const open = () => {
      panel.classList.add('open'); fab.style.display = 'none';
      if (!hasConsent()) { consentEl.classList.add('show'); return; }
      startChat();
      inputEl.focus();
    };
    const close = () => { panel.classList.remove('open'); fab.style.display = ''; };
    fab.onclick = open;
    panel.querySelector('.syl-x').onclick = close;
    sendBtn.onclick = send;
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    // Permet au module Urgence (urgence.js) d'ouvrir SYL directement.
    window.cylSylChat = { open, close };
  }

  onAuthStateChanged(auth, (user) => {
    if (user && !document.querySelector('.syl-fab')) build();
  });
}
