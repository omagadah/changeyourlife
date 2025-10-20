// Agent Builder integration + Life Model persistence
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable, getFunctions } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

let app, auth, db, functions;
if (!window._cyfFirebase) {
  const firebaseConfig = {
    apiKey: "AIzaSyCvEtaivyC5QD0dGyPKh97IgYU8U8QrrWg",
    authDomain: "changeyourlife-cc210.firebaseapp.com",
    projectId: "changeyourlife-cc210",
    storageBucket: "changeyourlife-cc210.appspot.com",
    messagingSenderId: "801720080785",
    appId: "1:801720080785:web:1a74aadba5755ea26c2230"
  };
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  window._cyfFirebase = { app, auth, db };
} else {
  ({ app, auth, db } = window._cyfFirebase);
  try { functions = getFunctions(app); } catch (e) {}
}

const $ = (id) => document.getElementById(id);
const progressBar = $('lm-progress');
const progressLabel = $('lm-progress-label');
const saveBtn = $('lm-save');

// Keep previous state to award XP only on improvements
let prevLm = null;
let prevProgress = 0;
// Baseline used for XP awards so autosave doesn't wipe improvements
let awardBaseLm = null;
let awardBaseProgress = 0;
let currentUID = null;
let saveDebounce = null;

function notify(msg) {
  const id = 'cyf-agent-toast';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:12005;display:flex;flex-direction:column;gap:10px;';
    document.body.appendChild(el);
  }
  const card = document.createElement('div');
  card.style.cssText = 'background:rgba(20,20,20,0.92);color:#e5eef8;border:1px solid rgba(255,255,255,0.12);padding:10px 12px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.4);max-width:320px;font-weight:600';
  card.textContent = msg;
  el.appendChild(card);
  setTimeout(() => { try { el.removeChild(card); if (!el.childElementCount) el.remove(); } catch(e){} }, 3000);
}

const fields = [
  'maslow-physio-score','maslow-physio-notes',
  'maslow-security-score','maslow-security-notes',
  'maslow-love-score','maslow-love-notes',
  'maslow-esteem-score','maslow-esteem-notes',
  'maslow-actual-score','maslow-actual-notes',
  'id-vision','id-values','id-strengths','goals-short','goals-long'
];

function calcProgress(lm) {
  // Very simple progress metric: each score filled + note/field increases progress
  const totalSlots = 5 /*scores*/ + 10 /*notes & identity*/;
  let count = 0;
  const scoreKeys = ['maslow-physio-score','maslow-security-score','maslow-love-score','maslow-esteem-score','maslow-actual-score'];
  scoreKeys.forEach(k => { if (Number(lm[k] ?? 0) > 0) count++; });
  ['maslow-physio-notes','maslow-security-notes','maslow-love-notes','maslow-esteem-notes','maslow-actual-notes','id-vision','id-values','id-strengths','goals-short','goals-long']
    .forEach(k => { if ((lm[k]||'').trim().length >= 10) count++; });
  const pct = Math.round((count / totalSlots) * 100);
  return Math.min(100, Math.max(0, pct));
}

function reflectProgress(pct) {
  if (progressBar) progressBar.style.width = pct + '%';
  if (progressLabel) progressLabel.textContent = pct + '%';
}

async function loadLifeModel(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? (snap.data() || {}) : {};
  const lm = data.lifeModel || {};
  // preload fields
  fields.forEach(fid => {
    const el = $(fid);
    if (!el) return;
    const v = lm[fid];
    if (typeof v === 'number') el.value = String(v);
    else if (typeof v === 'string') el.value = v;
  });
  const pct = calcProgress(lm);
  reflectProgress(pct);
  // store previous for delta comparison on next save
  prevLm = { ...lm };
  prevProgress = pct;
  // initialize award baseline on first load
  awardBaseLm = { ...lm };
  awardBaseProgress = pct;
}

async function saveLifeModel(uid, { awardXp = true } = {}) {
  const lm = {};
  fields.forEach(fid => {
    const el = $(fid); if (!el) return;
    lm[fid] = el.type === 'range' ? Number(el.value || 0) : (el.value || '').trim();
  });
  const pct = calcProgress(lm);
  reflectProgress(pct);

  await setDoc(doc(db,'users',uid), { lifeModel: lm, lifeModelProgress: pct, lifeModelUpdatedAt: serverTimestamp() }, { merge: true });

  // Map progress to domain levels bonus (example heuristic)
  // body <- physio/security, heart <- love, etre <- esteem/actual, order <- goals/notes completeness
  try {
    if (!functions) functions = getFunctions(app);
    const addXp = httpsCallable(functions, 'addXp');
    const bonuses = [];

    if (awardXp) {
      // Compute vs award baseline (not modified by autosave)
      const p = awardBaseLm || {};
      const physioSecNow = Number(lm['maslow-physio-score']||0) + Number(lm['maslow-security-score']||0);
      const physioSecPrev = Number(p['maslow-physio-score']||0) + Number(p['maslow-security-score']||0);
      if (physioSecNow - physioSecPrev >= 1) bonuses.push(['body', 5]);

      const loveNow = Number(lm['maslow-love-score']||0);
      const lovePrev = Number(p['maslow-love-score']||0);
      if (loveNow - lovePrev >= 1) bonuses.push(['heart', 5]);

      const etreNow = Number(lm['maslow-esteem-score']||0) + Number(lm['maslow-actual-score']||0);
      const etrePrev = Number(p['maslow-esteem-score']||0) + Number(p['maslow-actual-score']||0);
      if (etreNow - etrePrev >= 1) bonuses.push(['etre', 5]);

      const goalsLenNow = (lm['goals-short']||'').length + (lm['goals-long']||'').length;
      const goalsLenPrev = (p['goals-short']||'').length + (p['goals-long']||'').length;
      if (goalsLenNow - goalsLenPrev >= 30) bonuses.push(['order', 5]);

      // Overall progress improvement bonus vs baseline
      if ((pct - (awardBaseProgress || 0)) >= 10) bonuses.push(['etre', 5]);

      for (const [domain, amt] of bonuses) { await addXp({ domain, amount: amt }); }

      if (bonuses.length) {
        const msg = 'XP: ' + bonuses.map(([d,a]) => `${d} +${a}`).join(', ');
        notify(msg);
      } else {
        notify('Aucune amélioration significative pour l’XP');
      }
    }
  } catch (e) { /* non bloquant */ }

  // Update prev snapshot after save to reflect most recent state
  prevLm = { ...lm };
  prevProgress = pct;
  // If we awarded XP this round, advance the award baseline to current
  if (awardXp) { awardBaseLm = { ...lm }; awardBaseProgress = pct; }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  currentUID = user.uid;
  await loadLifeModel(user.uid);
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement...';
    try { await saveLifeModel(user.uid, { awardXp: true }); saveBtn.textContent = 'Enregistré ✔'; setTimeout(()=>{ saveBtn.textContent = 'Enregistrer & Calculer'; }, 1200); }
    catch(e){ saveBtn.textContent = 'Réessayer'; }
    finally { saveBtn.disabled = false; }
  });

  // Autosave (debounced) without awarding XP; live progress updates
  const onFieldChange = () => {
    // Live progress based on current form values
    const lm = {};
    fields.forEach(fid => { const el = $(fid); if (el) lm[fid] = el.type === 'range' ? Number(el.value||0) : (el.value||'').trim(); });
    reflectProgress(calcProgress(lm));
    if (saveDebounce) clearTimeout(saveDebounce);
    saveDebounce = setTimeout(() => { if (currentUID) saveLifeModel(currentUID, { awardXp: false }); }, 1200);
  };
  fields.forEach(fid => { const el = $(fid); if (el) { el.addEventListener('input', onFieldChange); el.addEventListener('change', onFieldChange); } });
});
