// /bilan/ - récap hebdomadaire (XP, journal, méditation, habitudes, réflexion).
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { auth, db } from '/js/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initUserMenu } from '/js/userMenu.js';
import { setContext, toast } from '/js/common.js';
import { icon } from '/js/icons.js';
import { xpParBranche, palierDe } from '/js/growth.js';
import { BRANCHES } from '/js/organizer-data.js';

try { initUserMenu(); } catch(e) {}

let currentUser;
let weekOffset = 0; // 0 = current week, -1 = last week, etc.
let userData = {};
let weekBilanData = null;

window.saveBilan = saveBilan;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace('/login'); return; }
  currentUser = user;

  // Load user doc
  const uSnap = await getDoc(doc(db, 'users', user.uid));
  userData = uSnap.exists() ? uSnap.data() : {};

  setupWeekNav();
  await renderWeek();
});

// ── Week helpers ──
function getWeekBounds(offset = 0) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function weekKey(monday) {
  return `${monday.getFullYear()}-W${String(isoWeek(monday)).padStart(2,'0')}`;
}

function isoWeek(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function formatDate(d, short = false) {
  return d.toLocaleDateString('fr-FR', short ? { day:'numeric', month:'short' } : { day:'numeric', month:'long' });
}

function setupWeekNav() {
  document.getElementById('prev-week').addEventListener('click', () => {
    weekOffset--; renderWeek();
  });
  document.getElementById('next-week').addEventListener('click', () => {
    if (weekOffset < 0) { weekOffset++; renderWeek(); }
  });
}

// ── Main render ──
async function renderWeek() {
  const nextBtn = document.getElementById('next-week');
  nextBtn.disabled = weekOffset >= 0;

  const { monday, sunday } = getWeekBounds(weekOffset);
  const wKey = weekKey(monday);

  // Week range label
  document.getElementById('week-range').textContent =
    `${formatDate(monday, true)} au ${formatDate(sunday, true)}`;

  // Load bilan if exists
  weekBilanData = null;
  try {
    const bSnap = await getDoc(doc(db, 'users', currentUser.uid, 'bilans', wKey));
    if (bSnap.exists()) weekBilanData = bSnap.data();
  } catch(e) {}

  // Restore reflection if saved
  ['q1','q2','q3','q4'].forEach(k => {
    const el = document.getElementById(k);
    if (el) el.value = weekBilanData?.[k] || '';
  });
  const saveBtn = document.getElementById('save-btn');
  saveBtn.textContent = weekBilanData ? 'Mettre à jour mon bilan' : 'Enregistrer mon bilan';

  // Render activity from user data
  renderActivityGrid(monday);
  await renderStats(monday, sunday);
}

// ── Activity grid (7 cells = Mon-Sun) ──
function renderActivityGrid(monday) {
  const grid = document.getElementById('activity-grid');
  const labels = document.getElementById('activity-day-labels');
  const DAY_LABELS = ['Lu','Ma','Me','Je','Ve','Sa','Di'];
  grid.innerHTML = '';
  labels.innerHTML = '';
  const habits = Array.isArray(userData.habits) ? userData.habits : [];
  const medLog = userData.meditation?.sessions || [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = d.toDateString();

    const medDone = medLog.some ? medLog.some(s => new Date(s).toDateString() === ds) : false;
    const habitsDone = habits.filter(h => h.lastDoneAt && new Date(h.lastDoneAt).toDateString() === ds).length;
    const total = (medDone ? 1 : 0) + habitsDone;
    const full = total >= (habits.length || 1) + 1;

    const cell = document.createElement('div');
    cell.className = `act-cell${total > 0 ? (full ? ' full-day' : ' has-activity') : ''}`;
    cell.innerHTML = `<span class="act-tooltip">${DAY_LABELS[i]} ${d.getDate()}/${d.getMonth()+1}${total > 0 ? ` · ${total} activité${total>1?'s':''}` : ''}</span>`;
    grid.appendChild(cell);

    const lbl = document.createElement('div');
    lbl.className = 'act-day-label';
    lbl.textContent = DAY_LABELS[i];
    labels.appendChild(lbl);
  }
}

// ── Stats ──
async function renderStats(monday, sunday) {
  const uid = currentUser.uid;

  // Journal entries this week
  let journalCount = 0;
  try {
    const jSnap = await getDocs(query(collection(db, 'users', uid, 'journal'), orderBy('createdAt', 'desc'), limit(100)));
    jSnap.forEach(d => {
      const ts = d.data().createdAt;
      const date = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
      if (date && date >= monday && date <= sunday) journalCount++;
    });
  } catch(e) {}

  // Habits done this week
  const habits = Array.isArray(userData.habits) ? userData.habits : [];
  let habitsDoneCount = 0;
  habits.forEach(h => {
    if (!h.lastDoneAt) return;
    const d = new Date(h.lastDoneAt);
    if (d >= monday && d <= sunday) habitsDoneCount++;
  });

  // Meditation sessions this week
  let medCount = 0;
  const medLog = userData.meditation?.sessions;
  if (Array.isArray(medLog)) {
    medCount = medLog.filter(s => { const d = new Date(s); return d >= monday && d <= sunday; }).length;
  } else if (userData.meditation?.lastSessionAt) {
    const d = new Date(userData.meditation.lastSessionAt);
    if (d >= monday && d <= sunday) medCount = 1;
  }

  // Mood entries this week
  let moodEntries = [];
  try {
    const mSnap = await getDocs(query(collection(db, 'users', uid, 'moods'), limit(14)));
    mSnap.forEach(d => {
      const [y,m,day] = d.id.split('-').map(Number);
      const date = new Date(y, m-1, day);
      if (date >= monday && date <= sunday) moodEntries.push(d.data());
    });
  } catch(e) {}

  // XP this week - estimate from journal*10 + habits*5 + med*15 + moods*5
  const xpEstimate = journalCount * 10 + habitsDoneCount * 5 + medCount * 15 + moodEntries.length * 5;

  // Display stats
  document.getElementById('stat-xp').textContent = xpEstimate;
  document.getElementById('stat-journal').textContent = journalCount;
  document.getElementById('stat-meditation').textContent = medCount;
  document.getElementById('stat-habits').textContent = habitsDoneCount;

  // XP by domain (current totals, just show them in bars)
  renderBranches(userData);

  // Relire la semaine avec CYL : prefill, jamais envoye tout seul.
  const btnCyl = document.getElementById('btn-cyl-semaine');
  if (btnCyl) btnCyl.onclick = () => {
    const texte = `Peux-tu relire ma semaine avec moi ? Cette semaine : ${journalCount} entrée${journalCount > 1 ? 's' : ''} de journal, ${medCount} séance${medCount > 1 ? 's' : ''} de méditation, ${habitsDoneCount} habitude${habitsDoneCount > 1 ? 's' : ''} cochée${habitsDoneCount > 1 ? 's' : ''}, ${moodEntries.length} humeur${moodEntries.length > 1 ? 's' : ''} notée${moodEntries.length > 1 ? 's' : ''}. Qu'est-ce que tu remarques ?`;
    try { document.dispatchEvent(new CustomEvent('cyl:chat-open', { detail: { prefill: texte } })); } catch (_) {}
    if (window.cylChat && window.cylChat.open) { try { window.cylChat.open(); } catch (_) {} }
  };

  // Highlights
  buildHighlights(journalCount, medCount, habitsDoneCount, moodEntries, habits.length);

  // La semaine en chiffres pour CYL. Elle est a cote pendant la relecture :
  // sans ces reperes, elle commente une semaine qu'elle ne voit pas.
  setContext('bilan', {
    'semaine du': monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
    'entrees de journal': journalCount,
    'seances de meditation': medCount,
    'habitudes tenues': habitsDoneCount,
    'humeurs notees': moodEntries.length,
    'XP estimes sur la semaine': xpEstimate,
  });
}

function setBar(barId, valId, val, max) {
  const pct = max > 0 ? Math.min(100, Math.round(val / max * 100)) : 0;
  document.getElementById(barId).style.width = pct + '%';
  document.getElementById(valId).textContent = val + ' XP';
}

function buildHighlights(journal, med, habits, moods, totalHabits) {
  const list = [];
  // Les couleurs sont des tokens, les icones viennent de icons.js.
  if (journal > 0) list.push({ icon:'book', text:`${journal} entrée${journal>1?'s':''} de journal écrite${journal>1?'s':''}`, val:journal, color:'var(--etre)' });
  if (med > 0) list.push({ icon:'leaf', text:`${med} séance${med>1?'s':''} de méditation`, val:med, color:'var(--corps)' });
  if (habits > 0) list.push({ icon:'checks', text:`${habits} habitude${habits>1?'s':''} tenue${habits>1?'s':''}`, val:`${habits}${totalHabits ? '/'+totalHabits : ''}`, color:'var(--leaf)' });
  if (moods.length > 0) {
    const avg = (moods.reduce((a,b) => a + b.mood, 0) / moods.length).toFixed(1);
    list.push({ icon:'smile', text:`Humeur moyenne : ${avg}/5`, val:moods.length + ' jour' + (moods.length > 1 ? 's' : ''), color:'var(--coeur)' });
  }

  const section = document.getElementById('highlights-section');
  const listEl = document.getElementById('highlights-list');
  if (!list.length) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  listEl.innerHTML = list.map(h => `
    <div class="highlight-item" style="--hl-color:${h.color}">
      <span class="highlight-icon" aria-hidden="true">${icon(h.icon)}</span>
      <span class="highlight-text">${h.text}</span>
      <span class="highlight-val">${h.val}</span>
    </div>
  `).join('');
}

// ── Save bilan ──
async function saveBilan() {
  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = 'Sauvegarde…';

  const { monday } = getWeekBounds(weekOffset);
  const wKey = weekKey(monday);

  const data = {
    q1: document.getElementById('q1').value.trim(),
    q2: document.getElementById('q2').value.trim(),
    q3: document.getElementById('q3').value.trim(),
    q4: document.getElementById('q4').value.trim(),
    weekKey: wKey,
    savedAt: Date.now(),
  };

  try {
    const isNewBilan = !weekBilanData;
    await setDoc(doc(db, 'users', currentUser.uid, 'bilans', wKey), data);
    weekBilanData = data;
    // XP via Cloud Function addXp → branche Estime (le rituel de réflexion hebdo)
    if (isNewBilan) { try { await window._cyfFirebase.awardXp('estime', 20); } catch(_) {} }
    btn.textContent = 'Bilan enregistré';
    toast('Bilan de la semaine enregistré.', { type: 'success' });
    setTimeout(() => { btn.disabled = false; btn.textContent = 'Mettre à jour mon bilan'; }, 2000);
  } catch(e) {
    console.error(e);
    btn.disabled = false;
    btn.textContent = 'Enregistrer mon bilan';
    toast('Impossible d\'enregistrer. Réessaie.', { type: 'error' });
  }
}

// ── Event listener save-btn (remplace onclick inline pour CSP stricte) ──
const saveBtnEl = document.getElementById('save-btn');
if (saveBtnEl) saveBtnEl.addEventListener('click', () => saveBilan());


// ── Les 8 branches (growth.js), a la place des 4 domaines herites ──────────
function renderBranches(userData) {
  const host = document.getElementById('xp-domains-card');
  if (!host) return;
  const xp = xpParBranche(userData || {});
  const max = Math.max(1, ...BRANCHES.map((b) => xp[b.key] || 0));
  host.innerHTML = BRANCHES.map((b) => {
    const v = xp[b.key] || 0;
    const p = palierDe(v);
    return `<div class="xp-br" style="--bc:${b.color}">
      <span class="ic">${icon(b.ic, { size: 16 })}</span>
      <span><b>${b.label}</b><small>${p.nom}</small></span>
      <em>${v.toLocaleString('fr-FR')} XP</em>
      <i><span data-w="${Math.round((v / max) * 100)}"></span></i>
    </div>`;
  }).join('');
  setTimeout(() => host.querySelectorAll('[data-w]').forEach((el) => { el.style.width = el.dataset.w + '%'; }), 120);
}
