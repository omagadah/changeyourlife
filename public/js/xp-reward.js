// /js/xp-reward.js — carte de récompense affichée à chaque gain d'XP.
//
// Appelée par `awardXp()` (firebase.js) → un seul point, donc TOUS les
// modules (méditation, journal, sommeil…) ont le même retour visuel : une
// carte qui glisse, à la couleur de la branche Maslow nourrie.

const BRANCH_META = {
  physio:          { label: 'Physiologique',   color: '#2dd4bf', emoji: '🌱' },
  securite:        { label: 'Sécurité',        color: '#fbbf24', emoji: '🛡️' },
  appartenance:    { label: 'Appartenance',    color: '#f87171', emoji: '❤️' },
  estime:          { label: 'Estime',          color: '#fb923c', emoji: '⭐' },
  cognitif:        { label: 'Cognitif',        color: '#a78bfa', emoji: '🧠' },
  esthetique:      { label: 'Esthétique',      color: '#e879c7', emoji: '🎨' },
  accomplissement: { label: 'Accomplissement', color: '#38bdf8', emoji: '🚀' },
  transcendance:   { label: 'Transcendance',   color: '#c4b5fd', emoji: '✨' },
};

let ready = false;
let wrap = null;

function ensure() {
  if (ready) return;
  ready = true;
  const css = document.createElement('style');
  css.id = 'xp-reward-css';
  css.textContent = `
    .xpr-wrap{position:fixed;top:18px;right:18px;z-index:10000;
      display:flex;flex-direction:column;gap:10px;pointer-events:none;}
    .xpr-card{display:flex;align-items:center;gap:12px;min-width:212px;
      padding:12px 16px 12px 13px;border-radius:14px;
      background:rgba(11,24,41,0.97);
      border:1px solid var(--xpr-color,#0070f3);
      border-left:4px solid var(--xpr-color,#0070f3);
      box-shadow:0 12px 34px rgba(0,0,0,0.5),0 0 22px -8px var(--xpr-color,#0070f3);
      transform:translateX(135%);opacity:0;
      animation:xprIn .5s cubic-bezier(.22,1,.36,1) forwards;}
    .xpr-card.xpr-out{animation:xprOut .42s ease forwards;}
    @keyframes xprIn{to{transform:translateX(0);opacity:1;}}
    @keyframes xprOut{to{transform:translateX(135%);opacity:0;}}
    .xpr-emoji{font-size:1.6rem;flex-shrink:0;
      animation:xprPop .6s cubic-bezier(.22,1,.36,1) .14s both;}
    @keyframes xprPop{0%{transform:scale(0);}60%{transform:scale(1.32);}100%{transform:scale(1);}}
    .xpr-body{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;}
    .xpr-branch{font:700 0.68rem -apple-system,Segoe UI,Roboto,sans-serif;
      letter-spacing:.6px;text-transform:uppercase;color:var(--xpr-color,#0070f3);}
    .xpr-xp{font:800 1.02rem -apple-system,Segoe UI,Roboto,sans-serif;color:#eef4ff;}
    .xpr-leaf{font-size:1.1rem;flex-shrink:0;transform-origin:bottom center;
      animation:xprLeaf 2.4s ease-in-out infinite;}
    @keyframes xprLeaf{0%,100%{transform:rotate(-9deg);}50%{transform:rotate(9deg);}}
    @media (max-width:520px){.xpr-wrap{left:14px;right:14px;}.xpr-card{min-width:0;}}
  `;
  document.head.appendChild(css);
  wrap = document.createElement('div');
  wrap.className = 'xpr-wrap';
  document.body.appendChild(wrap);
}

/** Affiche une carte « +N XP · Branche ». branchKey = clé Maslow. */
export function showXpReward(branchKey, amount) {
  const m = BRANCH_META[branchKey];
  const xp = Math.round(Number(amount) || 0);
  if (!m || xp <= 0) return;
  try {
    ensure();
    const card = document.createElement('div');
    card.className = 'xpr-card';
    card.style.setProperty('--xpr-color', m.color);
    card.innerHTML =
      `<span class="xpr-emoji">${m.emoji}</span>` +
      `<span class="xpr-body">` +
        `<span class="xpr-branch">${m.label} a poussé</span>` +
        `<span class="xpr-xp">+${xp} XP</span>` +
      `</span>` +
      `<span class="xpr-leaf">🌿</span>`;
    wrap.appendChild(card);
    while (wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
    setTimeout(() => {
      card.classList.add('xpr-out');
      setTimeout(() => card.remove(), 450);
    }, 3200);
  } catch (e) { /* feedback non critique */ }
}
