// /js/emoji.js - Remplace les emojis système (« cheap », surtout sous Windows)
// par MICROSOFT FLUENT EMOJI 3D : des emojis volumineux et brillants, cohérents
// et identiques partout (style Teams / Windows 11). On réutilise le moteur de
// détection Twemoji (repère les emojis dans le DOM) mais on pointe les images
// vers le pack Fluent 3D (webp, via @lobehub/fluent-emoji-3d sur jsDelivr).
//
// Repli en cascade -> jamais d'image cassée :
//   Fluent 3D  ->  variante Fluent "-fe0f"  ->  Twemoji SVG  ->  emoji système.
(function () {
  if (window.__cylEmoji) return; window.__cylEmoji = true;

  var FLUENT  = 'https://cdn.jsdelivr.net/npm/@lobehub/fluent-emoji-3d@1.1.0/assets/'; // <code>.webp
  var TWEMOJI = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/';      // <code>.svg (repli)
  var LIB     = 'https://cdn.jsdelivr.net/npm/@twemoji/api@15.1.0/dist/twemoji.min.js';
  var OPT = {
    className: 'cyl-emoji',
    callback: function (icon) { return FLUENT + icon + '.webp'; },
  };

  // Style : emoji 3D légèrement plus grand que le texte, aligné sur la ligne.
  var st = document.createElement('style');
  st.textContent = 'img.cyl-emoji,img.emoji{height:1.15em;width:1.15em;margin:0 .06em 0 .08em;' +
    'vertical-align:-0.22em;display:inline-block;object-fit:contain;}';
  document.head.appendChild(st);

  // Repli en cascade attaché à chaque <img> généré.
  function attachFallback(img) {
    if (img.getAttribute('data-fb')) return;
    img.setAttribute('data-fb', '1');
    // code = point(s) de code, dérivé de l'URL Fluent générée (fiable quelle que
    // soit la version de Twemoji).
    var m = (img.getAttribute('src') || '').match(/\/assets\/([0-9a-f-]+)\.webp$/i);
    var code = m ? m[1] : '';
    img.setAttribute('data-code', code);
    img.addEventListener('error', function () {
      var step = +(img.getAttribute('data-step') || 0);
      if (!code) { img.style.display = 'none'; return; }
      if (step === 0) { img.setAttribute('data-step', '1'); img.src = FLUENT + code + '-fe0f.webp'; return; }
      if (step === 1) { img.setAttribute('data-step', '2'); img.src = TWEMOJI + code + '.svg'; return; }
      // Twemoji a aussi échoué (très rare) : on cesse, l'emoji système reste.
      img.style.display = 'none';
    });
  }

  var obs = null;
  function parseAll() {
    if (!window.twemoji) return;
    if (obs) obs.disconnect();              // évite que nos propres <img> relancent le parse
    try { window.twemoji.parse(document.body, OPT); } catch (e) {}
    try {
      var imgs = document.querySelectorAll('img.cyl-emoji:not([data-fb])');
      for (var i = 0; i < imgs.length; i++) attachFallback(imgs[i]);
    } catch (e) {}
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
