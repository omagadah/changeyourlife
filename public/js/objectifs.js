// /objectifs/ - gestion d'objectifs avec sous-tâches + filtres + templates.
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { updateGlobalAvatar, saveWithFeedback, setContext, toast } from '/js/common.js';
import { initUserMenu } from '/js/userMenu.js';
import { showXpFloat } from '/js/xp.js';
import { icon } from '/js/icons.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';


// ── Firebase ──────────────────────────────────────────────────────────────
let auth, db, uid, goals = [], editingId = null, activeFilter = 'all';

// Couleurs en tokens (le theme clair les suit), icones depuis icons.js.
const DOMAIN_COLORS = { body:'var(--corps)', heart:'var(--coeur)', etre:'var(--etre)', order:'var(--ordre)' };
const DOMAIN_LABELS = { body:'Corps', heart:'Cœur', etre:'Être', order:'Ordre' };
const DOMAIN_ICONS  = { body:'walk', heart:'heart', etre:'sparkles', order:'checks' };

const TEMPLATES = [
  { icon:'walk',  name:'Sport',      title:'Courir 5 km',                 domain:'body',  desc:'Courir 5 km sans s\'arrêter' },
  { icon:'book',  name:'Lecture',    title:'Lire 12 livres cette année',  domain:'etre',  desc:'Un livre par mois' },
  { icon:'chart', name:'Épargne',    title:'Épargner 10 % de mes revenus',domain:'order', desc:'Mettre de côté chaque mois' },
  { icon:'leaf',  name:'Méditation', title:'Méditer tous les jours',      domain:'etre',  desc:'Une séance quotidienne de 10 min' },
  { icon:'heart', name:'Relations',  title:'Appeler un proche par semaine', domain:'heart', desc:'Entretenir des liens forts' },
  { icon:'zap',   name:'Force',      title:'3 séances de sport par semaine', domain:'body', desc:'Musculation ou cardio' },
];

if (window._cyfFirebase) {
  ({ auth, db } = window._cyfFirebase);
} else {
  await import('/js/firebase.js');
  ({ auth, db } = window._cyfFirebase);
}

try { initUserMenu(); } catch(e) {}
window.addEventListener('DOMContentLoaded', () => {
  try { updateGlobalAvatar(); } catch(e) {}
});

// ── Helpers Jalons (milestones datés) ────────────────────────────────────────
// Le style des jalons vit dans le <style> de la page (tokens), plus d'injection.

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
  // Sans objectif, les reperes se taisent.
  bar.innerHTML = goals.length ? `
    <span class="chip"><span class="sp-val">${active}</span> en cours</span>
    <span class="chip on"><span class="sp-val">${completed}</span> atteint${completed > 1 ? 's' : ''}</span>
    <span class="chip gold"><span class="sp-val">${avgPct}%</span> de progression moyenne</span>
    ${overdue ? `<span class="chip red"><span class="sp-val">${overdue}</span> en retard</span>` : ''}
  ` : '';

  // Les mêmes chiffres pour CYL, dans le panneau à droite.
  setContext('objectifs', {
    'en cours': active,
    'completes': completed,
    'en retard': overdue,
    'progression moyenne': avgPct + '%',
    'intitules en cours': goals.filter((g) => !g.completed).slice(0, 5).map((g) => String(g.title || '').slice(0, 60)),
  });
}

// ── Domain filter tabs ────────────────────────────────────────────────────
function renderDomainTabs() {
  const tabs = document.getElementById('domain-tabs');
  const allCount = goals.length;
  const filters = [
    { key:'all', label:`Tous (${allCount})`, color:'var(--leaf)' },
    ...Object.entries(DOMAIN_LABELS).map(([k,l]) => ({
      key:k, label:`${l} (${goals.filter(g=>g.domain===k).length})`, color:DOMAIN_COLORS[k], ic:DOMAIN_ICONS[k]
    }))
  ];
  tabs.innerHTML = '';
  filters.forEach(f => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip domain-tab${activeFilter===f.key?' active':''}`;
    btn.setAttribute('aria-pressed', activeFilter===f.key ? 'true' : 'false');
    btn.style.setProperty('--tab-color', f.color);
    btn.innerHTML = (f.ic ? icon(f.ic, { size: 13 }) : '') + f.label;
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
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'template-card';
    card.style.setProperty('--tpl-color', DOMAIN_COLORS[tpl.domain] || 'var(--leaf-text)');
    card.innerHTML = `<span class="template-icon" aria-hidden="true">${icon(tpl.icon)}</span><span class="template-name">${tpl.name}</span>`;
    card.title = tpl.title;
    card.setAttribute('aria-label', `Ajouter l'objectif : ${tpl.title}`);
    card.addEventListener('click', async () => {
      goals.push({ id:Date.now(), title:tpl.title, desc:tpl.desc, domain:tpl.domain, deadline:null, progress:0, completed:false, createdAt:Date.now(), subtasks:[] });
      await persistGoals(); renderAll(); showToast(`« ${tpl.title} » ajouté`);
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
    grid.style.display = 'none'; empty.hidden = false; return;
  }
  grid.style.display = 'grid'; empty.hidden = true;
  grid.innerHTML = '';

  visible.forEach(g => {
    const realIdx = goals.indexOf(g);
    const card = buildGoalCard(g, realIdx);
    grid.appendChild(card);
  });
}

function buildGoalCard(g, idx) {
  const card = document.createElement('article');
  const goalColor = DOMAIN_COLORS[g.domain] || 'var(--text-3)';
  card.className = `card goal-card${g.completed?' completed':''}`;
  card.style.setProperty('--goal-color', goalColor);
  if (!g.completed && g.deadline && new Date(g.deadline) < new Date()) card.classList.add('overdue');

  // ── Header ──
  const header = document.createElement('div'); header.className = 'goal-header';
  const titleEl = document.createElement('h3'); titleEl.className = 'goal-title'; titleEl.textContent = g.title; titleEl.style.margin = '0';
  const domEl   = document.createElement('span'); domEl.className = 'chip goal-domain';
  domEl.innerHTML = (DOMAIN_ICONS[g.domain] ? icon(DOMAIN_ICONS[g.domain], { size: 12 }) : '');
  domEl.appendChild(document.createTextNode(DOMAIN_LABELS[g.domain]||g.domain));
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
      const e1 = document.createElement('span'); e1.className = 'next-milestone-emoji'; e1.setAttribute('aria-hidden', 'true');
      e1.innerHTML = icon(status === 'overdue' ? 'bell' : 'target', { size: 15 });
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
    progText.innerHTML = `Cible : ${new Date(g.deadline).toLocaleDateString('fr-FR')}${isOverdue ? ' <span class="overdue-tag">En retard</span>' : ''}`;
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
  slider.setAttribute('aria-label', `Progression de « ${g.title} »`);
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

  const stToggle = document.createElement('button'); stToggle.type = 'button'; stToggle.className = 'subtasks-toggle';
  const doneCount = subtasks.filter(s=>s.done).length;
  stToggle.innerHTML = toggleLabel(doneCount, subtasks.length);
  stToggle.setAttribute('aria-expanded', 'false');
  stToggle.addEventListener('click', () => {
    const open = stToggle.classList.toggle('open');
    stList.classList.toggle('open', open);
    stToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
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
  addInput.type = 'text'; addInput.className = 'input subtask-add-input';
  addInput.placeholder = 'Nouveau jalon'; addInput.maxLength = 80;
  addInput.setAttribute('aria-label', 'Nouveau jalon');
  const addDate = document.createElement('input');
  addDate.type = 'date'; addDate.className = 'input subtask-add-date';
  addDate.title = 'Échéance (facultative)'; addDate.setAttribute('aria-label', 'Échéance du jalon (facultative)');
  const addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'btn sm subtask-add-btn'; addBtn.innerHTML = icon('plus', { size: 14 }) + 'Ajouter';
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
  const btnSlider = document.createElement('button'); btnSlider.type = 'button'; btnSlider.className = 'btn sm'; btnSlider.innerHTML = icon('sliders', { size: 14 }) + 'Progression';
  btnSlider.setAttribute('aria-pressed', 'false');
  btnSlider.addEventListener('click', () => {
    const open = sliderWrap.classList.toggle('open');
    btnSlider.classList.toggle('active-slider', open);
    btnSlider.setAttribute('aria-pressed', open ? 'true' : 'false');
  });

  // Toggle complete
  const btnT = document.createElement('button'); btnT.type = 'button'; btnT.className = 'btn sm';
  btnT.innerHTML = g.completed ? icon('refresh', { size: 14 }) + 'Réactiver' : icon('check', { size: 14 }) + 'Atteint';
  btnT.addEventListener('click', async () => {
    const was = g.completed;
    g.completed = !was;
    if (g.completed) { g.progress = 100; showToast('Objectif atteint. +25 XP'); }
    else { showToast('Objectif réactivé'); }
    await persistGoals();
    if (!was) {
      try { await window._cyfFirebase.awardXp(g.domain || 'accomplissement', 25); showXpFloat(25); } catch(_){}
    }
    renderAll();
  });

  // Edit
  const btnE = document.createElement('button'); btnE.type = 'button'; btnE.className = 'btn sm'; btnE.innerHTML = icon('edit', { size: 14 }) + 'Modifier';
  btnE.addEventListener('click', () => openModal(idx));

  // Delete (2-step)
  const btnD = document.createElement('button'); btnD.type = 'button'; btnD.className = 'btn sm quiet danger'; btnD.dataset.pending='0';
  btnD.innerHTML = icon('x', { size: 14 }) + 'Supprimer';
  btnD.addEventListener('click', async () => {
    if (btnD.dataset.pending==='1') {
      goals.splice(idx, 1); await persistGoals(); renderAll(); showToast('Objectif supprimé'); return;
    }
    btnD.dataset.pending='1'; btnD.classList.add('danger-confirm'); btnD.textContent='Confirmer ?';
    setTimeout(()=>{ if(btnD.dataset.pending==='1'){btnD.dataset.pending='0';btnD.classList.remove('danger-confirm');btnD.innerHTML=icon('x', { size: 14 }) + 'Supprimer';} }, 3000);
  });

  actions.append(btnSlider, btnT, btnE, btnD);
  card.appendChild(actions);

  return card;
}

// Le libelle du bouton « Jalons » : une fleche, le mot, le compte.
function toggleLabel(doneCount, total) {
  return `<span class="arrow" aria-hidden="true">${icon('chevronRight', { size: 14 })}</span>Jalons <span class="st-count">${total ? `${doneCount}/${total}` : 'ajouter'}</span>`;
}

function buildSubtaskItem(g, goalIdx, st, stIdx, card, toggle, goalColor) {
  const item = document.createElement('div'); item.className = 'subtask-item';
  // Une case a cocher est un bouton : clavier et lecteur d'ecran la voient.
  const check = document.createElement('button');
  check.type = 'button';
  check.className = `subtask-check${st.done?' done':''}`;
  check.setAttribute('aria-pressed', st.done ? 'true' : 'false');
  check.setAttribute('aria-label', (st.done ? 'Rouvrir : ' : 'Marquer fait : ') + st.label);
  check.innerHTML = icon('check', { size: 11, stroke: 3 });
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

  const del = document.createElement('button'); del.type = 'button'; del.className = 'btn quiet sm subtask-del'; del.innerHTML = icon('x', { size: 14 });
  del.setAttribute('aria-label', 'Supprimer le jalon : ' + st.label);

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
    toggle.innerHTML = toggleLabel(doneCount, total);
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
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('modal-goal').classList.contains('open')) closeModal(); });
// Le geste de l'etat vide mene au meme endroit que le bouton d'en-tete.
const btnEmptyNew = document.getElementById('btn-empty-new');
if (btnEmptyNew) btnEmptyNew.addEventListener('click', () => openModal());

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
  document.getElementById('modal-goal').classList.add('open');
  setTimeout(() => document.getElementById('input-title').focus(), 80);
}

function closeModal() {
  document.getElementById('modal-goal').classList.remove('open');
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

// ── Toast : le retour commun de common.js, plus de #toast local ──────────
function showToast(msg, err=false) { toast(msg, { type: err ? 'error' : 'success' }); }
