// /js/habitudes.js - externalisé depuis habitudes/index.html
// Gabarit v3 (2026-10-17) : cadre commun, icones SVG, toast de common.js.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initUserMenu } from '/js/userMenu.js';
import { updateGlobalAvatar, saveWithFeedback, setContext, escapeHtml, toast } from '/js/common.js';
import { showXpFloat } from '/js/xp.js';
import { icon } from '/js/icons.js';

let auth, db, uid, habits = [], editingIdx = null;
let selectedEmoji = '✅';

if (window._cyfFirebase) {
  ({ auth, db } = window._cyfFirebase);
} else {
  await import('/js/firebase.js');
  ({ auth, db } = window._cyfFirebase);
}

try { initUserMenu(); } catch(e) {}

// Les couleurs de domaine viennent des tokens : le theme clair les suit.
const DOMAINS = [
  {key:'body',  label:'Corps', color:'var(--corps)'},
  {key:'heart', label:'Cœur',  color:'var(--coeur)'},
  {key:'etre',  label:'Être',  color:'var(--etre)'},
  {key:'order', label:'Ordre', color:'var(--ordre)'},
];

const todayStr = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function isDoneToday(h) {
  return h.lastDoneAt && new Date(h.lastDoneAt).toDateString() === new Date().toDateString();
}

function getStreak(h) { return h.streak || 0; }

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  uid = user.uid;
  try { updateGlobalAvatar((user.email||'U').charAt(0).toUpperCase()); } catch(e) {}
  try { initUserMenu(); } catch(e) {}
  await loadHabits();
});

async function loadHabits() {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    habits = snap.exists() ? (snap.data().habits || []) : [];
  } catch(e) { habits = []; }
  render();
}

async function saveHabits() {
  // Avant : setDoc nu + toasts de succès inconditionnels aux appelants →
  // l'utilisateur croyait avoir sauvegardé même en cas d'échec (perte muette).
  return saveWithFeedback(() => setDoc(doc(db, 'users', uid), { habits }, { merge: true }));
}

// Ce que CYL voit des habitudes : des compteurs et des séries, jamais le
// détail des journées. Assez pour parler juste, pas plus.
function publishContext() {
  try {
    const enCours = habits.filter(h => !isDoneToday(h)).map(h => String(h.name || h.title || '').slice(0, 50));
    const meilleure = habits.reduce((m, h) => Math.max(m, getStreak(h)), 0);
    setContext('habitudes', {
      'habitudes suivies': habits.length,
      'tenues aujourd hui': habits.filter(h => isDoneToday(h)).length,
      'pas encore faites': enCours.slice(0, 5),
      'meilleure serie en cours': meilleure ? meilleure + ' jours' : 'aucune serie en cours',
    });
  } catch (_) { /* la page marche meme si CYL n'apprend rien */ }
}

function render() {
  publishContext();
  const area = document.getElementById('content-area');
  if (!area) return;

  const doneCount = habits.filter(h => isDoneToday(h)).length;
  const totalCount = habits.length;

  if (totalCount === 0) {
    area.innerHTML = `<div class="empty">
      <span class="empty-ic">${icon('checks')}</span>
      <h3>Aucune habitude pour l'instant</h3>
      <p>Un geste court, refait chaque jour, finit par tenir tout seul. Commence par un seul.</p>
      <button class="btn primary" type="button" id="btn-add-empty">${icon('plus')}Créer ma première habitude</button>
    </div>`;
    const b = document.getElementById('btn-add-empty');
    if (b) b.addEventListener('click', () => openModal(null));
    return;
  }

  const pct = totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0;

  let html = `<div class="card">
    <div class="dp-row">
      <span class="dp-title">Aujourd'hui : ${doneCount} sur ${totalCount}</span>
      <span class="dp-count t-num">${pct}%</span>
    </div>
    <div class="dp-bar-bg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Habitudes tenues aujourd'hui"><div class="dp-bar" style="width:${pct}%"></div></div>
    <div class="dp-domains">
      ${DOMAINS.map(d => {
        const domHabits = habits.filter(h => h.domain === d.key);
        if (!domHabits.length) return '';
        const allDone = domHabits.every(h => isDoneToday(h));
        return `<span class="chip${allDone?' on':''}">${allDone ? icon('check', { size: 12 }) : ''}${d.label}</span>`;
      }).join('')}
    </div>
  </div>`;

  // Group by domain
  DOMAINS.forEach(d => {
    const domHabits = habits.filter((h) => h.domain === d.key).map((h) => {
      return { ...h, _origIdx: habits.indexOf(h) };
    });
    if (!domHabits.length) return;
    html += `<section class="domain-section" aria-label="${escapeHtml(d.label)}">
      <div class="sec-label domain-section-title" style="--dom:${d.color}">${escapeHtml(d.label)}</div>
      <div class="habits-list">
        ${domHabits.map(h => renderHabitCard(h, h._origIdx)).join('')}
      </div>
    </section>`;
  });

  area.innerHTML = html;

  // Wire checkboxes
  area.querySelectorAll('.habit-check').forEach(btn => {
    btn.addEventListener('click', () => toggleDone(parseInt(btn.dataset.idx)));
  });
  area.querySelectorAll('.habit-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openModal(parseInt(btn.dataset.idx)));
  });
  area.querySelectorAll('.habit-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteHabit(parseInt(btn.dataset.idx)));
  });
}

// Les habitudes portent body/heart/etre/order ; on accepte aussi les cles
// francaises au cas ou (anciennes donnees), sans toucher au modele.
const HABIT_DOMAIN_COLORS = {
  body:'var(--corps)', heart:'var(--coeur)', etre:'var(--etre)', order:'var(--ordre)',
  corps:'var(--corps)', coeur:'var(--coeur)', ordre:'var(--ordre)',
};

function renderHabitCard(h, idx) {
  const done = isDoneToday(h);
  const streak = getStreak(h);
  const hColor = HABIT_DOMAIN_COLORS[h.domain] || 'var(--line-strong)';
  const name = escapeHtml(h.name);
  return `<div class="habit-card ${done ? 'done-today' : ''}" style="--habit-color:${hColor}">
    <button class="habit-check" type="button" data-idx="${idx}" aria-pressed="${done ? 'true' : 'false'}" aria-label="${done ? 'Décocher' : 'Marquer comme fait'} : ${name}">${icon('check', { size: 16, stroke: 2.5 })}</button>
    <span class="habit-emoji" aria-hidden="true">${escapeHtml(h.emoji || '✅')}</span>
    <div class="habit-body">
      <div class="habit-name">${name}</div>
      <div class="habit-meta">
        ${streak > 0 ? `<span class="habit-streak">${icon('flame', { size: 13 })}${streak} jour${streak !== 1 ? 's' : ''}</span>` : ''}
        ${done ? `<span class="habit-done-label">${icon('check', { size: 13 })}Fait aujourd'hui</span>` : ''}
      </div>
    </div>
    <div class="habit-actions">
      <button class="btn quiet sm habit-edit-btn" type="button" data-idx="${idx}" aria-label="Modifier : ${name}" title="Modifier">${icon('edit', { size: 15 })}</button>
      <button class="btn quiet sm danger habit-del-btn" type="button" data-idx="${idx}" aria-label="Supprimer : ${name}" title="Supprimer">${icon('x', { size: 15 })}</button>
    </div>
  </div>`;
}

async function toggleDone(idx) {
  const h = habits[idx];
  if (!h) return;
  const wasAlreadyDone = isDoneToday(h);

  if (!wasAlreadyDone) {
    // Mark done
    // Pardon : un jour manqué (avant-hier) ne remet pas la série à 1. Deux, si.
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const avantHier = new Date(Date.now() - 2 * 86400000).toDateString();
    const lastDayStr = h.lastDoneAt ? new Date(h.lastDoneAt).toDateString() : null;
    const newStreak = (lastDayStr === yesterday || lastDayStr === avantHier) ? (h.streak || 0) + 1 : 1;
    habits[idx] = { ...h, lastDoneAt: Date.now(), streak: newStreak };
    await saveHabits();
    // Award XP via Cloud Function (validation + level-up server-side)
    try {
      await window._cyfFirebase.awardXp(h.domain || 'physio', 5);
      try { showXpFloat(5); } catch(e) {}
    } catch(_) {}
    toast(`+5 XP. ${newStreak} jour${newStreak!==1?'s':''} d'affilée.`, { type: 'success' });
  } else {
    // Uncheck (deduct streak if today was the only day)
    habits[idx] = { ...h, lastDoneAt: null };
    await saveHabits();
    toast('Habitude décochée');
  }
  render();
}

async function deleteHabit(idx) {
  const name = habits[idx]?.name || 'cette habitude';
  habits.splice(idx, 1);
  await saveHabits();
  toast(`« ${name} » supprimée`);
  render();
}

// ── Modal ──────────────────────────────────────────────────────────────────
const overlay = document.getElementById('modal-overlay');
const inputName = document.getElementById('input-name');
const inputDomain = document.getElementById('input-domain');

document.getElementById('btn-add').addEventListener('click', () => openModal(null));
document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
document.getElementById('btn-modal-save').addEventListener('click', saveHabit);

function markEmoji(value) {
  document.querySelectorAll('.emoji-opt').forEach(o => {
    const on = o.dataset.e === value;
    o.classList.toggle('on', on);
    o.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

document.getElementById('emoji-picker').addEventListener('click', e => {
  const opt = e.target.closest('.emoji-opt');
  if (!opt) return;
  selectedEmoji = opt.dataset.e;
  markEmoji(selectedEmoji);
});

overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal(); });

function openModal(idx) {
  editingIdx = idx;
  selectedEmoji = '✅';
  document.getElementById('modal-title').textContent = idx !== null ? 'Modifier l\'habitude' : 'Nouvelle habitude';
  if (idx !== null && habits[idx]) {
    const h = habits[idx];
    inputName.value = h.name || '';
    inputDomain.value = h.domain || 'body';
    selectedEmoji = h.emoji || '✅';
  } else {
    inputName.value = '';
    inputDomain.value = 'body';
  }
  markEmoji(selectedEmoji);
  overlay.classList.add('open');
  setTimeout(() => inputName.focus(), 80);
}

function closeModal() { overlay.classList.remove('open'); editingIdx = null; }

async function saveHabit() {
  const name = inputName.value.trim();
  if (!name) { inputName.focus(); return; }
  const habit = { name, emoji: selectedEmoji, domain: inputDomain.value, streak: 0, lastDoneAt: null, createdAt: Date.now() };
  const wasEditing = editingIdx !== null;
  if (wasEditing) {
    habits[editingIdx] = { ...habits[editingIdx], name: habit.name, emoji: habit.emoji, domain: habit.domain };
  } else {
    habit.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    habits.push(habit);
  }
  await saveHabits();
  closeModal();
  toast(wasEditing ? 'Habitude modifiée' : 'Habitude créée. Tu peux commencer dès aujourd\'hui.', { type: 'success' });
  render();
}
