/**
 * Firebase singleton — unique source de vérité pour auth + db.
 * Toutes les pages doivent importer depuis ce module.
 *
 * Usage:
 *   import { auth, db } from '/js/firebase.js';
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth }      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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
export const auth = getAuth(app);
export const db   = getFirestore(app);

// Compat avec le pattern window._cyfFirebase utilisé par les anciennes pages
if (!window._cyfFirebase) {
  window._cyfFirebase = { app, auth, db };
}
