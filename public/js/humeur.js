// /humeur/ - tracker quotidien d'humeur + heatmap + stats.
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { auth, db } from '/js/firebase.js';
import { serieAvecPardon } from '/js/growth.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initUserMenu } from '/js/userMenu.js';
import { showXpFloat } from '/js/xp.js';
import { setContext, toast, escapeHtml } from '/js/common.js';

try { initUserMenu(); } catch(e) {}

// L'echelle d'humeur (--m1..--m5) et les domaines sont des tokens poses par
// la page : le theme clair les suit, et l'annee en pixels partage la meme.
const MOOD_COLORS = { 1:'var(--m1)', 2:'var(--m2)', 3:'var(--m3)', 4:'var(--m4)', 5:'var(--m5)' };
const MOOD_EMOJIS = { 1:'😞', 2:'😟', 3:'😐', 4:'🙂', 5:'😄' };
const MOOD_LABELS = { 1:'Difficile', 2:'Bas', 3:'Neutre', 4:'Bien', 5:'Excellent' };
const DOMAIN_COLORS = { corps:'var(--corps)', coeur:'var(--coeur)', etre:'var(--etre)', ordre:'var(--ordre)' };
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
  renderPixels();
  renderEntries();
  computeStats();
});

// ── Selection helpers ──
function selectMood(level, el) {
  if (todayAlreadyLogged) return;
  selectedMood = level;
  markPressed('.mood-btn', el);
  const color = MOOD_COLORS[level];
  document.getElementById('today-mood-card').style.setProperty('--mood-accent', color);
  document.getElementById('save-mood-btn').disabled = false;
}

function selectDomain(domain, el) {
  if (todayAlreadyLogged) return;
  selectedDomain = selectedDomain === domain ? null : domain;
  markPressed('.domain-pill', selectedDomain ? el : null);
}

// Un choix est un bouton presse : aria-pressed porte l'etat, le style suit.
function markPressed(selector, active) {
  document.querySelectorAll(selector).forEach(b => {
    const on = b === active;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// ── Load entries from Firestore ──
async function loadEntries() {
  const col = collection(db, 'users', currentUser.uid, 'moods');
  const q = query(col, orderBy('timestamp', 'desc'), limit(400));
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

  publishContext();
}

// ── Ce que CYL sait de l'humeur, et ce qu'elle ne saura jamais ──────────────
// Le SCORE et la TENDANCE partent avec le message (CYL est dans le panneau
// pendant qu'on note sa journée : sans ça, elle demande « comment te sens-tu ? »
// à quelqu'un qui vient justement de répondre à l'écran).
// La NOTE, elle, ne part JAMAIS : c'est le texte intime, pas un repère.
const MOOD_WORDS = { 1: 'tres bas', 2: 'bas', 3: 'neutre', 4: 'bon', 5: 'tres bon' };

function publishContext() {
  try {
    const dates = Object.keys(allEntries).sort().reverse();
    const last7 = dates.slice(0, 7).map((d) => allEntries[d]).filter((e) => e && typeof e.mood === 'number');
    const moy = last7.length ? (last7.reduce((s, e) => s + e.mood, 0) / last7.length) : null;
    const today = allEntries[todayDateStr()];
    setContext('humeur', {
      'humeur du jour': today && today.mood ? `${MOOD_WORDS[today.mood] || today.mood} (${today.mood}/5)` : 'pas encore notee',
      'moyenne 7 jours': moy === null ? 'aucune donnee' : `${moy.toFixed(1)}/5`,
      'jours suivis': dates.length,
      'domaine du jour': (today && today.domain) || 'non precise',
    });
  } catch (_) { /* la page marche meme si CYL n'apprend rien */ }
}

function todayDateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function showAlreadyLogged(entry) {
  document.getElementById('mood-question').textContent = `Aujourd'hui : ${MOOD_EMOJIS[entry.mood]} ${MOOD_LABELS[entry.mood]}`;
  document.getElementById('mood-row').setAttribute('aria-disabled', 'true');
  document.getElementById('mood-note').value = entry.note || '';
  document.getElementById('mood-note').disabled = true;
  document.getElementById('domain-row').setAttribute('aria-disabled', 'true');
  document.getElementById('save-mood-btn').disabled = true;
  document.getElementById('save-mood-btn').textContent = 'Humeur enregistrée';
  document.getElementById('today-mood-card').style.setProperty('--mood-accent', MOOD_COLORS[entry.mood]);
  // Pre-select the mood btn visually
  markPressed('.mood-btn', document.querySelector(`.mood-btn[data-mood="${entry.mood}"]`));
  markPressed('.domain-pill', entry.domain ? document.querySelector(`.domain-pill[data-domain="${entry.domain}"]`) : null);
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
    toast('+5 XP. Humeur enregistrée.', { type: 'success' });
  } catch(err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'Enregistrer mon humeur';
    toast('Impossible d\'enregistrer. Réessaie.', { type: 'error' });
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
      const label = `${d.getDate()}/${d.getMonth()+1} - ${MOOD_EMOJIS[entry.mood]} ${MOOD_LABELS[entry.mood]}`;
      cell.innerHTML = `<span class="cell-tooltip">${label}</span>`;
    } else {
      const label = `${d.getDate()}/${d.getMonth()+1}`;
      cell.innerHTML = `<span class="cell-tooltip">${label}</span>`;
    }
    grid.appendChild(cell);
  }
}

// ── L'annee en pixels (Daylio) : un carre par jour, 53 semaines ──────────
// La grille se lit comme un calendrier : colonnes = semaines, lignes = jours.
// Rien n'est note, rien n'est compare : c'est une photo de l'annee, pas une
// moyenne. Les jours non renseignes restent vides, sans reproche.
function renderPixels() {
  const grid = document.getElementById('pixels-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // on commence un lundi
  const todayStr = todayDateStr();
  let renseignes = 0;
  const cells = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const e = allEntries[key];
    const cell = document.createElement('span');
    cell.className = 'px' + (key === todayStr ? ' today' : '');
    if (e && e.mood) { cell.setAttribute('data-v', e.mood); renseignes++; }
    cell.title = `${d.getDate()}/${d.getMonth()+1}${e && e.mood ? ' - ' + MOOD_LABELS[e.mood] : ''}`;
    cells.push(cell);
  }
  // La grille est en colonnes (une semaine par colonne) : on remplit par
  // lignes de 7, en transposant.
  const semaines = Math.ceil(cells.length / 7);
  grid.style.gridTemplateColumns = `repeat(${semaines}, 1fr)`;
  for (let jour = 0; jour < 7; jour++) {
    for (let w = 0; w < semaines; w++) {
      const c = cells[w * 7 + jour];
      grid.appendChild(c || Object.assign(document.createElement('span'), { className: 'px vide' }));
    }
  }
  const note = document.getElementById('pixels-note');
  if (note) note.textContent = renseignes ? `${renseignes} jour${renseignes > 1 ? 's' : ''} renseigne${renseignes > 1 ? 's' : ''} sur les 365 derniers` : 'Chaque jour note ici ajoute un carre.';
}

// ── Render recent entries list ──
function renderEntries() {
  const list = document.getElementById('entries-list');
  const sorted = Object.entries(allEntries)
    .sort((a,b) => b[1].timestamp - a[1].timestamp)
    .slice(0, 10);

  if (!sorted.length) {
    list.innerHTML = '<div class="empty"><h3>Aucune entrée pour l\'instant</h3><p>Note ton humeur ci-dessus : l\'historique commence avec aujourd\'hui.</p></div>';
    return;
  }

  list.innerHTML = sorted.map(([dateStr, e]) => {
    const color = MOOD_COLORS[e.mood];
    const [y,m,d] = dateStr.split('-');
    const dateLabel = formatDate(new Date(+y, +m-1, +d));
    const domLabel = e.domain ? DOMAIN_LABELS[e.domain] : '';
    const domStyle = e.domain ? `--dpcolor:${DOMAIN_COLORS[e.domain]}` : '';
    return `
      <div class="entry-row" style="--entry-mood-color:${color}">
        <span class="entry-emoji" aria-hidden="true">${MOOD_EMOJIS[e.mood]}</span>
        <div class="entry-meta">
          <div class="entry-date">${dateLabel} · ${MOOD_LABELS[e.mood]}</div>
          <div class="entry-note">${e.note ? escapeHtml(e.note) : '<em>Sans note</em>'}</div>
        </div>
        ${domLabel ? `<span class="chip entry-domain" style="${domStyle}">${domLabel}</span>` : ''}
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

  // Série avec pardon (growth.js) : un jour manqué par semaine ne casse rien.
  const today = new Date();
  const streak = serieAvecPardon((k) => !!allEntries[k]).jours;
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
  // Sans donnee, la moyenne se tait : le bloc entier disparait.
  const avgBlock = document.getElementById('stat-avg-block');
  if (last7.length) {
    const avgNum = last7.reduce((a,b)=>a+b,0)/last7.length;
    document.getElementById('stat-avg').textContent = avgNum.toFixed(1);
    document.getElementById('stat-avg').style.color = MOOD_COLORS[Math.max(1, Math.min(5, Math.round(avgNum)))];
    if (avgBlock) avgBlock.hidden = false;
  } else if (avgBlock) { avgBlock.hidden = true; }

  // Total
  document.getElementById('stat-total').textContent = keys.length;
}

// ── Event listeners (remplacent les onclick inline pour CSP stricte) ──
document.querySelectorAll('.mood-btn[data-mood]').forEach(btn => {
  btn.addEventListener('click', () => {
    const level = Number(btn.dataset.mood);
    if (!Number.isNaN(level)) selectMood(level, btn);
  });
});

document.querySelectorAll('.domain-pill[data-domain]').forEach(pill => {
  pill.addEventListener('click', () => selectDomain(pill.dataset.domain, pill));
});

const saveBtn = document.getElementById('save-mood-btn');
if (saveBtn) saveBtn.addEventListener('click', () => saveMood());
