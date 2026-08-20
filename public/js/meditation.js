// /meditation/ - sessions guidées + respiration + sons d'ambiance + stats.
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { updateGlobalAvatar } from '/js/common.js';
import { showXpFloat } from '/js/xp.js';
import { initUserMenu } from '/js/userMenu.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { SCRIPTS, reflectionScript, createVoice, createGuide } from '/js/meditation-guide.js';
import { classify } from '/js/organizer-data.js';

let auth, db;
if (window._cyfFirebase) {
  ({ auth, db } = window._cyfFirebase);
} else {
  await import('/js/firebase.js');
  ({ auth, db } = window._cyfFirebase);
}

try { initUserMenu(); } catch(e) {}

window.addEventListener('DOMContentLoaded', () => {
  try { updateGlobalAvatar(); } catch(e){}
});

const sessions = [
  { id:'calm',      title:'Calme & Sérénité',       desc:'Apaise ton esprit, relâche les tensions',       duration:5,  icon:'🌊', type:'guided',    color:'#44bd48' },
  { id:'focus',     title:'Focus & Concentration',   desc:'Clarifie ton mental, améliore ta productivité', duration:10, icon:'🎯', type:'guided',    color:'#6cb43f' },
  { id:'sleep',     title:'Sommeil profond',          desc:'Prépare-toi à une nuit réparatrice',           duration:15, icon:'🌙', type:'guided',    color:'#bdafd6' },
  { id:'gratitude', title:'Gratitude & Positivité',  desc:'Cultive la reconnaissance et la joie',          duration:7,  icon:'✨', type:'guided',    color:'#fbbf24' },
  { id:'breathing', title:'Respiration 4-7-8',       desc:'Technique rapide pour réduire le stress',       duration:5,  icon:'💨', type:'breathing', color:'#a4d486' },
  { id:'coherence', title:'Cohérence cardiaque',      desc:'5 s inspire, 5 s expire - apaise le système nerveux', duration:5, icon:'🫁', type:'breathing', color:'#4fc153',
    pattern:[ { text:'Inspire doucement…', label:'Inspiration', cls:'inhale', duration:5000, dot:0 }, { text:'Expire doucement…', label:'Expiration', cls:'exhale', duration:5000, dot:2 } ] },
  { id:'sos',       title:'SOS stress',               desc:'3 minutes pour redescendre, tout de suite',     duration:3,  icon:'🆘', type:'breathing', color:'#fb7185' },
  { id:'body-scan', title:'Scan corporel',            desc:'Relâche chaque partie de ton corps',            duration:12, icon:'🧘', type:'guided',    color:'#f87171' },
  { id:'philo',     title:'Réflexion philosophique',  desc:'Une question à contempler en silence',          duration:8,  icon:'🌌', type:'reflection',color:'#d6cde5' },
  { id:'nature',    title:'Évasion nature',           desc:'Laisse un paysage t\'emporter au calme',        duration:10, icon:'🏞️', type:'guided',    color:'#34d399' },
  { id:'custom',    title:'Durée personnalisée',      desc:'Choisis ton propre rythme',                     duration:20, icon:'⏱️', type:'guided',    color:'#34d399' },
];

// Questions de réflexion (mode philosophique) - une au hasard à la sélection.
const REFLECTIONS = [
  "Qu'est-ce qui compte vraiment pour toi, aujourd'hui ?",
  "De quoi peux-tu te libérer pour avancer plus léger ?",
  "Quelle serait la version de toi dont tu serais fier dans 10 ans ?",
  "Qu'as-tu accompli récemment que tu n'as pas pris le temps de célébrer ?",
  "Si la peur n'existait pas, que ferais-tu dès demain ?",
  "Pour quoi, parmi ce que tu as, ressens-tu de la gratitude là maintenant ?",
];

let currentSession = null;
let timer = null;
let elapsed = 0;
let paused = false;
let uid = null;
let breathingActive = false;

// ── Ambient sound engine (Web Audio API) ─────────────────────────────────
let ambCtx = null, ambGain = null, ambNodes = [];
let currentAmbient = 'none';

function getAmbCtx() {
  if (!ambCtx) { ambCtx = new (window.AudioContext || window.webkitAudioContext)(); }
  return ambCtx;
}

function stopAmbient() {
  ambNodes.forEach(n => { try { n.stop(); } catch(e){} try { n.disconnect(); } catch(e){} });
  ambNodes = [];
  if (ambGain) { try { ambGain.disconnect(); } catch(e){} ambGain = null; }
}

function startAmbient(type) {
  stopAmbient();
  if (type === 'none') return;
  const ctx = getAmbCtx();
  if (ctx.state === 'suspended') ctx.resume();
  ambGain = ctx.createGain();
  const vol = (document.getElementById('amb-volume')?.value || 40) / 100 * 0.6;
  ambGain.gain.setValueAtTime(vol, ctx.currentTime);
  ambGain.connect(ctx.destination);

  if (type === 'white') {
    const buf = createNoiseBuf(ctx, 3);
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1800;
    src.connect(filter); filter.connect(ambGain); src.start();
    ambNodes = [src];
  } else if (type === 'rain') {
    // Rain = white noise + lowpass + LFO for intensity variation
    const buf = createNoiseBuf(ctx, 3);
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 600; filter.Q.value = 0.8;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.3;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain); lfoGain.connect(ambGain.gain);
    src.connect(filter); filter.connect(ambGain); src.start(); lfo.start();
    ambNodes = [src, lfo];
  } else if (type === 'ocean') {
    // Ocean = noise + very slow LFO (wave rhythm)
    const buf = createNoiseBuf(ctx, 5);
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 400;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.1;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain); lfoGain.connect(ambGain.gain);
    src.connect(filter); filter.connect(ambGain); src.start(); lfo.start();
    // Add a second layer
    const buf2 = createNoiseBuf(ctx, 3);
    const src2 = ctx.createBufferSource(); src2.buffer = buf2; src2.loop = true;
    const f2 = ctx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 800;
    const g2 = ctx.createGain(); g2.gain.value = 0.15;
    src2.connect(f2); f2.connect(g2); g2.connect(ambGain); src2.start();
    ambNodes = [src, src2, lfo];
  } else if (type === 'forest') {
    // Forest = filtered noise + occasional chirp tones
    const buf = createNoiseBuf(ctx, 4);
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1200; filter.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0.3;
    src.connect(filter); filter.connect(g); g.connect(ambGain); src.start();
    // Periodic bird chirp
    function chirp() {
      const o = ctx.createOscillator(); const og = ctx.createGain();
      o.frequency.value = 1800 + Math.random() * 1200;
      o.type = 'sine'; og.gain.setValueAtTime(0.12, ctx.currentTime);
      og.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      o.connect(og); og.connect(ambGain); o.start(); o.stop(ctx.currentTime + 0.3);
    }
    const iv = setInterval(() => { if (ambNodes.length && ambCtx) chirp(); else clearInterval(iv); }, 1500 + Math.random()*2000);
    ambNodes = [src];
  }
}

function createNoiseBuf(ctx, seconds) {
  const sr = ctx.sampleRate, len = sr * seconds;
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// Wire sound buttons
document.querySelectorAll('.amb-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.amb-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentAmbient = btn.dataset.sound;
    if (timer) startAmbient(currentAmbient); // only start if session active
  });
});
document.getElementById('amb-volume')?.addEventListener('input', e => {
  if (ambGain) ambGain.gain.setValueAtTime((e.target.value / 100) * 0.6, getAmbCtx().currentTime);
});

function showToast(msg, err = false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast${err?' error':''} show`;
  setTimeout(() => t.classList.remove('show'), 2800);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  uid = user.uid;
  renderSessions();
  initCylWelcome();
  await loadStats();
  await initFromMood();
});


// ── CE QUE LE SITE SAIT DEJA ────────────────────────────────────────────────
// Le module demandait « comment te sens-tu ? » alors que /humeur/ avait la
// reponse depuis le matin. C'est le defaut de fond du site : treize modules
// qui ne se lisent pas entre eux. Ici on lit l'humeur du jour, et CYL part de
// la - une proposition, jamais une prescription (regle non-directif).
const MOOD_BY_SCORE = {
  1: { id: 'sos',       line: 'Tu as noté une journée dure ce matin. Si tu veux, trois minutes pour faire redescendre la pression.' },
  2: { id: 'gratitude', line: 'Ce matin, ça n’allait pas fort. Une parenthèse de gratitude, si le cœur t’en dit.' },
  3: { id: 'calm',      line: 'Journée moyenne, d’après ce que tu as noté. Une séance calme peut aider à y voir clair.' },
  4: { id: 'focus',     line: 'Tu allais plutôt bien ce matin. C’est un bon moment pour travailler ton attention.' },
  5: { id: 'calm',      line: 'Belle journée, d’après toi. Autant ancrer ce calme pendant qu’il est là.' },
};

async function readTodayMood() {
  try {
    // MEME construction que /humeur/ (humeur.js, todayDateStr) : la cle du
    // document EST la date, une divergence d'un caractere et on ne lirait
    // jamais rien, en silence. Pas de toISOString ici - il bascule en UTC et
    // ferait lire la veille en soiree.
    const n = new Date();
    const key = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
    const snap = await getDoc(doc(db, 'users', uid, 'moods', key));
    return snap.exists() ? snap.data() : null;
  } catch (_) { return null; }
}

async function initFromMood() {
  const m = await readTodayMood();
  if (!m) return;                       // rien note aujourd'hui : on ne suppose rien
  const line = document.getElementById('la-line');

  // La note ecrite passe avant le score : « 8/10 mais j'en peux plus » doit
  // etre entendu comme de la detresse, pas comme une bonne journee.
  let reco = MOOD_BY_SCORE[Number(m.mood)] || null;
  if (m.note) {
    try {
      const r = classify(String(m.note));
      if (r.crisis || r.distress) {
        reco = { id: 'sos', line: 'J’ai lu ce que tu as écrit ce matin. On peut commencer par respirer, simplement. Trois minutes.' };
      }
    } catch (_) {}
  }
  if (!reco) return;

  const s = sessions.find((x) => x.id === reco.id);
  if (!s) return;
  if (line) line.textContent = reco.line;
  // Pre-selectionnee, PAS lancee : c'est une porte ouverte, pas une poussee.
  selectSession(s);
}

// Accueil CYL : selon l'humeur, recommande un mode et le pré-charge.
const MOOD_RECO = {
  stress:  { id: 'sos',       line: 'Respirons. 3 minutes pour faire redescendre la pression - je te guide.' },
  agite:   { id: 'coherence', line: 'On apaise le système nerveux : cohérence cardiaque, 5 minutes.' },
  fatigue: { id: 'sleep',     line: 'Accorde-toi du repos. Une descente douce vers le sommeil.' },
  triste:  { id: 'gratitude', line: 'Ramenons un peu de lumière - une parenthèse de gratitude.' },
  sens:    { id: 'philo',     line: 'Prends un instant pour réfléchir. Une question, et le silence.' },
  bien:    { id: 'calm',      line: "Profitons-en pour ancrer ce calme. Une séance sérénité ?" },
};
function initCylWelcome() {
  document.querySelectorAll('#la-moods button').forEach((b) => {
    b.addEventListener('click', () => {
      const reco = MOOD_RECO[b.dataset.mood];
      if (!reco) return;
      const line = document.getElementById('la-line');
      if (line) line.textContent = reco.line;
      const s = sessions.find((x) => x.id === reco.id);
      if (s) { selectSession(s); document.getElementById('player')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
  });
}

function renderSessions() {
  const grid = document.getElementById('sessions-grid');
  grid.innerHTML = sessions.map(s => `
    <div class="session-card" data-id="${s.id}" style="--card-color:${s.color}">
      <div class="session-duration">${s.id === 'custom' ? '?' : s.duration} min</div>
      <div class="session-icon">${s.icon}</div>
      <div class="session-title">${s.title}</div>
      <div class="session-desc">${s.desc}</div>
    </div>
  `).join('');
  grid.querySelectorAll('.session-card').forEach(card => {
    card.addEventListener('click', () => {
      const s = sessions.find(x => x.id === card.dataset.id);
      if (s.id === 'custom') {
        // Toggle custom duration panel
        document.querySelectorAll('.session-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const wrap = document.getElementById('custom-dur-wrap');
        wrap.classList.toggle('open');
      } else {
        document.getElementById('custom-dur-wrap').classList.remove('open');
        selectSession(s);
      }
    });
  });
}

// Custom duration confirm
document.getElementById('custom-dur-confirm').addEventListener('click', () => {
  const val = parseInt(document.getElementById('custom-dur-input').value) || 20;
  const clamped = Math.max(1, Math.min(120, val));
  const customSession = { ...sessions.find(s => s.id === 'custom'), duration: clamped, title: `Session ${clamped} min` };
  document.getElementById('custom-dur-wrap').classList.remove('open');
  selectSession(customSession);
});
document.getElementById('custom-dur-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('custom-dur-confirm').click();
});

function selectSession(session) {
  // Stop any running session first
  if (timer) { clearInterval(timer); timer = null; }
  breathingActive = false;
  voice.stop();
  guide.reset();
  currentSession = session;
  document.querySelectorAll('.session-card').forEach(c => c.classList.remove('active', 'playing'));
  document.querySelector(`[data-id="${session.id}"]`)?.classList.add('active');
  document.getElementById('player-title').textContent = session.title;
  if (session.type === 'reflection') {
    const q = REFLECTIONS[Math.floor(Math.random() * REFLECTIONS.length)];
    currentSession = { ...session, _prompt: q };
    document.getElementById('player-subtitle').textContent = '« ' + q + ' »';
  } else {
    document.getElementById('player-subtitle').textContent = session.desc;
  }
  const min = String(session.duration).padStart(2,'0');
  document.getElementById('timer').textContent = `${min}:00`;
  document.getElementById('player').classList.add('active');
  elapsed = 0; paused = false;
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  btnStart.style.display = 'inline-block'; btnStart.textContent = 'Démarrer';
  btnPause.style.display = 'none'; btnPause.textContent = 'Pause';
  btnPause.classList.remove('pause-active');
  document.getElementById('breathing-guide').classList.remove('active');
  resetTimerUI();
}


// ── GUIDAGE ─────────────────────────────────────────────────────────────────
// Une seance « guidee » qui ne dit rien n'est qu'un minuteur : c'est ce qui
// faisait que personne ne revenait. La voix et le texte arrivent maintenant
// aux bons moments, calcules sur la duree reelle de la seance.
const voice = createVoice();
const guide = createGuide({
  voice,
  onLine(text) {
    const el = document.getElementById('guide-line');
    if (!el) return;
    if (!text) { el.classList.remove('in'); el.textContent = ''; return; }
    // On retire la classe, on laisse un cadre s'ecouler, on la remet : sans ce
    // temps mort le navigateur ne rejoue pas la transition et la phrase change
    // d'un coup sec.
    el.classList.remove('in');
    requestAnimationFrame(() => {
      el.textContent = text;
      requestAnimationFrame(() => el.classList.add('in'));
    });
  },
});

// Le choix de couper la voix survit au rechargement : quelqu'un qui medite au
// bureau ne veut pas le redecocher chaque jour.
try { voice.setMuted(localStorage.getItem('cyl-med-mute') === '1'); } catch (_) {}

function syncVoiceBtn() {
  const b = document.getElementById('btn-voice');
  if (!b) return;
  if (!voice.available) { b.style.display = 'none'; return; }
  const m = voice.isMuted();
  b.classList.toggle('off', m);
  b.textContent = m ? '🔇 Voix' : '🔊 Voix';
  b.setAttribute('aria-pressed', String(!m));
}
document.getElementById('btn-voice')?.addEventListener('click', () => {
  voice.setMuted(!voice.isMuted());
  try { localStorage.setItem('cyl-med-mute', voice.isMuted() ? '1' : '0'); } catch (_) {}
  syncVoiceBtn();
});
syncVoiceBtn();

// Le script depend du type de seance : les respirations ont deja leur rythme
// visuel, la reflexion se construit autour de la question tiree.
function scriptFor(session) {
  if (!session) return [];
  if (session.type === 'reflection') return reflectionScript(session._prompt || '');
  if (session.type === 'breathing') return SCRIPTS.breathing;
  return SCRIPTS[session.id] || SCRIPTS.calm;   // une duree perso suit le calme
}

document.getElementById('btn-start').addEventListener('click', startSession);
document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-stop').addEventListener('click', stopSession);

function startSession() {
  if (!currentSession) return;
  paused = false;
  startAmbient(currentAmbient);
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  btnStart.style.display = 'none';
  btnPause.style.display = 'inline-block';
  btnPause.classList.remove('pause-active');
  document.querySelector(`[data-id="${currentSession.id}"]`)?.classList.add('playing');
  if (currentSession.type === 'breathing') {
    document.getElementById('breathing-guide').classList.add('active');
    breathingActive = true;
    startBreathingCycle();
  }
  const totalSec = currentSession.duration * 60;
  // Le guide est nourri par CE minuteur, il n'en tient pas un second : deux
  // horloges auraient derive l'une de l'autre et le texte se serait decale.
  guide.load(scriptFor(currentSession), totalSec);
  guide.tick(0);
  timer = setInterval(() => {
    if (paused) return;
    elapsed++;
    guide.tick(elapsed);
    const remaining = totalSec - elapsed;
    if (remaining <= 0) { completeSession(); return; }
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    document.getElementById('timer').textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    // Update ring progress (circumference ≈ 440 for r=70)
    const pct = elapsed / totalSec;
    document.getElementById('timer-ring-fill').style.strokeDashoffset = 440 * (1 - pct);
  }, 1000);
}

function togglePause() {
  paused = !paused;
  // Sans ceci, la phrase en cours continue de se dire alors que la seance est
  // arretee - et reprend au milieu d'un mot au moment de repartir.
  if (paused) voice.stop(); else guide.seek(elapsed);
  const btn = document.getElementById('btn-pause');
  btn.textContent = paused ? 'Reprendre' : 'Pause';
  btn.classList.toggle('pause-active', paused);
}

function resetTimerUI() {
  document.getElementById('timer-ring-fill').style.strokeDashoffset = 440;
  document.getElementById('timer-label').textContent = 'restant';
  document.getElementById('breathing-rings')?.classList.remove('inhale','hold','exhale');
}

function stopSession() {
  clearInterval(timer); timer = null;
  stopAmbient();
  voice.stop();
  guide.reset();
  breathingActive = false;
  elapsed = 0; paused = false;
  document.getElementById('btn-start').style.display = 'inline-block';
  document.getElementById('btn-pause').style.display = 'none';
  document.getElementById('btn-pause').classList.remove('pause-active');
  document.getElementById('breathing-guide').classList.remove('active');
  document.querySelectorAll('.session-card').forEach(c => c.classList.remove('playing'));
  resetTimerUI();
  if (currentSession) {
    const min = String(currentSession.duration).padStart(2,'0');
    document.getElementById('timer').textContent = `${min}:00`;
  }
}

async function completeSession() {
  clearInterval(timer); timer = null;
  stopAmbient();
  // « Sommeil profond » se termine SANS rien dire : reveiller quelqu'un pour
  // lui annoncer que sa seance d'endormissement est finie serait absurde.
  if (currentSession && currentSession.id === 'sleep') { voice.stop(); guide.reset(); }
  breathingActive = false;
  document.getElementById('timer').textContent = '✓';
  document.getElementById('timer-label').textContent = 'Terminé !';
  document.getElementById('timer-ring-fill').style.strokeDashoffset = 0;
  document.getElementById('btn-start').style.display = 'inline-block';
  document.getElementById('btn-pause').style.display = 'none';
  document.getElementById('btn-pause').classList.remove('pause-active');
  document.getElementById('breathing-guide').classList.remove('active');
  document.getElementById('breathing-rings')?.classList.remove('inhale','hold','exhale');
  document.querySelectorAll('.session-card').forEach(c => c.classList.remove('playing'));
  showToast(`Session terminée - ${currentSession.duration} min ✓`);
  const _la = document.getElementById('la-line');
  if (_la) _la.textContent = 'Belle séance 🌿 Prends un instant - comment te sens-tu maintenant ?';
  try { showXpFloat(15, document.getElementById('timer')); } catch(e) {}

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(doc(db, 'users', uid));
    const med = snap.exists() ? (snap.data().meditation || {}) : {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const lastDay = med.lastSessionAt ? new Date(med.lastSessionAt).toDateString() : null;
    let streak = med.streak || 0;
    if (lastDay === today) { /* already practiced today */ }
    else if (lastDay === yesterday) { streak += 1; }
    else { streak = 1; }

    // Save to history (keep last 20)
    const historyEntry = { title: currentSession.title, icon: currentSession.icon, duration: currentSession.duration, completedAt: Date.now() };
    const history = (med.history || []).slice(0, 19);
    history.unshift(historyEntry);

    await updateDoc(userRef, {
      'meditation.totalSessions': increment(1),
      'meditation.totalMinutes': increment(currentSession.duration),
      'meditation.lastSessionAt': Date.now(),
      'meditation.streak': streak,
      'meditation.history': history,
    });
    try { await window._cyfFirebase.awardXp('body', 15); } catch(_){}
    await loadStats();
  } catch(e) {
    try {
      const userRef = doc(db, 'users', uid);
      const historyEntry = { title: currentSession.title, icon: currentSession.icon, duration: currentSession.duration, completedAt: Date.now() };
      await setDoc(userRef, { meditation: { totalSessions:1, totalMinutes:currentSession.duration, lastSessionAt:Date.now(), streak:1, history:[historyEntry] }}, {merge:true});
      try { await window._cyfFirebase.awardXp('body', 15); } catch(_){}
      await loadStats();
    } catch(e2) {}
  }
}

async function loadStats() {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const med = snap.data().meditation || {};
      document.getElementById('stat-total').textContent = med.totalSessions || 0;
      const mins = med.totalMinutes || 0;
      document.getElementById('stat-time').textContent = mins >= 60 ? `${Math.floor(mins/60)}h${mins%60?` ${mins%60}m`:''}` : `${mins} min`;
      document.getElementById('stat-streak').textContent = calculateStreak(med);
      renderHistory(med.history || []);
    }
  } catch(e) {}
}

function renderHistory(history) {
  const section = document.getElementById('history-section');
  const list    = document.getElementById('history-list');
  if (!history.length) { section.style.display='none'; return; }
  section.style.display = 'block';
  list.innerHTML = history.slice(0,8).map(h => {
    const d = new Date(h.completedAt);
    const isToday = d.toDateString() === new Date().toDateString();
    const isYesterday = d.toDateString() === new Date(Date.now()-86400000).toDateString();
    const dateStr = isToday ? `Aujourd'hui · ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}` : isYesterday ? `Hier · ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}` : d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
    return `<div class="history-item">
      <div class="history-icon">${h.icon||'🧘'}</div>
      <div class="history-info">
        <div class="history-name">${h.title}</div>
        <div class="history-date">${dateStr}</div>
      </div>
      <div class="history-dur">${h.duration} min</div>
    </div>`;
  }).join('');
}

function calculateStreak(med) {
  if (!med || !med.lastSessionAt) return 0;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const lastDay = new Date(med.lastSessionAt).toDateString();
  if (lastDay === today || lastDay === yesterday) return med.streak || 1;
  return 0;
}

function startBreathingCycle() {
  const phases = (currentSession && Array.isArray(currentSession.pattern) && currentSession.pattern.length)
    ? currentSession.pattern
    : [
      { text: 'Inspire profondément…', label: 'Inspiration', cls: 'inhale', duration: 4000, dot: 0 },
      { text: 'Retiens ta respiration…', label: 'Rétention', cls: 'hold', duration: 7000, dot: 1 },
      { text: 'Expire lentement…', label: 'Expiration', cls: 'exhale', duration: 8000, dot: 2 }
    ];
  let idx = 0;
  const rings = document.getElementById('breathing-rings');
  const cycle = () => {
    if (!breathingActive) return;
    if (paused) { setTimeout(cycle, 500); return; }
    const p = phases[idx];
    document.getElementById('breathing-text').textContent = p.text;
    document.getElementById('breathing-phase-label').textContent = p.label;
    // Update rings class
    if (rings) { rings.classList.remove('inhale','hold','exhale'); rings.classList.add(p.cls); }
    // Update progress dots
    document.querySelectorAll('.bp-dot').forEach((d,i) => d.classList.toggle('active', i === p.dot));
    const dur = p.duration;
    idx = (idx + 1) % phases.length;
    setTimeout(cycle, dur);
  };
  cycle();
}
