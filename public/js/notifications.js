// public/js/notifications.js - v1
// Petit store de notifications (localStorage, par UID) alimenté par les VRAIES
// actions de l'utilisateur (gain d'XP par branche, participation giveaway...).
// Cohérent avec la philosophie CYL : on notifie ce qui se passe pour de vrai.
//
// Exports : addNotif, getNotifs, markAllRead, unreadCount, onChange.
// L'espace Notifications du menu (userMenu.js) lit ce store et écoute `cyl:notifs-changed`.

const CAP = 30;               // nb max de notifs conservées
const XP_MERGE_MS = 60000;    // fusionne les gains d'XP rapprochés (< 60 s)

function uid() {
  try { return (window._cyfFirebase?.auth?.currentUser?.uid) || 'anon'; } catch (_) { return 'anon'; }
}
function key() { return `cyl_notifs_${uid()}`; }

function load() {
  try { return JSON.parse(localStorage.getItem(key()) || '[]') || []; } catch (_) { return []; }
}
function save(list) {
  try { localStorage.setItem(key(), JSON.stringify(list.slice(0, CAP))); } catch (_) {}
  try { window.dispatchEvent(new CustomEvent('cyl:notifs-changed')); } catch (_) {}
}

// Horodatage monotone sans Date.now() interdit ? (côté navigateur Date.now est OK)
function now() { return Date.now(); }

export function getNotifs() { return load(); }
export function unreadCount() { return load().filter(n => !n.read).length; }

export function markAllRead() {
  const list = load();
  let changed = false;
  for (const n of list) if (!n.read) { n.read = true; changed = true; }
  if (changed) save(list);
}

export function addNotif(type, title, body, opts = {}) {
  const list = load();
  // Fusion des gains d'XP rapprochés en une seule notif "+N XP"
  if (type === 'xp' && list[0] && list[0].type === 'xp' && (now() - list[0].ts) < XP_MERGE_MS) {
    list[0].amount = (list[0].amount || 0) + (opts.amount || 0);
    list[0].title = `+${list[0].amount} XP gagné`;
    list[0].body = body || list[0].body;
    list[0].ts = now();
    list[0].read = false;
    save(list);
    return list[0];
  }
  const n = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(now()) + Math.random().toString(36).slice(2)),
    type, title, body: body || '', ts: now(), read: false,
    emoji: opts.emoji || defaultEmoji(type), amount: opts.amount || 0,
  };
  list.unshift(n);
  save(list);
  return n;
}

function defaultEmoji(type) {
  return ({ xp: '⚡', giveaway: '🎁', badge: '🏆', system: '🔔' })[type] || '🔔';
}

// ── Libellés de branche Maslow (pour les notifs d'XP) ────────────────────────
const BRANCH = {
  physio: '💪 Corps', securite: '🛡️ Sécurité', appartenance: '❤️ Appartenance',
  estime: '⭐ Estime', cognitif: '🧠 Cognitif', esthetique: '🎨 Esthétique',
  accomplissement: '🎯 Accomplissement', transcendance: '🌌 Transcendance',
  // alias domaines
  body: '💪 Corps', heart: '❤️ Cœur', etre: '🌌 Être', order: '📐 Ordre',
};
function branchLabel(b) { return BRANCH[b] || (b ? b.charAt(0).toUpperCase() + b.slice(1) : 'ton arbre'); }

// ── Branchement sur les vrais événements ─────────────────────────────────────
function wire() {
  if (window.__cylNotifsWired) return;
  window.__cylNotifsWired = true;

  document.addEventListener('cyl:xp-gained', (e) => {
    const d = (e && e.detail) || {};
    const amount = d.amount || 0;
    if (!amount) return;
    addNotif('xp', `+${amount} XP gagné`, `Tu as nourri ${branchLabel(d.branch)}.`, { amount, emoji: '⚡' });
  });

  window.addEventListener('cyf:giveaway-entered', () => {
    addNotif('giveaway', 'Participation au giveaway confirmée', 'Bonne chance pour le prochain tirage ! 🍀', { emoji: '🎁' });
  });
}
wire();

// Accès global pratique (pour du code non-module éventuel).
try { window.cylNotifs = { addNotif, getNotifs, markAllRead, unreadCount }; } catch (_) {}

export default { addNotif, getNotifs, markAllRead, unreadCount };
