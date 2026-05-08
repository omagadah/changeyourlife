// /login/ — bootstrap : Vanta birds + global avatar.
// Module ESM : exécuté en defer après le DOM, après les scripts Vanta.
import { updateGlobalAvatar } from '/js/common.js';

function bootVanta() {
  try {
    if (window.VANTA && window.VANTA.BIRDS) {
      window.VANTA.BIRDS({
        el: '#vanta-birds-bg',
        mouseControls: true, touchControls: true, gyroControls: false,
        minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
        backgroundColor: 0x0, color1: 0x7192ff, color2: 0xd1ff,
        colorMode: 'varianceGradient', quantity: 5,
      });
    } else {
      setTimeout(bootVanta, 80);
    }
  } catch (e) { /* ignore */ }
}

bootVanta();
window.addEventListener('DOMContentLoaded', () => {
  try { updateGlobalAvatar(); } catch (e) {}
});
