// /signup/ → /login redirect (compatibilité avec anciens liens / SEO).
// La redirection 301 server-side dans vercel.json gère 99% des cas ;
// ce JS est un fallback pour les browsers qui ignorent le meta-refresh.
(function () {
  var target = '/login' + (location.search || '') + (location.hash || '');
  if (location.pathname !== '/login') {
    location.replace(target);
  }
})();
