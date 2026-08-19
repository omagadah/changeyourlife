// /js/frise.js - Frise chronologique (memoire longue).
//
// Page de structure pour l'instant : elle garantit l'authentification et
// charge le socle commun (barre de navigation, chat CYL, i18n). La frise
// elle-meme se construira quand le modele d'evenements de vie sera arrete.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import '/js/common.js';

let auth;
if (window._cyfFirebase) { ({ auth } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth } = window._cyfFirebase); }

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = '/login';
});
