// /js/plan.js - Module « Aujourd'hui » : poste de pilotage quotidien.
// Rythme de vie + besoins essentiels (garde-fous) + tâches du jour.
// Chaque action validée → awardXp(branche) → l'arbre pousse.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initUserMenu } from '/js/userMenu.js';
import { updateGlobalAvatar, saveWithFeedback, setContext, toast, escapeHtml } from '/js/common.js';
import { loadSkills, awardSkillXp } from '/js/skills.js';
import { icon } from '/js/icons.js';
import { BRANCHES, BRANCH_BY_KEY } from '/js/organizer-data.js';

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
// Les branches (libellé, icône, couleur) viennent d'organizer-data.js : une
// seule source pour l'ORGANIZER, l'agenda et cette page.
const VITALS = [
  { key: 'sommeil',     label: 'Sommeil',     ic: 'moon' },
  { key: 'nutrition',   label: 'Nutrition',   ic: 'bowl' },
  { key: 'hydratation', label: 'Hydratation', ic: 'droplet' },
  { key: 'mouvement',   label: 'Mouvement',   ic: 'walk' },
];
const VITAL_XP = 20;
const RHYTHM_XP = 15;
const TASK_XP = 40;

const todayStr = () => new Date().toISOString().slice(0, 10);
const uid4 = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
async function award(branch, amount, label) {
  try {
    const fn = window._cyfFirebase && window._cyfFirebase.awardXp;
    if (fn) await fn(branch, amount);
    toast(`+${amount} XP · ${label}`, { type: 'success', duration: 2200 });
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
  initEvening();
  updateCyl();
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
  const paintEnergy = () => document.querySelectorAll('#energy-chips .energy-chip').forEach((x) => {
    const on = Number(x.dataset.v) === energy;
    x.classList.toggle('on', on);
    x.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  paintEnergy();
  document.querySelectorAll('#energy-chips .energy-chip').forEach((c) => {
    c.onclick = () => { energy = Number(c.dataset.v); paintEnergy(); };
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
  renderWorkload();
  updateCyl();
  if (!already) { await award('physio', RHYTHM_XP, 'Rythme du jour'); }
  else { toast('Rythme mis à jour', { duration: 2200 }); }
}

// ── Base vitale ──────────────────────────────────────────────────────────────
function renderVitals() {
  publishContext();
  const grid = document.getElementById('vitals-grid');
  if (!grid) return;
  grid.innerHTML = '';
  VITALS.forEach((v) => {
    const done = !!plan.vitals[v.key];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'vital-card' + (done ? ' done' : '');
    el.setAttribute('aria-pressed', done ? 'true' : 'false');
    el.innerHTML =
      `<span class="vital-check" aria-hidden="true">${icon('check', { size: 12 })}</span>` +
      `<span class="ic" aria-hidden="true">${icon(v.ic, { size: 26 })}</span>` +
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
  updateCyl();
  if (!wasDone) await award('physio', VITAL_XP, v.label); // XP seulement à la validation
}

// ── Tâches ───────────────────────────────────────────────────────────────────
function initTasks() {
  const sel = document.getElementById('task-branch');
  if (sel) sel.innerHTML = BRANCHES.map((b) => `<option value="${b.key}">${escapeHtml(b.label)}</option>`).join('');
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
      if (res && res.leveledUp) toast(`${userSkills[t.skillId].name} - niveau ${res.level}`, { type: 'success' });
    }
  }
}
async function delTask(id) {
  plan.tasks = plan.tasks.filter((x) => x.id !== id);
  renderTasks();
  await savePlan();
}
// CYL est dans le panneau pendant qu'on coche sa journée : ces repères lui
// évitent de redemander ce qui est déjà affiché à l'écran.
function publishContext() {
  try {
    const faites = plan.tasks.filter((t) => t.done).length;
    const vitaux = VITALS.filter((v) => plan.vitals[v.key]).map((v) => v.label);
    setContext('plan', {
      'taches du jour': plan.tasks.length,
      'taches accomplies': faites,
      'reste a faire': plan.tasks.filter((t) => !t.done).slice(0, 5).map((t) => String(t.title || '').slice(0, 60)),
      'essentiels coches': vitaux.length ? vitaux : 'aucun pour le moment',
      'essentiels au total': VITALS.length,
    });
  } catch (_) { /* la journee s'affiche meme si CYL n'apprend rien */ }
}

// ── Charge du jour (Sunsama « workload warning ») ───────────────────────────
// Le temps disponible declare donne une capacite indicative. Si les taches
// ouvertes la depassent, on le DIT, sans trier a la place de la personne.
const CAPACITE = { 1: 2, 3: 4, 6: 7, 9: 10 };
function renderWorkload() {
  const el = document.getElementById('workload-note');
  if (!el) return;
  const cap = CAPACITE[Number((plan.rhythm || {}).time)] || 0;
  const ouvertes = plan.tasks.filter((t) => !t.done).length;
  if (!cap || ouvertes <= cap) { el.hidden = true; return; }
  const libelle = { 1: "moins d'une heure", 3: 'une à trois heures', 6: 'trois à six heures', 9: 'six heures et plus' }[Number(plan.rhythm.time)];
  el.textContent = `${ouvertes} tâches ouvertes pour ${libelle} de disponible : certaines peuvent attendre demain, à toi de voir.`;
  el.hidden = false;
}

// ── Clôture du soir ─────────────────────────────────────────────────────────
function initEvening() {
  const note = document.getElementById('evening-note');
  const carry = document.getElementById('btn-carry');
  const close = document.getElementById('btn-close-day');
  const e = plan.evening && plan.evening.date === todayStr() ? plan.evening : null;
  if (note && e) note.value = e.note || '';
  if (carry) carry.addEventListener('click', async () => {
    const restantes = plan.tasks.filter((t) => !t.done);
    if (!restantes.length) { toast('Rien à reporter : tout est posé.', { type: 'success' }); return; }
    const demain = new Date(); demain.setDate(demain.getDate() + 1);
    const cle = `${demain.getFullYear()}-${String(demain.getMonth() + 1).padStart(2, '0')}-${String(demain.getDate()).padStart(2, '0')}`;
    for (const t of restantes) { t.carried = (Number(t.carried) || 0) + 1; t.forDate = cle; }
    await savePlan();
    renderTasks();
    toast(`${restantes.length} tâche${restantes.length > 1 ? 's reportées' : ' reportée'} à demain. Rien n'est perdu.`, { type: 'success' });
  });
  if (close) close.addEventListener('click', async () => {
    const faites = plan.tasks.filter((t) => t.done);
    plan.evening = { date: todayStr(), note: String((note && note.value) || '').slice(0, 280), closedAt: Date.now(), done: faites.length, open: plan.tasks.length - faites.length };
    // Les taches faites sont rangees : la liste de demain repart propre, et le
    // compte du jour reste dans plan.evening.
    plan.tasks = plan.tasks.filter((t) => !t.done);
    await savePlan();
    renderTasks();
    renderEvening();
    try { await award('transcendance', 10, 'Clôture du soir'); } catch (_) {}
  });
  renderEvening();
}
function renderEvening() {
  const sum = document.getElementById('evening-sum');
  const done = document.getElementById('evening-done');
  if (!sum) return;
  const faites = plan.tasks.filter((t) => t.done).length;
  const ouvertes = plan.tasks.length - faites;
  const e = plan.evening && plan.evening.date === todayStr() ? plan.evening : null;
  if (e) {
    sum.textContent = `Journée clôturée. ${e.done} tâche${e.done > 1 ? 's' : ''} posée${e.done > 1 ? 's' : ''}, ${e.open} en attente.`;
    if (done) { done.textContent = e.note ? `« ${e.note} »` : 'À demain.'; done.hidden = false; }
  } else {
    sum.textContent = plan.tasks.length
      ? `Ce soir : ${faites} posée${faites > 1 ? 's' : ''}, ${ouvertes} encore ouverte${ouvertes > 1 ? 's' : ''}. Une journée à ${faites} sur ${plan.tasks.length} est une journée.`
      : 'Aucune tâche aujourd\'hui. La journée a pu être pleine quand même.';
    if (done) done.hidden = true;
  }
}

function renderTasks() {
  renderWorkload();
  publishContext();
  const list = document.getElementById('task-list');
  const prog = document.getElementById('tasks-progress');
  if (!list) return;
  const done = plan.tasks.filter((t) => t.done).length;
  if (prog) prog.textContent = plan.tasks.length ? `${done}/${plan.tasks.length} accomplies` : '';
  if (!plan.tasks.length) {
    list.innerHTML = `<div class="empty"><span class="empty-ic">${icon('sapling')}</span>` +
      `<h3>Rien de prévu pour l'instant</h3><p>Ajoute une première tâche du jour : chaque tâche accomplie nourrit une branche de ton arbre.</p></div>`;
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
      `<button type="button" class="task-check" aria-label="${t.done ? 'Marquer comme à faire' : 'Valider'}" aria-pressed="${t.done ? 'true' : 'false'}"><span>${icon('check', { size: 14 })}</span></button>` +
      `<div class="task-body"><div class="task-title">${escapeHtml(t.title)}</div>` +
      `<div class="task-branch">${icon(b.ic, { size: 13 })}${escapeHtml(b.label)}${t.skillId && userSkills[t.skillId] ? ' · ' + escapeHtml(userSkills[t.skillId].name) : ''}</div></div>` +
      `<button type="button" class="btn quiet sm task-del" aria-label="Supprimer la tâche">${icon('x', { size: 14 })}</button>`;
    card.querySelector('.task-check').onclick = () => toggleTask(t.id);
    card.querySelector('.task-del').onclick = () => delTask(t.id);
    list.appendChild(card);
  });
}

// ── CYL - message contextuel selon le rythme et la base vitale ──────────────
function updateCyl() {
  const el = document.getElementById('lya-line');
  if (!el) return;
  const r = plan.rhythm || {};
  const sleep = Number(r.sleep) || 0;
  const en = Number(r.energy) || 0;
  const vitalsDone = VITALS.filter((v) => plan.vitals[v.key]).length;
  let msg;
  // CYL constate et propose : elle ne prescrit pas une journée.
  if (sleep && sleep < 6) {
    msg = `Tu as dormi ${sleep} h. Une journée légère, avec une ou deux tâches, pourrait te convenir : à toi de voir.`;
  } else if (en && en <= 2) {
    msg = `Ton énergie est basse aujourd'hui. Si tu veux, choisis une seule chose qui compte et laisse le reste pour plus tard.`;
  } else if (vitalsDone < 2) {
    msg = `Ta base du jour (sommeil, eau, repas, mouvement) est encore peu cochée. C'est souvent elle qui tient le reste.`;
  } else if (r.focus) {
    msg = `Belle énergie. Ton focus du jour : « ${r.focus} ».`;
  } else if (r.savedDate) {
    msg = `Ton rythme est calé. Tes tâches du jour viendront ici, et chaque coche fera pousser l'arbre.`;
  } else {
    msg = `Bonjour. Si tu veux, on commence par caler ton rythme du jour.`;
  }
  el.textContent = msg;
}
