// /js/profile-init.js - bootstrap pour /profile/.
// Module ESM : Vanta birds + tabs handling + bio counter + global avatar/menu.
import { updateGlobalAvatar } from '/js/common.js';
import { initUserMenu } from '/js/userMenu.js';

// ── Vanta birds ──
function bootVanta() {
  try {
    if (window.VANTA && window.VANTA.BIRDS) {
      window.VANTA.BIRDS({
        el: '#vanta-birds-bg',
        mouseControls: true, touchControls: true, gyroControls: false,
        backgroundColor: 0x060e1a,
        color1: 0x4a3a3a, color2: 0xcccccc,
        quantity: 3.0,
      });
    } else {
      setTimeout(bootVanta, 80);
    }
  } catch (e) { /* ignore */ }
}
bootVanta();

// ── Tabs (Identité / Niveaux / Préférences) ──
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const t = btn.getAttribute('data-tab');
    document.querySelectorAll('.tab').forEach((b) => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    document.querySelectorAll('.section').forEach((s) => {
      s.classList.toggle('active', s.id === 'tab-' + t);
    });
  });
});

// ── Bio character counter ──
const bio = document.getElementById('profile-bio');
const bioCounter = document.getElementById('bio-counter');
if (bio && bioCounter) {
  const updateCounter = () => { bioCounter.textContent = String(bio.value.length); };
  bio.addEventListener('input', updateCounter);
  updateCounter();
}

// ── Choix d'univers (arbre Chêne / Frêne), persisté en local (clé cyl_treeType,
//    lue par ez-tree-build sur accueil/login/app). Pas d'import de la lib 4 Mo ici.
(function treeChoice() {
  const KEY = 'cyl_treeType';
  const opts = document.querySelectorAll('.univers-opt');
  if (!opts.length) return;
  const cur = (localStorage.getItem(KEY) === 'frene') ? 'frene' : 'chene';
  const paint = (v) => opts.forEach((b) => b.classList.toggle('active', b.dataset.tree === v));
  paint(cur);
  const toast = (msg) => { const t = document.getElementById('toast'); if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400); } };
  opts.forEach((b) => b.addEventListener('click', () => {
    try { localStorage.setItem(KEY, b.dataset.tree); } catch (_) {}
    paint(b.dataset.tree);
    toast('Essence mise à jour - recharge l\'accueil pour la voir');
  }));
  // Univers : Arbre vivant / Architecture (clé cyl_universe)
  const WKEY = 'cyl_universe';
  const worldOpts = document.querySelectorAll('.world-opt');
  const curW = (localStorage.getItem(WKEY) === 'archi') ? 'archi' : 'arbre';
  const paintW = (v) => worldOpts.forEach((b) => b.classList.toggle('active', b.dataset.world === v));
  paintW(curW);
  worldOpts.forEach((b) => b.addEventListener('click', () => {
    try { localStorage.setItem(WKEY, b.dataset.world); } catch (_) {}
    paintW(b.dataset.world);
    toast(b.dataset.world === 'archi' ? 'Univers Architecture - recharge l\'accueil' : 'Univers Arbre - recharge l\'accueil');
  }));
})();

// ── Global avatar + user menu ──
try { updateGlobalAvatar(); } catch (e) { /* ignore */ }
try { initUserMenu(); } catch (e) { /* ignore */ }
