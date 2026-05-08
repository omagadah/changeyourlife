/**
 * Theme initializer — applique le thème stocké en localStorage très tôt
 * pour éviter le flash blanc/sombre au chargement.
 *
 * Inclus dans <head> via :
 *   <script src="/js/theme-init.js"></script>
 *
 * Marche pour :
 * - Les pages qui utilisent main.min.css → ajoute la classe `light-mode` sur body.
 * - Les pages standalone (ex: 404) → injecte un <style> minimal en clair.
 */
(function () {
  try {
    var theme = localStorage.getItem('theme');
    if (theme !== 'light') return;
    var apply = function () {
      if (document.body && document.body.classList) {
        document.body.classList.add('light-mode');
      }
      // Pages sans main.min.css : injecter un fond clair minimal
      var hasMain = !!document.querySelector('link[href*="main.min.css"]');
      if (!hasMain) {
        var s = document.createElement('style');
        s.textContent = 'html,body{background:#f0f3f5;color:#121212}';
        (document.head || document.documentElement).appendChild(s);
      }
    };
    if (document.body) apply();
    else document.addEventListener('DOMContentLoaded', apply, { once: true });
  } catch (e) {
    /* localStorage may throw in private browsing — ignore */
  }
})();
