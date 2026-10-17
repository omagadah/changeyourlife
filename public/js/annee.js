// /js/annee.js - « Ton arbre cette année ».
//
// POSTURE : un constat, jamais une note. On compte ce qui a ete depose et ce
// qui a pousse ; on ne compare a personne, on ne classe rien, on ne dit pas
// « bravo » ni « dommage ». La carte a garder est une image que l'utilisateur
// genere lui-meme, sur son appareil (canvas), et choisit de montrer ou non.
//
// LECTURES : les collections datees (journal, moods, gratitude, sleep) et le
// document utilisateur (arbre, organizer, meditation). Une seule requete par
// collection, bornee a l'annee affichee.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { escapeHtml } from '/js/common.js';
import { icon } from '/js/icons.js';
import { palierDe, xpParBranche, xpTotal } from '/js/growth.js';
import { BRANCHES } from '/js/organizer-data.js';

let auth, db;
if (window._cyfFirebase) ({ auth, db } = window._cyfFirebase);
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }

const host = document.getElementById('an');
const segEl = document.getElementById('an-periode');
const ANNEE_COURANTE = new Date().getFullYear();
let annee = ANNEE_COURANTE;
let uid = null;
let userData = {};

const dansAnnee = (d) => d instanceof Date && !isNaN(d) && d.getFullYear() === annee;
const toDate = (v) => {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  if (typeof v === 'number' || typeof v === 'string') { const d = new Date(v); return isNaN(d) ? null : d; }
  return null;
};
const dateDeCle = (id) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(id || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };

// ── Lectures ────────────────────────────────────────────────────────────────
async function compterParCle(col) {
  // Les trackers datent leur document par cle YYYY-MM-DD : on lit l'annee.
  try {
    // Pas de filtre sur l'identifiant (le SDK exige documentId() et une
    // syntaxe a part) : on lit la collection, bornee, et on filtre l'annee ici.
    const s = await getDocs(query(collection(db, 'users', uid, col), limit(800)));
    const docs = s.docs.filter((d) => dansAnnee(dateDeCle(d.id)));
    return { n: docs.length, docs };
  } catch (_) { return { n: 0, docs: [] }; }
}

async function lireTout() {
  const [journal, moods, gratitude, sleep] = await Promise.all([
    (async () => {
      try {
        const s = await getDocs(query(collection(db, 'users', uid, 'journal'), orderBy('createdAt', 'desc'), limit(400)));
        return s.docs.map((d) => d.data()).filter((e) => dansAnnee(toDate(e.createdAt)));
      } catch (_) { return []; }
    })(),
    compterParCle('moods'),
    compterParCle('gratitude'),
    compterParCle('sleep'),
  ]);

  // Humeur moyenne de l'annee : un repere, pas une note (on affiche le mot).
  const moodsVals = moods.docs.map((d) => Number((d.data() || {}).mood)).filter((x) => x >= 1 && x <= 5);
  const moodMoy = moodsVals.length ? moodsVals.reduce((a, b) => a + b, 0) / moodsVals.length : null;

  // Organizer : fiches terminees cette annee (dans le document utilisateur).
  let fichesFinies = 0;
  try {
    for (const c of (userData.organizer && userData.organizer.columns) || []) {
      for (const card of c.cards || []) if (dansAnnee(toDate(card.doneAt))) fichesFinies += 1;
    }
  } catch (_) {}

  // Meditation : l'historique s'il existe, sinon le total (non date).
  let seances = 0;
  const med = userData.meditation || {};
  if (Array.isArray(med.history)) seances = med.history.filter((h) => dansAnnee(toDate(h && h.completedAt))).length;
  else if (annee === ANNEE_COURANTE) seances = Number(med.totalSessions) || 0;

  return { journal: journal.length, moods: moods.n, moodMoy, gratitude: gratitude.n, sleep: sleep.n, fichesFinies, seances };
}

// ── Rendu ────────────────────────────────────────────────────────────────────
const MOTS_HUMEUR = ['', 'difficile', 'bas', 'neutre', 'bon', 'très bon'];

function render(stats) {
  const xp = xpParBranche(userData);
  const total = xpTotal(userData);
  const palArbre = palierDe(total / BRANCHES.length);
  const branches = BRANCHES.map((b) => ({ ...b, xp: xp[b.key] || 0, p: palierDe(xp[b.key] || 0) }))
    .sort((a, b) => b.xp - a.xp);
  const vivantes = branches.filter((b) => b.xp > 0);
  const top = vivantes.slice(0, 3);

  const nums = [
    [stats.journal, stats.journal > 1 ? 'entrées de journal' : 'entrée de journal'],
    [stats.moods, stats.moods > 1 ? 'humeurs notées' : 'humeur notée'],
    [stats.gratitude, stats.gratitude > 1 ? 'jours de gratitude' : 'jour de gratitude'],
    [stats.sleep, stats.sleep > 1 ? 'nuits suivies' : 'nuit suivie'],
    [stats.fichesFinies, stats.fichesFinies > 1 ? 'fiches menées à bout' : 'fiche menée à bout'],
    [stats.seances, stats.seances > 1 ? 'séances de méditation' : 'séance de méditation'],
  ].filter(([n]) => n > 0);

  const rien = !nums.length && !vivantes.length;

  host.innerHTML = `
    <div class="an-main">
      <section class="card an-hero">
        <div class="t-eyebrow">${annee}</div>
        <h2>${rien ? "Rien n'est encore posé pour cette année." : `Ton arbre est <em class="t-italic">${escapeHtml(palArbre.nom.toLowerCase())}</em>.`}</h2>
        <p class="t-lead">${rien
          ? "Chaque geste dans l'espace laisse une trace ici. Il n'y a pas de retard à rattraper."
          : `${total.toLocaleString('fr-FR')} XP au total, ${vivantes.length} branche${vivantes.length > 1 ? 's' : ''} vivante${vivantes.length > 1 ? 's' : ''} sur ${BRANCHES.length}${stats.moodMoy ? `, une humeur le plus souvent ${MOTS_HUMEUR[Math.round(stats.moodMoy)]}` : ''}.`}</p>
      </section>
      ${nums.length ? `<div class="an-nums">${nums.map(([n, l]) => `<div class="card an-num"><b>${n.toLocaleString('fr-FR')}</b><span>${escapeHtml(l)}</span></div>`).join('')}</div>` : ''}
      ${top.length ? `<div class="sec-label">Là où ton énergie est allée</div>
      <div class="an-themes">${top.map((b) => `<div class="an-theme" style="--c:${b.color}">
          <span class="ic">${icon(b.ic)}</span>
          <div><b>${escapeHtml(b.label)}</b><small>${escapeHtml(b.p.nom)} · ${escapeHtml(b.p.desc)}</small></div>
          <em>${b.xp.toLocaleString('fr-FR')} XP</em>
        </div>`).join('')}</div>` : ''}
      ${vivantes.length < BRANCHES.length && !rien ? `<p class="t-muted" style="font-size:.86rem">${BRANCHES.length - vivantes.length} branche${BRANCHES.length - vivantes.length > 1 ? 's' : ''} encore dormante${BRANCHES.length - vivantes.length > 1 ? 's' : ''}. C'est un constat, pas un reproche : peut-être que c'est exactement ce que tu veux cette année.</p>` : ''}
    </div>
    <aside class="an-side">
      <canvas class="an-card" id="an-canvas" width="1080" height="1350" aria-label="Carte de ton année"></canvas>
      <button class="btn primary" type="button" id="an-dl">${icon('download', { size: 16 })}Garder l'image</button>
      <p class="an-note">L'image est fabriquée sur ton appareil, rien n'est envoyé. À toi de la garder, ou de la montrer.</p>
    </aside>`;

  dessiner(stats, palArbre, total, vivantes, top, nums);
  const dl = document.getElementById('an-dl');
  if (dl) dl.addEventListener('click', () => {
    const c = document.getElementById('an-canvas');
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `mon-arbre-${annee}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  });
}

// ── La carte (1080 x 1350, format story / portrait) ─────────────────────────
function dessiner(stats, pal, total, vivantes, top, nums) {
  const c = document.getElementById('an-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const clair = document.body.classList.contains('light-mode');
  const bg = clair ? '#e8e1cf' : '#0a0f0a', ink = clair ? '#2b2719' : '#f4efe1', ink2 = clair ? '#57503c' : '#b4ad94', leaf = clair ? '#40702f' : '#84c25e', gold = clair ? '#8a6220' : '#e7b15c';
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // deux lumieres, comme le fond du site
  const g1 = ctx.createRadialGradient(W * .2, H * .1, 0, W * .2, H * .1, W * .6); g1.addColorStop(0, 'rgba(231,177,92,.16)'); g1.addColorStop(1, 'rgba(231,177,92,0)');
  const g2 = ctx.createRadialGradient(W * .85, H * .95, 0, W * .85, H * .95, W * .7); g2.addColorStop(0, 'rgba(74,122,58,.28)'); g2.addColorStop(1, 'rgba(74,122,58,0)');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  const serif = '"Fraunces", Georgia, serif', sans = '"Hanken Grotesk", "Segoe UI", sans-serif';
  ctx.fillStyle = gold; ctx.font = `700 30px ${sans}`; ctx.fillText(String(annee).toUpperCase(), 80, 120);
  ctx.fillStyle = ink; ctx.font = `500 92px ${serif}`;
  ctx.fillText('Mon arbre est', 80, 230);
  ctx.font = `italic 400 92px ${serif}`; ctx.fillText(pal.nom.toLowerCase() + '.', 80, 330);

  // l'arbre : un tronc et une branche par branche vivante, longueur selon l'XP
  const cx = W / 2, base = 980, hTronc = 300;
  ctx.strokeStyle = clair ? '#8a6234' : '#c39a6b'; ctx.lineWidth = 22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx, base - hTronc); ctx.stroke();
  const maxXp = Math.max(1, ...vivantes.map((b) => b.xp));
  vivantes.forEach((b, i) => {
    const t = 0.25 + 0.75 * (b.xp / maxXp);
    const ang = (-Math.PI / 2) + (i % 2 === 0 ? -1 : 1) * (0.45 + 0.12 * Math.floor(i / 2));
    const y0 = base - hTronc * (0.45 + 0.5 * (i / Math.max(1, vivantes.length)));
    const L = 170 * t + 60;
    ctx.strokeStyle = b.color; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx + Math.cos(ang) * L, y0 + Math.sin(ang) * L); ctx.stroke();
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * L, y0 + Math.sin(ang) * L, 14 + 10 * t, 0, Math.PI * 2); ctx.fill();
  });
  if (!vivantes.length) { ctx.fillStyle = leaf; ctx.beginPath(); ctx.arc(cx, base - hTronc, 20, 0, Math.PI * 2); ctx.fill(); }

  // les chiffres
  ctx.fillStyle = ink; ctx.font = `600 54px ${serif}`;
  ctx.fillText(`${total.toLocaleString('fr-FR')} XP`, 80, 1090);
  ctx.fillStyle = ink2; ctx.font = `500 30px ${sans}`;
  const lignes = nums.slice(0, 4).map(([n, l]) => `${n} ${l}`);
  lignes.forEach((l, i) => ctx.fillText(l, 80, 1150 + i * 44));
  ctx.fillStyle = ink2; ctx.font = `600 26px ${sans}`; ctx.textAlign = 'right';
  ctx.fillText('changeyourlife.ai', W - 80, H - 70); ctx.textAlign = 'left';
}

// ── Selecteur d'annee ────────────────────────────────────────────────────────
function rendreSeg() {
  const debut = (() => { const d = toDate(userData.createdAt); return d ? d.getFullYear() : ANNEE_COURANTE; })();
  const annees = [];
  for (let y = Math.max(debut, ANNEE_COURANTE - 3); y <= ANNEE_COURANTE; y++) annees.push(y);
  segEl.innerHTML = annees.map((y) => `<button type="button" role="tab" aria-selected="${y === annee}" class="${y === annee ? 'on' : ''}" data-y="${y}">${y}</button>`).join('');
  segEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', async () => {
    annee = Number(b.dataset.y);
    rendreSeg();
    render(await lireTout());
  }));
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  uid = user.uid;
  try { const s = await getDoc(doc(db, 'users', uid)); if (s.exists()) userData = s.data() || {}; } catch (_) {}
  rendreSeg();
  render(await lireTout());
});
