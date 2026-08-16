// /js/home-boot.js - Choisit la scene de l'accueil selon l'appareil.
//
// CE FICHIER DOIT RESTER EXTERNE. La CSP du projet est `script-src 'self'`
// SANS `unsafe-inline` : le meme code ecrit en <script> dans index.html est
// bloque par le navigateur, et l'accueil se retrouve sans arbre, sans
// environnement et sans XP. C'est exactement ce qui est arrive le 2026-08-16.
//
//  · Grand ecran + connexion correcte -> scene 3D complete (arbre3d.js),
//    precedee des modulepreload de three.
//  · Telephone, 2G/3G ou economie de donnees -> mode leger : classe `lite`
//    sur <html> et arbre SVG (home-tree-lite.js). ~129 Ko au lieu de 7,8 Mo.

(function () {
  var lite = false;
  try {
    var conn = navigator.connection || {};
    var slow = conn.saveData === true || /^(slow-2g|2g|3g)$/.test(conn.effectiveType || '');
    var small = window.matchMedia('(max-width: 820px)').matches;
    lite = small || slow;
  } catch (e) {
    lite = false;   // API absente : on sert la version complete
  }

  function load(src) {
    var s = document.createElement('script');
    s.type = 'module';
    s.src = src;
    document.head.appendChild(s);
  }

  if (lite) {
    document.documentElement.classList.add('lite');
    load('/js/home-tree-lite.js');
    return;
  }

  // Prechargement : uniquement quand la scene 3D va reellement etre utilisee.
  // En <link> statique dans le <head>, ces ~780 Ko partaient aussi sur mobile.
  ['/vendor/three/three.module.min.js', '/vendor/three/three.core.min.js', '/js/tree-model.js']
    .forEach(function (href) {
      var l = document.createElement('link');
      l.rel = 'modulepreload';
      l.href = href;
      document.head.appendChild(l);
    });

  load('/js/arbre3d.js');
})();
