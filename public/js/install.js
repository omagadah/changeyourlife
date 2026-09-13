// /js/install.js - « Mets-le sur ton téléphone ».
//
// LE CONSTAT QUI A DECLENCHE CE FICHIER
// Le site est une PWA installable depuis le debut : manifest complet, mode
// standalone, icones maskable, raccourcis. Mais RIEN dans tout le depot
// n ecoutait `beforeinstallprompt`. L application existait et personne ne
// pouvait le deviner - il fallait connaitre le menu cache du navigateur.
//
// Ce module ne fabrique pas une application : il rend visible celle qui est
// deja la. Pas de store, pas de build, pas de Capacitor.
//
// TROIS REGLES DE POLITESSE, parce qu une banniere d installation est
// l element le plus facilement detestable d un site :
//   1. Jamais a la premiere visite. On demande a s installer chez quelqu un
//      qui ne sait pas encore si le site lui plait : c est la meilleure facon
//      de se faire refuser pour toujours.
//   2. Un refus vaut un mois de silence. Pas « jusqu au prochain rechargement ».
//   3. Jamais quand c est deja installe (mode standalone), jamais sur la
//      vitrine publique.
// Et quoi qu il arrive, une entree permanente reste dans la barre laterale :
// celui qui a dit non peut revenir sur sa decision sans attendre une banniere.

const VISITES_KEY = 'cyl_visites';
const REFUS_KEY = 'cyl_install_refus';
const SILENCE_MS = 30 * 24 * 3600 * 1000;   // un refus = un mois de silence
const VISITES_MIN = 2;                       // jamais a la premiere visite

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
};

// ── Ou en est-on ? ───────────────────────────────────────────────────────────
export function estInstallee() {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    // iOS n implemente pas display-mode : Safari expose son propre drapeau.
    if (navigator.standalone === true) return true;
  } catch (_) {}
  return false;
}

export function estIOS() {
  const ua = navigator.userAgent || '';
  // iPadOS 13+ se declare « Macintosh » : le seul signe fiable est l ecran
  // tactile sur une plateforme Mac.
  const iPadMasque = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadMasque;
}

// Safari est le SEUL navigateur iOS capable d installer sur l ecran d accueil.
// Chrome et Firefox sur iOS n ont pas « Sur l ecran d'accueil » : leur donner
// les instructions de Safari, c est les envoyer chercher un bouton absent.
function estSafariIOS() {
  const ua = navigator.userAgent || '';
  return estIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function silencieux() {
  const t = parseInt(ls.get(REFUS_KEY) || '', 10);
  return Number.isFinite(t) && Date.now() - t < SILENCE_MS;
}

// ── Le navigateur nous tend la main : on la garde pour plus tard ─────────────
// `beforeinstallprompt` ne se rattrape pas : si on ne le capture pas a
// l instant ou il passe, on ne peut plus jamais declencher l installation
// depuis la page. On l ecoute donc TOUT DE SUITE, au chargement du module.
let differe = null;
let pret = false;

// Ce module est charge par import dynamique : il peut arriver APRES que le
// navigateur ait tendu la main. common.js pose donc un capteur synchrone des
// sa premiere ligne et range l evenement dans window.__cylBip - on le reprend
// ici s il est deja passe. Sans ce relais, l installation etait injouable sur
// un chargement un peu lent.
if (window.__cylBip) { differe = window.__cylBip; pret = true; }

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();          // sinon Chrome affiche sa propre mini-barre
  differe = e;
  pret = true;
  document.dispatchEvent(new CustomEvent('cyl:installable'));
});

window.addEventListener('appinstalled', () => {
  differe = null; pret = false;
  fermerBanniere();
  try { document.querySelectorAll('[data-cyl-install]').forEach((el) => el.remove()); } catch (_) {}
  try { window.cyl && window.cyl.toast && window.cyl.toast('Installée. Retrouve-la sur ton écran d\'accueil.', { type: 'success', duration: 5000 }); } catch (_) {}
});

// Peut-on proposer quelque chose ? Chrome/Edge/Android : oui des que
// l evenement est passe. Safari iOS : toujours, mais en expliquant le geste.
export function peutProposer() {
  if (estInstallee()) return false;
  return pret || estSafariIOS();
}

// ── L installation elle-meme ─────────────────────────────────────────────────
export async function installer() {
  if (estIOS()) { montrerModeIOS(); return 'ios'; }
  if (!differe) return 'indisponible';
  try {
    differe.prompt();
    const { outcome } = await differe.userChoice;
    // Le prompt n est utilisable QU UNE FOIS : le navigateur en renverra un
    // nouveau plus tard s il le juge pertinent.
    differe = null; pret = false;
    if (outcome !== 'accepted') ls.set(REFUS_KEY, String(Date.now()));
    return outcome;
  } catch (_) { return 'erreur'; }
}

// ── Styles ───────────────────────────────────────────────────────────────────
function injecterCSS() {
  if (document.getElementById('cyl-install-css')) return;
  const s = document.createElement('style');
  s.id = 'cyl-install-css';
  s.textContent = `
  .cyl-inst {
    position:fixed; left:50%; transform:translateX(-50%) translateY(140%);
    /* La barre se pose AU-DESSUS de la zone systeme (barre home de l iPhone),
       jamais dessous : env(safe-area-inset-bottom) vaut 0 partout ailleurs. */
    bottom:calc(16px + env(safe-area-inset-bottom, 0px));
    z-index:99500; width:min(440px, calc(100vw - 24px));
    display:flex; align-items:center; gap:12px; padding:13px 14px;
    border-radius:16px; border:1px solid var(--line, rgba(221,205,160,.12));
    background:var(--bg-surface, #0f1710);
    box-shadow:var(--shadow-lg, 0 20px 56px rgba(0,0,0,.55));
    transition:transform .34s cubic-bezier(.4,0,.2,1);
  }
  .cyl-inst.on { transform:translateX(-50%) translateY(0); }
  .cyl-inst-ic { width:38px; height:38px; flex-shrink:0; border-radius:10px; }
  .cyl-inst-txt { flex:1; min-width:0; }
  .cyl-inst-t { font-size:.85rem; font-weight:800; color:var(--text-1, #f4efe1); line-height:1.25; }
  .cyl-inst-s { font-size:.72rem; color:var(--text-3, #86806a); margin-top:2px; }
  .cyl-inst-ok {
    flex-shrink:0; padding:9px 14px; border:none; border-radius:10px; cursor:pointer;
    background:var(--leaf, #84c25e); color:var(--bg-surface, #0f1710);
    font:inherit; font-size:.79rem; font-weight:800;
  }
  .cyl-inst-ok:hover { filter:brightness(1.07); }
  .cyl-inst-no {
    flex-shrink:0; width:28px; height:28px; border:none; border-radius:8px; cursor:pointer;
    background:none; color:var(--text-3, #86806a); font-size:.95rem; line-height:1;
  }
  .cyl-inst-no:hover { color:var(--text-1, #f4efe1); }

  /* Mode d emploi iOS : Safari n expose aucune API d installation, la seule
     chose qu on puisse faire est de montrer le geste. */
  .cyl-ios { position:fixed; inset:0; z-index:99600; display:flex;
    align-items:flex-end; justify-content:center; background:rgba(5,8,4,.66); }
  .cyl-ios-card {
    width:min(460px, calc(100vw - 20px));
    margin-bottom:calc(10px + env(safe-area-inset-bottom, 0px));
    padding:20px 18px 18px; border-radius:20px 20px 14px 14px;
    background:var(--bg-surface, #0f1710); border:1px solid var(--line, rgba(221,205,160,.12));
    box-shadow:var(--shadow-lg, 0 20px 56px rgba(0,0,0,.55));
  }
  .cyl-ios-t { font-size:1rem; font-weight:800; color:var(--text-1, #f4efe1); text-align:center; }
  .cyl-ios-s { font-size:.78rem; color:var(--text-3, #86806a); text-align:center; margin:5px 0 15px; }
  .cyl-ios-step { display:flex; align-items:center; gap:11px; padding:10px 0;
    border-top:1px solid var(--line, rgba(221,205,160,.12)); font-size:.83rem; color:var(--text-2, #b4ad94); }
  .cyl-ios-n { width:23px; height:23px; flex-shrink:0; border-radius:50%;
    background:rgba(132,194,94,.16); color:var(--leaf, #84c25e);
    font-size:.72rem; font-weight:800; display:flex; align-items:center; justify-content:center; }
  .cyl-ios-step b { color:var(--text-1, #f4efe1); font-weight:700; }
  .cyl-ios-x { width:100%; margin-top:14px; padding:11px; border:none; border-radius:11px; cursor:pointer;
    background:var(--surface-2, rgba(255,255,255,.05)); color:var(--text-2, #b4ad94);
    font:inherit; font-size:.82rem; font-weight:700; }
  @media (prefers-reduced-motion:reduce) { .cyl-inst { transition:none; } }
  `;
  document.head.appendChild(s);
}

// ── Le mode d emploi iOS ─────────────────────────────────────────────────────
function montrerModeIOS() {
  injecterCSS();
  if (document.querySelector('.cyl-ios')) return;
  const ov = document.createElement('div');
  ov.className = 'cyl-ios';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-label', "Installer l'application sur ton iPhone");
  ov.innerHTML = `
    <div class="cyl-ios-card">
      <div class="cyl-ios-t">Mets-la sur ton écran d'accueil</div>
      <div class="cyl-ios-s">Trois gestes, et elle s'ouvre comme une application.</div>
      <div class="cyl-ios-step"><span class="cyl-ios-n">1</span>
        <span>Touche le bouton <b>Partager</b> en bas de Safari (le carré avec une flèche).</span></div>
      <div class="cyl-ios-step"><span class="cyl-ios-n">2</span>
        <span>Fais défiler et choisis <b>Sur l'écran d'accueil</b>.</span></div>
      <div class="cyl-ios-step"><span class="cyl-ios-n">3</span>
        <span>Touche <b>Ajouter</b>. C'est fait.</span></div>
      <button class="cyl-ios-x" type="button">J'ai compris</button>
    </div>`;
  const fermer = () => ov.remove();
  ov.querySelector('.cyl-ios-x').onclick = fermer;
  ov.onclick = (e) => { if (e.target === ov) fermer(); };
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(ov);
}

// ── La bannière ──────────────────────────────────────────────────────────────
let banniere = null;
function fermerBanniere() {
  if (!banniere) return;
  banniere.classList.remove('on');
  const el = banniere; banniere = null;
  setTimeout(() => { try { el.remove(); } catch (_) {} }, 360);
}

function montrerBanniere() {
  if (banniere || estInstallee()) return;
  injecterCSS();
  banniere = document.createElement('div');
  banniere.className = 'cyl-inst';
  banniere.setAttribute('role', 'complementary');
  banniere.innerHTML = `
    <img class="cyl-inst-ic" src="/web-app-manifest-192x192.png" alt="" width="38" height="38"/>
    <div class="cyl-inst-txt">
      <div class="cyl-inst-t">Garde ton arbre dans ta poche</div>
      <div class="cyl-inst-s">Sur ton écran d'accueil, sans passer par le navigateur.</div>
    </div>
    <button class="cyl-inst-ok" type="button">Installer</button>
    <button class="cyl-inst-no" type="button" aria-label="Plus tard">✕</button>`;
  banniere.querySelector('.cyl-inst-ok').onclick = async () => {
    fermerBanniere();
    await installer();
  };
  banniere.querySelector('.cyl-inst-no').onclick = () => {
    ls.set(REFUS_KEY, String(Date.now()));
    fermerBanniere();
  };
  document.body.appendChild(banniere);
  requestAnimationFrame(() => banniere && banniere.classList.add('on'));
}

// ── Amorçage ─────────────────────────────────────────────────────────────────
export function initInstall() {
  if (estInstallee()) return;

  // Compte les visites AVANT tout le reste : c est ce compteur qui garantit
  // qu on ne demande rien a quelqu un qui decouvre le site.
  const n = (parseInt(ls.get(VISITES_KEY) || '0', 10) || 0) + 1;
  ls.set(VISITES_KEY, String(n));

  if (n < VISITES_MIN || silencieux()) return;

  // On laisse la page se poser. Une banniere qui arrive pendant le chargement
  // se lit comme une publicite, pas comme une proposition.
  const plusTard = () => setTimeout(() => { if (peutProposer()) montrerBanniere(); }, 3500);
  if (pret || estSafariIOS()) plusTard();
  else document.addEventListener('cyl:installable', plusTard, { once: true });
}

// Utilisable depuis n importe ou (entrée permanente de la barre latérale).
window.cylInstall = { installer, peutProposer, estInstallee, montrerModeIOS };
