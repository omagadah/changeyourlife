/**
 * XP utilities — floating +XP animation.
 * Usage: import { showXpFloat } from '/js/xp.js';
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
