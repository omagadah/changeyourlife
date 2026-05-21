/**
 * Firebase singleton — unique source de vérité pour auth + db + functions.
 * Toutes les pages doivent importer depuis ce module.
 *
 * Usage:
 *   import { auth, db, awardXp } from '/js/firebase.js';
 *   await awardXp('physio', 15);
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth }      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { treeFromUserDoc, applyXp, BRANCH_KEYS, LEGACY_DOMAIN_MAP } from '/js/tree-data.js';
import { showXpReward } from '/js/xp-reward.js';

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

// ── XP — écriture de l'arbre côté client ────────────────────────────────────
// Le projet est sur le plan Firebase gratuit (Spark) : les Cloud Functions ne
// sont pas déployables. `addXp` (functions/src/index.ts) reste la référence
// canonique ; on en reproduit ici la logique via tree-data.js (`applyXp` =
// miroir exact). Écriture transactionnelle → pas de course entre deux actions.
// Sécurité : les Firestore rules autorisent l'owner à écrire SON `tree`. Un
// utilisateur averti pourrait gonfler son propre XP — sans intérêt, il ne
// triche que lui-même. L'anti-triche serveur reviendra avec le plan Blaze.
const DOMAIN_ALIASES   = { corps: 'body', coeur: 'heart', ordre: 'order', mind: 'etre' };
const BRANCH_TO_LEGACY = { physio: 'body', appartenance: 'heart', cognitif: 'etre', securite: 'order' };
const nextThreshold = (lvl) => 100 + lvl * 20;

export async function awardXp(domain, amount) {
  const a = Math.max(0, Math.min(10000, Number(amount) || 0));
  if (!a) return { ok: false, reason: 'no-xp' };
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) return { ok: false, reason: 'not-signed-in' };
  // résout le domaine (legacy 4-axes OU 8 branches Maslow) vers une branche
  const d = DOMAIN_ALIASES[domain] || domain;
  const branch = BRANCH_KEYS.includes(d) ? d : LEGACY_DOMAIN_MAP[d];
  if (!branch) return { ok: false, reason: 'invalid-domain' };

  try {
    const ref = doc(db, 'users', uid);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const now = Date.now();

      // 1. `tree` — modèle source de vérité (xp cumulé + lastActionAt par branche)
      const next = applyXp(treeFromUserDoc(data, now), branch, a, now);
      const patch = { tree: next };

      // 2. `levels` — miroir legacy (anneaux du dashboard, anciennes pages)
      const legacyKey = BRANCH_TO_LEGACY[branch];
      if (legacyKey) {
        const levels = (data.levels && typeof data.levels === 'object')
          ? { ...data.levels } : {};
        const cur = levels[legacyKey] || { level: 0, xp: 0, nextXp: 100 };
        let xp = (cur.xp || 0) + a;
        let level = cur.level || 0;
        let nextXp = cur.nextXp || nextThreshold(level);
        while (xp >= nextXp) { xp -= nextXp; level += 1; nextXp = nextThreshold(level); }
        levels[legacyKey] = { level, xp, nextXp };
        patch.levels = levels;
      }

      tx.set(ref, patch, { merge: true });
    });
    // retour visuel : carte de récompense à la couleur de la branche
    showXpReward(branch, a);
    // L'arbre (tree-widget) écoute cet événement pour faire pousser la branche
    // concernée en temps réel et ajouter quelques brins d'herbe au sol.
    try {
      document.dispatchEvent(new CustomEvent('cyl:xp-gained', {
        detail: { branch, amount: a },
      }));
    } catch (_) { /* ignore */ }
    return { ok: true, branch };
  } catch (e) {
    console.warn('[awardXp] failed', (e && e.message) || e);
    return { ok: false, reason: (e && e.message) || 'error' };
  }
}

// Compat avec le pattern window._cyfFirebase utilisé par les anciennes pages
if (!window._cyfFirebase) {
  window._cyfFirebase = { app, auth, db, functions, awardXp };
} else {
  window._cyfFirebase.functions = functions;
  window._cyfFirebase.awardXp   = awardXp;
}
