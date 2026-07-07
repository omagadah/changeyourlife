// /objectifs/ - gestion d'objectifs avec sous-tâches + filtres + templates.
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { updateGlobalAvatar, saveWithFeedback } from '/js/common.js';
import { initUserMenu } from '/js/userMenu.js';
import { showXpFloat } from '/js/xp.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Vanta bootstrap ──────────────────────────────────────────────────────────
function bootVanta() {
  try {
    if (window.VANTA && window.VANTA.BIRDS) {
      window.VANTA.BIRDS({ el:'#vanta-birds-bg', mouseControls:true, touchControls:true, backgroundColor:0x07192f, quantity:4.0 });
    } else {
      setTimeout(bootVanta, 80);
    }
  } catch (e) { /* ignore */ }
}

// ── Firebase ──────────────────────────────────────────────────────────────
let auth, db, uid, goals = [], editingId = null, activeFilter = 'all';

const DOMAIN_COLORS = { body:'#2dd4bf', heart:'#f87171', etre:'#a78bfa', order:'#fbbf24' };
const DOMAIN_LABELS = { body:'Corps', heart:'Cœur', etre:'Être', order:'Ordre' };
const DOMAIN_ICONS  = { body:'🏃', heart:'❤️', etre:'✨', order:'📋' };

const TEMPLATES = [
  { icon:'🏃', name:'Sport',      title:'Courir 5km',               domain:'body',  desc:'Courir 5km sans s\'arrêter' },
  { icon:'📚', name:'Lecture',    title:'Lire 12 livres cette année',domain:'etre',  desc:'1 livre par mois' },
  { icon:'💰', name:'Épargne',    title:'Épargner 10% de mes revenus',domain:'order',desc:'Mettre de côté chaque mois' },
  { icon:'🧘', name:'Méditation', title:'Méditer tous les jours',    domain:'etre',  desc:'Session quotidienne de 10 min' },
  { icon:'❤️', name:'Relations',  title:'Appeler un proche/semaine', domain:'heart', desc:'Maintenir des liens forts' },
  { icon:'💪', name:'Force',      title:'3 séances de sport/semaine',domain:'body',  desc:'Musculation ou cardio' },
];

if (window._cyfFirebase) {
  ({ auth, db } = window._cyfFirebase);
} else {
  await import('/js/firebase.js');
  ({ auth, db } = window._cyfFirebase);
}

try { initUserMenu(); } catch(e) {}
window.addEventListener('DOMContentLoaded', () => {
  bootVanta();
  injectMilestoneCss();
  try { updateGlobalAvatar(); } catch(e) {}
});

// ── Helpers Jalons (milestones datés) ────────────────────────────────────────
function injectMilestoneCss() {
  if (document.getElementById('cyl-milestone-css')) return;
  const css = document.createElement('style');
  css.id = 'cyl-milestone-css';
  css.textContent = `
    .subtask-date{font-size:0.72rem;font-weight:600;margin-left:auto;
      padding:2px 7px;border-radius:6px;background:rgba(255,255,255,0.06);
      color:#9bb3d0;flex-shrink:0;letter-spacing:.2px;white-space:nowrap;}
    .subtask-date.overdue{color:#fca5a5;background:rgba(248,113,113,0.15);}
    .subtask-date.soon{color:#fde68a;background:rgba(251,191,36,0.15);}
    .subtask-add-row.has-date{flex-wrap:wrap;}
    .subtask-add-date{padding:7px 9px;border-radius:8px;
      background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
      color:#cdd9ea;font:500 0.78rem inherit;width:142px;flex-shrink:0;
      color-scheme:dark;outline:none;transition:border-color .15s;}
    .subtask-add-date:focus{border-color:rgba(0,112,243,0.4);}
    .next-milestone{display:flex;align-items:center;gap:10px;padding:9px 13px;
      border-radius:10px;margin:10px 0 4px;
      background:rgba(0,112,243,0.08);border:1px solid rgba(0,112,243,0.22);}
    .next-milestone-emoji{font-size:1.05rem;flex-shrink:0;}
    .next-milestone-label{flex:1;min-width:0;font-size:0.84rem;font-weight:600;color:#e0eaf6;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .next-milestone-date{font-size:0.74rem;color:#7bbfff;font-weight:700;flex-shrink:0;}
    .next-milestone.overdue{background:rgba(248,113,113,0.08);border-color:rgba(248,113,113,0.25);}
    .next-milestone.overdue .next-milestone-date{color:#fca5a5;}
    .next-milestone.soon{background:rgba(251,191,36,0.08);border-color:rgba(251,191,36,0.28);}
    .next-milestone.soon .next-milestone-date{color:#fbbf24;}
  `;
  document.head.appendChild(css);
}

function fmtDueDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00');
  if (isNaN(d)) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('fr-FR', sameYear ? { day:'numeric', month:'short' } : { day:'numeric', month:'short', year:'numeric' });
}
function dueStatus(iso) {
  if (!iso) return 'none';
  const t = new Date(iso + 'T00:00').getTime();
  if (isNaN(t)) return 'none';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((t - today.getTime()) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'soon';
  return 'ok';
}
function sortMilestones(arr) {
  return arr.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ad = a.dueAt ? new Date(a.dueAt + 'T00:00').getTime() : Infinity;
    const bd = b.dueAt ? new Date(b.dueAt + 'T00:00').getTime() : Infinity;
    return ad - bd;
  });
}
function nextMilestone(g) {
  const arr = (g.subtasks || []).filter(s => !s.done);
  if (!arr.length) return null;
  return sortMilestones(arr)[0];
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  uid = user.uid;
  await loadGoals();
});

async function loadGoals() {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) goals = snap.data().goals || [];
  } catch(e) {}
  renderAll();
}

async function persistGoals() {
  return saveWithFeedback(() => setDoc(doc(db, 'users', uid), { goals }, { merge: true }));
}

// ── Render everything ─────────────────────────────────────────────────────
function renderAll() {
  renderStats();
  renderDomainTabs();
  renderTemplates();
  renderGoals();
}

// ── Stats bar ─────────────────────────────────────────────────────────────
function renderStats() {
  const active    = goals.filter(g => !g.completed).length;
  const completed = goals.filter(g => g.completed).length;
  const overdue   = goals.filter(g => !g.completed && g.deadline && new Date(g.deadline) < new Date()).length;
  const avgPct    = goals.length ? Math.round(goals.reduce((s,g) => s + (g.progress||0), 0) / goals.length) : 0;

  const bar = document.getElementById('stats-bar');
  bar.innerHTML = `
    <div class="stat-pill"><span class="sp-val">${active}</span> en cours</div>
    <div class="stat-pill green"><span class="sp-val">${completed}</span> complétés</div>
    <div class="stat-pill amber"><span class="sp-val">${avgPct}%</span> progression moy.</div>
    ${overdue ? `<div class="stat-pill red"><span class="sp-val">${overdue}</span> en retard</div>` : ''}
  `;
}

// ── Domain filter tabs ────────────────────────────────────────────────────
function renderDomainTabs() {
  const tabs = document.getElementById('domain-tabs');
  const allCount = goals.length;
  const filters = [
    { key:'all', label:`Tous (${allCount})`, color:'#3b82f6' },
    ...Object.entries(DOMAIN_LABELS).map(([k,l]) => ({
      key:k, label:`${DOMAIN_ICONS[k]} ${l} (${goals.filter(g=>g.domain===k).length})`, color:DOMAIN_COLORS[k]
    }))
  ];
  tabs.innerHTML = '';
  filters.forEach(f => {
    const btn = document.createElement('button');
    btn.className = `domain-tab${activeFilter===f.key?' active':''}`;
    btn.style.setProperty('--tab-color', f.color);
    btn.textContent = f.label;
    btn.addEventListener('click', () => { activeFilter = f.key; renderDomainTabs(); renderGoals(); renderTemplates(); });
    tabs.appendChild(btn);
  });
}

// ── Templates ─────────────────────────────────────────────────────────────
function renderTemplates() {
  const ts  = document.getElementById('templates-section');
  const tg  = document.getElementById('templates-grid');
  if (!tg) return;
  const visibleGoals = activeFilter === 'all' ? goals : goals.filter(g => g.domain === activeFilter);
  if (visibleGoals.length >= 3 || (activeFilter !== 'all' && activeFilter !== 'all')) {
    ts.style.display = 'none'; return;
  }
  const filtered = activeFilter === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.domain === activeFilter);
  if (!filtered.length) { ts.style.display = 'none'; return; }
  ts.style.display = 'block'; tg.innerHTML = '';
  filtered.forEach(tpl => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `<div class="template-icon">${tpl.icon}</div><div class="template-name">${tpl.name}</div>`;
    card.title = tpl.title;
    card.addEventListener('click', async () => {
      goals.push({ id:Date.now(), title:tpl.title, desc:tpl.desc, domain:tpl.domain, deadline:null, progress:0, completed:false, createdAt:Date.now(), subtasks:[] });
      await persistGoals(); renderAll(); showToast(`✓ "${tpl.title}" ajouté`);
    });
    tg.appendChild(card);
  });
}

// ── Goals list ────────────────────────────────────────────────────────────
function renderGoals() {
  const grid  = document.getElementById('goals-grid');
  const empty = document.getElementById('empty-state');

  let visible = activeFilter === 'all' ? goals : goals.filter(g => g.domain === activeFilter);
  // sort: active overdue first, then active, then completed
  visible = [...visible].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const aO = a.deadline && !a.completed && new Date(a.deadline) < new Date();
    const bO = b.deadline && !b.completed && new Date(b.deadline) < new Date();
    if (aO !== bO) return aO ? -1 : 1;
    return (b.createdAt||0) - (a.createdAt||0);
  });

  if (!visible.length) {
    grid.style.display = 'none'; empty.style.display = 'block'; return;
  }
  grid.style.display = 'grid'; empty.style.display = 'none';
  grid.innerHTML = '';

  visible.forEach(g => {
    const realIdx = goals.indexOf(g);
    const card = buildGoalCard(g, realIdx);
    grid.appendChild(card);
  });
}

function buildGoalCard(g, idx) {
  const card = document.createElement('div');
  const goalColor = DOMAIN_COLORS[g.domain] || '#6b7280';
  card.className = `goal-card${g.completed?' completed':''}`;
  card.style.setProperty('--goal-color', goalColor);
  if (!g.completed && g.deadline && new Date(g.deadline) < new Date()) card.classList.add('overdue');

  // ── Header ──
  const header = document.createElement('div'); header.className = 'goal-header';
  const titleEl = document.createElement('div'); titleEl.className = 'goal-title'; titleEl.textContent = g.title;
  const domEl   = document.createElement('div'); domEl.className = 'goal-domain';
  domEl.textContent = `${DOMAIN_ICONS[g.domain]||''} ${DOMAIN_LABELS[g.domain]||g.domain}`;
  header.append(titleEl, domEl); card.appendChild(header);

  // ── Description ──
  if (g.desc) {
    const desc = document.createElement('div'); desc.className = 'goal-desc'; desc.textContent = g.desc;
    card.appendChild(desc);
  }

  // ── Prochain jalon ──
  if (!g.completed) {
    const nxt = nextMilestone(g);
    if (nxt) {
      const nmBox = document.createElement('div');
      const status = dueStatus(nxt.dueAt);
      nmBox.className = 'next-milestone' + (status === 'overdue' ? ' overdue' : status === 'soon' ? ' soon' : '');
      const e1 = document.createElement('span'); e1.className = 'next-milestone-emoji';
      e1.textContent = status === 'overdue' ? '⚠️' : '🎯';
      const e2 = document.createElement('span'); e2.className = 'next-milestone-label';
      e2.textContent = 'Prochain jalon : ' + nxt.label;
      nmBox.append(e1, e2);
      if (nxt.dueAt) {
        const e3 = document.createElement('span'); e3.className = 'next-milestone-date';
        e3.textContent = fmtDueDate(nxt.dueAt);
        nmBox.appendChild(e3);
      }
      card.appendChild(nmBox);
    }
  }

  // ── Progress row ──
  const progRow = document.createElement('div'); progRow.className = 'progress-row';
  const progText = document.createElement('span'); progText.className = 'progress-text';
  if (g.deadline) {
    const isOverdue = !g.completed && new Date(g.deadline) < new Date();
    progText.innerHTML = `Cible : ${new Date(g.deadline).toLocaleDateString('fr-FR')}${isOverdue ? ' <span class="overdue-tag">⚠ En retard</span>' : ''}`;
  } else {
    progText.textContent = 'En cours';
  }
  const progPct = document.createElement('span'); progPct.className = 'progress-pct'; progPct.textContent = `${g.progress||0}%`;
  progRow.append(progText, progPct); card.appendChild(progRow);

  // ── Progress bar ──
  const bar = document.createElement('div'); bar.className = 'progress-bar';
  const fill = document.createElement('div'); fill.className = 'progress-fill'; fill.style.width = `${g.progress||0}%`;
  bar.appendChild(fill); card.appendChild(bar);

  // ── Slider (hidden by default) ──
  const sliderWrap = document.createElement('div');
  sliderWrap.className = 'progress-slider-wrap';
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = 0; slider.max = 100; slider.value = g.progress||0;
  slider.className = 'progress-slider';
  slider.style.setProperty('--pct', `${g.progress||0}%`);
  const sliderLabel = document.createElement('span'); sliderLabel.className = 'slider-pct-label'; sliderLabel.textContent = `${g.progress||0}%`;
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value);
    sliderLabel.textContent = `${v}%`;
    slider.style.setProperty('--pct', `${v}%`);
    progPct.textContent = `${v}%`;
    fill.style.width = `${v}%`;
  });
  slider.addEventListener('change', async () => {
    const v = parseInt(slider.value);
    const wasCompleted = g.completed;
    g.progress = v;
    if (v >= 100 && !wasCompleted) {
      g.completed = true; showToast('Objectif complété ! +25 XP');
      try { await window._cyfFirebase.awardXp(g.domain || 'accomplissement', 25); showXpFloat(25); } catch(_){}
    }
    await persistGoals(); renderAll();
  });
  sliderWrap.append(slider, sliderLabel);
  card.appendChild(sliderWrap);

  // ── Jalons (milestones datés) ──
  // Note interne : on conserve la clé `subtasks` en Firestore pour la rétro-
  // compatibilité, mais l'UI parle de « jalons ». Une date d'échéance
  // optionnelle est ajoutée à chaque entrée.
  const subtasksRaw = g.subtasks || [];
  const subtasks = sortMilestones(subtasksRaw);
  const stSection = document.createElement('div'); stSection.className = 'subtasks-section';

  const stToggle = document.createElement('button'); stToggle.className = 'subtasks-toggle';
  const doneCount = subtasks.filter(s=>s.done).length;
  stToggle.innerHTML = `<span class="arrow">▶</span> Jalons <span style="color:#4a6a8a;font-weight:600;margin-left:2px">${subtasks.length ? `${doneCount}/${subtasks.length}` : '+ ajouter'}</span>`;
  stToggle.addEventListener('click', () => {
    stToggle.classList.toggle('open');
    stList.classList.toggle('open');
  });
  stSection.appendChild(stToggle);

  const stList = document.createElement('div'); stList.className = 'subtasks-list';
  subtasks.forEach((st, si) => {
    // si est l'index dans le tableau trié ; on retrouve l'index réel pour delete/toggle.
    const realIdx = (g.subtasks || []).indexOf(st);
    stList.appendChild(buildSubtaskItem(g, idx, st, realIdx, card, stToggle, goalColor));
  });

  // Ajout d'un jalon : libellé + date d'échéance optionnelle
  const addRow = document.createElement('div'); addRow.className = 'subtask-add-row has-date';
  const addInput = document.createElement('input');
  addInput.type = 'text'; addInput.className = 'subtask-add-input';
  addInput.placeholder = 'Nouveau jalon…'; addInput.maxLength = 80;
  const addDate = document.createElement('input');
  addDate.type = 'date'; addDate.className = 'subtask-add-date';
  addDate.title = 'Échéance (optionnelle)';
  const addBtn = document.createElement('button'); addBtn.className = 'subtask-add-btn'; addBtn.textContent = '+ Ajouter';
  const addMilestone = async () => {
    const val = addInput.value.trim(); if (!val) return;
    if (!g.subtasks) g.subtasks = [];
    g.subtasks.push({
      id: `st_${Date.now()}`,
      label: val,
      done: false,
      dueAt: addDate.value || null,
    });
    addInput.value = ''; addDate.value = '';
    await persistGoals(); renderAll();
  };
  addBtn.addEventListener('click', addMilestone);
  addInput.addEventListener('keydown', e => { if (e.key==='Enter') addMilestone(); });
  addDate.addEventListener('keydown', e => { if (e.key==='Enter') addMilestone(); });
  addRow.append(addInput, addDate, addBtn);
  stList.appendChild(addRow);

  stSection.appendChild(stList);
  card.appendChild(stSection);

  // ── Action buttons ──
  const actions = document.createElement('div'); actions.className = 'goal-actions';

  // Slider toggle
  const btnSlider = document.createElement('button'); btnSlider.className = 'btn-icon'; btnSlider.textContent = 'Progression';
  btnSlider.addEventListener('click', () => {
    const open = sliderWrap.classList.toggle('open');
    btnSlider.classList.toggle('active-slider', open);
  });

  // Toggle complete
  const btnT = document.createElement('button'); btnT.className = 'btn-icon';
  btnT.textContent = g.completed ? '↻ Réactiver' : '✓ Compléter';
  btnT.addEventListener('click', async () => {
    const was = g.completed;
    g.completed = !was;
    if (g.completed) { g.progress = 100; showToast('Objectif complété ! +25 XP'); }
    else { showToast('↻ Objectif réactivé'); }
    await persistGoals();
    if (!was) {
      try { await window._cyfFirebase.awardXp(g.domain || 'accomplissement', 25); showXpFloat(25); } catch(_){}
    }
    renderAll();
  });

  // Edit
  const btnE = document.createElement('button'); btnE.className = 'btn-icon'; btnE.textContent = 'Modifier';
  btnE.addEventListener('click', () => openModal(idx));

  // Delete (2-step)
  const btnD = document.createElement('button'); btnD.className = 'btn-icon'; btnD.dataset.pending='0'; btnD.textContent = '🗑️';
  btnD.addEventListener('click', async () => {
    if (btnD.dataset.pending==='1') {
      goals.splice(idx, 1); await persistGoals(); renderAll(); showToast('Objectif supprimé'); return;
    }
    btnD.dataset.pending='1'; btnD.classList.add('danger-confirm'); btnD.textContent='🗑️ Confirmer ?';
    setTimeout(()=>{ if(btnD.dataset.pending==='1'){btnD.dataset.pending='0';btnD.classList.remove('danger-confirm');btnD.textContent='🗑️';} }, 3000);
  });

  actions.append(btnSlider, btnT, btnE, btnD);
  card.appendChild(actions);

  return card;
}

function buildSubtaskItem(g, goalIdx, st, stIdx, card, toggle, goalColor) {
  const item = document.createElement('div'); item.className = 'subtask-item';
  const check = document.createElement('div');
  check.className = `subtask-check${st.done?' done':''}`;
  check.style.setProperty('--goal-color', goalColor);
  const label = document.createElement('span');
  label.className = `subtask-label${st.done?' done':''}`;
  label.textContent = st.label;

  // Badge de date (n'apparaît que si dueAt + jalon non fait)
  let dateBadge = null;
  if (st.dueAt && !st.done) {
    const status = dueStatus(st.dueAt);
    dateBadge = document.createElement('span');
    dateBadge.className = 'subtask-date' + (status === 'overdue' ? ' overdue' : status === 'soon' ? ' soon' : '');
    dateBadge.textContent = fmtDueDate(st.dueAt);
  }

  const del = document.createElement('button'); del.className = 'subtask-del'; del.textContent = '×';

  const toggle2 = async () => {
    const wasDone = st.done;
    st.done = !st.done;
    // XP : on récompense le passage à « fait » (et seulement celui-là), à la
    // branche de l'objectif. Garde-fou côté firestore.rules + addXp.
    if (!wasDone) {
      try { await window._cyfFirebase.awardXp(g.domain || 'accomplissement', 5); } catch (_) {}
      try { showXpFloat(5); } catch (_) {}
    }
    // Update toggle badge (libellé « Jalons »)
    const doneCount = (g.subtasks||[]).filter(s=>s.done).length;
    const total = (g.subtasks||[]).length;
    toggle.innerHTML = `<span class="arrow${toggle.classList.contains('open')?'':''}" style="transition:transform .2s;display:inline-block${toggle.classList.contains('open')?';transform:rotate(90deg)':''}">▶</span> Jalons <span style="color:#4a6a8a;font-weight:600;margin-left:2px">${total?`${doneCount}/${total}`:' + ajouter'}</span>`;
    // Auto-update goal progress from milestones
    if (total > 0) {
      g.progress = Math.round(doneCount / total * 100);
    }
    await persistGoals(); renderAll();
  };

  check.addEventListener('click', toggle2);
  label.addEventListener('click', toggle2);
  del.addEventListener('click', async () => {
    g.subtasks.splice(stIdx, 1);
    await persistGoals(); renderAll();
  });

  item.append(check, label);
  if (dateBadge) item.appendChild(dateBadge);
  item.appendChild(del);
  return item;
}

// ── Modal ─────────────────────────────────────────────────────────────────
document.getElementById('btn-new-goal').addEventListener('click', () => openModal());
document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
document.getElementById('btn-save-goal').addEventListener('click', saveGoal);
document.getElementById('modal-goal').addEventListener('click', e => { if (e.target.id==='modal-goal') closeModal(); });

const urlDomain = new URLSearchParams(window.location.search).get('domain');
const domainMap = { corps:'body', coeur:'heart', etre:'etre', ordre:'order' };
if (urlDomain && domainMap[urlDomain]) {
  setTimeout(() => { openModal(); const sel = document.getElementById('input-domain'); if (sel) sel.value = domainMap[urlDomain]; }, 600);
}

function openModal(idx = null) {
  editingId = idx;
  if (idx !== null) {
    const g = goals[idx];
    document.getElementById('modal-title').textContent = 'Modifier l\'objectif';
    document.getElementById('input-title').value   = g.title;
    document.getElementById('input-desc').value    = g.desc || '';
    document.getElementById('input-domain').value  = g.domain;
    document.getElementById('input-deadline').value= g.deadline || '';
  } else {
    document.getElementById('modal-title').textContent = 'Nouvel objectif';
    ['input-title','input-desc'].forEach(id => document.getElementById(id).value='');
    document.getElementById('input-domain').value   = activeFilter !== 'all' ? activeFilter : 'body';
    document.getElementById('input-deadline').value = '';
  }
  document.getElementById('modal-goal').classList.add('active');
  setTimeout(() => document.getElementById('input-title').focus(), 80);
}

function closeModal() {
  document.getElementById('modal-goal').classList.remove('active');
  editingId = null;
}

async function saveGoal() {
  const title = document.getElementById('input-title').value.trim();
  if (!title) { document.getElementById('input-title').focus(); return; }
  const goal = {
    id:       editingId !== null ? goals[editingId].id : Date.now(),
    title,
    desc:     document.getElementById('input-desc').value.trim(),
    domain:   document.getElementById('input-domain').value,
    deadline: document.getElementById('input-deadline').value || null,
    progress: editingId !== null ? goals[editingId].progress : 0,
    completed:editingId !== null ? goals[editingId].completed : false,
    createdAt:editingId !== null ? goals[editingId].createdAt : Date.now(),
    subtasks: editingId !== null ? (goals[editingId].subtasks||[]) : [],
  };
  if (editingId !== null) goals[editingId] = goal;
  else goals.push(goal);
  await persistGoals();
  renderAll();
  showToast(editingId !== null ? 'Objectif modifié' : 'Objectif ajouté');
  closeModal();
}

// ── Toast ─────────────────────────────────────────────────────────────────
function showToast(msg, err=false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast${err?' error':''} show`;
  setTimeout(() => t.classList.remove('show'), 2800);
}
