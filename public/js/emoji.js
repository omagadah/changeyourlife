// /js/emoji.js — Remplace les emojis système (« cheap », surtout sous Windows)
// par Twemoji : des emojis SVG propres, cohérents et identiques partout.
// Open source (Twitter/jdecked, CC-BY 4.0). Chargé via /js/emoji.js sur les pages.
(function () {
  if (window.__cylEmoji) return; window.__cylEmoji = true;

  var ASSET_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/';
  var LIB = 'https://cdn.jsdelivr.net/npm/@twemoji/api@15.1.0/dist/twemoji.min.js';
  var OPT = { folder: 'svg', ext: '.svg', base: ASSET_BASE, className: 'cyl-emoji' };

  // Style : emoji aligné sur le texte, taille 1em.
  var st = document.createElement('style');
  st.textContent = 'img.cyl-emoji,img.emoji{height:1em;width:1em;margin:0 .06em 0 .1em;vertical-align:-0.12em;display:inline-block;}';
  document.head.appendChild(st);

  var obs = null;
  function parseAll() {
    if (!window.twemoji) return;
    if (obs) obs.disconnect();              // évite que nos propres <img> relancent le parse
    try { window.twemoji.parse(document.body, OPT); } catch (e) {}
    if (obs) obs.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    parseAll();
    // Le contenu est très dynamique (rendus JS) → on re-parse les ajouts (débounce rAF).
    var pending = false;
    obs = new MutationObserver(function () {
      if (pending) return; pending = true;
      requestAnimationFrame(function () { pending = false; parseAll(); });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  var s = document.createElement('script');
  s.src = LIB; s.crossOrigin = 'anonymous';
  s.onload = start;
  s.onerror = function () { /* repli silencieux : emojis système conservés */ };
  document.head.appendChild(s);
})();
