// /js/cyl-memoire.js - « Ce que CYL sait de moi ».
//
// POURQUOI : la memoire visible et editable est le standard 2026 des
// assistants (Oura Memories, Replika, Pi). Ici, CYL ne garde presque rien,
// et c'est justement ce qu'il faut montrer : d'ou vient chaque information
// qu'elle recoit, et comment l'effacer. Rien n'est cache pour simplifier.
//
// CE QUE CYL RECOIT, et rien d'autre (cf. api/chat.js, cyl-panel.js) :
//   1. ses reglages (localStorage, cyl-prefs.js), copies dans le compte ;
//   2. l'etat de l'arbre (paliers des branches) si l'ouverture « CYL se
//      souvient de ton arbre » est atteinte ;
//   3. les reperes de la page en cours (setContext : des chiffres et des
//      libelles, jamais le texte d'une entree) ;
//   4. la conversation de la session (sessionStorage, effacee a la fermeture
//      de l'onglet, ou tout de suite d'un clic).
// Cote serveur : un compteur d'appels par jour (collection chatRate), pour
// le rate-limit, sans le contenu des messages.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { escapeHtml, toast } from '/js/common.js';
import { icon } from '/js/icons.js';
import * as prefs from '/js/cyl-prefs.js';
import { palierDe, xpParBranche, estOuvert, etatArbre } from '/js/growth.js';
import { BRANCHES } from '/js/organizer-data.js';

let auth, db;
if (window._cyfFirebase) ({ auth, db } = window._cyfFirebase);
else { await import('/js/firebase.js'); ({ auth, db } = window._cyfFirebase); }

const host = document.getElementById('mem');
const HIST_KEY = 'cyl_panel_hist';
const CONSENT_KEY = 'cyl_consent_v1';

const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const ssGet = (k) => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };

function carte(titre, source, corps, actions) {
  return `<section class="card">
    <h3>${escapeHtml(titre)}</h3>
    <div class="mem-src">${escapeHtml(source)}</div>
    ${corps}
    ${actions ? `<div class="mem-actions">${actions}</div>` : ''}
  </section>`;
}

function libellePref(champ, v) {
  if (champ.type === 'choix') { const o = (champ.options || []).find((x) => x.v === v); return o ? o.l : String(v); }
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  return String(v ?? '');
}

function render(userData) {
  const p = prefs.lire();
  const consent = lsGet(CONSENT_KEY);
  let hist = [];
  try { hist = JSON.parse(ssGet(HIST_KEY) || '[]'); } catch (_) { hist = []; }
  const ctx = window.CYL_CONTEXT || null;

  // 1. Consentement
  const c1 = carte(
    'Ton accord pour parler à CYL',
    'Enregistré sur cet appareil (localStorage), jamais sur nos serveurs.',
    `<p class="mem-note">${consent ? 'Tu as accepté de parler à CYL sur cet appareil. CYL est une intelligence artificielle, pas un professionnel de santé.' : "Tu n'as pas encore donné ton accord sur cet appareil : CYL ne reçoit rien tant que tu ne l'as pas fait."}</p>`,
    consent ? `<button class="btn sm danger" type="button" data-act="consent">${icon('x', { size: 14 })}Retirer mon accord</button>` : ''
  );

  // 2. Reglages
  const lignes = [];
  for (const g of prefs.GROUPES) {
    for (const ch of g.champs || []) {
      lignes.push(`<li><span>${escapeHtml(ch.label)}</span><b>${escapeHtml(libellePref(ch, p[ch.cle]))}</b></li>`);
    }
  }
  const c2 = carte(
    'Tes réglages',
    'Enregistrés sur cet appareil et copiés dans ton compte. Ils partent avec chaque question pour orienter le ton de la réponse.',
    `<ul class="mem-list">${lignes.join('')}</ul>`,
    `<a class="btn sm" href="/settings/#cyl">${icon('sliders', { size: 14 })}Modifier</a>
     <button class="btn sm quiet" type="button" data-act="prefs">Revenir aux réglages d'origine</button>`
  );

  // 3. L'arbre
  const etat = etatArbre(userData || {}, BRANCHES);
  const ouvert = estOuvert(etat, 'cyl-memoire');
  const xp = xpParBranche(userData || {});
  const brs = BRANCHES.map((b) => {
    const pal = palierDe(xp[b.key] || 0);
    return `<li><span>${icon(b.ic, { size: 14 })} ${escapeHtml(b.label)}</span><b>${escapeHtml(pal.nom)}</b></li>`;
  }).join('');
  const c3 = carte(
    "L'état de ton arbre",
    ouvert
      ? 'Lu dans ton compte au moment où tu lui parles. CYL reçoit le palier de chaque branche, pas tes actions ni tes textes.'
      : "Pas encore transmis : l'ouverture « CYL se souvient de ton arbre » se fait au premier palier. En attendant, CYL ne sait rien de tes branches.",
    `<ul class="mem-list">${brs}</ul>`,
    ''
  );

  // 4. Les reperes de la page
  let ctxCorps = '<p class="mem-note">Sur cette page, rien.</p>';
  if (ctx && ctx.data && typeof ctx.data === 'object') {
    const l = Object.entries(ctx.data).map(([k, v]) => `<li><span>${escapeHtml(k)}</span><b>${escapeHtml(String(v))}</b></li>`).join('');
    ctxCorps = `<ul class="mem-list">${l}</ul>`;
  }
  const c4 = carte(
    'Les repères de la page où tu lui parles',
    "Publiés par la page en cours (des chiffres, des libellés), jamais le contenu d'une entrée de journal, d'une note ou d'une humeur. Le serveur les borne et les traite comme une donnée, pas comme une instruction.",
    `<p class="mem-note">Exemples : « humeur du jour : bon (4/5) », « 3 fiches à trier », « 2 objectifs en cours ».</p>${ctxCorps}`,
    ''
  );

  // 5. La conversation
  const c5 = carte(
    'La conversation en cours',
    "Gardée dans cet onglet le temps de la session (sessionStorage). Fermer l'onglet l'efface. Le serveur n'en garde aucune copie, et rien ne sert à entraîner un modèle.",
    `<p class="mem-note">${hist.length ? `${hist.length} message${hist.length > 1 ? 's' : ''} dans cet onglet.` : 'Aucun message dans cet onglet.'}</p>`,
    hist.length ? `<button class="btn sm danger" type="button" data-act="hist">${icon('x', { size: 14 })}Effacer la conversation</button>` : ''
  );

  // 6. Cote serveur
  const c6 = carte(
    'Sur nos serveurs',
    'api/chat.js',
    `<p class="mem-note">Un compteur d'appels par jour, lié à ton compte, pour empêcher les abus. Pas le contenu des messages. Chaque question est transmise à Anthropic (le fournisseur du modèle) pour obtenir la réponse, avec les éléments ci-dessus, puis oubliée.</p>
     <p class="mem-note">Ce que tu écris dans ton journal, tes notes, ton humeur ou ton organizer n'est jamais envoyé à CYL.</p>`,
    `<a class="btn sm quiet" href="/confidentialite/">${icon('external', { size: 14 })}Politique de confidentialité</a>`
  );

  host.innerHTML = c1 + c2 + c3 + c4 + c5 + c6;

  host.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'consent') { try { localStorage.removeItem(CONSENT_KEY); } catch (_) {} toast('Accord retiré. CYL te redemandera avant de parler.', { type: 'success' }); }
    if (act === 'prefs') { prefs.reinitialiser(); toast("Réglages d'origine rétablis.", { type: 'success' }); }
    if (act === 'hist') { try { sessionStorage.removeItem(HIST_KEY); } catch (_) {} toast('Conversation effacée.', { type: 'success' }); }
    render(userData);
  }));
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  let data = {};
  try { const s = await getDoc(doc(db, 'users', user.uid)); if (s.exists()) data = s.data() || {}; } catch (_) {}
  render(data);
});
