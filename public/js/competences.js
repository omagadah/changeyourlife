// /js/competences.js — Module « Mes compétences ».
// Des savoir-faire qui montent de niveau avec le temps (pratiques, tâches).

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initUserMenu } from '/js/userMenu.js';
import { updateGlobalAvatar } from '/js/common.js';
import { loadSkills, upsertSkill, deleteSkill, awardSkillXp, skillLevel } from '/js/skills.js';

let auth, db, uid;
let skills = {};

if (window._cyfFirebase) { ({ auth, db } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }
try { initUserMenu(); } catch (e) {}

const BRANCHES = [
  { key: 'physio',          label: 'Physiologique',   color: '#2dd4bf' },
  { key: 'securite',        label: 'Sécurité',        color: '#fbbf24' },
  { key: 'appartenance',    label: 'Appartenance',    color: '#f87171' },
  { key: 'estime',          label: 'Estime',          color: '#fb923c' },
  { key: 'cognitif',        label: 'Cognitif',        color: '#a78bfa' },
  { key: 'esthetique',      label: 'Esthétique',      color: '#e879c7' },
  { key: 'accomplissement', label: 'Accomplissement', color: '#38bdf8' },
  { key: 'transcendance',   label: 'Transcendance',   color: '#c4b5fd' },
];
const BRANCH_BY = Object.fromEntries(BRANCHES.map((b) => [b.key, b]));
const EMOJIS = ['🍳','💻','🏋️','🗣️','🎸','✍️','💰','🎨','📷','🧠','🛠️','📚','🌱','🎯','🧗','🎤','🚗','🌍','♟️','🧩'];
const SUGGEST = [
  { name: 'Cuisine', emoji: '🍳', branch: 'physio' },
  { name: 'Informatique', emoji: '💻', branch: 'cognitif' },
  { name: 'Sport', emoji: '🏋️', branch: 'physio' },
  { name: 'Langues', emoji: '🗣️', branch: 'cognitif' },
  { name: 'Musique', emoji: '🎸', branch: 'esthetique' },
  { name: 'Écriture', emoji: '✍️', branch: 'esthetique' },
  { name: 'Finance', emoji: '💰', branch: 'securite' },
];
const PRACTICE_SKILL_XP = 25;
const PRACTICE_BRANCH_XP = 10;

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function slug(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24); }
function newId(name) { return (slug(name) || 'skill') + '-' + Math.random().toString(36).slice(2, 6); }
function toast(msg, cls) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.className = 'toast' + (cls ? ' ' + cls : ''); t.classList.add('show');
  clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 2400);
}
function relAt(ts) {
  if (!ts) return 'jamais pratiqué';
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return "pratiqué aujourd'hui";
  if (d === 1) return 'pratiqué hier';
  return `pratiqué il y a ${d} j`;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login/'; return; }
  uid = user.uid;
  try { updateGlobalAvatar((user.email || 'U').charAt(0).toUpperCase()); } catch (e) {}
  try { initUserMenu(); } catch (e) {}
  fillSelects();
  initAdd();
  skills = await loadSkills(db, uid);
  render();
});

function fillSelects() {
  const e = document.getElementById('sk-emoji');
  if (e) e.innerHTML = EMOJIS.map((x) => `<option value="${x}">${x}</option>`).join('');
  const b = document.getElementById('sk-branch');
  if (b) b.innerHTML = BRANCHES.map((x) => `<option value="${x.key}">${x.label}</option>`).join('');
  const def = b && b.querySelector('option[value="accomplissement"]'); if (def) def.selected = true;
}

function initAdd() {
  const btn = document.getElementById('btn-add');
  const name = document.getElementById('sk-name');
  if (btn) btn.onclick = addSkill;
  if (name) name.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSkill(); });
}

async function addSkill(preset) {
  const nameEl = document.getElementById('sk-name');
  const emojiEl = document.getElementById('sk-emoji');
  const branchEl = document.getElementById('sk-branch');
  const name = (preset && preset.name) || (nameEl.value || '').trim();
  if (!name) { nameEl.focus(); return; }
  const skill = {
    id: newId(name), name,
    emoji: (preset && preset.emoji) || emojiEl.value || '🛠️',
    branch: (preset && preset.branch) || branchEl.value || 'accomplissement',
  };
  skills[skill.id] = { name: skill.name, emoji: skill.emoji, branch: skill.branch, xp: 0 };
  if (nameEl) nameEl.value = '';
  render();
  await upsertSkill(db, uid, skill);
  toast(`Compétence ajoutée : ${skill.name}`);
}

async function practice(id) {
  const s = skills[id]; if (!s) return;
  s.xp = (Number(s.xp) || 0) + PRACTICE_SKILL_XP; s.lastAt = Date.now();
  render();
  const res = await awardSkillXp(db, uid, id, PRACTICE_SKILL_XP);
  try { const fn = window._cyfFirebase && window._cyfFirebase.awardXp; if (fn) await fn(s.branch || 'accomplissement', PRACTICE_BRANCH_XP); } catch (e) {}
  if (res && res.leveledUp) toast(`🎉 ${s.name} — niveau ${res.level} !`, 'up');
  else toast(`+${PRACTICE_SKILL_XP} ${s.name}`, 'xp');
}

async function removeSkill(id) {
  delete skills[id]; render();
  await deleteSkill(db, uid, id);
}

function render() {
  const host = document.getElementById('skills-host');
  if (!host) return;
  const ids = Object.keys(skills);
  if (!ids.length) {
    host.innerHTML =
      `<div class="empty"><div class="ic">🌱</div>` +
      `<div>Aucune compétence pour l'instant. Ajoute celles qui comptent pour toi — elles grandiront à chaque pratique.</div>` +
      `<div class="suggest">${SUGGEST.map((s, i) => `<button class="sug-chip" data-i="${i}">${s.emoji} ${s.name}</button>`).join('')}</div></div>`;
    host.querySelectorAll('.sug-chip').forEach((c) => { c.onclick = () => addSkill(SUGGEST[Number(c.dataset.i)]); });
    return;
  }
  const sorted = ids.map((id) => ({ id, ...skills[id] })).sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const grid = document.createElement('div'); grid.className = 'skill-grid';
  sorted.forEach((s) => {
    const b = BRANCH_BY[s.branch] || BRANCH_BY.accomplissement;
    const lv = skillLevel(s.xp || 0);
    const card = document.createElement('div');
    card.className = 'skill-card';
    card.style.setProperty('--bc', b.color);
    card.innerHTML =
      `<div class="sk-top">` +
        `<span class="sk-emoji">${escapeHtml(s.emoji || '🛠️')}</span>` +
        `<div class="sk-id"><div class="sk-name">${escapeHtml(s.name)}</div><div class="sk-branch">${b.label}</div></div>` +
        `<button class="sk-del" aria-label="Supprimer">Suppr.</button>` +
      `</div>` +
      `<div class="sk-lvl"><span class="sk-lvl-name">${lv.name} · Niv. ${lv.level}</span>` +
        `<span class="sk-lvl-xp">${lv.max ? 'XP max' : lv.inLevel + '/' + lv.need + ' XP'}</span></div>` +
      `<div class="sk-bar-bg"><div class="sk-bar" data-w="${lv.pct}"></div></div>` +
      `<div class="sk-foot"><span class="sk-last">${(s.xp || 0).toLocaleString('fr-FR')} XP · ${relAt(s.lastAt)}</span>` +
        `<button class="btn-practice">✓ Pratiqué</button></div>`;
    card.querySelector('.btn-practice').onclick = () => practice(s.id);
    card.querySelector('.sk-del').onclick = () => removeSkill(s.id);
    grid.appendChild(card);
  });
  host.innerHTML = '';
  host.appendChild(grid);
  requestAnimationFrame(() => host.querySelectorAll('.sk-bar').forEach((el) => { el.style.width = (el.dataset.w || 0) + '%'; }));
}
