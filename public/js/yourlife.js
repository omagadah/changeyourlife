// /js/yourlife.js - « Où j'en suis » : les 8 branches de l'arbre, et leurs jalons.
//
// Refonte du 2026-10-17 (gabarit v3). Avant : une pyramide de Maslow à cinq
// étages, un anneau « 0 % » global, trois vues (pyramide, carte mentale,
// chronologie). Maintenant : une carte par branche, avec son palier, son XP,
// sa dernière action (growth.js, la même source que l'arbre et le profil) et
// ses jalons - les pastilles d'avant, migrées vers les branches.
//
// TON : CYL constate, elle n'ordonne pas et ne note pas une vie. Un compte
// « 12 jalons posés sur 14 » se lit ; un « 87 % » se subit. Pas de pourcentage
// sur une vie, pas de « niveau », pas de titre de mérite.
//
// ── Stockage Firestore (users/{uid}) ────────────────────────────────────────
//   NOUVEAU  yourlife = { v: 2, branches: { physio: [{ id, label, done, doneAt? }], ... } }
//   ANCIEN   maVieSkills = { 'self-actualization': [...], esteem: [...], love: [...],
//                            safety: [...], physiological: [...] }
// L'ancien format reste LU : au premier chargement sans `yourlife.branches`,
// il est converti une fois (écrit sous `yourlife`, `maVieSkills` n'est pas
// touché). app.js lit les deux formats pour compter les jalons posés.
//
// ── Correspondance pyramide -> branches ─────────────────────────────────────
//   physiological        -> physio
//   safety               -> securite
//   love                 -> appartenance
//   esteem               -> estime
//   self-actualization   -> transcendance pour les jalons « Spiritualité » et
//                           « Contribution » (les deux libellés par défaut qui
//                           parlent de dépassement de soi), accomplissement
//                           pour tout le reste (y compris ceux que la personne
//                           a ajoutés : on ne devine pas à sa place).
//   cognitif, esthetique -> démarrent vides (la pyramide ne les connaissait pas).

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { auth, db } from '/js/firebase.js';
import { escapeHtml, toast, saveWithFeedback, setContext } from '/js/common.js';
import { icon } from '/js/icons.js';
import { BRANCHES } from '/js/organizer-data.js';
import { palierDe, xpParBranche, derniereActionDe } from '/js/growth.js';

const YL_VERSION = 2;

// Les jalons de départ d'un compte neuf : ceux de l'ancienne pyramide, déjà
// rangés par branche. Cognitif et esthétique commencent vides.
const DEFAULTS = {
  physio:          ['Sommeil 7-8h', 'Nutrition équilibrée', 'Exercice régulier', 'Hydratation', 'Repos'],
  securite:        ['Sécurité financière', 'Stabilité', 'Logement sûr', 'Santé préventive', 'Épargne'],
  appartenance:    ['Famille', 'Amis proches', 'Relations amoureuses', 'Communauté', 'Empathie'],
  estime:          ['Confiance en soi', 'Compétences', 'Réussite', 'Reconnaissance', 'Fierté'],
  cognitif:        [],
  esthetique:      [],
  accomplissement: ['Créativité', 'Croissance personnelle', 'Vision de vie'],
  transcendance:   ['Spiritualité', 'Contribution'],
};

const LEGACY_LEVELS = {
  physiological: 'physio',
  safety: 'securite',
  love: 'appartenance',
  esteem: 'estime',
  'self-actualization': 'accomplissement',
};
const LEGACY_SELF_TO_TRANSCENDANCE = new Set(['Spiritualité', 'Contribution']);

function emptyBranches() {
  const out = {};
  for (const b of BRANCHES) out[b.key] = [];
  return out;
}

function defaultBranches() {
  const out = emptyBranches();
  for (const b of BRANCHES) {
    out[b.key] = (DEFAULTS[b.key] || []).map((label, i) => ({ id: `${b.key}_${i}`, label, done: false }));
  }
  return out;
}

function cleanItem(raw, key, i) {
  if (!raw || typeof raw !== 'object') return null;
  const label = String(raw.label || '').trim().slice(0, 50);
  if (!label) return null;
  const item = { id: String(raw.id || `${key}_${i}_${Date.now()}`), label, done: !!raw.done };
  if (raw.done && Number(raw.doneAt)) item.doneAt = Number(raw.doneAt);
  return item;
}

// Ancien format -> branches. Pur, testable, sans Firestore.
export function migrateLegacy(maVieSkills) {
  const out = emptyBranches();
  if (!maVieSkills || typeof maVieSkills !== 'object') return out;
  for (const [level, key] of Object.entries(LEGACY_LEVELS)) {
    const list = Array.isArray(maVieSkills[level]) ? maVieSkills[level] : [];
    list.forEach((raw, i) => {
      const item = cleanItem(raw, key, i);
      if (!item) return;
      const dest = (level === 'self-actualization' && LEGACY_SELF_TO_TRANSCENDANCE.has(item.label)) ? 'transcendance' : key;
      out[dest].push(item);
    });
  }
  return out;
}

function normalizeBranches(raw) {
  const out = emptyBranches();
  if (!raw || typeof raw !== 'object') return out;
  for (const b of BRANCHES) {
    const list = Array.isArray(raw[b.key]) ? raw[b.key] : [];
    out[b.key] = list.map((x, i) => cleanItem(x, b.key, i)).filter(Boolean);
  }
  return out;
}

// ── État ────────────────────────────────────────────────────────────────────
let uid = null;
let userData = {};
let branches = emptyBranches();
let saveTimer = null;

// ── Firestore ───────────────────────────────────────────────────────────────
async function load() {
  let data = {};
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) data = snap.data() || {};
  } catch (e) {
    console.warn('[yourlife] lecture impossible', e && e.message || e);
    toast('Impossible de lire tes jalons pour le moment.', { type: 'error' });
  }
  userData = data;
  const yl = data.yourlife;
  if (yl && yl.branches && typeof yl.branches === 'object') {
    branches = normalizeBranches(yl.branches);
  } else if (data.maVieSkills && typeof data.maVieSkills === 'object') {
    branches = migrateLegacy(data.maVieSkills);
    // Conversion unique : à partir d'ici, tout vit sous `yourlife.branches`.
    await persist();
  } else {
    branches = defaultBranches();
  }
}

function persist() {
  return saveWithFeedback(() => setDoc(doc(db, 'users', uid), { yourlife: { v: YL_VERSION, branches } }, { merge: true }));
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 600);
}

// ── Rendu ───────────────────────────────────────────────────────────────────
function relatif(ts) {
  if (!ts) return '';
  const j = Math.floor((Date.now() - ts) / 86400000);
  if (j <= 0) return "dernière action aujourd'hui";
  if (j === 1) return 'dernière action hier';
  if (j < 30) return `dernière action il y a ${j} jours`;
  const m = Math.floor(j / 30);
  return m < 12 ? `dernière action il y a ${m} mois` : 'dernière action il y a plus d\'un an';
}

function compte() {
  let total = 0, done = 0;
  for (const b of BRANCHES) {
    const l = branches[b.key] || [];
    total += l.length;
    done += l.filter((x) => x.done).length;
  }
  return { total, done };
}

function render() {
  const grid = document.getElementById('yl-grid');
  if (!grid) return;
  const xp = xpParBranche(userData);

  grid.innerHTML = BRANCHES.map((b) => {
    const p = palierDe(xp[b.key] || 0);
    const last = relatif(derniereActionDe(userData, b.key));
    const list = branches[b.key] || [];
    const faits = list.filter((x) => x.done).length;
    const sousTitre = p.suivant ? `${p.reste} XP avant ${p.suivant.nom.toLowerCase()}` : p.desc;
    return `<section class="card br ${p.cle === 'dormante' ? 'dormante' : ''}" data-branch="${b.key}" style="--bc:${escapeHtml(b.color)}" aria-labelledby="h-${b.key}">
      <div class="br-head">
        <span class="br-ic">${icon(b.ic)}</span>
        <h2 id="h-${b.key}">${escapeHtml(b.label)}</h2>
        <span class="br-xp">${p.xp.toLocaleString('fr-FR')} <small class="t-muted">XP</small></span>
        <div class="br-meta">
          <span class="chip ${p.n > 0 ? 'on' : ''}">${escapeHtml(p.nom)}</span>
          <span>${escapeHtml(sousTitre)}</span>
          ${last ? `<span>· ${escapeHtml(last)}</span>` : ''}
        </div>
      </div>
      <div class="br-bar" role="progressbar" aria-label="${escapeHtml(b.label)} : ${escapeHtml(p.nom)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}"><i style="width:${p.pct}%"></i></div>
      <div class="sec-label">Jalons <span class="t-muted" style="letter-spacing:0;text-transform:none;font-weight:500">${faits} sur ${list.length}</span></div>
      <div class="jalons" role="list">
        ${list.length ? list.map((j) => `
          <div class="jalon" role="listitem" data-id="${escapeHtml(j.id)}">
            <button type="button" class="tog" aria-pressed="${j.done ? 'true' : 'false'}" data-act="toggle">
              <span class="box">${icon('check', { size: 13 })}</span>
              <span class="lbl">${escapeHtml(j.label)}</span>
            </button>
            <button type="button" class="del" data-act="del" aria-label="Supprimer le jalon ${escapeHtml(j.label)}">${icon('x', { size: 14 })}</button>
          </div>`).join('') : '<p class="jalon-empty">Aucun jalon posé ici pour l\'instant.</p>'}
      </div>
      <form class="yl-add" data-add="${b.key}">
        <label class="vh" for="add-${b.key}">Nouveau jalon pour ${escapeHtml(b.label)}</label>
        <input class="input" id="add-${b.key}" type="text" maxlength="50" placeholder="Poser un jalon" autocomplete="off">
        <button class="btn sm" type="submit"><span class="ic">${icon('plus', { size: 14 })}</span>Ajouter</button>
      </form>
    </section>`;
  }).join('');

  const c = compte();
  const countEl = document.getElementById('yl-count');
  if (countEl) countEl.textContent = c.total ? `${c.done} jalon${c.done > 1 ? 's' : ''} posé${c.done > 1 ? 's' : ''} sur ${c.total}` : 'Aucun jalon pour l\'instant';

  // Repères pour CYL : des libellés et des nombres, jamais la matière.
  setContext('yourlife', {
    'jalons poses': `${c.done} sur ${c.total}`,
    'branches': BRANCHES.map((b) => {
      const l = branches[b.key] || [];
      return `${b.label} : ${palierDe(xp[b.key] || 0).nom.toLowerCase()}, ${l.filter((x) => x.done).length} jalon(s) sur ${l.length}`;
    }),
    'branches sans jalon pose': BRANCHES.filter((b) => !(branches[b.key] || []).some((x) => x.done)).map((b) => b.label),
  });
}

// ── Gestes ──────────────────────────────────────────────────────────────────
function findItem(key, id) {
  return (branches[key] || []).find((x) => x.id === id) || null;
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const sec = btn.closest('[data-branch]');
  const row = btn.closest('[data-id]');
  if (!sec || !row) return;
  const key = sec.dataset.branch;
  const item = findItem(key, row.dataset.id);
  if (!item) return;
  if (btn.dataset.act === 'toggle') {
    item.done = !item.done;
    if (item.done) item.doneAt = Date.now(); else delete item.doneAt;
    scheduleSave();
    render();
    if (item.done) toast(`Jalon posé : ${item.label}`, { type: 'success', duration: 2000 });
  } else if (btn.dataset.act === 'del') {
    branches[key] = (branches[key] || []).filter((x) => x.id !== item.id);
    scheduleSave();
    render();
    toast('Jalon retiré', { duration: 2000 });
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-add]');
  if (!form) return;
  e.preventDefault();
  const key = form.dataset.add;
  const input = form.querySelector('input');
  const label = (input && input.value.trim().slice(0, 50)) || '';
  if (!label || !branches[key]) return;
  branches[key].push({ id: `${key}_${Date.now()}`, label, done: false });
  scheduleSave();
  render();
  const again = document.getElementById(`add-${key}`);
  if (again) again.focus();
});

// ── Export ──────────────────────────────────────────────────────────────────
const exportBtn = document.getElementById('yl-export');
if (exportBtn) exportBtn.addEventListener('click', () => {
  const c = compte();
  const xp = xpParBranche(userData);
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const lines = [`# Où j'en suis - Change Your Life`, `Date : ${date}`, '', `${c.done} jalons posés sur ${c.total}`, ''];
  for (const b of BRANCHES) {
    const p = palierDe(xp[b.key] || 0);
    const list = branches[b.key] || [];
    lines.push(`## ${b.label} (${p.nom}, ${p.xp} XP)`);
    if (!list.length) lines.push('- (aucun jalon)');
    list.forEach((j) => lines.push(`- [${j.done ? 'x' : ' '}] ${j.label}${j.doneAt ? ` (${new Date(j.doneAt).toLocaleDateString('fr-FR')})` : ''}`));
    lines.push('');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ou-j-en-suis-${new Date().toISOString().slice(0, 10)}.md`;
  a.click(); URL.revokeObjectURL(url);
  toast('Export prêt', { type: 'success', duration: 2000 });
});

// ── Démarrage ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  uid = user.uid;
  await load();
  render();
});
