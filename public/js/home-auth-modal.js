// home-auth-modal.js — Contrôleur du modal de connexion de l'accueil.
// Extrait d'un <script> inline de index.html (bloqué par la CSP script-src 'self').
(function () {
  var modal = document.getElementById('auth-modal');
  var closeBtn = document.getElementById('auth-close');
  var toggleLink = document.getElementById('auth-toggle-link');
  var emailInput = document.getElementById('email');
  if (!modal) return;

  function isRegisterMode() {
    var g = document.getElementById('password-confirm-group');
    return g && g.style.display !== 'none';
  }
  function setMode(mode) {
    var wantRegister = (mode === 'register');
    if (toggleLink && isRegisterMode() !== wantRegister) toggleLink.click();
  }
  function openModal(mode) {
    setMode(mode || 'login');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { if (emailInput) emailInput.focus(); }, 360);
  }
  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  document.querySelectorAll('[data-auth-open]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openModal(el.getAttribute('data-auth-open'));
    });
  });
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
  window.openAuthModal = openModal;
})();
