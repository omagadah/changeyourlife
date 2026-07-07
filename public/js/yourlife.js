// /yourlife/ - Pyramide de Maslow interactive (skills par niveau, mindmap, timeline).
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { updateGlobalAvatar, saveWithFeedback } from '/js/common.js';
import { initUserMenu } from '/js/userMenu.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Vanta bootstrap ──────────────────────────────────────────────────────────
function bootVanta() {
  try {
    if (window.VANTA && window.VANTA.BIRDS) {
      window.VANTA.BIRDS({ el:'#vanta-birds-bg', mouseControls:true, touchControls:true, backgroundColor:0x07192f, quantity:2.0 });
    } else {
      setTimeout(bootVanta, 80);
    }
  } catch (e) { /* ignore */ }
}
bootVanta();

try { updateGlobalAvatar(); } catch(e) {}
try { initUserMenu(); } catch(e) {}

// ── Firebase ──────────────────────────────────────────────────────────────
let auth, db, uid;
if (window._cyfFirebase) {
  ({ auth, db } = window._cyfFirebase);
} else {
  await import('/js/firebase.js');
  ({ auth, db } = window._cyfFirebase);
}

// ── Levels definition ─────────────────────────────────────────────────────
const LEVELS = [
  { id:'self-actualization', label:'Réalisation de Soi',    emoji:'✨', color:'#6366f1',
    defaults:['Créativité','Croissance personnelle','Spiritualité','Contribution','Vision de vie'] },
  { id:'esteem',             label:'Estime de Soi',         emoji:'⭐', color:'#8b5cf6',
    defaults:['Confiance en soi','Compétences','Réussite','Reconnaissance','Fierté'] },
  { id:'love',               label:'Amour & Appartenance',  emoji:'❤️', color:'#ec4899',
    defaults:['Famille','Amis proches','Relations amoureuses','Communauté','Empathie'] },
  { id:'safety',             label:'Sécurité',              emoji:'🛡️', color:'#f59e0b',
    defaults:['Sécurité financière','Stabilité','Logement sûr','Santé préventive','Épargne'] },
  { id:'physiological',      label:'Besoins Physiologiques',emoji:'🧬', color:'#ef4444',
    defaults:['Sommeil 7-8h','Nutrition équilibrée','Exercice régulier','Hydratation','Repos'] },
];

// ── State ─────────────────────────────────────────────────────────────────
let skillData = {};
let saveTimer = null;
let currentView = 'pyramid';

function defaultData() {
  const d = {};
  LEVELS.forEach(lvl => {
    d[lvl.id] = lvl.defaults.map((label, i) => ({ id: `${lvl.id}_${i}`, label, done: false }));
  });
  return d;
}

// ── Auth ──────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  uid = user.uid;
  await loadData();
  render();
});

// ── Firestore ─────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const raw = snap.exists() ? snap.data().maVieSkills : null;
    if (raw && typeof raw === 'object') {
      const hasKeys = LEVELS.some(l => Array.isArray(raw[l.id]));
      skillData = hasKeys ? raw : defaultData();
    } else {
      skillData = defaultData();
    }
    LEVELS.forEach(lvl => {
      if (!Array.isArray(skillData[lvl.id])) skillData[lvl.id] = lvl.defaults.map((label, i) => ({ id: `${lvl.id}_${i}`, label, done: false }));
    });
  } catch(e) { skillData = defaultData(); }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveWithFeedback(() => setDoc(doc(db, 'users', uid), { maVieSkills: skillData }, { merge: true }));
  }, 600);
}

// ── View switching ────────────────────────────────────────────────────────
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentView = btn.dataset.view;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('view-' + currentView).classList.add('active');
    render();
  });
});

// ── Render dispatcher ─────────────────────────────────────────────────────
function render() {
  renderGlobalScore();
  if (currentView === 'pyramid') { renderPyramid(); renderStats('stats-row', 'level-prog-list'); }
  else if (currentView === 'mindmap') { renderMindmap(); renderStats('stats-row-mm', null); }
  else if (currentView === 'timeline') { renderTimeline(); renderStats('stats-row-tl', null); }
}

// ── Global score banner ───────────────────────────────────────────────────
function renderGlobalScore() {
  let total = 0, done = 0;
  LEVELS.forEach(lvl => {
    const s = skillData[lvl.id] || [];
    total += s.length;
    done  += s.filter(x => x.done).length;
  });
  const pct = total ? Math.round(done / total * 100) : 0;
  const complete = LEVELS.filter(lvl => { const s=skillData[lvl.id]||[]; return s.length>0 && s.every(x=>x.done); }).length;

  document.getElementById('gsb-pct').textContent = `${pct}%`;

  // Ring stroke: circumference ≈ 2π×31.5 ≈ 198
  const C = 198;
  document.getElementById('gsb-ring-fill').style.strokeDashoffset = C * (1 - pct / 100);

  // Color by progress
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#3b82f6' : pct >= 25 ? '#f59e0b' : '#6366f1';
  document.getElementById('gsb-ring-fill').style.stroke = color;

  // Title
  const titles = ['Début du voyage 🌱', 'En progression 🚀', 'Belle avancée ⭐', 'Presque au sommet 🏆', 'Maître de ta vie ✨'];
  const ti = Math.min(4, Math.floor(pct / 20));
  document.getElementById('gsb-title').textContent = titles[ti];
  document.getElementById('gsb-sub').textContent = `${done}/${total} compétences · ${complete}/${LEVELS.length} niveaux complets`;
}

// ── Export progression ────────────────────────────────────────────────────
document.getElementById('btn-export-life').addEventListener('click', () => {
  let total=0, done=0;
  const lines = [`# Ma Progression - Change Your Life\nDate : ${new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}\n`];
  LEVELS.forEach(lvl => {
    const skills = skillData[lvl.id] || [];
    const lvlDone = skills.filter(s=>s.done).length;
    total += skills.length; done += lvlDone;
    lines.push(`\n## ${lvl.emoji} ${lvl.label} (${lvlDone}/${skills.length})`);
    skills.forEach(s => lines.push(`- [${s.done?'x':' '}] ${s.label}${s.doneAt ? ` (${new Date(s.doneAt).toLocaleDateString('fr-FR')})` : ''}`));
  });
  const pct = total ? Math.round(done/total*100) : 0;
  lines.unshift(`**Score global : ${pct}% - ${done}/${total} compétences acquises**\n`);
  const blob = new Blob([lines.join('\n')], { type:'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ma-vie-cyf-${new Date().toISOString().slice(0,10)}.md`;
  a.click(); URL.revokeObjectURL(url);
  showToast('✅ Progression exportée !');
});

// ════════════════════════════════════════════════════════════════════════
// PYRAMID VIEW
// ════════════════════════════════════════════════════════════════════════
function renderPyramid() {
  const container = document.getElementById('pyramid');
  container.innerHTML = '';
  LEVELS.forEach(lvl => {
    const skills = skillData[lvl.id] || [];
    const done = skills.filter(s => s.done).length;
    const pct = skills.length ? Math.round(done / skills.length * 100) : 0;

    const row = document.createElement('div');
    row.className = 'level-row';
    row.dataset.level = lvl.id;

    const hdr = document.createElement('div');
    hdr.className = 'level-header';
    hdr.style.background = lvl.color + 'cc';
    hdr.innerHTML = `
      <div class="level-header-left"><span>${lvl.emoji}</span><span>${lvl.label}</span></div>
      <span class="level-pct-badge">${done}/${skills.length} · ${pct}%</span>`;
    row.appendChild(hdr);

    const area = document.createElement('div');
    area.className = 'level-skills';
    area.style.borderColor = lvl.color + '30';
    skills.forEach(skill => area.appendChild(makeSkillPill(lvl, skill)));
    area.appendChild(makeAddBtn(lvl, area));
    row.appendChild(area);
    container.appendChild(row);
  });
}

function makeSkillPill(lvl, skill) {
  const pill = document.createElement('div');
  pill.className = `skill-pill${skill.done ? ' done' : ''}`;
  if (skill.done) { pill.style.borderColor = lvl.color; pill.style.background = hexToRgba(lvl.color, 0.22); }

  const check = document.createElement('span');
  check.className = 'skill-check';
  check.textContent = skill.done ? '✓' : '○';

  const lbl = document.createElement('span');
  lbl.textContent = skill.label;

  const editBtn = document.createElement('button');
  editBtn.className = 'skill-edit'; editBtn.textContent = '✏'; editBtn.title = 'Renommer';
  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    const input = document.createElement('input');
    input.className = 'add-skill-input'; input.value = skill.label; input.style.maxWidth = '160px';
    const parent = pill.parentNode;
    parent.insertBefore(input, pill); pill.style.display = 'none';
    input.focus(); input.select();
    let saved = false;
    const commit = () => {
      if (saved) return; saved = true;
      const val = input.value.trim();
      if (val && val !== skill.label) { skill.label = val; scheduleSave(); }
      render();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { input.removeEventListener('blur', commit); commit(); }
      if (ev.key === 'Escape') { saved = true; input.removeEventListener('blur', commit); render(); }
    });
  });

  const del = document.createElement('button');
  del.className = 'skill-del'; del.textContent = '×'; del.title = 'Supprimer';
  del.addEventListener('click', e => {
    e.stopPropagation();
    skillData[lvl.id] = skillData[lvl.id].filter(s => s.id !== skill.id);
    scheduleSave(); render(); showToast('🗑️ Compétence supprimée');
  });

  pill.append(check, lbl, editBtn, del);
  pill.addEventListener('click', () => toggleSkill(lvl, skill));
  return pill;
}

function makeAddBtn(lvl, area) {
  const btn = document.createElement('button');
  btn.className = 'btn-add-skill'; btn.innerHTML = '+ <span>Ajouter</span>';
  btn.addEventListener('click', () => {
    btn.style.display = 'none';
    const form = document.createElement('div'); form.className = 'add-inline-form';
    const input = document.createElement('input');
    input.className = 'add-skill-input'; input.placeholder = 'Nouvelle compétence…'; input.maxLength = 50;
    const ok = document.createElement('button'); ok.className = 'add-confirm-btn'; ok.title = 'Confirmer'; ok.textContent = '✓';
    const cancel = document.createElement('button'); cancel.className = 'add-cancel-btn'; cancel.title = 'Annuler'; cancel.textContent = '×';
    form.append(input, ok, cancel); area.insertBefore(form, btn); input.focus();
    const confirm = () => {
      const val = input.value.trim();
      if (val) { const id = `${lvl.id}_${Date.now()}`; skillData[lvl.id].push({ id, label: val, done: false }); scheduleSave(); render(); }
      else { form.remove(); btn.style.display = ''; }
    };
    ok.addEventListener('click', confirm);
    cancel.addEventListener('click', () => { form.remove(); btn.style.display = ''; });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirm();
      if (e.key === 'Escape') { form.remove(); btn.style.display = ''; }
    });
  });
  return btn;
}

// ════════════════════════════════════════════════════════════════════════
// MINDMAP VIEW  - SVG radial tree
// ════════════════════════════════════════════════════════════════════════
function renderMindmap() {
  const container = document.getElementById('mindmap-container');
  const W = container.clientWidth || 900;
  const H = 580;
  const cx = W / 2, cy = H / 2;
  const LR = Math.min(W, H) * 0.26; // level radius from center
  const SR = Math.min(W, H) * 0.17; // skill radius from level node

  // 5 levels evenly spaced, starting from top
  const angles = LEVELS.map((_, i) => -Math.PI / 2 + (2 * Math.PI / 5) * i);

  let svgParts = [];
  svgParts.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:${H}px;cursor:default;">`);

  // Defs: gradients + glow filter
  svgParts.push(`<defs>
    <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0.7"/>
    </radialGradient>
    ${LEVELS.map(l => `<radialGradient id="grad-${l.id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${l.color}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${l.color}" stop-opacity="0.5"/>
    </radialGradient>`).join('')}
  </defs>`);

  // Draw level branches and skills first (behind nodes)
  LEVELS.forEach((lvl, li) => {
    const angle = angles[li];
    const lx = cx + Math.cos(angle) * LR;
    const ly = cy + Math.sin(angle) * LR;
    const skills = skillData[lvl.id] || [];

    // Curved line center → level
    const mx = cx + Math.cos(angle) * LR * 0.5;
    const my = cy + Math.sin(angle) * LR * 0.5;
    svgParts.push(`<path d="M${cx},${cy} Q${mx},${my} ${lx},${ly}" fill="none" stroke="${lvl.color}" stroke-width="2.5" stroke-opacity="0.45" stroke-linecap="round"/>`);

    // Skills
    const n = skills.length;
    if (n > 0) {
      const spread = Math.PI * 0.65;
      skills.forEach((skill, si) => {
        const sa = n > 1 ? angle + (si - (n - 1) / 2) * spread / (n - 1) : angle;
        let sx = lx + Math.cos(sa) * SR;
        let sy = ly + Math.sin(sa) * SR;
        // clamp within SVG
        sx = Math.max(52, Math.min(W - 52, sx));
        sy = Math.max(16, Math.min(H - 16, sy));

        const opacity = skill.done ? 0.75 : 0.25;
        svgParts.push(`<line x1="${lx}" y1="${ly}" x2="${sx}" y2="${sy}" stroke="${lvl.color}" stroke-width="1.5" stroke-opacity="${opacity}"/>`);

        const r = 22;
        const fill = skill.done ? `url(#grad-${lvl.id})` : 'rgba(255,255,255,0.04)';
        const stroke = skill.done ? lvl.color : 'rgba(255,255,255,0.18)';
        const sw = skill.done ? 2 : 1;
        const textFill = skill.done ? '#ffffff' : '#7a9ab8';
        const truncated = truncateStr(skill.label, 9);

        svgParts.push(`<g class="mm-skill" data-level="${lvl.id}" data-skill="${skill.id}" style="cursor:pointer">
          <circle cx="${sx}" cy="${sy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${skill.done ? 'filter="url(#glow)"' : ''}/>
          ${skill.done ? `<text x="${sx}" y="${sy - 4}" text-anchor="middle" fill="#fff" font-size="8" font-family="system-ui">✓</text>
          <text x="${sx}" y="${sy + 6}" text-anchor="middle" fill="${textFill}" font-size="7.5" font-family="system-ui" font-weight="600">${truncated}</text>` :
          `<text x="${sx}" y="${sy + 3}" text-anchor="middle" fill="${textFill}" font-size="7.5" font-family="system-ui">${truncated}</text>`}
        </g>`);
      });
    }
  });

  // Draw level nodes on top
  LEVELS.forEach((lvl, li) => {
    const angle = angles[li];
    const lx = cx + Math.cos(angle) * LR;
    const ly = cy + Math.sin(angle) * LR;
    const skills = skillData[lvl.id] || [];
    const done = skills.filter(s => s.done).length;

    svgParts.push(`<circle cx="${lx}" cy="${ly}" r="30" fill="${lvl.color}22" stroke="${lvl.color}" stroke-width="2.5"/>`);
    svgParts.push(`<text x="${lx}" y="${ly - 5}" text-anchor="middle" fill="${lvl.color}" font-size="14" font-family="system-ui">${lvl.emoji}</text>`);
    svgParts.push(`<text x="${lx}" y="${ly + 9}" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="8" font-family="system-ui" font-weight="700">${done}/${skills.length}</text>`);
  });

  // Center node
  svgParts.push(`<circle cx="${cx}" cy="${cy}" r="36" fill="url(#centerGrad)" stroke="rgba(255,255,255,0.25)" stroke-width="2" filter="url(#glow)"/>`);
  svgParts.push(`<text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="white" font-size="11" font-family="system-ui" font-weight="800">Ma</text>`);
  svgParts.push(`<text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="white" font-size="11" font-family="system-ui" font-weight="800">Vie</text>`);

  svgParts.push('</svg>');
  container.innerHTML = svgParts.join('');

  // Skill click handlers
  container.querySelectorAll('.mm-skill').forEach(node => {
    node.addEventListener('click', () => {
      const lvl = LEVELS.find(l => l.id === node.dataset.level);
      const skill = skillData[node.dataset.level]?.find(s => s.id === node.dataset.skill);
      if (skill && lvl) { toggleSkill(lvl, skill); }
    });
  });
}

// ════════════════════════════════════════════════════════════════════════
// TIMELINE VIEW
// ════════════════════════════════════════════════════════════════════════
function renderTimeline() {
  const container = document.getElementById('timeline-container');
  const doneSkills = [];
  LEVELS.forEach(lvl => {
    (skillData[lvl.id] || []).forEach(skill => {
      if (skill.done) doneSkills.push({ ...skill, lvl });
    });
  });

  if (doneSkills.length === 0) {
    container.innerHTML = `<div class="timeline-empty">🌱 Coche tes premières compétences pour les voir apparaître ici !</div>`;
    return;
  }

  // Sort: with timestamp desc, then undated
  doneSkills.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  // Group by date
  const groups = new Map();
  doneSkills.forEach(skill => {
    let dateKey;
    if (skill.doneAt) {
      const d = new Date(skill.doneAt);
      dateKey = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      // Capitalise
      dateKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1);
    } else {
      dateKey = 'Non daté';
    }
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(skill);
  });

  let html = '';
  groups.forEach((skills, date) => {
    html += `<div class="tl-group"><div class="tl-date">${date}</div><div class="tl-items">`;
    skills.forEach(skill => {
      const timeStr = skill.doneAt ? new Date(skill.doneAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      html += `<div class="tl-item" style="--accent:${skill.lvl.color}">
        <div class="tl-dot" style="background:${skill.lvl.color}33;border-color:${skill.lvl.color}"></div>
        <div>
          <div class="tl-level">${skill.lvl.emoji} ${skill.lvl.label}</div>
          <div class="tl-skill">${skill.label}</div>
        </div>
        ${timeStr ? `<div class="tl-time">${timeStr}</div>` : ''}
      </div>`;
    });
    html += '</div></div>';
  });
  container.innerHTML = html;
}

// ════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ════════════════════════════════════════════════════════════════════════
function toggleSkill(lvl, skill) {
  skill.done = !skill.done;
  if (skill.done) skill.doneAt = Date.now();
  else delete skill.doneAt;
  scheduleSave();
  render();
  if (skill.done) showToast(`✓ ${skill.label}`);
}

function renderStats(rowId, progId) {
  let total = 0, totalDone = 0;
  LEVELS.forEach(lvl => {
    const skills = skillData[lvl.id] || [];
    total += skills.length;
    totalDone += skills.filter(s => s.done).length;
  });
  const pct = total ? Math.round(totalDone / total * 100) : 0;

  const statsRow = document.getElementById(rowId);
  if (!statsRow) return;
  statsRow.innerHTML = '';
  const cards = [
    { icon:'🎯', value:`${pct}%`,      label:'Progression globale', fill:lvlColor(pct), pct },
    { icon:'✅', value: totalDone,       label:'Compétences cochées',  fill:'#10b981', pct: total ? totalDone/total*100 : 0 },
    { icon:'📋', value: total,           label:'Compétences totales',  fill:'#3b82f6', pct: 100 },
    { icon:'🏆', value: countComplete(), label:'Niveaux complets',     fill:'#f59e0b', pct: countComplete()/LEVELS.length*100 },
  ];
  cards.forEach(c => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-card-icon">${c.icon}</div>
      <div class="stat-card-value">${c.value}</div>
      <div class="stat-card-label">${c.label}</div>
      <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100,c.pct)}%;background:${c.fill}"></div></div>`;
    statsRow.appendChild(card);
  });

  if (!progId) return;
  const progList = document.getElementById(progId);
  if (!progList) return;
  progList.innerHTML = '';
  LEVELS.forEach(lvl => {
    const skills = skillData[lvl.id] || [];
    const done = skills.filter(s => s.done).length;
    const p = skills.length ? Math.round(done / skills.length * 100) : 0;
    const item = document.createElement('div');
    item.className = 'level-prog-item';
    item.innerHTML = `
      <span class="level-prog-emoji">${lvl.emoji}</span>
      <span class="level-prog-label">${lvl.label}</span>
      <div class="level-prog-bar"><div class="level-prog-bar-fill" style="width:${p}%;background:${lvl.color}"></div></div>
      <span class="level-prog-pct" style="color:${lvl.color}">${p}%</span>`;
    progList.appendChild(item);
  });
}

function countComplete() {
  return LEVELS.filter(lvl => {
    const s = skillData[lvl.id] || [];
    return s.length > 0 && s.every(sk => sk.done);
  }).length;
}

function lvlColor(pct) {
  if (pct >= 80) return '#10b981';
  if (pct >= 50) return '#3b82f6';
  if (pct >= 20) return '#f59e0b';
  return '#ef4444';
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function truncateStr(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}
