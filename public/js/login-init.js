// /login/ - bootstrap : avatar global + enregistrement SW (via common.js).
// Le fond 3D arbre/Terre est géré par /js/login-bg.js (continuité avec l'accueil).
import { updateGlobalAvatar } from '/js/common.js';

window.addEventListener('DOMContentLoaded', () => {
  try { updateGlobalAvatar(); } catch (e) {}
});
