// /journal/ - journal de bord, gestion des entrées + stats + filtres.
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { updateGlobalAvatar } from '/js/common.js';
import { initUserMenu } from '/js/userMenu.js';
import { showXpFloat } from '/js/xp.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, doc, getDocs, setDoc, deleteDoc, orderBy, query, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Vanta bootstrap ──────────────────────────────────────────────────────────
function bootVanta() {
  try {
    if (window.VANTA && window.VANTA.BIRDS) {
      window.VANTA.BIRDS({ el:'#vanta-birds-bg', mouseControls:true, touchControls:true, backgroundColor:0x07192f, quantity:3.0 });
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

// ── Data constants ─────────────────────────────────────────────────────────
const EMOTIONS = [
  { key:'joy',      emoji:'😊', label:'Joie' },
  { key:'calm',     emoji:'😌', label:'Calme' },
  { key:'grateful', emoji:'🙏', label:'Gratitude' },
  { key:'worried',  emoji:'😟', label:'Inquiet' },
  { key:'sad',      emoji:'😢', label:'Triste' },
  { key:'angry',    emoji:'😡', label:'Frustré' },
  { key:'neutral',  emoji:'😐', label:'Neutre' },
];
const DOMAINS = [
  { key:'none',  label:'Général' },
  { key:'body',  label:'Corps' },
  { key:'heart', label:'Cœur' },
  { key:'etre',  label:'Être' },
  { key:'order', label:'Ordre' },
];
const EMOTION_MAP = Object.fromEntries(EMOTIONS.map(e => [e.key, e]));
const DOMAIN_COLORS = { body:'#2dd4bf', heart:'#ef4444', etre:'#9ca3ff', order:'#f59e0b', none:'#6b7280' };
const MOOD_SCORE = { joy:9, grateful:8, calm:7, neutral:5, worried:4, sad:3, angry:2 };

// ── State ──────────────────────────────────────────────────────────────────
let entries = [];
let selEmotion = 'neutral';
let selDomain = 'none';
let editingId = null;
let readId = null;
let filterEmotion = null;
let filterDomain  = null;
let searchQuery   = '';

// ── Auth ───────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  uid = user.uid;
  await loadEntries();
  buildPickers();
});

// ── Firestore helpers ──────────────────────────────────────────────────────
const journalCol = () => collection(db, 'users', uid, 'journal');

async function loadEntries() {
  try {
    const snap = await getDocs(query(journalCol(), orderBy('createdAt','desc'), limit(300)));
    entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { console.warn(e); entries = []; }
  renderList();
  renderMoodChart();
  renderFilterPills();
}

// ── Render: filter pills ────────────────────────────────────────────────────
const DOMAIN_FILTER_CFG = [
  { key:'body',  label:'🏃 Corps',  cls:'dom-body'  },
  { key:'heart', label:'❤️ Cœur',  cls:'dom-heart' },
  { key:'etre',  label:'✨ Être',   cls:'dom-etre'  },
  { key:'order', label:'📋 Ordre',  cls:'dom-order' },
];

function renderFilterPills() {
  // Emotion pills
  const fp = document.getElementById('filter-pills'); fp.innerHTML = '';
  EMOTIONS.forEach(({ key, emoji }) => {
    const p = document.createElement('button'); p.className = `filter-pill${filterEmotion===key?' active':''}`;
    p.textContent = emoji; p.title = EMOTION_MAP[key].label;
    p.addEventListener('click', () => { filterEmotion = filterEmotion===key ? null : key; renderFilterPills(); renderList(); });
    fp.appendChild(p);
  });

  // Domain pills
  const dp = document.getElementById('domain-filter-pills'); dp.innerHTML = '';
  DOMAIN_FILTER_CFG.forEach(({ key, label, cls }) => {
    const p = document.createElement('button');
    p.className = `filter-pill ${cls}${filterDomain===key?' active':''}`;
    p.textContent = label;
    p.addEventListener('click', () => { filterDomain = filterDomain===key ? null : key; renderFilterPills(); renderList(); });
    dp.appendChild(p);
  });

  // Clear all filters
  const hasFilter = filterEmotion || filterDomain || searchQuery;
  const existingClear = fp.querySelector('.clear-btn');
  if (hasFilter && !existingClear) {
    const c = document.createElement('button'); c.className = 'filter-pill clear-btn'; c.textContent = '× Tout';
    c.addEventListener('click', () => { filterEmotion=null; filterDomain=null; searchQuery=''; document.getElementById('journal-search').value=''; document.getElementById('search-clear').style.display='none'; renderFilterPills(); renderList(); });
    fp.appendChild(c);
  }
}

// ── Render: entry list ─────────────────────────────────────────────────────
function renderList() {
  const list = document.getElementById('entry-list');
  const cnt  = document.getElementById('entry-count');
  const q = searchQuery.toLowerCase().trim();
  const visible = entries.filter(e => {
    if (filterEmotion && e.emotion !== filterEmotion) return false;
    if (filterDomain  && (e.domain || 'none') !== filterDomain) return false;
    if (q && !(e.title||'').toLowerCase().includes(q) && !(e.content||'').toLowerCase().includes(q)) return false;
    return true;
  });
  cnt.textContent = visible.length !== entries.length
    ? `${visible.length}/${entries.length} entrée${entries.length>1?'s':''}`
    : entries.length ? `${entries.length} entrée${entries.length > 1 ? 's' : ''}` : 'Aucune entrée';

  // ── Streak & mood stats ──────────────────────────────────────────────
  const statsEl = document.getElementById('sidebar-stats');
  if (statsEl && entries.length) {
    // Streak: consecutive days with at least one entry
    const daySet = new Set(entries.map(e => tsToDate(e.createdAt).toDateString()));
    let streak = 0, d = new Date();
    while (daySet.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
    // Dominant emotion this week
    const weekAgo = Date.now() - 7 * 86400000;
    const weekEntries = entries.filter(e => tsToDate(e.createdAt).getTime() >= weekAgo);
    const emotionCount = {};
    weekEntries.forEach(e => { if (e.emotion && e.emotion !== 'neutral') emotionCount[e.emotion] = (emotionCount[e.emotion]||0)+1; });
    const domEmo = Object.entries(emotionCount).sort((a,b)=>b[1]-a[1])[0];
    const domEmoData = domEmo ? EMOTION_MAP[domEmo[0]] : null;
    statsEl.innerHTML = `
      ${streak > 0 ? `<span class="sidebar-stat-pill streak">🔥 ${streak} jour${streak>1?'s':''} d'affilée</span>` : ''}
      ${domEmoData ? `<span class="sidebar-stat-pill mood">${domEmoData.emoji} ${domEmoData.label} cette semaine</span>` : ''}
    `;
  } else if (statsEl) { statsEl.innerHTML = ''; }
  list.innerHTML = '';
  if (!visible.length) {
    const empty = document.createElement('div'); empty.className = 'empty-list';
    const noMsg = entries.length ? 'Aucun résultat pour ce filtre' : 'Aucune entrée';
    const noSub = entries.length ? 'Modifie ou efface le filtre' : 'Commence par écrire aujourd\'hui';
    empty.innerHTML = `<div class="empty-list-icon">📝</div><div>${noMsg}</div><div style="font-size:.75rem;margin-top:4px">${noSub}</div>`;
    list.appendChild(empty); return;
  }
  visible.forEach(e => {
    const item = document.createElement('div');
    item.className = `entry-item${e.id === readId ? ' active' : ''}`;
    item.dataset.id = e.id;
    const domColor = DOMAIN_COLORS[e.domain || 'none'];
    item.style.setProperty('--entry-color', domColor);

    // Top row: emoji + date + word badge
    const row = document.createElement('div'); row.className = 'entry-item-row';
    const emo = EMOTION_MAP[e.emotion] || EMOTION_MAP.neutral;
    const emoSpan = document.createElement('span'); emoSpan.className = 'entry-emoji';
    emoSpan.textContent = emo.emoji;
    const dateSpan = document.createElement('span'); dateSpan.className = 'entry-date';
    const ts = tsToDate(e.createdAt);
    const isToday = ts.toDateString() === new Date().toDateString();
    const isYesterday = ts.toDateString() === new Date(Date.now()-86400000).toDateString();
    dateSpan.textContent = isToday ? 'Aujourd\'hui · ' + ts.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
      : isYesterday ? 'Hier · ' + ts.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
      : ts.toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
    // Word count badge
    const wc = (e.content || '').trim().split(/\s+/).filter(Boolean).length;
    const wcBadge = document.createElement('span'); wcBadge.className = 'entry-word-badge';
    wcBadge.textContent = wc ? `${wc}m` : '';
    row.append(emoSpan, dateSpan, wcBadge); item.appendChild(row);

    // Title or preview
    if (e.title) {
      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-size:0.85rem;font-weight:700;color:#d4e4f7;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      titleEl.textContent = e.title;
      item.appendChild(titleEl);
      if (e.content) {
        const prev = document.createElement('div'); prev.className = 'entry-preview';
        prev.textContent = (e.content||'').slice(0,50) + ((e.content||'').length > 50 ? '…' : '');
        item.appendChild(prev);
      }
    } else {
      const prev = document.createElement('div'); prev.className = 'entry-preview';
      const raw = (e.content || '').slice(0, 65);
      prev.textContent = (e.content||'').length > 65 ? raw + '…' : (raw || '(vide)');
      item.appendChild(prev);
    }
    item.addEventListener('click', () => openReadView(e.id));
    list.appendChild(item);
  });
}

// ── Render: mood chart ─────────────────────────────────────────────────────
function renderMoodChart() {
  const wrap  = document.getElementById('mood-chart-wrap');
  const chart = document.getElementById('mood-chart');
  if (entries.length < 2) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block'; chart.innerHTML = '';
  const localIso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { iso: localIso(d), lbl: d.toLocaleDateString('fr-FR', { weekday:'narrow' }) };
  });
  days.forEach(({ iso, lbl }) => {
    const dayE = entries.filter(e => localIso(tsToDate(e.createdAt)) === iso);
    const avg = dayE.length ? dayE.reduce((s,e) => s + (MOOD_SCORE[e.emotion]||5), 0) / dayE.length : 0;
    const h = Math.round((avg / 10) * 28);
    const bwrap = document.createElement('div'); bwrap.className = 'mood-bar-wrap';
    const bg = document.createElement('div'); bg.className = 'mood-bar-bg';
    const fill = document.createElement('div'); fill.className = 'mood-bar-fill';
    fill.style.height = `${h}px`;
    fill.style.background = avg >= 7 ? '#10b981' : avg >= 5 ? '#3b82f6' : avg > 0 ? '#f59e0b' : 'rgba(255,255,255,.06)';
    bg.appendChild(fill); bwrap.appendChild(bg);
    const ll = document.createElement('div'); ll.className = 'mood-bar-label'; ll.textContent = lbl;
    bwrap.appendChild(ll); chart.appendChild(bwrap);
  });
}

// ── Pickers ────────────────────────────────────────────────────────────────
function buildPickers() {
  // Emotions
  const ep = document.getElementById('emotion-picker'); ep.innerHTML = '';
  EMOTIONS.forEach(({ key, emoji, label }) => {
    const btn = document.createElement('button'); btn.className = `emotion-btn${key===selEmotion?' selected':''}`; btn.dataset.key = key;
    const s1 = document.createElement('span'); s1.textContent = emoji;
    const s2 = document.createElement('span'); s2.textContent = label;
    btn.append(s1, s2);
    btn.addEventListener('click', () => { selEmotion = key; ep.querySelectorAll('.emotion-btn').forEach(b => b.classList.toggle('selected', b.dataset.key===key)); });
    ep.appendChild(btn);
  });
  // Domains
  const dp = document.getElementById('domain-picker'); dp.innerHTML = '';
  DOMAINS.forEach(({ key, label }) => {
    const btn = document.createElement('button'); btn.className = `domain-btn${key===selDomain?` sel-${key}`:''}`; btn.dataset.key = key; btn.textContent = label;
    btn.addEventListener('click', () => { selDomain = key; dp.querySelectorAll('.domain-btn').forEach(b => { b.className = `domain-btn${b.dataset.key===key?` sel-${key}`:''}`; }); });
    dp.appendChild(btn);
  });
}

function setEmotion(key) { selEmotion = key; document.querySelectorAll('#emotion-picker .emotion-btn').forEach(b => b.classList.toggle('selected', b.dataset.key===key)); }
function setDomain(key) { selDomain = key; document.querySelectorAll('#domain-picker .domain-btn').forEach(b => { b.className = `domain-btn${b.dataset.key===key?` sel-${key}`:''}`; }); }

// ── Views ──────────────────────────────────────────────────────────────────
function showView(name) {
  ['empty','editor','read'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    el.style.display = (name===v) ? 'flex' : 'none';
  });
  const statsPanel = document.getElementById('view-stats');
  statsPanel.classList.toggle('active', name === 'stats');
  const statsBtn = document.getElementById('btn-stats-toggle');
  if (statsBtn) statsBtn.classList.toggle('active', name === 'stats');
}

// ── Stats view ────────────────────────────────────────────────────────────
function renderStatsView() {
  const content = document.getElementById('stats-content');
  const sub     = document.getElementById('stats-sub');
  if (!entries.length) {
    content.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#4a6a8a">Aucune entrée pour analyser</div>';
    return;
  }
  sub.textContent = `Analyse de ${entries.length} entrée${entries.length>1?'s':''}`;

  // ── KPIs ──
  const totalWords = entries.reduce((s,e)=>(s + (e.content||'').trim().split(/\s+/).filter(Boolean).length),0);
  const avgWords   = Math.round(totalWords / entries.length);
  const daySet     = new Set(entries.map(e=>tsToDate(e.createdAt).toDateString()));
  let streak=0, d=new Date();
  while (daySet.has(d.toDateString())) { streak++; d.setDate(d.getDate()-1); }
  const longestStreak = calcLongestStreak();

  // ── Monthly chart (last 6 months) ──
  const monthData = [];
  for (let i=5; i>=0; i--) {
    const ref = new Date(); ref.setDate(1); ref.setMonth(ref.getMonth()-i);
    const key = `${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,'0')}`;
    const count = entries.filter(e => {
      const dd = tsToDate(e.createdAt);
      return `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}` === key;
    }).length;
    monthData.push({ lbl: ref.toLocaleDateString('fr-FR',{month:'short'}), count });
  }
  const maxM = Math.max(...monthData.map(m=>m.count), 1);

  // ── Emotion breakdown ──
  const emoCount = {};
  entries.forEach(e => { const k=e.emotion||'neutral'; emoCount[k]=(emoCount[k]||0)+1; });
  const emoSorted = Object.entries(emoCount).sort((a,b)=>b[1]-a[1]);
  const maxEmo = Math.max(...Object.values(emoCount), 1);

  // ── Domain breakdown ──
  const domCount = {};
  entries.forEach(e => { const k=e.domain||'none'; domCount[k]=(domCount[k]||0)+1; });

  const domColors  = { body:'#2dd4bf', heart:'#f87171', etre:'#a78bfa', order:'#fbbf24', none:'#6b7280' };
  const domLabels  = { body:'Corps', heart:'Cœur', etre:'Être', order:'Ordre', none:'Général' };

  content.innerHTML = `
    <!-- KPIs -->
    <div>
      <div class="stats-section-title">Vue d'ensemble</div>
      <div class="stats-kpi-row">
        <div class="kpi-card"><div class="kpi-val">${entries.length}</div><div class="kpi-label">Entrées totales</div></div>
        <div class="kpi-card"><div class="kpi-val">${streak}</div><div class="kpi-label">Série actuelle</div></div>
        <div class="kpi-card"><div class="kpi-val">${longestStreak}</div><div class="kpi-label">Meilleure série</div></div>
        <div class="kpi-card"><div class="kpi-val">${avgWords}</div><div class="kpi-label">Mots / entrée</div></div>
        <div class="kpi-card"><div class="kpi-val">${totalWords}</div><div class="kpi-label">Mots écrits</div></div>
      </div>
    </div>

    <!-- Monthly activity -->
    <div>
      <div class="stats-section-title">Activité · 6 derniers mois</div>
      <div class="months-chart">
        ${monthData.map(m=>`
          <div class="month-col">
            <div class="month-bar-bg">
              <div class="month-bar-fill" style="height:${Math.round(m.count/maxM*100)}%"></div>
            </div>
            <div class="month-label">${m.lbl}</div>
            <div class="month-count">${m.count||''}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Emotions -->
    <div>
      <div class="stats-section-title">Émotions dominantes</div>
      <div class="emo-stat-list">
        ${emoSorted.slice(0,6).map(([key,cnt])=>{
          const em = EMOTION_MAP[key] || EMOTION_MAP.neutral;
          return `<div class="emo-stat-row">
            <span class="emo-stat-label">${em.emoji} ${em.label}</span>
            <div class="emo-stat-bar-bg"><div class="emo-stat-bar-fill" style="width:${Math.round(cnt/maxEmo*100)}%"></div></div>
            <span class="emo-stat-count">${cnt}</span>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Domains -->
    <div>
      <div class="stats-section-title">Répartition par domaine</div>
      <div class="domain-stat-list">
        ${Object.entries(domCount).sort((a,b)=>b[1]-a[1]).map(([k,cnt])=>`
          <div class="domain-stat-pill">
            <div class="domain-stat-dot" style="background:${domColors[k]||'#6b7280'}"></div>
            <span class="domain-stat-name">${domLabels[k]||k}</span>
            <span class="domain-stat-cnt">${cnt}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function calcLongestStreak() {
  if (!entries.length) return 0;
  const days = [...new Set(entries.map(e => tsToDate(e.createdAt).toDateString()))].map(s=>new Date(s)).sort((a,b)=>a-b);
  let best=1, cur=1;
  for (let i=1;i<days.length;i++) {
    const diff = (days[i]-days[i-1])/(1000*60*60*24);
    if (diff===1) { cur++; best=Math.max(best,cur); } else { cur=1; }
  }
  return best;
}

const PROMPTS = [
  "Quelle est la chose la plus importante que j'ai apprise sur moi-même cette semaine ?",
  "Qu'est-ce qui m'a donné de l'énergie aujourd'hui ? Qu'est-ce qui m'en a pris ?",
  "Si je pouvais changer une seule chose de ma journée, ce serait quoi ?",
  "Quel obstacle ai-je surmonté récemment dont je suis fier(e) ?",
  "Quelle habitude je voudrais cultiver ce mois-ci, et pourquoi ?",
  "Décris un moment de la journée où tu t'es senti(e) pleinement vivant(e).",
  "Qu'est-ce que je reporte depuis trop longtemps ? Pourquoi ?",
  "Quelles sont les 3 choses pour lesquelles je suis reconnaissant(e) aujourd'hui ?",
  "Comment mon corps se sent-il en ce moment ? Qu'est-ce qu'il essaie de me dire ?",
  "Quelle peur m'empêche d'avancer vers ce que je veux vraiment ?",
  "Si j'avais tout l'argent et le temps du monde, comment passerais-je ma journée idéale ?",
  "Qu'est-ce qui me met en colère ? Qu'est-ce que ça révèle sur mes valeurs ?",
  "Qui a eu un impact positif sur moi récemment ? Est-ce que je le lui ai dit ?",
  "Quelle décision difficile dois-je prendre et qu'est-ce qui me retient ?",
  "Décris une version de toi dans 5 ans. Qu'est-ce qui a changé ?",
  "Quel est mon plus grand rêve que je n'ose pas encore avouer ?",
  "Qu'est-ce que la réussite signifie vraiment pour moi, pas pour les autres ?",
  "Dans quel domaine est-ce que je me mens à moi-même en ce moment ?",
  "Quelle relation dans ma vie mérite plus d'attention et d'énergie ?",
  "Quel conseil donnerais-je à mon moi d'il y a 10 ans ?",
  "Qu'est-ce qui m'apporte de la joie pure, sans raison particulière ?",
  "Quelle habitude toxique voudrais-je abandonner définitivement ?",
  "Comment est-ce que je prends soin de mon bien-être mental en ce moment ?",
  "Qu'est-ce que j'ai évité de ressentir cette semaine ? Pourquoi ?",
  "Quelle est la dernière fois où j'ai fait quelque chose pour la première fois ?",
  "Qu'est-ce qui compte vraiment pour moi quand je retire tout le superflu ?",
  "Comment est-ce que je réagis face à l'échec ? Est-ce que ça me convient ?",
  "Qu'est-ce que j'aurais voulu apprendre plus tôt dans ma vie ?",
  "Dans quelle situation est-ce que je me sens le plus moi-même ?",
  "Quelle limite saine est-ce que je dois poser dans ma vie en ce moment ?",
  "Qu'est-ce qui m'inspire profondément en ce moment ? Pourquoi ?",
  "Comment est-ce que je me parle à moi-même quand je fais une erreur ?",
  "Qu'est-ce que je ferais différemment si je n'avais pas peur du jugement ?",
  "Quelle est la leçon la plus précieuse que m'a apprise une douleur passée ?",
  "En quoi est-ce que je suis devenu(e) meilleur(e) cette année ?",
  "Qu'est-ce qui me donne l'impression de me trahir moi-même ?",
  "Quelles croyances limitantes est-ce que je porte depuis trop longtemps ?",
  "Comment est-ce que je veux me souvenir de cette période dans ma vie ?",
  "Qu'est-ce que j'aurais besoin d'entendre de quelqu'un en ce moment ?",
  "Si ma vie était un livre, quel titre donnerais-je à ce chapitre ?",
  "Quelle petite action concrète puis-je faire aujourd'hui pour avancer vers mon objectif ?",
  "Qu'est-ce qui me manque pour me sentir vraiment en paix avec moi-même ?"
];

function openEditor(id = null) {
  editingId = id;
  const promptDiv = document.getElementById('prompt-du-jour');
  const promptText = document.getElementById('prompt-text');
  const contentEl = document.getElementById('editor-content');
  const todayStr = capFirst(new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }));
  if (id) {
    const e = entries.find(x => x.id===id); if (!e) return;
    document.getElementById('editor-date').textContent = capFirst(tsToDate(e.createdAt).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }));
    document.getElementById('editor-title').value = e.title || '';
    contentEl.value = e.content || '';
    setEmotion(e.emotion || 'neutral');
    setDomain(e.domain || 'none');
    if (promptDiv) promptDiv.style.display = 'none';
  } else {
    document.getElementById('editor-date').textContent = todayStr;
    // Restore draft if exists for a new entry (not editing)
    const draft = (() => { try { const d = localStorage.getItem(DRAFT_KEY); return d ? JSON.parse(d) : null; } catch(e) { return null; } })();
    if (draft && !draft.editingId) {
      document.getElementById('editor-title').value = draft.title || '';
      contentEl.value = draft.content || '';
      setEmotion(draft.emotion || 'neutral'); setDomain(draft.domain || 'none');
      selEmotion = draft.emotion || 'neutral'; selDomain = draft.domain || 'none';
      if (promptDiv) promptDiv.style.display = 'none';
    } else {
      document.getElementById('editor-title').value = '';
      contentEl.value = '';
      setEmotion('neutral'); setDomain('none');
      selEmotion = 'neutral'; selDomain = 'none';
      // Show daily prompt (cycles by day)
      if (promptDiv && promptText) {
        const dayIndex = Math.floor(Date.now() / 86400000) % PROMPTS.length;
        promptText.textContent = PROMPTS[dayIndex];
        promptDiv.style.display = 'block';
        promptDiv.onclick = () => {
          contentEl.value = PROMPTS[dayIndex] + '\n\n';
          promptDiv.style.display = 'none';
          contentEl.focus();
          updateWC();
        };
      }
    }
  }
  updateWC(); showView('editor');
  setTimeout(() => contentEl.focus(), 80);
}

function openReadView(id) {
  readId = id;
  const e = entries.find(x => x.id===id); if (!e) return;
  const ts = tsToDate(e.createdAt);
  const emo = EMOTION_MAP[e.emotion] || EMOTION_MAP.neutral;
  const dm  = DOMAINS.find(x => x.key===(e.domain||'none'));
  const wc  = (e.content||'').trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('read-title').textContent = e.title || 'Entrée sans titre';
  document.getElementById('read-date').textContent = ts.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) + ' · ' + ts.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  document.getElementById('read-emotion-badge').textContent = `${emo.emoji} ${emo.label}`;
  const domColor = DOMAIN_COLORS[e.domain || 'none'];
  document.getElementById('read-domain-badge').innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:${domColor};display:inline-block"></span>${dm ? dm.label : 'Général'}</span>`;
  document.getElementById('read-word-count').textContent = `${wc} mot${wc!==1?'s':''}`;
  document.getElementById('read-domain-bar').style.background = `linear-gradient(90deg, ${domColor}, transparent)`;
  document.getElementById('read-content').textContent = e.content || '';
  // Show "modifié" badge if updatedAt differs meaningfully from createdAt
  const badge = document.getElementById('read-edited-badge');
  const createdTs = tsToDate(e.createdAt).getTime();
  const updatedTs = e.updatedAt ? tsToDate(e.updatedAt).getTime() : createdTs;
  badge.style.display = Math.abs(updatedTs - createdTs) > 5000 ? 'inline' : 'none';
  renderList();
  showView('read');
}

// ── Word count + draft autosave ────────────────────────────────────────────
const DRAFT_KEY = 'cyf_journal_draft';
function updateWC() {
  const wc = (document.getElementById('editor-content').value||'').trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('wc-label').textContent = `${wc} mot${wc!==1?'s':''}`;
  // Fill bar: 0-300 words = 0-100%
  const pct = Math.min(100, Math.round(wc / 3));
  document.getElementById('wc-bar').style.width = pct + '%';
}
function saveDraft() {
  const title = document.getElementById('editor-title').value;
  const content = document.getElementById('editor-content').value;
  if (!title && !content) { localStorage.removeItem(DRAFT_KEY); return; }
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content, editingId, emotion: selEmotion, domain: selDomain, ts: Date.now() }));
}
document.getElementById('editor-content').addEventListener('input', () => { updateWC(); saveDraft(); });
document.getElementById('editor-title').addEventListener('input', saveDraft);

// ── Save entry ─────────────────────────────────────────────────────────────
const btnSave = document.getElementById('btn-save-entry');
btnSave.addEventListener('click', async () => {
  if (btnSave.disabled) return;
  const title   = document.getElementById('editor-title').value.trim();
  const content = document.getElementById('editor-content').value.trim();
  if (!content && !title) { document.getElementById('editor-content').focus(); return; }
  btnSave.disabled = true; btnSave.textContent = 'Sauvegarde…';
  const id = editingId || `e_${Date.now()}`;
  const existing = editingId ? entries.find(x => x.id===id) : null;
  const data = { id, title, content, emotion: selEmotion, domain: selDomain, userId: uid, createdAt: existing?.createdAt || serverTimestamp(), updatedAt: serverTimestamp() };
  try {
    await setDoc(doc(journalCol(), id), data, { merge: true });
    if (!editingId) {
      entries.unshift({ ...data, createdAt: { toDate: () => new Date() } });
      // Award XP for journaling (10 XP to matching domain) via Cloud Function
      try {
        const xpKey = selDomain === 'none' ? 'etre' : selDomain;
        await window._cyfFirebase.awardXp(xpKey, 10);
        try { showXpFloat(10, document.getElementById('btn-save-entry')); } catch(e) {}
      } catch(_) {}
    } else {
      const idx = entries.findIndex(x => x.id===id);
      if (idx !== -1) entries[idx] = { ...data, createdAt: entries[idx].createdAt };
    }
    localStorage.removeItem(DRAFT_KEY);
    editingId = null; readId = id;
    renderList(); renderMoodChart();
    showToast('Entrée sauvegardée ✓');
    openReadView(id);
  } catch(e) { console.error(e); showToast('Erreur lors de la sauvegarde', true); }
  finally { btnSave.disabled = false; btnSave.textContent = 'Sauvegarder'; }
});

// ── Delete entry (2-step confirm) ──────────────────────────────────────────
const btnDel = document.getElementById('btn-delete-entry');
btnDel.dataset.pending = '0';
btnDel.addEventListener('click', async () => {
  if (!readId) return;
  if (btnDel.dataset.pending !== '1') {
    btnDel.dataset.pending = '1'; btnDel.textContent = 'Confirmer la suppression ?';
    setTimeout(() => { if (btnDel.dataset.pending === '1') { btnDel.dataset.pending = '0'; btnDel.textContent = 'Supprimer'; } }, 3000);
    return;
  }
  btnDel.dataset.pending = '0'; btnDel.textContent = 'Supprimer';
  try {
    await deleteDoc(doc(journalCol(), readId));
    entries = entries.filter(e => e.id !== readId);
    readId = null; renderList(); renderMoodChart(); showView('empty');
    showToast('Entrée supprimée');
  } catch(e) { console.error(e); }
});

// ── Keyboard shortcut: Ctrl+S to save while editor is open ─────────────────
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    const editorVisible = document.getElementById('view-editor').style.display !== 'none';
    if (editorVisible) { e.preventDefault(); btnSave.click(); }
  }
});

// ── Search & filter wiring ─────────────────────────────────────────────────
const searchInput = document.getElementById('journal-search');
const searchClear = document.getElementById('search-clear');
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  searchClear.style.display = searchQuery ? 'block' : 'none';
  renderList();
});
searchClear.addEventListener('click', () => { searchQuery = ''; searchInput.value = ''; searchClear.style.display = 'none'; renderList(); });

// ── Export JSON ────────────────────────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', () => {
  if (!entries.length) { showToast('Aucune entrée à exporter.', true); return; }
  const data = entries.map(e => ({
    id: e.id,
    title: e.title || '',
    content: e.content || '',
    emotion: e.emotion || '',
    domain: e.domain || '',
    createdAt: tsToDate(e.createdAt).toISOString(),
    updatedAt: e.updatedAt ? tsToDate(e.updatedAt).toISOString() : null,
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `journal-cyf-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${data.length} entrées exportées`);
});

// ── Button wiring ──────────────────────────────────────────────────────────
document.getElementById('btn-new-entry').addEventListener('click', () => { readId = null; openEditor(null); });
document.getElementById('btn-cancel-edit').addEventListener('click', () => { localStorage.removeItem(DRAFT_KEY); editingId = null; showView(readId ? 'read' : 'empty'); if (readId) openReadView(readId); });
document.getElementById('btn-edit-entry').addEventListener('click', () => { if (readId) openEditor(readId); });

// ── Helpers ────────────────────────────────────────────────────────────────
function tsToDate(ts) { return ts?.toDate ? ts.toDate() : new Date(ts || Date.now()); }
function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function showToast(msg, err = false) {
  const t = document.getElementById('toast'); t.textContent = msg;
  t.className = `toast${err?' error':''} show`;
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Stats toggle ──────────────────────────────────────────────────────────
document.getElementById('btn-stats-toggle').addEventListener('click', () => {
  const isActive = document.getElementById('view-stats').classList.contains('active');
  if (isActive) {
    showView(readId ? 'read' : 'empty');
  } else {
    renderStatsView();
    showView('stats');
  }
});

// ── Init: show empty state ─────────────────────────────────────────────────
showView('empty');
