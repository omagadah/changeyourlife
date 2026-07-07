// /js/plan.js - Module « Aujourd'hui » : poste de pilotage quotidien.
// Rythme de vie + besoins essentiels (garde-fous) + tâches du jour.
// Chaque action validée → awardXp(branche) → l'arbre pousse.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initUserMenu } from '/js/userMenu.js';
import { updateGlobalAvatar, saveWithFeedback } from '/js/common.js';
import { loadSkills, awardSkillXp } from '/js/skills.js';

let auth, db, uid;
let plan = { rhythm: {}, vitals: {}, tasks: [] };
let userSkills = {};   // compétences de l'utilisateur (pour taguer une tâche)

if (window._cyfFirebase) {
  ({ auth, db } = window._cyfFirebase);
} else {
  await import('/js/firebase.js');
  ({ auth, db } = window._cyfFirebase);
}
try { initUserMenu(); } catch (e) {}
if (!document.getElementById('cyl-emoji-js')) { const _e = document.createElement('script'); _e.id = 'cyl-emoji-js'; _e.src = '/js/emoji.js'; document.head.appendChild(_e); }

// ── Métadonnées ──────────────────────────────────────────────────────────────
const BRANCHES = [
  { key: 'physio',          label: 'Physiologique',   emoji: '🌱', color: '#2dd4bf' },
  { key: 'securite',        label: 'Sécurité',        emoji: '🛡️', color: '#fbbf24' },
  { key: 'appartenance',    label: 'Appartenance',    emoji: '🤝', color: '#f87171' },
  { key: 'estime',          label: 'Estime',          emoji: '🏆', color: '#fb923c' },
  { key: 'cognitif',        label: 'Cognitif',        emoji: '📚', color: '#a78bfa' },
  { key: 'esthetique',      label: 'Esthétique',      emoji: '🎨', color: '#e879c7' },
  { key: 'accomplissement', label: 'Accomplissement', emoji: '🚀', color: '#38bdf8' },
  { key: 'transcendance',   label: 'Transcendance',   emoji: '✨', color: '#c4b5fd' },
];
const BRANCH_BY_KEY = Object.fromEntries(BRANCHES.map((b) => [b.key, b]));
const VITALS = [
  { key: 'sommeil',     label: 'Sommeil',     emoji: '🌙' },
  { key: 'nutrition',   label: 'Nutrition',   emoji: '🥗' },
  { key: 'hydratation', label: 'Hydratation', emoji: '💧' },
  { key: 'mouvement',   label: 'Mouvement',   emoji: '🏃' },
];
const VITAL_XP = 20;
const RHYTHM_XP = 15;
const TASK_XP = 40;

const todayStr = () => new Date().toISOString().slice(0, 10);
const uid4 = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(msg, xp) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.toggle('xp', !!xp);
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2200);
}
async function award(branch, amount, label) {
  try {
    const fn = window._cyfFirebase && window._cyfFirebase.awardXp;
    if (fn) await fn(branch, amount);
    toast(`+${amount} XP · ${label}`, true);
  } catch (e) { /* silencieux */ }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login/'; return; }
  uid = user.uid;
  try { updateGlobalAvatar((user.email || 'U').charAt(0).toUpperCase()); } catch (e) {}
  try { initUserMenu(); } catch (e) {}
  const d = document.getElementById('header-date');
  if (d) d.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  await loadPlan();
  try { userSkills = await loadSkills(db, uid); } catch (e) { userSkills = {}; }
  initRhythm();
  renderVitals();
  initTasks();
  renderTasks();
  updateSYL();
});

async function loadPlan() {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const p = snap.exists() ? snap.data().plan : null;
    plan = (p && typeof p === 'object') ? p : {};
  } catch (e) { plan = {}; }
  plan.rhythm = plan.rhythm || {};
  plan.vitals = plan.vitals || {};
  plan.tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  // Réinitialisation quotidienne du rythme et des besoins (par jour)
  const today = todayStr();
  if (plan.rhythm.date !== today) plan.rhythm = { date: today };
  if (plan.vitals.date !== today) plan.vitals = { date: today };
}
async function savePlan() {
  await saveWithFeedback(() => setDoc(doc(db, 'users', uid), { plan }, { merge: true }));
}

// ── Rythme ───────────────────────────────────────────────────────────────────
let energy = 0;
function initRhythm() {
  const r = plan.rhythm || {};
  const wake = document.getElementById('r-wake');
  const sleep = document.getElementById('r-sleep');
  const time = document.getElementById('r-time');
  const focus = document.getElementById('r-focus');
  if (wake) wake.value = r.wake || '';
  if (sleep) sleep.value = r.sleep || '';
  if (time) time.value = r.time || '';
  if (focus) focus.value = r.focus || '';
  energy = Number(r.energy) || 0;
  document.querySelectorAll('#energy-chips .energy-chip').forEach((c) => {
    c.classList.toggle('on', Number(c.dataset.v) === energy);
    c.onclick = () => {
      energy = Number(c.dataset.v);
      document.querySelectorAll('#energy-chips .energy-chip').forEach((x) =>
        x.classList.toggle('on', Number(x.dataset.v) === energy));
    };
  });
  const btn = document.getElementById('btn-save-rhythm');
  if (btn) btn.onclick = saveRhythm;
}
async function saveRhythm() {
  const today = todayStr();
  const already = plan.rhythm && plan.rhythm.savedDate === today;
  plan.rhythm = {
    date: today,
    wake: (document.getElementById('r-wake') || {}).value || '',
    sleep: (document.getElementById('r-sleep') || {}).value || '',
    time: (document.getElementById('r-time') || {}).value || '',
    focus: (document.getElementById('r-focus') || {}).value || '',
    energy,
    savedDate: today,
  };
  await savePlan();
  updateSYL();
  if (!already) { await award('physio', RHYTHM_XP, 'Rythme du jour'); }
  else { toast('Rythme mis à jour'); }
}

// ── Base vitale ──────────────────────────────────────────────────────────────
function renderVitals() {
  const grid = document.getElementById('vitals-grid');
  if (!grid) return;
  grid.innerHTML = '';
  VITALS.forEach((v) => {
    const done = !!plan.vitals[v.key];
    const el = document.createElement('div');
    el.className = 'vital-card' + (done ? ' done' : '');
    el.innerHTML =
      `<span class="vital-check">✓</span>` +
      `<span class="vital-emoji">${v.emoji}</span>` +
      `<span class="vital-name">${v.label}</span>`;
    el.onclick = () => toggleVital(v);
    grid.appendChild(el);
  });
}
async function toggleVital(v) {
  const wasDone = !!plan.vitals[v.key];
  plan.vitals[v.key] = !wasDone;
  plan.vitals.date = todayStr();
  renderVitals();
  await savePlan();
  updateSYL();
  if (!wasDone) await award('physio', VITAL_XP, v.label); // XP seulement à la validation
}

// ── Tâches ───────────────────────────────────────────────────────────────────
function initTasks() {
  const sel = document.getElementById('task-branch');
  if (sel) sel.innerHTML = BRANCHES.map((b) => `<option value="${b.key}">${b.emoji} ${b.label}</option>`).join('');
  const skSel = document.getElementById('task-skill');
  if (skSel) {
    const ids = Object.keys(userSkills);
    skSel.innerHTML = '<option value="">- compétence (option) -</option>' +
      ids.map((id) => `<option value="${id}">${escapeHtml((userSkills[id].emoji || '') + ' ' + (userSkills[id].name || id))}</option>`).join('');
  }
  const btn = document.getElementById('btn-add-task');
  const input = document.getElementById('task-title');
  if (btn) btn.onclick = addTask;
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });
}
async function addTask() {
  const input = document.getElementById('task-title');
  const sel = document.getElementById('task-branch');
  const skSel = document.getElementById('task-skill');
  const title = (input.value || '').trim();
  if (!title) { input.focus(); return; }
  plan.tasks.push({ id: uid4(), title, branch: (sel && sel.value) || 'accomplissement', skillId: (skSel && skSel.value) || '', done: false, createdAt: Date.now() });
  input.value = '';
  renderTasks();
  await savePlan();
}
async function toggleTask(id) {
  const t = plan.tasks.find((x) => x.id === id);
  if (!t) return;
  const wasDone = t.done;
  t.done = !wasDone;
  t.doneAt = t.done ? Date.now() : null;
  renderTasks();
  await savePlan();
  if (t.done && !wasDone) {
    await award(t.branch, TASK_XP, BRANCH_BY_KEY[t.branch] ? BRANCH_BY_KEY[t.branch].label : 'Tâche');
    if (t.skillId && userSkills[t.skillId]) {
      const res = await awardSkillXp(db, uid, t.skillId, 25);
      if (res && res.leveledUp) toast(`${userSkills[t.skillId].name} - niveau ${res.level} !`, true);
    }
  }
}
async function delTask(id) {
  plan.tasks = plan.tasks.filter((x) => x.id !== id);
  renderTasks();
  await savePlan();
}
function renderTasks() {
  const list = document.getElementById('task-list');
  const prog = document.getElementById('tasks-progress');
  if (!list) return;
  const done = plan.tasks.filter((t) => t.done).length;
  if (prog) prog.textContent = plan.tasks.length ? `${done}/${plan.tasks.length} accomplies` : '';
  if (!plan.tasks.length) {
    list.innerHTML = `<div class="empty-tasks">Ajoute ta première tâche du jour 🌿</div>`;
    return;
  }
  // tâches non faites d'abord
  const sorted = [...plan.tasks].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  list.innerHTML = '';
  sorted.forEach((t) => {
    const b = BRANCH_BY_KEY[t.branch] || BRANCH_BY_KEY.accomplissement;
    const card = document.createElement('div');
    card.className = 'task-card' + (t.done ? ' done' : '');
    card.style.setProperty('--bc', b.color);
    card.innerHTML =
      `<button class="task-check" aria-label="Valider">✓</button>` +
      `<div class="task-body"><div class="task-title">${escapeHtml(t.title)}</div>` +
      `<div class="task-branch">${b.emoji} ${b.label}${t.skillId && userSkills[t.skillId] ? ' · 🧗 ' + escapeHtml(userSkills[t.skillId].name) : ''}</div></div>` +
      `<button class="task-del" aria-label="Supprimer">Suppr.</button>`;
    card.querySelector('.task-check').onclick = () => toggleTask(t.id);
    card.querySelector('.task-del').onclick = () => delTask(t.id);
    list.appendChild(card);
  });
}

// ── SYL - message contextuel selon le rythme et la base vitale ──────────────
function updateSYL() {
  const el = document.getElementById('lya-line');
  if (!el) return;
  const r = plan.rhythm || {};
  const sleep = Number(r.sleep) || 0;
  const en = Number(r.energy) || 0;
  const vitalsDone = VITALS.filter((v) => plan.vitals[v.key]).length;
  let msg;
  if (sleep && sleep < 6) {
    msg = `Tu n'as dormi que ${sleep} h. Aujourd'hui, priorité au repos - on garde une journée légère, 1 ou 2 tâches suffisent.`;
  } else if (en && en <= 2) {
    msg = `Énergie basse aujourd'hui. Choisis l'essentiel et avance pas à pas, sans te surcharger.`;
  } else if (vitalsDone < 2) {
    msg = `Pense à ta base : sommeil, eau, repas, mouvement. C'est elle qui tient tout le reste debout.`;
  } else if (r.focus) {
    msg = `Belle énergie. Garde le cap sur ton focus : « ${escapeHtml(r.focus)} ».`;
  } else if (r.savedDate) {
    msg = `Ton rythme est calé. Ajoute tes tâches du jour, et coche-les au fur et à mesure - l'arbre grandira.`;
  } else {
    msg = `Bonjour. Commençons par caler ton rythme du jour.`;
  }
  el.innerHTML = msg;
}
