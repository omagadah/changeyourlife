/**
 * XP utilities — floating +XP animation and level-up banner
 * Usage: import { showXpFloat, showLevelUp } from '/js/xp.js';
 */

/**
 * Show a floating "+15 XP" text near a target element (or screen center).
 * @param {number} amount - XP amount to show
 * @param {HTMLElement|null} near - Element to anchor near (optional)
 */
export function showXpFloat(amount, near = null) {
  const el = document.createElement('div');
  el.className = 'xp-float';
  el.textContent = `+${amount} XP`;
  document.body.appendChild(el);

  let x = window.innerWidth / 2 - 30;
  let y = window.innerHeight / 2 - 60;
  if (near) {
    const rect = near.getBoundingClientRect();
    x = rect.left + rect.width / 2 - 30;
    y = rect.top - 10;
  }
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  el.addEventListener('animationend', () => el.remove());
}

let _levelupTimer = null;

/**
 * Show a level-up celebration banner.
 * @param {string} domain - Domain name (e.g. "Corps")
 * @param {number} level  - New level number
 */
export function showLevelUp(domain, level) {
  let banner = document.getElementById('_levelup_banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = '_levelup_banner';
    banner.className = 'levelup-banner';
    banner.innerHTML = `
      <div class="levelup-icon">🏆</div>
      <div class="levelup-text">
        <div class="levelup-title" id="_lu_title"></div>
        <div class="levelup-sub" id="_lu_sub"></div>
      </div>
    `;
    document.body.appendChild(banner);
  }
  document.getElementById('_lu_title').textContent = `Niveau ${level} — ${domain} !`;
  document.getElementById('_lu_sub').textContent   = 'Continue comme ça, tu progresses vraiment.';

  banner.classList.add('show');
  if (_levelupTimer) clearTimeout(_levelupTimer);
  _levelupTimer = setTimeout(() => banner.classList.remove('show'), 4000);
}
