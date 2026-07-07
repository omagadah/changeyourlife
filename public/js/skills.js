// /js/skills.js - Socle des compétences : modèle + niveaux + attribution d'XP.
// Une compétence grandit avec le temps (tâches accomplies, pratiques répétées).
// Firestore : users/{uid}.skills = { <id>: { name, emoji, branch, xp, lastAt } }.

import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { saveWithFeedback } from '/js/common.js';

export const SKILL_LEVELS = ['Débutant', 'Initié', 'Confirmé', 'Avancé', 'Expert', 'Maître', 'Pro'];

// Niveau dérivé de l'XP cumulé (besoin croissant : 100, 150, 200, …).
export function skillLevel(xp) {
  xp = Math.max(0, Number(xp) || 0);
  let lvl = 0, acc = 0;
  while (lvl < SKILL_LEVELS.length - 1 && xp >= acc + (100 + lvl * 50)) { acc += 100 + lvl * 50; lvl++; }
  const need = 100 + lvl * 50;
  const inLevel = xp - acc;
  const max = lvl >= SKILL_LEVELS.length - 1;
  return { level: lvl + 1, name: SKILL_LEVELS[lvl], inLevel, need, pct: max ? 100 : Math.round((inLevel / need) * 100), max, xp };
}

export async function loadSkills(db, uid) {
  try {
    const s = await getDoc(doc(db, 'users', uid));
    return (s.exists() && s.data().skills && typeof s.data().skills === 'object') ? s.data().skills : {};
  } catch (e) { return {}; }
}

// Ajoute/MAJ une compétence (création ou édition des méta).
export async function upsertSkill(db, uid, skill) {
  if (!skill || !skill.id) return;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const skills = (data.skills && typeof data.skills === 'object') ? { ...data.skills } : {};
    const cur = skills[skill.id] || { xp: 0 };
    skills[skill.id] = { ...cur, name: skill.name, emoji: skill.emoji || '🛠️', branch: skill.branch || 'accomplissement', xp: Number(cur.xp) || 0 };
    await saveWithFeedback(() => setDoc(ref, { skills }, { merge: true }), { errorMsg: 'Sauvegarde de la compétence impossible. Vérifie ta connexion.' });
  } catch (e) {}
}

export async function deleteSkill(db, uid, skillId) {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const skills = (data.skills && typeof data.skills === 'object') ? { ...data.skills } : {};
    delete skills[skillId];
    await saveWithFeedback(() => setDoc(ref, { skills }, { merge: true }), { errorMsg: 'Sauvegarde de la compétence impossible. Vérifie ta connexion.' });
  } catch (e) {}
}

// Attribue de l'XP à une compétence. Retourne {leveledUp, level, name} ou null.
export async function awardSkillXp(db, uid, skillId, amount) {
  if (!skillId) return null;
  const a = Math.max(0, Math.min(2000, Number(amount) || 0));
  if (!a) return null;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const skills = (data.skills && typeof data.skills === 'object') ? { ...data.skills } : {};
    const s = skills[skillId];
    if (!s) return null;                       // on ne crée pas une compétence à la volée
    const before = skillLevel(s.xp || 0).level;
    s.xp = (Number(s.xp) || 0) + a;
    s.lastAt = Date.now();
    skills[skillId] = s;
    await saveWithFeedback(() => setDoc(ref, { skills }, { merge: true }), { errorMsg: 'Sauvegarde de la compétence impossible. Vérifie ta connexion.' });
    const after = skillLevel(s.xp).level;
    return { leveledUp: after > before, level: after, name: s.name };
  } catch (e) { return null; }
}
