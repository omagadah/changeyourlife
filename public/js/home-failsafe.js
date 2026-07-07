// home-failsafe.js — Garde-fou de l'accueil.
// Si le module 3D échoue (WebGL absent, import KO), on lève quand même le voile
// après 5 s pour ne JAMAIS bloquer l'accueil sur "l'arbre s'éveille".
// Extrait d'un <script> inline de index.html (était bloqué par la CSP → failsafe mort).
setTimeout(function () {
  if (!document.body.classList.contains('tree-ready')) {
    document.body.classList.add('tree-ready');
  }
}, 5000);
