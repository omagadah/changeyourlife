/**
 * Firebase singleton — unique source de vérité pour auth + db + functions.
 * Toutes les pages doivent importer depuis ce module.
 *
 * Usage:
 *   import { auth, db, awardXp } from '/js/firebase.js';
 *   await awardXp('body', 15);
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth }      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyCvEtaivyC5QD0dGyPKh97IgYU8U8QrrWg',
  authDomain:        'changeyourlife-cc210.firebaseapp.com',
  projectId:         'changeyourlife-cc210',
  storageBucket:     'changeyourlife-cc210.appspot.com',
  messagingSenderId: '801720080785',
  appId:             '1:801720080785:web:1a74aadba5755ea26c2230',
};

// Réutilise l'app déjà initialisée si elle existe (évite l'erreur duplicate-app)
const app  = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const functions = getFunctions(app);

// ── XP via Cloud Function (les écritures directes sur `levels` sont bloquées par Firestore rules) ──
const _addXpCallable = httpsCallable(functions, 'addXp');
const DOMAIN_ALIASES = { corps: 'body', coeur: 'heart', ordre: 'order', mind: 'etre' };

export async function awardXp(domain, amount) {
  const d = DOMAIN_ALIASES[domain] || domain || 'etre';
  const a = Math.max(0, Math.min(10000, Number(amount) || 0));
  if (!a) return { ok: false, reason: 'no-xp' };
  try {
    await _addXpCallable({ domain: d, amount: a });
    return { ok: true };
  } catch (e) {
    console.warn('[awardXp] failed', e?.message || e);
    return { ok: false, reason: e?.message || 'error' };
  }
}

// Compat avec le pattern window._cyfFirebase utilisé par les anciennes pages
if (!window._cyfFirebase) {
  window._cyfFirebase = { app, auth, db, functions, awardXp };
} else {
  window._cyfFirebase.functions = functions;
  window._cyfFirebase.awardXp   = awardXp;
}
