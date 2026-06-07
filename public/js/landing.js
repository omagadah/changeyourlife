// /js/landing.js - bootstrap pour la landing page (/).
// Module ESM : Vanta birds + lazy-load Tidio + scroll reveal + état auth CTA.
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { updateGlobalAvatar } from '/js/common.js';

// ── Vanta birds (background) ──────────────────────────────────────────────
function bootVanta() {
  try {
    if (window.VANTA && window.VANTA.BIRDS) {
      window.VANTA.BIRDS({
        el: '#vanta-birds-bg',
        mouseControls: true, touchControls: true, gyroControls: false,
        minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
        backgroundColor: 0x0, color1: 0x7192ff, color2: 0xd1ff,
        colorMode: 'varianceGradient',
        quantity: 5, birdSize: 1, wingSpan: 30,
        speedLimit: 5, separation: 20, alignment: 20, cohesion: 20,
      });
    } else {
      setTimeout(bootVanta, 80);
    }
  } catch (e) { /* ignore */ }
}
bootVanta();

// ── Lazy-load Tidio chat (3s après load pour ne pas bloquer le rendu) ────
window.addEventListener('load', () => {
  setTimeout(() => {
    const tidio = document.createElement('script');
    tidio.src = '//code.tidio.co/cm488cf0vfaocd3agpjnan7ywxkq3q2t.js';
    tidio.async = true;
    document.body.appendChild(tidio);
  }, 3000);
});

// ── Mute console.log en prod ──────────────────────────────────────────────
if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  console.log = console.warn = console.error = () => {};
}

// ── Footer year (auto) ────────────────────────────────────────────────────
const footerYear = document.getElementById('footer-year');
if (footerYear) footerYear.textContent = String(new Date().getFullYear());

// ── Scroll reveal (.reveal → .visible quand on scroll dessus) ─────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// ── État auth → CTA dynamiques ────────────────────────────────────────────
let auth;
if (window._cyfFirebase) {
  ({ auth } = window._cyfFirebase);
} else {
  await import('/js/firebase.js');
  ({ auth } = window._cyfFirebase);
}

const ctaButton = document.getElementById('cta-button');
const ctaTop    = document.getElementById('cta-top');
const ctaLogin  = document.getElementById('cta-login');
const ctaFinal  = document.getElementById('cta-final');

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (ctaButton) { ctaButton.href = '/app'; ctaButton.textContent = 'Accéder à mon espace →'; }
    if (ctaTop)    { ctaTop.href = '/app';    ctaTop.textContent = 'Mon espace'; }
    if (ctaLogin)  { ctaLogin.style.display = 'none'; }
    if (ctaFinal)  { ctaFinal.href = '/app';  ctaFinal.textContent = 'Accéder à mon espace →'; }
  } else {
    if (ctaButton) { ctaButton.href = '/login'; ctaButton.textContent = "Commencer l'aventure →"; }
    if (ctaTop)    { ctaTop.href = '/login';    ctaTop.textContent = 'Commencer'; }
  }
});

// updateGlobalAvatar non utilisé sur landing public - réservé aux pages logged-in.
// Import préservé pour cohérence si on l'ajoute plus tard.
void updateGlobalAvatar;
