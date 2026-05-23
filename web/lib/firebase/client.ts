'use client';

// web/lib/firebase/client.ts — singleton Firebase côté client (App Next.js).
// La clé apiKey est publique par design (règles Firestore + App Check sécurisent).
// Mêmes identifiants que l'ancien site → comptes/données partagés pendant la migration.

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCvEtaivyC5QD0dGyPKh97IgYU8U8QrrWg',
  authDomain: 'changeyourlife-cc210.firebaseapp.com',
  projectId: 'changeyourlife-cc210',
  storageBucket: 'changeyourlife-cc210.appspot.com',
  messagingSenderId: '801720080785',
  appId: '1:801720080785:web:1a74aadba5755ea26c2230',
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function getFirebase() {
  if (typeof window === 'undefined') {
    throw new Error('Firebase client ne doit être utilisé que côté navigateur.');
  }
  if (!_app) {
    _app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
  }
  return { app: _app, auth: _auth as Auth, db: _db as Firestore };
}
