// /js/cyl-bg.js - Le fond anime, partout et de la meme facon.
//
// Il existait deja, mais en QUATORZE implementations divergentes : deux noms
// de conteneur (#vanta-bg et #vanta-birds-bg), des reglages differents d'une
// page a l'autre, et surtout - c'etait le bug - un conteneur SANS AUCUN STYLE
// sur la moitie des pages. Le div etait bien la, Vanta s'y initialisait, mais
// dans une boite de zero pixel : rien ne s'affichait. D'ou un fond visible sur
// le Codex et la Roue de vie, et absent du Journal, du Sommeil, de l'Humeur,
// de la Meditation et des Habitudes.
//
// Ici : un seul conteneur, un seul style, un seul reglage.
//
// LE POIDS EST ASSUME. Three.js et Vanta pesent environ 630 Ko. On les charge
// donc APRES le contenu (requestIdleCallback), jamais en bloquant l'affichage,
// et jamais sur un petit ecran ni en economie de donnees - un fond decoratif
// ne vaut pas de vider un forfait mobile.

const HOST_ID = 'cyl-bg';
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
const VANTA_URL = 'https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.birds.min.js';

// Les teintes du fond restent BLEUES, a la difference du reste du site : elles
// signent l'espace numerique, la couche « machine » sur laquelle l'arbre pousse.
const SETTINGS = {
  backgroundColor: 0x07192f,
  color1: 0x7192ff,
  color2: 0x00d1ff,
  colorMode: 'varianceGradient',
  quantity: 3,
  birdSize: 1,
  wingSpan: 20,
  speedLimit: 4,
  separation: 60,
  mouseControls: true,
  touchControls: false,     // sur mobile, le doigt sert a faire defiler
  gyroControls: false,
};

let effect = null;
let started = false;

function injectCSS() {
  if (document.getElementById('cyl-bg-css')) return;
  const s = document.createElement('style');
  s.id = 'cyl-bg-css';
  s.textContent = `
    /* NE JAMAIS TOUCHER AUX ENFANTS DU BODY ICI.
       Une version de ce fichier ajoutait body > *:not(#cyl-bg) en
       position:relative, pour garantir que le contenu passe devant. La barre
       laterale, la bulle de CYL et le cadre de chaque page sont en
       position:FIXED : les basculer en relative les a jetes dans le flux
       normal. La barre a disparu, la bulle est remontee en haut a droite et
       toute la mise en page s est effondree.
       Le fond n a besoin de rien de tel : en z-index 0 il est peint avant les
       elements positionnes, et tous les cadres de page du site en sont
       (.app-container, .page-shell, .ap-shell, .layout, .fr-shell). C est
       exactement ce que faisait deja le Codex, seule page ou ca marchait. */
    /* z-index 0 et non -1 : a -1 le fond passe DERRIERE la couleur de fond du
       body, qui est opaque sur la plupart des pages, et redevient invisible. */
    #${HOST_ID}{position:fixed;inset:0;z-index:0;pointer-events:none;}
    @media print { #${HOST_ID}{display:none !important;} }`;
  document.head.appendChild(s);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Les anciennes pages chargeaient deja ces scripts : on ne les remet pas.
    if ([...document.scripts].some((x) => x.src === src)) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = resolve;
    el.onerror = () => reject(new Error('script ' + src));
    document.head.appendChild(el);
  });
}

// Un fond decoratif ne doit couter ni batterie ni forfait.
function shouldRun() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.innerWidth < 900) return false;
  const c = navigator.connection;
  if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return false;
  return true;
}

export async function initBackground() {
  if (started) return;
  started = true;
  injectCSS();

  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(host, document.body.firstChild);
  }
  if (!shouldRun()) return;

  try {
    await loadScript(THREE_URL);
    await loadScript(VANTA_URL);
    if (!window.VANTA || !window.VANTA.BIRDS) return;
    effect = window.VANTA.BIRDS(Object.assign({ el: '#' + HOST_ID }, SETTINGS));
  } catch (e) {
    // Un fond qui ne charge pas ne doit jamais empecher la page de servir.
    console.warn('[cyl-bg]', e && e.message || e);
  }
}

export function destroyBackground() {
  if (effect && effect.destroy) { try { effect.destroy(); } catch (_) {} }
  effect = null;
}

// Une animation WebGL qui tourne dans un onglet cache consomme pour rien.
document.addEventListener('visibilitychange', () => {
  if (!effect) return;
  try {
    if (document.hidden && effect.pause) effect.pause();
    else if (!document.hidden && effect.play) effect.play();
  } catch (_) {}
});

// Charge quand le navigateur n'a plus rien d'urgent a faire : le contenu de la
// page passe toujours avant 630 Ko de decor.
export function scheduleBackground() {
  const go = () => initBackground();
  if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 2500 });
  else setTimeout(go, 900);
}
