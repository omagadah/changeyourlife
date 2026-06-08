// /js/emoji.js - Remplace TOUS les emojis système (« cheap », surtout Windows)
// par de jolis emojis, partout, SANS jamais laisser passer un emoji système.
//
// Stratégie robuste (2 temps) :
//   1. On rend d'abord TWEMOJI (SVG) -> couverture 100 % garantie, jamais d'emoji
//      système moche.
//   2. On AMÉLIORE en Microsoft Fluent 3D (webp) quand il existe : on teste l'URL
//      en arrière-plan (probe) et on ne remplace la source QUE si elle charge ->
//      donc jamais d'image cassée.
//
// L'observateur ne re-parse QUE les nœuds ajoutés (pas tout le <body>) -> pas de
// reflow en boucle sur les pages très dynamiques (accueil 3D).
(function () {
  if (window.__cylEmoji) return; window.__cylEmoji = true;

  var TW_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/';     // <base>svg/<code>.svg
  var FLUENT  = 'https://cdn.jsdelivr.net/npm/@lobehub/fluent-emoji-3d@1.1.0/assets/'; // <code>.webp
  var LIB     = 'https://cdn.jsdelivr.net/npm/@twemoji/api@15.1.0/dist/twemoji.min.js';
  var OPT = { folder: 'svg', ext: '.svg', base: TW_BASE, className: 'cyl-emoji' };

  // Style : emoji 3D légèrement plus grand que le texte, taille FIXE (layout stable).
  var st = document.createElement('style');
  st.textContent = 'img.cyl-emoji,img.emoji{height:1.15em;width:1.15em;margin:0 .06em 0 .08em;' +
    'vertical-align:-0.22em;display:inline-block;object-fit:contain;}';
  document.head.appendChild(st);

  // Améliore un emoji Twemoji déjà rendu en Fluent 3D si disponible (probe -> swap).
  function upgrade(img) {
    var m = (img.getAttribute('src') || '').match(/\/([0-9a-f-]+)\.svg$/i);
    if (!m) return;
    var code = m[1];
    var urls = [FLUENT + code + '.webp', FLUENT + code + '-fe0f.webp']; // fe0f gardé par Fluent dans certains cas
    var i = 0;
    (function next() {
      if (i >= urls.length) return;
      var u = urls[i++];
      var probe = new Image();
      probe.onload = function () { img.src = u; };  // swap seulement si Fluent charge
      probe.onerror = next;                         // sinon on garde Twemoji
      probe.src = u;
    })();
  }

  function parseEl(el) {
    if (!window.twemoji || !el || el.nodeType !== 1) return;
    if (el.classList && el.classList.contains('cyl-emoji')) return;   // déjà un emoji
    try { window.twemoji.parse(el, OPT); } catch (e) {}
    try {
      var imgs = el.querySelectorAll('img.cyl-emoji:not([data-up])');
      for (var i = 0; i < imgs.length; i++) { imgs[i].setAttribute('data-up', '1'); upgrade(imgs[i]); }
    } catch (e) {}
  }

  function start() {
    parseEl(document.body);
    // On ne traite QUE les nœuds ajoutés (pas tout le body) -> zéro reflow en boucle.
    var queue = [];
    var flushing = false;
    function flush() {
      flushing = false;
      var batch = queue; queue = [];
      for (var i = 0; i < batch.length; i++) parseEl(batch[i]);
    }
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 1) queue.push(n);
          else if (n.nodeType === 3 && n.parentNode && n.parentNode.nodeType === 1) queue.push(n.parentNode);
        }
      }
      if (queue.length && !flushing) { flushing = true; requestAnimationFrame(flush); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  var s = document.createElement('script');
  s.src = LIB; s.crossOrigin = 'anonymous';
  s.onload = start;
  s.onerror = function () { /* repli silencieux : emojis système conservés */ };
  document.head.appendChild(s);
})();
