/**
 * Initialiser le background Vanta Birds
 * À appeler après que le DOM soit chargé
 */
export function initVantaBirds(containerId = '#vanta-bg') {
  if (typeof VANTA === 'undefined') {
    console.warn('Vanta not loaded');
    return;
  }

  return VANTA.BIRDS({
    el: containerId,
    mouseControls: true,
    touchControls: true,
    gyroControls: false,
    minHeight: 200.0,
    minWidth: 200.0,
    scale: 1.0,
    scaleMobile: 1.0,
    backgroundColor: 0x07192f,
    color1: 0x7192ff,
    color2: 0xd1ff,
    colorMode: 'varianceGradient',
    quantity: 5.0,
    birdSize: 1.0,
    wingSpan: 30.0,
    speedLimit: 5.0,
    separation: 20.0,
    alignment: 20.0,
    cohesion: 20.0
  });
}

/**
 * Ajouter le conteneur Vanta au DOM
 */
export function addVantaContainer() {
  if (!document.getElementById('vanta-bg')) {
    const div = document.createElement('div');
    div.id = 'vanta-bg';
    div.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;';
    document.body.insertBefore(div, document.body.firstChild);
  }
}

/**
 * Initialiser Vanta avec tous les scripts nécessaires
 */
export async function setupVanta() {
  // Vérifier si les scripts sont déjà chargés
  if (typeof VANTA !== 'undefined') {
    addVantaContainer();
    initVantaBirds();
    return;
  }

  // Charger Three.js
  if (typeof THREE === 'undefined') {
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }

  // Charger Vanta
  await new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.birds.min.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });

  addVantaContainer();
  initVantaBirds();
}
