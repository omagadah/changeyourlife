// /js/cyl-bg.js - Le fond, partout et de la meme facon.
//
// AVANT (2026-08-20 -> 2026-10-17) : Vanta « birds », soit three.js + un
// effet WebGL, 630 Ko charges sur chaque page connectee, pour des oiseaux
// bleus sur un fond navy. Le navy etait le reste de la charte v2 : il
// contredisait la foret nocturne de tout le reste du site, et c'est lui qui
// donnait aux pages /profile/, /settings/ et /yourlife/ leur air « rapporte ».
//
// MAINTENANT : zero script, zero WebGL. Deux lumieres douces (une dorée en
// haut, une mousse en bas) et un grain de papier, en CSS. Le grain est ce qui
// fait « matiere » plutot que « degrade de generateur ». La derive est lente
// (40 s) et coupee quand le systeme demande moins de mouvement.
//
// L'API publique est conservee (initBackground, scheduleBackground,
// destroyBackground) : common.js n'a pas change.

const HOST_ID = 'cyl-bg';
let started = false;

function injectCSS() {
  if (document.getElementById('cyl-bg-css')) return;
  const s = document.createElement('style');
  s.id = 'cyl-bg-css';
  s.textContent = `
    /* NE JAMAIS TOUCHER AUX ENFANTS DU BODY ICI (cf. historique : passer les
       enfants en position:relative avait jete la barre et la bulle hors de
       leur position fixed). z-index 0, pas -1 : a -1 le fond passe derriere la
       couleur du body et disparait. */
    #${HOST_ID}{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;}
    #${HOST_ID}::before{
      content:'';position:absolute;inset:-18%;
      background:
        radial-gradient(58% 46% at 18% 8%, rgba(231,177,92,.11), transparent 62%),
        radial-gradient(52% 60% at 86% 92%, rgba(74,122,58,.20), transparent 62%),
        radial-gradient(38% 40% at 72% 22%, rgba(111,154,82,.07), transparent 60%);
      animation:cylbg-drift 40s ease-in-out infinite alternate;
    }
    #${HOST_ID}::after{
      content:'';position:absolute;inset:0;
      background-image:var(--grain);opacity:.05;mix-blend-mode:overlay;
    }
    body.light-mode #${HOST_ID}::before{
      background:
        radial-gradient(58% 46% at 18% 8%, rgba(231,177,92,.22), transparent 62%),
        radial-gradient(52% 60% at 86% 92%, rgba(74,122,58,.16), transparent 62%);
    }
    body.light-mode #${HOST_ID}::after{opacity:.09;mix-blend-mode:multiply;}
    @keyframes cylbg-drift{from{transform:translate3d(0,0,0)}to{transform:translate3d(-3%,2%,0)}}
    @media (prefers-reduced-motion: reduce){#${HOST_ID}::before{animation:none;}}
    @media print{#${HOST_ID}{display:none !important;}}`;
  document.head.appendChild(s);
}

export function initBackground() {
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
}

export function destroyBackground() {
  const host = document.getElementById(HOST_ID);
  if (host) host.remove();
  started = false;
}

// Conserve pour common.js : il n'y a plus rien a differer, le fond est du CSS.
export function scheduleBackground() { initBackground(); }
