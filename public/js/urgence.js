// /js/urgence.js - Bouton URGENCE : flux d'aide bienveillant. Au clic, on demande
// à la personne comment elle va. Si détresse grave (danger, pensées suicidaires),
// on affiche IMMEDIATEMENT des mesures d'urgence (numéros d'aide France 24/7).
// Sinon : respiration guidée + possibilité de parler à SYL. Anonyme, sans compte.
//
// Ressources : 3114 (prévention suicide, gratuit 24/7), 15 (SAMU), 112 (urgences
// Europe), 114 (SMS sourds/malentendants).
(function () {
  if (window.__cylUrgence) return; window.__cylUrgence = true;

  var CSS = `
  .urg-ov{position:fixed;inset:0;z-index:99998;display:none;align-items:center;justify-content:center;padding:20px;
    background:rgba(3,8,18,0.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}
  .urg-ov.on{display:flex;}
  .urg-card{width:100%;max-width:460px;max-height:90vh;overflow-y:auto;border-radius:20px;padding:26px 24px;
    background:linear-gradient(180deg,rgba(14,24,42,0.98),rgba(10,18,32,0.98));border:1px solid rgba(127,209,255,0.22);
    box-shadow:0 30px 90px rgba(0,0,0,0.6);animation:urgIn .35s cubic-bezier(.2,.9,.25,1) both;color:#e8f0fb;}
  @keyframes urgIn{from{opacity:0;transform:translateY(16px) scale(.98);}to{opacity:1;transform:none;}}
  .urg-x{position:absolute;top:16px;right:18px;font-size:24px;line-height:1;color:#8ea6c4;background:none;border:none;cursor:pointer;}
  .urg-x:hover{color:#fff;}
  .urg-h{font:800 1.32rem Segoe UI,sans-serif;letter-spacing:-.3px;margin:0 0 8px;}
  .urg-p{font:500 0.94rem/1.5 Segoe UI,sans-serif;color:#aebfd6;margin:0 0 18px;}
  .urg-opt{display:flex;flex-direction:column;gap:10px;}
  .urg-b{display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:14px 16px;border-radius:13px;
    font:700 0.95rem Segoe UI,sans-serif;cursor:pointer;border:1px solid rgba(255,255,255,0.12);
    background:rgba(255,255,255,0.05);color:#eaf2ff;transition:transform .12s,background .15s,border-color .15s;text-decoration:none;}
  .urg-b:hover{background:rgba(255,255,255,0.09);transform:translateY(-1px);}
  .urg-b .ic{font-size:1.25rem;flex-shrink:0;}
  .urg-b small{display:block;font-weight:500;color:#9fb2cb;font-size:0.78rem;margin-top:2px;}
  .urg-b.danger{border-color:rgba(239,68,68,0.5);background:rgba(239,68,68,0.12);}
  .urg-b.danger:hover{background:rgba(239,68,68,0.2);}
  .urg-b.warn{border-color:rgba(251,191,36,0.45);background:rgba(251,191,36,0.1);}
  .urg-b.calm{border-color:rgba(45,212,191,0.45);background:rgba(45,212,191,0.1);}
  .urg-b.call{border-color:rgba(127,209,255,0.5);background:rgba(127,209,255,0.12);font-size:1.02rem;}
  .urg-b.call:hover{background:rgba(127,209,255,0.2);}
  .urg-b.call .num{margin-left:auto;font-weight:800;color:#bfe6ff;font-size:1.1rem;}
  .urg-ghost{background:none;border:none;color:#8ea6c4;font:600 0.86rem Segoe UI,sans-serif;cursor:pointer;
    margin-top:14px;text-decoration:underline;text-underline-offset:3px;}
  .urg-ghost:hover{color:#cfe0ff;}
  .urg-note{font:500 0.82rem/1.45 Segoe UI,sans-serif;color:#9fb2cb;margin:14px 2px 0;}
  /* respiration */
  .urg-breath{display:flex;flex-direction:column;align-items:center;gap:14px;padding:6px 0 4px;}
  .urg-breath .ball{width:120px;height:120px;border-radius:50%;
    background:radial-gradient(circle at 40% 35%,#7fd1ff,#2dd4bf 70%);box-shadow:0 0 40px rgba(127,209,255,0.5);
    animation:urgBreath 8s ease-in-out infinite;}
  .urg-breath .lab{font:700 1rem Segoe UI,sans-serif;color:#cfe0ff;min-height:1.2em;}
  @keyframes urgBreath{0%,100%{transform:scale(.62);}45%{transform:scale(1);}55%{transform:scale(1);}}
  @media (prefers-reduced-motion:reduce){.urg-breath .ball{animation:none;}}
  `;

  var ov, card, breathTimer;

  function ensureDom() {
    if (ov) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    ov = document.createElement('div'); ov.className = 'urg-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="urg-card" style="position:relative"><button class="urg-x" aria-label="Fermer">×</button><div class="urg-body"></div></div>';
    document.body.appendChild(ov);
    card = ov.querySelector('.urg-body');
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.urg-x').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('on')) close(); });
  }

  function open() { ensureDom(); stepIntro(); ov.classList.add('on'); }
  function close() { if (ov) ov.classList.remove('on'); if (breathTimer) { clearInterval(breathTimer); breathTimer = null; } }

  function talkToSyl() {
    // SYL n'est dispo qu'une fois connecté (/app). Sur l'accueil -> on y redirige.
    if (window.cylSylChat && typeof window.cylSylChat.open === 'function') { close(); window.cylSylChat.open(); return; }
    window.location.href = '/app/';
  }

  function stepIntro() {
    card.innerHTML =
      '<h2 class="urg-h">On est là. Respire.</h2>' +
      '<p class="urg-p">Dis-moi comment tu te sens, là, maintenant. C\'est anonyme, et ça reste entre nous.</p>' +
      '<div class="urg-opt">' +
        '<button class="urg-b danger" data-go="crisis"><span class="ic">🆘</span><span>Je suis en danger immédiat<small>Pensées suicidaires, envie d\'en finir, risque pour moi</small></span></button>' +
        '<button class="urg-b warn" data-go="crisis"><span class="ic">🖤</span><span>Ça ne va pas du tout<small>Pensées noires, détresse, je me sens submergé(e)</small></span></button>' +
        '<button class="urg-b calm" data-go="calm"><span class="ic">🌿</span><span>J\'ai besoin de souffler / de parler<small>Stress, anxiété, coup de mou</small></span></button>' +
      '</div>';
    card.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { b.dataset.go === 'crisis' ? stepCrisis() : stepCalm(); });
    });
  }

  function stepCrisis() {
    if (breathTimer) { clearInterval(breathTimer); breathTimer = null; }
    card.innerHTML =
      '<h2 class="urg-h">Tu comptes. Tu n\'es pas seul(e).</h2>' +
      '<p class="urg-p">Ce que tu ressens est réel, et ça peut passer. Parle à quelqu\'un <b>tout de suite</b> - ces lignes sont gratuites, confidentielles, ouvertes 24h/24.</p>' +
      '<div class="urg-opt">' +
        '<a class="urg-b call" href="tel:3114"><span class="ic">☎️</span><span>Prévention du suicide<small>National, gratuit, anonyme, 24h/24</small></span><span class="num">3114</span></a>' +
        '<a class="urg-b call" href="tel:15"><span class="ic">🚑</span><span>SAMU - urgence vitale<small>Si tu es en danger immédiat</small></span><span class="num">15</span></a>' +
        '<a class="urg-b call" href="tel:112"><span class="ic">🆘</span><span>Urgences (Europe)<small>Depuis n\'importe quel téléphone</small></span><span class="num">112</span></a>' +
        '<a class="urg-b call" href="sms:114"><span class="ic">💬</span><span>Par SMS (sourds / malentendants)<small>Écris au 114</small></span><span class="num">114</span></a>' +
      '</div>' +
      '<p class="urg-note">Reste en ligne avec quelqu\'un. Si tu peux, ouvre ta porte à un proche. Tu as fait le plus dur en cherchant de l\'aide.</p>' +
      '<button class="urg-ghost" data-back>‹ Revenir</button>';
    card.querySelector('[data-back]').addEventListener('click', stepIntro);
  }

  function stepCalm() {
    card.innerHTML =
      '<h2 class="urg-h">Respirons ensemble.</h2>' +
      '<p class="urg-p">Suis la bulle : elle gonfle quand tu inspires, se dégonfle quand tu expires. 4 secondes chacun.</p>' +
      '<div class="urg-breath"><div class="ball"></div><div class="lab">Inspire…</div></div>' +
      '<div class="urg-opt" style="margin-top:18px">' +
        '<button class="urg-b calm" data-syl><span class="ic">✨</span><span>Parler à SYL<small>Une IA bienveillante qui t\'écoute et t\'oriente</small></span></button>' +
      '</div>' +
      '<button class="urg-ghost" data-crisis>Voir les numéros d\'aide d\'urgence</button>';
    var lab = card.querySelector('.lab');
    var phases = ['Inspire…', 'Retiens…', 'Expire…', 'Retiens…'];
    var i = 0; if (lab) lab.textContent = phases[0];
    if (breathTimer) clearInterval(breathTimer);
    breathTimer = setInterval(function () { i = (i + 1) % phases.length; if (lab) lab.textContent = phases[i]; }, 2000);
    card.querySelector('[data-syl]').addEventListener('click', talkToSyl);
    card.querySelector('[data-crisis]').addEventListener('click', stepCrisis);
  }

  function bind() {
    var btn = document.getElementById('urgence-btn');
    if (btn) btn.addEventListener('click', function (e) { e.preventDefault(); open(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();

  window.cylUrgence = { open: open, close: close };
})();
