// /js/cyl-avatar.js - Le visage de CYL.
//
// L'orbe doree ne disait rien de ce que CYL fait. L'idee de l'owner : le
// « syndrome de la blouse blanche » - on ecoute autrement quelqu'un qui a
// l'air de savoir. Donc un professeur : blouse, lunettes, craie a la main,
// l'air de reflechir a ce qu'on vient de lui dire.
//
// POURQUOI UN DESSIN VECTORIEL plutot qu'une image trouvee en ligne :
//   · net a 28px comme a 240px, alors qu'un bitmoji flouterait ;
//   · quelques kilo-octets de balises, pas un fichier a heberger ;
//   · la CSP interdit les images d'un domaine tiers ;
//   · aucune question de droits sur un visage dessine par quelqu'un d'autre.
//
// NEUTRALITE : coupe courte, pas de maquillage, pas de carrure marquee - rien
// n'assigne de genre a CYL. Ce n'est pas un detail : CYL accompagne sans
// s'imposer, son visage suit la meme regle.

const NS = 'http://www.w3.org/2000/svg';

// Un identifiant par instance : deux avatars sur la meme page partageraient
// sinon les memes degrades, et le second ecraserait le premier.
let seq = 0;

export function avatarSVG({ size = 44, ring = true, thinking = false } = {}) {
  const id = 'cylav' + (++seq);
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 100 100');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('class', 'cyl-av' + (thinking ? ' thinking' : ''));
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', 'CYL');
  s.innerHTML = `
    <defs>
      <radialGradient id="${id}bg" cx="36%" cy="30%">
        <stop offset="0%" stop-color="#fbe6b0"/>
        <stop offset="42%" stop-color="#e7b15c"/>
        <stop offset="100%" stop-color="#3f6b33"/>
      </radialGradient>
      <linearGradient id="${id}coat" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#dfe3dc"/>
      </linearGradient>
      <clipPath id="${id}clip"><circle cx="50" cy="50" r="50"/></clipPath>
    </defs>

    ${ring ? `<circle cx="50" cy="50" r="50" fill="url(#${id}bg)"/>` : ''}

    <g clip-path="${ring ? `url(#${id}clip)` : 'none'}">
      <!-- Buste : la blouse, signe le plus lisible a petite taille -->
      <path d="M22 100 q0-22 12-28 l16-6 h0 l16 6 q12 6 12 28 z" fill="url(#${id}coat)"/>
      <!-- Col en V, et le vert du site en dessous -->
      <path d="M42 66 l8 14 l8-14 l-8-4 z" fill="#2f4a2a"/>
      <path d="M42 66 l8 14 l-5 20 h-6 z" fill="#eef0ea"/>
      <path d="M58 66 l-8 14 l5 20 h6 z" fill="#eef0ea"/>
      <!-- Poche et stylo : le detail qui dit « professeur » sans mot -->
      <rect x="60" y="80" width="11" height="9" rx="1.5" fill="#e6e9e2"/>
      <rect x="64" y="77" width="2.2" height="8" rx="1.1" fill="#84c25e"/>

      <!-- Cou -->
      <path d="M43 56 h14 v10 q-7 5-14 0 z" fill="#d9a077"/>
      <!-- Tete -->
      <ellipse cx="50" cy="41" rx="19" ry="21" fill="#eab98f"/>
      <!-- Oreilles -->
      <ellipse cx="30.5" cy="43" rx="3.2" ry="4.4" fill="#e0aa7e"/>
      <ellipse cx="69.5" cy="43" rx="3.2" ry="4.4" fill="#e0aa7e"/>
      <!-- Cheveux : coupe courte, volontairement sans genre -->
      <path d="M31 39 q1-19 19-19 q18 0 19 19 q-3-9-9-11 q-6 4-14 3 q-9-1-12 3 q-2 2-3 5 z" fill="#4a3b30"/>

      <!-- Lunettes : deux ronds et un pont. C'est la forme qui porte tout le
           reste - sans elles, ce n'est plus un professeur. -->
      <g fill="none" stroke="#2b3340" stroke-width="2.4">
        <circle cx="42" cy="41" r="7.6" fill="#e4e2dd" fill-opacity=".26"/>
        <circle cx="60" cy="41" r="7.6" fill="#e4e2dd" fill-opacity=".26"/>
        <path d="M49.6 41 q2.4-2 4.8 0"/>
        <path d="M34.4 40 l-3.6-1.6"/>
        <path d="M67.6 40 l3.6-1.6"/>
      </g>
      <!-- Reflet : sans lui, les verres paraissent vides -->
      <path d="M38 37.5 l4-3" stroke="#ffffff" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M56 37.5 l4-3" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/>

      <!-- Yeux et sourcils. Le sourcil droit est leve : c'est ce seul trait
           qui fait passer le visage de « neutre » a « il t'ecoute ». -->
      <circle class="cyl-av-eye" cx="42" cy="41.5" r="2.3" fill="#2b2318"/>
      <circle class="cyl-av-eye" cx="60" cy="41.5" r="2.3" fill="#2b2318"/>
      <path d="M37.5 31.5 q4.5-2.4 9 -0.4" stroke="#4a3b30" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M55.5 30.4 q4.5-2.6 9 0.6" stroke="#4a3b30" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Sourire discret : bienveillant, jamais jovial. CYL n'est pas une
           mascotte, il accompagne des sujets qui peuvent etre lourds. -->
      <path d="M45 51 q5 4 10 0" stroke="#8a5c42" stroke-width="2" fill="none" stroke-linecap="round"/>

      <!-- Main et craie, pres du menton : le geste de quelqu'un qui reflechit -->
      <g class="cyl-av-hand">
        <rect x="70" y="52" width="4.6" height="15" rx="2.3" fill="#f6f4ee" transform="rotate(18 72 60)"/>
        <rect x="70" y="52" width="4.6" height="4" rx="1.6" fill="#cfd4c8" transform="rotate(18 72 60)"/>
        <ellipse cx="70" cy="68" rx="7" ry="6.2" fill="#eab98f"/>
      </g>
    </g>`;
  return s;
}

// Une seule feuille pour toutes les instances.
export function injectAvatarCSS() {
  if (document.getElementById('cyl-av-css')) return;
  const st = document.createElement('style');
  st.id = 'cyl-av-css';
  st.textContent = `
    .cyl-av{display:block;border-radius:50%;}
    /* Pendant qu'il cherche sa reponse, la craie bouge et il cligne : sans ce
       signe, une attente de trois secondes ressemble a un plantage. */
    .cyl-av.thinking .cyl-av-hand{animation:cylAvHand 1.9s ease-in-out infinite;transform-origin:70px 68px;}
    .cyl-av.thinking .cyl-av-eye{animation:cylAvBlink 3.4s steps(1,end) infinite;transform-origin:center;}
    @keyframes cylAvHand{0%,100%{transform:translateY(0) rotate(0deg);}50%{transform:translateY(-2.5px) rotate(-6deg);}}
    @keyframes cylAvBlink{0%,92%{transform:scaleY(1);}94%,97%{transform:scaleY(.12);}100%{transform:scaleY(1);}}
    /* Respecte le reglage systeme : une animation permanente peut declencher
       des troubles chez certaines personnes. */
    @media (prefers-reduced-motion:reduce){
      .cyl-av.thinking .cyl-av-hand,.cyl-av.thinking .cyl-av-eye{animation:none;}
    }`;
  document.head.appendChild(st);
}

// Remplace le contenu d'un hote par l'avatar, en gardant sa taille.
export function mountAvatar(host, opts) {
  if (!host) return null;
  injectAvatarCSS();
  const svg = avatarSVG(opts);
  host.replaceChildren(svg);
  return svg;
}

export function setThinking(svg, on) {
  if (svg) svg.classList.toggle('thinking', !!on);
}
