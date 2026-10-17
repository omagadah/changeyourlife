// /js/profile.js - La page Profil, en trois blocs : identité, ton arbre, compte.
//
// Refonte du 2026-10-17 (gabarit v3). Ce qui est parti : le « Player #UID »,
// le badge d'identification qui se balançait, les badges et titres calculés
// sur les 4 domaines hérités (body/etre/heart/order), les onglets, le choix
// d'univers. Il n'existe aucune fonction sociale : rien ici n'est « visible
// par les autres », donc on ne le dit plus.
//
// L'XP et les paliers viennent de growth.js, comme partout ailleurs. Le palier
// décrit l'arbre, jamais la personne (cf. en-tête de growth.js).
//
// Champs Firestore (users/{uid}) : les MÊMES qu'avant, aucun nouveau.
//   lus     : displayName, profileTitle, bio, website, avatarUrl, tree / levels
//   écrits  : displayName, profileTitle, bio, website, avatarUrl, prefs.theme
//   plus lus ni écrits : badges, titles, selectedTitle, founder (système retiré)

import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { auth, db } from '/js/firebase.js';
import { escapeHtml, toast, saveWithFeedback, setContext } from '/js/common.js';
import { icon } from '/js/icons.js';
import { BRANCHES } from '/js/organizer-data.js';
import { PALIERS, palierDe, xpTotal, xpParBranche, etatArbre, ouverturesDe } from '/js/growth.js';

const $ = (id) => document.getElementById(id);
const form = $('pf-form');
const nameInput = $('pf-name');
const titleInput = $('pf-title');
const bioInput = $('pf-bio');
const bioCount = $('pf-bio-count');
const websiteInput = $('pf-website');
const emailInput = $('pf-email');
const avatarEl = $('pf-avatar');
const avatarFile = $('pf-avatar-file');
const avatarClear = $('pf-avatar-clear');

let uid = null;
let avatarUrl = null;   // data URL (jpeg 256 px) ou null = initiale

// ── Avatar ──────────────────────────────────────────────────────────────────
// Redimensionne l'image en un carré compact AVANT stockage. Une photo brute
// (plusieurs Mo) en data URL ferait exploser la limite de 1 Mo du document
// users/{uid} et toutes les sauvegardes de la personne échoueraient d'un coup.
function downscaleToDataURL(file, size = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode-failed'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          const s = Math.min(img.width, img.height);
          const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
          ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (err) { reject(err); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function initiale() {
  const n = (nameInput && nameInput.value.trim()) || (emailInput && emailInput.value) || '';
  return (n.charAt(0) || '·').toUpperCase();
}

function paintAvatar() {
  if (!avatarEl) return;
  if (avatarUrl) {
    const img = document.createElement('img');
    img.alt = '';
    img.src = avatarUrl;
    avatarEl.replaceChildren(img);
  } else {
    avatarEl.textContent = initiale();
  }
  if (avatarClear) avatarClear.hidden = !avatarUrl;
}

// L'avatar vit aussi en local : la barre latérale le lit avant Firebase.
function syncLocalAvatar() {
  try {
    if (avatarUrl) localStorage.setItem('userAvatarUrl', avatarUrl);
    else localStorage.removeItem('userAvatarUrl');
    // Le badge pixel-art (ancien gadget) ne se génère plus : on efface sa trace
    // pour que le logo du site ne reste pas remplacé par une vieille image.
    localStorage.removeItem('userBadgeUrl');
  } catch (_) {}
}

if (avatarFile) {
  avatarFile.addEventListener('change', async () => {
    const file = avatarFile.files && avatarFile.files[0];
    if (!file) return;
    try {
      avatarUrl = await downscaleToDataURL(file, 256);
      syncLocalAvatar();
      paintAvatar();
      toast('Photo prête. Pense à enregistrer.', { duration: 2500 });
    } catch (_) {
      toast("Cette image n'a pas pu être chargée. Essaie une autre photo.", { type: 'error' });
    }
    avatarFile.value = '';
  });
}
if (avatarClear) {
  avatarClear.addEventListener('click', () => {
    avatarUrl = null;
    syncLocalAvatar();
    paintAvatar();
  });
}
if (nameInput) nameInput.addEventListener('input', () => { if (!avatarUrl) paintAvatar(); });
if (bioInput && bioCount) {
  const count = () => { bioCount.textContent = String(bioInput.value.length); };
  bioInput.addEventListener('input', count);
  count();
}

// ── Identité : lecture / écriture ───────────────────────────────────────────
function fillIdentity(data, user) {
  if (nameInput) nameInput.value = data.displayName || '';
  if (titleInput) titleInput.value = data.profileTitle || '';
  if (bioInput) bioInput.value = data.bio || '';
  if (websiteInput) websiteInput.value = data.website || '';
  if (emailInput) emailInput.value = (user && user.email) || '';
  if (bioCount && bioInput) bioCount.textContent = String(bioInput.value.length);
  let local = null;
  try { local = localStorage.getItem('userAvatarUrl'); } catch (_) {}
  avatarUrl = data.avatarUrl || local || null;
  paintAvatar();
}

async function saveIdentity() {
  if (!uid) return;
  const payload = {
    displayName: (nameInput && nameInput.value.trim()) || '',
    profileTitle: ((titleInput && titleInput.value.trim()) || '').slice(0, 12),
    bio: ((bioInput && bioInput.value.trim()) || '').slice(0, 280),
    website: (websiteInput && websiteInput.value.trim()) || '',
    avatarUrl: avatarUrl || null,
    prefs: { theme: (function () { try { return localStorage.getItem('theme') || 'dark'; } catch (_) { return 'dark'; } })() },
  };
  const btn = $('pf-save');
  if (btn) btn.disabled = true;
  const r = await saveWithFeedback(
    () => setDoc(doc(db, 'users', uid), payload, { merge: true }),
    { successMsg: 'Profil enregistré' },
  );
  if (btn) btn.disabled = false;
  if (r.ok) syncLocalAvatar();
}

if (form) form.addEventListener('submit', (e) => { e.preventDefault(); saveIdentity(); });

// ── Ton arbre ───────────────────────────────────────────────────────────────
function renderTree(data) {
  const total = xpTotal(data);
  const totalEl = $('pf-xp-total');
  if (totalEl) totalEl.textContent = total.toLocaleString('fr-FR');

  const parBranche = xpParBranche(data);
  const list = $('pf-branches');
  if (list) {
    list.innerHTML = BRANCHES.map((b) => {
      const p = palierDe(parBranche[b.key] || 0);
      const sousTitre = p.suivant
        ? `${p.nom} · ${p.reste} XP avant ${p.suivant.nom.toLowerCase()}`
        : p.nom;
      return `<div class="br-row ${p.cle === 'dormante' ? 'dormante' : ''}" style="--bc:${escapeHtml(b.color)}">
        <span class="br-ic">${icon(b.ic)}</span>
        <span class="br-name">${escapeHtml(b.label)}</span>
        <span class="br-xp">${p.xp.toLocaleString('fr-FR')} <small class="t-muted">XP</small></span>
        <span class="br-palier">${escapeHtml(sousTitre)}</span>
        <span class="br-bar" role="progressbar" aria-label="${escapeHtml(b.label)} : ${escapeHtml(p.nom)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}"><i style="width:${p.pct}%"></i></span>
      </div>`;
    }).join('');
  }

  // Ce qui s'est ouvert : additif, jamais une retenue (cf. growth.js).
  const etat = etatArbre(data, BRANCHES);
  const ouv = ouverturesDe(etat);
  const ouvEl = $('pf-ouvertures');
  if (ouvEl) {
    ouvEl.innerHTML = ouv.map((o) => {
      const palier = PALIERS[o.palierMin];
      const cond = palier ? `S'ouvre dès qu'une branche est ${palier.nom.toLowerCase()}.` : '';
      return `<div class="ouv ${o.ouvert ? '' : 'off'}">
        <span class="ic">${icon(o.ouvert ? 'check' : 'clock', { size: 16 })}</span>
        <div>
          <b>${escapeHtml(o.nom)}</b>
          <p>${escapeHtml(o.desc)}</p>
          ${o.ouvert ? '' : `<span class="cond">${escapeHtml(cond)}</span>`}
        </div>
      </div>`;
    }).join('');
  }

  // Repères pour CYL : des libellés et des nombres, rien d'intime.
  setContext('profile', {
    'xp total': total,
    'branches': BRANCHES.map((b) => `${b.label} : ${palierDe(parBranche[b.key] || 0).nom.toLowerCase()}`),
    'ouvert': ouv.filter((o) => o.ouvert).map((o) => o.nom),
  });
}

// ── Compte ──────────────────────────────────────────────────────────────────
const logoutBtn = $('pf-logout');
if (logoutBtn) logoutBtn.addEventListener('click', async () => {
  if (!window.confirm('Se déconnecter de ChangeYourLife ?')) return;
  try { await signOut(auth); } catch (_) {}
  window.location.href = '/login';
});

// ── Démarrage ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  uid = user.uid;
  let data = {};
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) data = snap.data() || {};
  } catch (e) {
    console.warn('[profile] lecture impossible', e && e.message || e);
    toast('Impossible de lire ton profil pour le moment.', { type: 'error' });
  }
  fillIdentity(data, user);
  renderTree(data);
});
