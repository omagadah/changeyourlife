// /humeur/ — tracker quotidien d'humeur + heatmap + stats.
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { auth, db } from '/js/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initUserMenu } from '/js/userMenu.js';
import { showXpFloat, showLevelUp } from '/js/xp.js';

// ── Vanta bootstrap ──────────────────────────────────────────────────────────
function bootVanta() {
  try {
    if (window.VANTA && window.VANTA.BIRDS) {
      window.VANTA.BIRDS({ el:'#vanta-bg', mouseControls:false, touchControls:false,
        backgroundColor:0x07192f, color1:0x3a2a4a, color2:0xcccccc, quantity:3 });
    } else {
      setTimeout(bootVanta, 80);
    }
  } catch (e) { /* ignore */ }
}
window.addEventListener('DOMContentLoaded', () => {
  bootVanta();
});

window.CYF_NAV_LINKS = [
  { href: '/journal/',   label: '📔 Journal' },
  { href: '/habitudes/', label: '⚡ Habitudes' },
  { href: '/humeur/',    label: '🌡️ Humeur' },
  { href: '/bilan/',     label: '📊 Bilan Hebdo' },
];
try { initUserMenu(); } catch(e) {}

const MOOD_COLORS = { 1:'#ef4444', 2:'#f97316', 3:'#eab308', 4:'#22c55e', 5:'#2dd4bf' };
const MOOD_EMOJIS = { 1:'😞', 2:'😟', 3:'😐', 4:'🙂', 5:'😄' };
const MOOD_LABELS = { 1:'Difficile', 2:'Bas', 3:'Neutre', 4:'Bien', 5:'Excellent' };
const DOMAIN_COLORS = { corps:'#2dd4bf', coeur:'#f87171', etre:'#a78bfa', ordre:'#fbbf24' };
const DOMAIN_LABELS = { corps:'Corps', coeur:'Cœur', etre:'Être', ordre:'Ordre' };

let currentUser;
let selectedMood = null;
let selectedDomain = null;
let allEntries = {}; // dateStr → {mood, note, domain, timestamp}
let todayAlreadyLogged = false;

// Expose helpers globally for onclick handlers
window.selectMood = selectMood;
window.selectDomain = selectDomain;
window.saveMood = saveMood;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace('/login'); return; }
  currentUser = user;
  await loadEntries();
  renderHeatmap();
  renderEntries();
  computeStats();
});

// ── Selection helpers ──
function selectMood(level, el) {
  if (todayAlreadyLogged) return;
  selectedMood = level;
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  const color = MOOD_COLORS[level];
  document.getElementById('today-mood-card').style.setProperty('--mood-accent', color);
  document.getElementById('save-mood-btn').disabled = false;
}

function selectDomain(domain, el) {
  if (todayAlreadyLogged) return;
  selectedDomain = selectedDomain === domain ? null : domain;
  document.querySelectorAll('.domain-pill').forEach(p => p.classList.remove('selected'));
  if (selectedDomain) el.classList.add('selected');
}

// ── Load entries from Firestore ──
async function loadEntries() {
  const col = collection(db, 'users', currentUser.uid, 'moods');
  const q = query(col, orderBy('timestamp', 'desc'), limit(90));
  const snap = await getDocs(q);
  allEntries = {};
  snap.forEach(d => { allEntries[d.id] = d.data(); });

  // Check today
  const todayStr = todayDateStr();
  if (allEntries[todayStr]) {
    todayAlreadyLogged = true;
    const e = allEntries[todayStr];
    showAlreadyLogged(e);
  }
}

function todayDateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function showAlreadyLogged(entry) {
  document.getElementById('mood-question').textContent = `Déjà enregistré aujourd'hui — ${MOOD_EMOJIS[entry.mood]} ${MOOD_LABELS[entry.mood]}`;
  document.getElementById('mood-row').style.opacity = '0.4';
  document.getElementById('mood-row').style.pointerEvents = 'none';
  document.getElementById('mood-note').value = entry.note || '';
  document.getElementById('mood-note').disabled = true;
  document.getElementById('domain-row').style.opacity = '0.4';
  document.getElementById('domain-row').style.pointerEvents = 'none';
  document.getElementById('save-mood-btn').disabled = true;
  document.getElementById('save-mood-btn').textContent = '✓ Humeur enregistrée';
  document.getElementById('today-mood-card').style.setProperty('--mood-accent', MOOD_COLORS[entry.mood]);
  // Pre-select the mood btn visually
  const btn = document.querySelector(`.mood-btn[data-mood="${entry.mood}"]`);
  if (btn) btn.classList.add('selected');
  if (entry.domain) {
    const dp = document.querySelector(`.domain-pill[data-domain="${entry.domain}"]`);
    if (dp) dp.classList.add('selected');
  }
}

// ── Save mood ──
async function saveMood() {
  if (!selectedMood || todayAlreadyLogged) return;
  const btn = document.getElementById('save-mood-btn');
  btn.disabled = true;
  btn.textContent = 'Enregistrement…';

  const dateStr = todayDateStr();
  const note = document.getElementById('mood-note').value.trim();
  const entry = {
    mood: selectedMood,
    note: note || null,
    domain: selectedDomain || null,
    timestamp: Date.now()
  };

  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'moods', dateStr), entry);

    // Award XP via Cloud Function (validation + level-up server-side)
    const domainKey = selectedDomain === 'corps' ? 'body' : selectedDomain === 'coeur' ? 'heart' : selectedDomain === 'etre' ? 'etre' : selectedDomain === 'ordre' ? 'order' : 'heart';
    try { await window._cyfFirebase.awardXp(domainKey, 5); } catch(_){}

    allEntries[dateStr] = entry;
    todayAlreadyLogged = true;
    showAlreadyLogged(entry);
    renderHeatmap();
    renderEntries();
    computeStats();
    showXpFloat(5, document.getElementById('save-mood-btn'));
    showToast('+5 XP · Humeur enregistrée !', 'xp');
  } catch(err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'Enregistrer mon humeur';
    showToast('Erreur, réessaie.', '');
  }
}

// ── Render 30-day heatmap ──
function renderHeatmap() {
  const grid = document.getElementById('heatmap-grid');
  grid.innerHTML = '';
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const entry = allEntries[dateStr];
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    if (entry) {
      cell.setAttribute('data-mood', entry.mood);
      const label = `${d.getDate()}/${d.getMonth()+1} — ${MOOD_EMOJIS[entry.mood]} ${MOOD_LABELS[entry.mood]}`;
      cell.innerHTML = `<span class="cell-tooltip">${label}</span>`;
    } else {
      const label = `${d.getDate()}/${d.getMonth()+1}`;
      cell.innerHTML = `<span class="cell-tooltip">${label}</span>`;
    }
    grid.appendChild(cell);
  }
}

// ── Render recent entries list ──
function renderEntries() {
  const list = document.getElementById('entries-list');
  const sorted = Object.entries(allEntries)
    .sort((a,b) => b[1].timestamp - a[1].timestamp)
    .slice(0, 10);

  if (!sorted.length) {
    list.innerHTML = '<div class="empty-entries">Aucune entrée encore — commence dès aujourd\'hui !</div>';
    return;
  }

  list.innerHTML = sorted.map(([dateStr, e]) => {
    const color = MOOD_COLORS[e.mood];
    const [y,m,d] = dateStr.split('-');
    const dateLabel = formatDate(new Date(+y, +m-1, +d));
    const domLabel = e.domain ? DOMAIN_LABELS[e.domain] : '';
    const domStyle = e.domain ? `color:${DOMAIN_COLORS[e.domain]};background:color-mix(in srgb,${DOMAIN_COLORS[e.domain]} 12%,transparent);border-color:color-mix(in srgb,${DOMAIN_COLORS[e.domain]} 30%,transparent)` : '';
    return `
      <div class="entry-row" style="--entry-mood-color:${color}">
        <span class="entry-emoji">${MOOD_EMOJIS[e.mood]}</span>
        <div class="entry-meta">
          <div class="entry-date">${dateLabel} · ${MOOD_LABELS[e.mood]}</div>
          <div class="entry-note">${e.note || '<em style="opacity:.5">Sans note</em>'}</div>
        </div>
        ${domLabel ? `<span class="entry-domain" style="${domStyle}">${domLabel}</span>` : ''}
      </div>`;
  }).join('');
}

function formatDate(d) {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' });
}

// ── Compute stats ──
function computeStats() {
  const keys = Object.keys(allEntries).sort().reverse();

  // Streak
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate()-i);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (allEntries[ds]) { streak++; } else { break; }
  }
  document.getElementById('stat-streak').textContent = streak;
  document.getElementById('streak-count').textContent = streak;
  if (streak > 0) document.getElementById('streak-badge').style.display = 'inline-flex';

  // 7-day average
  const last7 = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate()-i);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (allEntries[ds]) last7.push(allEntries[ds].mood);
  }
  const avg = last7.length ? (last7.reduce((a,b)=>a+b,0)/last7.length).toFixed(1) : '—';
  document.getElementById('stat-avg').textContent = avg;
  if (avg !== '—') {
    const avgNum = parseFloat(avg);
    const avgColor = avgNum >= 4 ? '#22c55e' : avgNum >= 3 ? '#eab308' : '#f87171';
    document.getElementById('stat-avg').style.color = avgColor;
  }

  // Total
  document.getElementById('stat-total').textContent = keys.length;
}

// ── Toast ──
function showToast(msg, cls) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast${cls?' '+cls:''}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
