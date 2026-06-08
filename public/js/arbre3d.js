// /js/arbre3d.js - Page d'accueil : arbre de vie procédural + croissance + SYL.
// Cf. docs/VISION.md, docs/ARCHITECTURE.md.
//
// v7 - fix du texte de SYL (plus de superposition au clic rapide), flux de
// pop-ups « tâche accomplie » (satisfaisant), panneau explicatif au clic sur
// une branche. Barre de temps + caméra cinématique conservées.

import * as THREE from '/vendor/three/three.module.min.js';
import { createDemoModel, buildTree } from '/js/tree-model.js';
// ez-tree (~4 Mo) chargé en DIFFÉRÉ via import() dynamique -> page rapide.

// Chaîne traduite via le moteur i18n (window.CYL), avec repli si i18n absent.
function T(key, fallback) {
  if (window.CYL && typeof window.CYL.t === 'function') {
    const v = window.CYL.t(key);
    if (v && v !== key) return v;
  }
  return fallback != null ? fallback : key;
}

const ORBIT_TARGET = new THREE.Vector3(0, 40, 0);
const GROWTH_SECONDS = 9;
const REPLAY_SECONDS = 4.5;
const TOTAL_XP = 24800;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

// ── Contenu des 8 dimensions = 8 niveaux de la pyramide de Maslow ───────────
const BRANCHES_INFO = {
  physio: {
    desc: 'Le besoin vital - la base de tout. Sans énergie ni sommeil, rien d’autre ne tient debout.',
    subs: [
      ['Sommeil', '7 à 9 h règlent l’humeur, le focus, la santé.'],
      ['Nutrition', 'Le carburant du cerveau et du corps.'],
      ['Hydratation', 'Le premier réflexe, trop souvent oublié.'],
      ['Mouvement', 'Le corps est fait pour bouger, chaque jour.'],
      ['Repos', 'Récupérer fait partie de la performance.'],
    ],
    modules: 'Déjà sur le site : Sommeil, Habitudes.',
  },
  securite: {
    desc: 'Se sentir à l’abri - un toit, des ressources, un lendemain serein.',
    subs: [
      ['Logement', 'Un lieu stable, le point d’ancrage.'],
      ['Stabilité', 'Un cadre prévisible où se poser.'],
      ['Finances', 'Un coussin, c’est de la sérénité.'],
      ['Santé', 'Prévenir, écouter les signaux du corps.'],
      ['Sérénité', 'L’esprit libre, parce que la base est tenue.'],
    ],
    modules: 'Module dédié à venir.',
  },
  appartenance: {
    desc: 'Aimer et être aimé. Personne ne s’épanouit seul.',
    subs: [
      ['Famille', 'Tes racines, ton premier cercle.'],
      ['Amis', 'Ceux qui te choisissent.'],
      ['Amour', 'L’intimité, le lien profond.'],
      ['Empathie', 'Comprendre et accueillir l’autre.'],
      ['Communauté', 'Appartenir à plus grand que soi.'],
    ],
    modules: 'Module dédié à venir.',
  },
  estime: {
    desc: 'Être reconnu - et d’abord se reconnaître soi-même de la valeur.',
    subs: [
      ['Confiance', 'Croire en sa capacité d’agir.'],
      ['Compétence', 'Ce que tu sais faire, vraiment.'],
      ['Réussite', 'Atteindre ce que tu vises.'],
      ['Reconnaissance', 'Être vu et apprécié pour ce que tu fais.'],
      ['Fierté', 'Le respect que tu te portes.'],
    ],
    modules: 'Déjà sur le site : Autoévaluation, Bilan.',
  },
  cognitif: {
    desc: 'Le besoin de savoir, de comprendre, d’explorer le monde et soi.',
    subs: [
      ['Savoir', 'Nourrir l’esprit en continu.'],
      ['Curiosité', 'Le moteur de toute découverte.'],
      ['Compréhension', 'Relier les choses, voir clair.'],
      ['Apprentissage', 'Grandir, toujours.'],
      ['Lucidité', 'Penser net, décider juste.'],
    ],
    modules: 'Déjà sur le site : Codex, Journal.',
  },
  esthetique: {
    desc: 'Le besoin de beauté, d’harmonie et d’ordre - autour de soi et en soi.',
    subs: [
      ['Beauté', 'Ce qui élève le regard.'],
      ['Harmonie', 'L’équilibre entre les choses.'],
      ['Ordre', 'Un cadre clair libère l’esprit.'],
      ['Créativité', 'Mettre de la forme au monde.'],
      ['Émerveillement', 'Savoir encore s’étonner.'],
    ],
    modules: 'Module dédié à venir.',
  },
  accomplissement: {
    desc: 'Devenir pleinement soi - réaliser son potentiel.',
    subs: [
      ['Croissance', 'Toujours un cran plus loin.'],
      ['Projets', 'Ce que tu mets au monde.'],
      ['Maîtrise', 'L’excellence dans ce qui compte.'],
      ['Authenticité', 'Vivre aligné avec qui tu es.'],
      ['Vision', 'Savoir où tu vas.'],
    ],
    modules: 'Déjà sur le site : Objectifs, Méditation.',
  },
  transcendance: {
    desc: 'Aller au-delà de soi - donner du sens, contribuer, transmettre. La cime s’épanouit tard, et c’est normal.',
    subs: [
      ['Spiritualité', 'Le lien à plus vaste que soi.'],
      ['Contribution', 'Ce que tu apportes au monde.'],
      ['Sens', 'Le pourquoi de tout le reste.'],
      ['Transmission', 'Ce que tu passes aux autres.'],
      ['Héritage', 'La trace que tu laisses.'],
    ],
    modules: 'Déjà sur le site : Gratitude. Frise chronologique à venir.',
  },
};

// Détecte un palier de qualité d'après la machine (CPU/RAM/mobile). On part de là,
// puis la résolution s'ajuste dynamiquement selon le FPS réel (cf. animate).
function detectGfxTier() {
  try {
    const n = navigator;
    const cores = n.hardwareConcurrency || 4;
    const mem = n.deviceMemory || 4;
    const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(n.userAgent || '');
    if (mobile || cores <= 4 || mem <= 3) return 'low';
    if (cores >= 8 && mem >= 8) return 'high';
    return 'med';
  } catch (_) { return 'med'; }
}

// ── Scène ───────────────────────────────────────────────────────────────────
function initScene(canvas) {
  const gfxTier = detectGfxTier();
  const dpr = window.devicePixelRatio || 1;
  // Plafond de résolution selon le palier (la résolution dynamique fera le reste).
  const basePR = gfxTier === 'low' ? 1 : gfxTier === 'med' ? Math.min(dpr, 1.5) : Math.min(dpr, 2);
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: gfxTier !== 'low', alpha: true, powerPreference: 'high-performance',
    // Profondeur logarithmique : indispensable avec un far plane énorme (24000)
    // et un near de 0.1 - sinon z-fighting (clignotement / taches) sur la Terre
    // et l'herbe au dézoom. Précision répartie sur toute la plage au lieu d'être
    // écrasée près du near.
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(basePR);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.7;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  // Far plane large : Terre (R 2400), système solaire lointain, étoiles ~6000.
  const camera = new THREE.PerspectiveCamera(
    42, canvas.clientWidth / canvas.clientHeight, 0.1, 24000);

  // Ambiance organique : ciel chaud (lumière dorée tamisée) + rebond vert mousse.
  scene.add(new THREE.HemisphereLight(0xffe6bf, 0x0c1208, 1.15));
  const key = new THREE.DirectionalLight(0xfff2dd, 1.5);
  key.position.set(30, 70, 36);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x7faa5a, 0.7);
  fill.position.set(-36, 30, -20);
  scene.add(fill);

  const { group, nodes, subNodes, grow, animateCosmos, setEarthLocation, infoSats, orbits } = buildTree(THREE, createDemoModel(), { floating: true, ezTree: true });

  // Bel arbre ez-tree (le visuel) posé sur la plateforme. Les 8 nœuds Maslow
  // restent cliquables (fournis par buildTree en mode ezTree). On le fait grandir
  // avec `age` dans la boucle d'animation (ezTreeObj.scale).
  const EZ_SCALE = 0.95;
  const ez = { obj: null, clip: null };   // objet central (arbre OU architecture), chargé en différé
  // Pose l'objet central : centré sur la plateforme, mis à l'échelle, avec
  // croissance ANIMÉE par plan de coupe (révélation bas -> haut).
  function setupCentral(obj) {
    if (!obj) return;
    const box = new THREE.Box3().setFromObject(obj);
    obj.position.x -= (box.min.x + box.max.x) / 2;
    obj.position.z -= (box.min.z + box.max.z) / 2;
    obj.position.y -= box.min.y;
    obj.scale.setScalar(EZ_SCALE);
    group.add(obj);
    renderer.localClippingEnabled = true;
    const wbox = new THREE.Box3().setFromObject(obj);
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), wbox.min.y);
    obj.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { m.clippingPlanes = [plane]; m.clipShadows = true; });
      }
    });
    ez.obj = obj; ez.clip = { plane, baseY: wbox.min.y, topY: wbox.max.y };
  }
  let universe = 'arbre';
  try { if (localStorage.getItem('cyl_universe') === 'archi') universe = 'archi'; } catch (_) {}
  if (universe === 'archi') {
    import('/js/archi-build.js').then((m) => setupCentral(m.buildArchi(THREE))).catch((e) => console.error('[arbre3d] archi import failed', e));
  } else {
    import('/js/ez-tree-build.js').then((m) => setupCentral(m.buildEzTree(m.getTreeType(), { growth: 1 }))).catch((e) => console.error('[arbre3d] ez-tree import failed', e));
  }
  scene.add(group);

  // ── Faille dimensionnelle : la plaque de Pioneer flotte dans l'espace ───────
  // (message d'humanité gravé envoyé en 1972). Teintée gris « pierre ancienne »,
  // halo de portail, cliquable -> explication.
  const plaque = (function () {
    const grp = new THREE.Group();
    grp.position.set(-250, 165, -90);
    // halo "faille"
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const gg = gc.getContext('2d');
    const rad = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
    rad.addColorStop(0, 'rgba(160,195,255,0.5)'); rad.addColorStop(0.5, 'rgba(120,90,220,0.22)'); rad.addColorStop(1, 'rgba(0,0,0,0)');
    gg.fillStyle = rad; gg.fillRect(0, 0, 128, 128);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(165, 165, 1); grp.add(glow);
    // la plaque elle-même
    const W = 100, H = W / 1.262;
    const tex = new THREE.TextureLoader().load('/textures/pioneer-plaque.png');
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xc2cad6, transparent: true, depthWrite: false }));
    sp.scale.set(W, H, 1); grp.add(sp);
    scene.add(grp);
    return { obj: grp, glow };
  })();

  return { renderer, scene, camera, treeGroup: group, nodes, subNodes, grow, animateCosmos, setEarthLocation, infoSats, ez, orbits, plaque, gfx: { tier: gfxTier, basePR } };
}

// Géoloc IP (sans permission navigateur) : place l'arbre sur le pays de
// l'utilisateur. Mis en cache localStorage → un seul appel API par visiteur.
// Échec silencieux → l'arbre reste au pôle nord (pas bloquant).
function geolocateTree(setEarthLocation) {
  if (typeof setEarthLocation !== 'function') return;
  // Repli France (centre) : appliqué TOUT DE SUITE pour que l'arbre ne reste
  // jamais bloqué au pôle nord si l'API IP est injoignable (VPN, bloqueur de
  // pub Opera, hors-ligne…). Affiné ensuite si la géoloc IP répond.
  const FALLBACK = { lat: 46.6, lon: 2.2 };
  let applied = false;
  try {
    const c = JSON.parse(localStorage.getItem('cyl_geo') || 'null');
    if (c && typeof c.lat === 'number') { setEarthLocation(c.lat, c.lon); applied = true; }
  } catch (_) {}
  if (!applied) setEarthLocation(FALLBACK.lat, FALLBACK.lon);
  fetch('https://ipwho.is/')
    .then((r) => r.json())
    .then((d) => {
      if (d && d.success && typeof d.latitude === 'number') {
        setEarthLocation(d.latitude, d.longitude);
        try { localStorage.setItem('cyl_geo', JSON.stringify({ lat: d.latitude, lon: d.longitude })); } catch (_) {}
      }
    })
    .catch(() => {});
}

// ── Contrôles : orbite (glisser) + zoom borné (molette) ─────────────────────
function initControls(canvas, camera) {
  const s = {
    azimuth: 0.5, polar: 1.06, radius: 78,
    tAz: 0.5, tPo: 1.06, tR: 78,
    // minR = zoom AVANT maximum : on s'arrête au cadrage « toutes les branches
    // visibles » (cf. capture owner) pour que la 3D n'empiète jamais sur le texte
    // de présentation. Le zoom ARRIÈRE reste libre (on découvre l'espace).
    minR: 95, maxR: 7000, minPo: 0.55, maxPo: 1.45,
  };
  let dragging = false, moved = false, px = 0, py = 0;
  let userZoomed = false;   // l'utilisateur a pris la main sur le zoom
  let autoRotate = true;    // tourne tout seul tant qu'on ne touche pas
  let idle = 0;             // temps depuis la dernière interaction
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = false; px = e.clientX; py = e.clientY;
    autoRotate = false; idle = 0;   // on touche -> stop la rotation auto
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    px = e.clientX; py = e.clientY;
    // Suivi 1:1 du doigt : sensibilité adaptative à la largeur du canvas
    // (~75° pour un drag d'une largeur d'écran), mise à jour DIRECTE (pas
    // de lerp pendant le drag, donc pas d'inertie après release).
    const dim = Math.max(canvas.clientWidth, 320);
    const SENS = (Math.PI * 0.75) / dim;
    const newAz = s.tAz - dx * SENS;
    const newPo = Math.min(s.maxPo, Math.max(s.minPo, s.tPo - dy * SENS * 0.85));
    s.tAz = newAz; s.azimuth = newAz;
    s.tPo = newPo; s.polar = newPo;
  });
  const end = (e) => {
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    userZoomed = true; autoRotate = false; idle = 0;
    // Zoom logarithmique, plus DOUX : il faut longtemps pour quitter la Terre,
    // puis on atteint l'espace. Step réduit → plus de molette pour tout traverser.
    s.tR = Math.min(s.maxR, Math.max(s.minR, s.tR + e.deltaY * 0.00065 * s.tR));
  }, { passive: false });

  return {
    // `target` (optionnel) : centre d'orbite - suit la cime pendant la pousse.
    apply(target) {
      const tgt = target || ORBIT_TARGET;
      // Lerp encore plus doux : inertie, arrivée à la cible en douceur.
      s.azimuth += (s.tAz - s.azimuth) * 0.055;
      s.polar += (s.tPo - s.polar) * 0.055;
      s.radius += (s.tR - s.radius) * 0.055;
      // Arbre flottant : pas de dérive vers la Terre. La caméra reste centrée
      // sur l'arbre ; en dézoomant on découvre le système solaire autour.
      const ty = tgt.y;
      const sp = Math.sin(s.polar), cp = Math.cos(s.polar);
      camera.position.set(
        tgt.x + s.radius * sp * Math.sin(s.azimuth),
        ty + s.radius * cp,
        tgt.z + s.radius * sp * Math.cos(s.azimuth));
      camera.lookAt(tgt.x, ty, tgt.z);
    },
    // Pendant la croissance : impose le rayon sauf si l'utilisateur a zoomé.
    setRadius(r) {
      if (userZoomed) return;
      s.tR = r; s.radius = r;
    },
    // Rotation auto (vue 360) tant qu'on ne touche pas. Reprise après inactivité.
    autoSpin(dt) {
      if (dragging) { idle = 0; return; }
      if (!autoRotate) { idle += dt; if (idle > 6) autoRotate = true; }   // reprise après 6 s
      if (autoRotate) s.tAz += dt * 0.11;
    },
    setAutoRotate(v) { autoRotate = v; if (v) idle = 0; },
    isAutoRotate: () => autoRotate,
    wasDrag: () => moved,
    getRadius: () => s.radius,   // distance caméra courante (pour masquer les infos au dézoom)
  };
}

// ── HUD : compteur XP + flux de pop-ups « tâche accomplie » ─────────────────
// `key` = clé i18n du libellé · `task` = repli FR · l'XP reste international.
const BEATS = [
  { at: 0.10, icon: '🌅', key: 'beat.wake',     task: 'Réveil en pleine forme', xp: '+60 XP' },
  { at: 0.18, icon: '🧘', key: 'beat.meditate', task: 'Méditation du matin', xp: '+180 XP' },
  { at: 0.26, icon: '💧', key: 'beat.hydrate',  task: 'Hydratation', xp: '+40 XP' },
  { at: 0.34, icon: '📓', key: 'beat.journal',  task: 'Journal du jour', xp: '+120 XP' },
  { at: 0.42, icon: '🏃', key: 'beat.sport',    task: 'Séance de sport', xp: '+260 XP' },
  { at: 0.50, icon: '🎯', key: 'beat.goal',     task: 'Objectif atteint', xp: '+420 XP' },
  { at: 0.58, icon: '🙏', key: 'beat.gratitude',task: 'Gratitude notée', xp: '+90 XP' },
  { at: 0.66, icon: '📚', key: 'beat.reading',  task: '30 min de lecture', xp: '+140 XP' },
  { at: 0.73, icon: '🤝', key: 'beat.call',     task: 'Appel à un proche', xp: '+160 XP' },
  { at: 0.80, icon: '😴', key: 'beat.sleep',    task: 'Nuit réparatrice', xp: '+150 XP' },
  { at: 0.87, icon: '✅', key: 'beat.habit',    task: 'Habitude tenue 7 jours', xp: '+300 XP' },
  { at: 0.93, icon: '🏆', key: 'beat.levelup',  task: 'Nouveau palier de niveau', xp: '+500 XP' },
];
function initHud() {
  const xpEl = document.getElementById('xp-value');
  const stageEl = document.getElementById('xp-stage');
  const hud = document.getElementById('hud');
  const stream = document.getElementById('task-stream');
  let fired = BEATS.map(() => false);

  function updateXp(age) {
    if (xpEl) xpEl.textContent = Math.round(easeOut(age) * TOTAL_XP).toLocaleString('fr-FR');
    if (stageEl) {
      stageEl.textContent = T(age < 0.12 ? 'stage.sprout'
        : age < 0.42 ? 'stage.young'
        : age < 0.78 ? 'stage.mature' : 'stage.old');
    }
  }
  function showBeat(b, idx) {
    if (hud) { hud.classList.remove('flash'); void hud.offsetWidth; hud.classList.add('flash'); }
    if (!stream) return;
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.beat = String(idx);
    card.innerHTML =
      `<span class="ic">${b.icon}</span>` +
      `<span class="bd"><span class="nm">${T(b.key, b.task)}</span><span class="xp">${b.xp}</span></span>` +
      `<span class="ck">✓</span>`;
    stream.appendChild(card);
    while (stream.children.length > 5) stream.removeChild(stream.firstChild);
    const timer = setTimeout(() => {
      card.classList.add('out');
      setTimeout(() => card.remove(), 500);
    }, 3000);
    card._timer = timer;
  }
  function removeCard(idx) {
    if (!stream) return;
    const c = stream.querySelector(`[data-beat="${idx}"]`);
    if (c) { clearTimeout(c._timer); c.remove(); }
  }
  return {
    updateXp,
    // Remet à zéro le flux de pop-ups (rejoue la croissance depuis le début).
    resetBeats() {
      fired = BEATS.map(() => false);
      if (stream) stream.innerHTML = '';
    },
    // Synchronise les pop-ups avec la barre de temps : ils apparaissent quand
    // on franchit leur instant en avant, disparaissent quand on recule.
    syncBeats(age, prev) {
      for (let i = 0; i < BEATS.length; i++) {
        const at = BEATS[i].at;
        if (prev < at && age >= at) {
          if (!fired[i]) { fired[i] = true; showBeat(BEATS[i], i); }
        } else if (prev >= at && age < at) {
          fired[i] = false; removeCard(i);
        }
      }
    },
  };
}

// ── Panneau explicatif d'une branche ────────────────────────────────────────
function initBranchPanel(onClose) {
  const panel = document.getElementById('branch-panel');
  const dot = document.getElementById('bp-dot');
  const title = document.getElementById('bp-title');
  const desc = document.getElementById('bp-desc');
  const subsEl = document.getElementById('bp-subs');
  const modsEl = document.getElementById('bp-modules');
  const closeBtn = document.getElementById('bp-close');

  let lastOpen = null;   // dernière branche ouverte (pour relocaliser)

  function close() {
    if (panel) panel.classList.remove('open');
    if (onClose) onClose();
  }
  if (closeBtn) closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  function open(key, label, colorHex) {
    if (!panel) return;
    const info = BRANCHES_INFO[key] || {};   // repli FR si i18n indisponible
    lastOpen = { key, label, colorHex };
    const col = '#' + colorHex.toString(16).padStart(6, '0');
    if (dot) dot.style.background = col;
    if (title) { title.textContent = T(`branch.${key}.label`, label); title.style.color = col; }
    if (desc) desc.textContent = T(`branch.${key}.desc`, info.desc || '');
    if (subsEl) {
      subsEl.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const fb = (info.subs && info.subs[i]) || ['', ''];
        const name = T(`branch.${key}.s${i + 1}.name`, fb[0]);
        const note = T(`branch.${key}.s${i + 1}.note`, fb[1]);
        if (!name && !note) continue;
        const row = document.createElement('div');
        row.className = 'bp-sub';
        row.style.animationDelay = (0.12 + i * 0.09) + 's';
        const dotEl = document.createElement('span');
        dotEl.className = 'bp-sub-dot'; dotEl.style.background = col;
        const txt = document.createElement('span');
        txt.className = 'bp-sub-txt';
        const b = document.createElement('b'); b.textContent = name;
        txt.appendChild(b);
        txt.appendChild(document.createTextNode(note));
        row.appendChild(dotEl); row.appendChild(txt);
        subsEl.appendChild(row);
      }
    }
    if (modsEl) modsEl.textContent = T(`branch.${key}.modules`, info.modules || '');
    panel.classList.add('open');
  }

  // Ouvre le MÊME panneau avec un contenu libre (utilisé pour les satellites).
  function openInfo(opt) {
    if (!panel) return;
    lastOpen = null;
    const col = opt.color || '#7fd1ff';
    if (dot) dot.style.background = col;
    if (title) { title.textContent = opt.title || ''; title.style.color = col; }
    if (desc) desc.textContent = opt.body || '';
    if (subsEl) subsEl.innerHTML = '';
    if (modsEl) {
      modsEl.innerHTML = '';
      if (opt.link) {
        const a = document.createElement('a');
        a.href = opt.link.href; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = opt.link.label; a.style.color = col; a.style.fontWeight = '700';
        modsEl.appendChild(a);
      }
    }
    panel.classList.add('open');
  }

  // Changement de langue : si le panneau est ouvert, on le re-remplit.
  window.addEventListener('cyl:langchange', () => {
    if (panel && panel.classList.contains('open') && lastOpen) {
      open(lastOpen.key, lastOpen.label, lastOpen.colorHex);
    }
  });

  return { open, openInfo, close };
}

// ── Labels HTML projetés (style ESP) ────────────────────────────────────────
// `nodes` = branches principales · `subNodes` = sous-éléments (boules vides)
function initLabels(nodes, subNodes) {
  const css = document.createElement('style');
  css.textContent = `
    .esp-labels{position:absolute;inset:0;pointer-events:none;z-index:2;
      opacity:0;transition:opacity .6s;}
    .esp-labels.on{opacity:1;}
    .esp-label{position:absolute;transform:translate(-50%,-50%);
      font:600 11px -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.6px;
      text-transform:uppercase;white-space:nowrap;padding:2px 8px;border-radius:6px;
      background:rgba(6,14,26,0.72);border:1px solid rgba(255,255,255,0.14);}
    .esp-label.sub{font-size:8.5px;font-weight:600;letter-spacing:.4px;
      padding:1px 6px;border-radius:5px;opacity:.82;
      background:rgba(6,14,26,0.58);border-color:rgba(255,255,255,0.09);}
  `;
  document.head.appendChild(css);
  const wrap = document.createElement('div');
  wrap.className = 'esp-labels';
  document.querySelector('.scene')?.appendChild(wrap);

  // Clé i18n d'une étiquette : branch.<clé>.label pour une branche, et
  // branch.<clé>.sN.name pour un sous-élément (index retrouvé via le nom FR).
  function labelKey(m, sub) {
    const key = m.userData && m.userData.key;
    if (!key) return null;
    if (!sub) return `branch.${key}.label`;
    const info = BRANCHES_INFO[key];
    if (info && info.subs) {
      const i = info.subs.findIndex(([name]) => name === m.userData.label);
      if (i >= 0) return `branch.${key}.s${i + 1}.name`;
    }
    return null;
  }

  function makeLabel(m, sub) {
    const el = document.createElement('div');
    el.className = sub ? 'esp-label sub' : 'esp-label';
    const fb = m.userData.label || '';
    const i18nKey = labelKey(m, sub);
    el.textContent = i18nKey ? T(i18nKey, fb) : fb;
    el.style.color = '#' + (m.userData.color || 0xffffff).toString(16).padStart(6, '0');
    if (!sub && m.userData.state === 'dormant') el.style.opacity = '0.55';
    wrap.appendChild(el);
    return { el, mesh: m, sub, i18nKey, fb };
  }
  const labels = nodes.map((m) => makeLabel(m, false))
    .concat((subNodes || []).filter((m) => m.userData && m.userData.label)
      .map((m) => makeLabel(m, true)));
  // Re-traduit toutes les étiquettes (au changement de langue).
  function relabel() {
    for (const l of labels) l.el.textContent = l.i18nKey ? T(l.i18nKey, l.fb) : l.fb;
  }
  window.addEventListener('cyl:langchange', relabel);
  const v = new THREE.Vector3();
  // Les sous-labels ne sont visibles que pour la branche sélectionnée.
  let activeSubKey = null;
  return {
    reveal: () => wrap.classList.add('on'),
    hide: () => wrap.classList.remove('on'),
    showSubs(key) { activeSubKey = key; },
    hideSubs() { activeSubKey = null; },
    update(camera, canvas) {
      for (const { el, mesh, sub } of labels) {
        if (sub && mesh.userData.key !== activeSubKey) {
          el.style.visibility = 'hidden';
          continue;
        }
        mesh.getWorldPosition(v).project(camera);
        if (v.z > 1) { el.style.visibility = 'hidden'; continue; }
        el.style.visibility = 'visible';
        el.style.left = ((v.x * 0.5 + 0.5) * canvas.clientWidth) + 'px';
        el.style.top = ((-v.y * 0.5 + 0.5) * canvas.clientHeight - (sub ? 16 : 24)) + 'px';
      }
    },
  };
}

// ── Étiquette « schéma » sur le satellite (transparence / vie privée) ───────
// Une petite fiche reliée par un trait blanc au satellite, qui le suit dans sa
// course. But : prévenir l'utilisateur que ses données restent locales et que
// le code est ouvert/vérifiable (preuves : dépôt GitHub public). Style « légende
// de schéma » pour ne pas surcharger la scène.
const SAT_INFO = {
  transp: {
    title: '🛰 100% transparent',
    body: "Tes données restent sur ton appareil. Rien n'est revendu. Le code est ouvert et vérifiable.",
    link: { label: 'Voir le code (GitHub) ↗', href: 'https://github.com/omagadah/changeyourlife' },
  },
  connect: {
    title: '🔗 Connecté à ta vraie vie',
    body: 'Relie tes outils (Google Agenda, tâches...) : tes actions réelles nourrissent ton arbre.',
  },
  open: {
    title: '🌍 Gratuit & open source',
    body: "Le cœur de l'app est gratuit et ouvert. Tu construis ta vie, pas un abonnement.",
    link: { label: 'Le code (GitHub) ↗', href: 'https://github.com/omagadah/changeyourlife' },
  },
  syl: {
    title: '✨ SYL, ton assistant',
    body: "Une IA bienveillante qui t'écoute et t'oriente vers la bonne action, au bon moment.",
  },
};
function initSatInfo(infoSats) {
  if (!infoSats || !infoSats.length) return { update() {} };
  if (!document.getElementById('sat-info-css')) {
    const css = document.createElement('style'); css.id = 'sat-info-css';
    css.textContent = `
      .sat-info{position:absolute;inset:0;pointer-events:none;z-index:2;opacity:0;transition:opacity .55s;}
      .sat-info.on{opacity:1;}
      .sat-info:not(.on) .sat-info-card{pointer-events:none;}
      .sat-info svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}
      .sat-info-line{stroke:rgba(255,255,255,0.55);stroke-width:1;stroke-dasharray:3 3;}
      .sat-info-dot{fill:#fff;}
      .sat-info-card{position:absolute;width:208px;transform:translateY(-50%);
        background:rgba(6,14,26,0.84);border:1px solid rgba(255,255,255,0.16);
        border-radius:10px;padding:9px 11px;backdrop-filter:blur(6px);pointer-events:auto;}
      .sat-info-card.primordial{width:250px;padding:12px 14px;border-color:rgba(127,209,255,0.55);
        box-shadow:0 0 26px rgba(127,209,255,0.28);background:rgba(6,16,30,0.9);}
      .sat-info-title{font:800 11px Segoe UI,Roboto,sans-serif;letter-spacing:.4px;color:#cfe0ff;
        display:flex;align-items:center;gap:6px;margin-bottom:4px;}
      .sat-info-card.primordial .sat-info-title{font-size:13px;color:#bfe6ff;}
      .sat-info-card p{font:500 10.5px Segoe UI,Roboto,sans-serif;line-height:1.45;color:#b9c7dc;margin:0 0 6px;}
      .sat-info-card.primordial p{font-size:11.5px;}
      .sat-info-card a{font:700 10.5px Segoe UI,Roboto,sans-serif;color:#7fd1ff;text-decoration:none;}
      .sat-info-card a:hover{text-decoration:underline;}
      @media (max-width:880px){ .sat-info{display:none;} }
    `;
    document.head.appendChild(css);
  }
  const wrap = document.createElement('div');
  wrap.className = 'sat-info';
  document.querySelector('.scene')?.appendChild(wrap);

  const items = infoSats.map((sat) => {
    const info = SAT_INFO[sat.userData.info] || { title: 'Info', body: '' };
    const prim = !!sat.userData.primordial;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = `<line class="sat-info-line" x1="0" y1="0" x2="0" y2="0"></line><circle class="sat-info-dot" cx="0" cy="0" r="${prim ? 3 : 2.3}"></circle>`;
    const card = document.createElement('div');
    card.className = 'sat-info-card' + (prim ? ' primordial' : '');
    card.innerHTML =
      `<div class="sat-info-title">${info.title}</div><p>${info.body}</p>` +
      (info.link ? `<a href="${info.link.href}" target="_blank" rel="noopener">${info.link.label}</a>` : '');
    wrap.appendChild(svg); wrap.appendChild(card);
    return { sat, card, line: svg.querySelector('line'), dot: svg.querySelector('circle'), cw: prim ? 250 : 208 };
  });

  const v = new THREE.Vector3();
  let shown = false;
  return {
    update(camera, canvas, farHidden) {
      // Au-delà d'une certaine distance (on a depasse la plaque de Pioneer en
      // dezoomant), on masque les panneaux explicatifs ; ils reapparaissent en
      // rezoomant a l'interieur de la limite.
      if (farHidden) { if (shown) { wrap.classList.remove('on'); shown = false; } return; }
      const w = canvas.clientWidth, h = canvas.clientHeight;
      let anyVisible = false;
      for (const it of items) {
        it.sat.getWorldPosition(v).project(camera);
        const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
        const onScreen = v.z <= 1 && sx > -40 && sx < w + 40 && sy > -40 && sy < h + 40;
        if (!onScreen) { it.card.style.display = 'none'; it.line.style.display = 'none'; it.dot.style.display = 'none'; continue; }
        anyVisible = true;
        it.card.style.display = ''; it.line.style.display = ''; it.dot.style.display = '';
        let cx = sx + 28, anchorRight = false;
        if (cx + it.cw > w - 12) { cx = sx - 28 - it.cw; anchorRight = true; }
        const cy = Math.max(10, Math.min(h - 92, sy - 34));
        it.card.style.left = cx + 'px'; it.card.style.top = cy + 'px';
        const lx = anchorRight ? cx + it.cw : cx;
        it.line.setAttribute('x1', sx); it.line.setAttribute('y1', sy);
        it.line.setAttribute('x2', lx); it.line.setAttribute('y2', cy);
        it.dot.setAttribute('cx', sx); it.dot.setAttribute('cy', sy);
      }
      if (anyVisible && !shown) { wrap.classList.add('on'); shown = true; }
      else if (!anyVisible && shown) { wrap.classList.remove('on'); shown = false; }
    },
  };
}

// ── SYL ─────────────────────────────────────────────────────────────────────
// Répliques d'intro : [clé i18n, repli FR]
const LYA_INTRO = [
  ['lya.intro1', 'Bonjour, je suis SYL. Ravie de te rencontrer.'],
  ['lya.intro2', 'Regarde : chaque chose que tu fais dans ta vraie vie fait pousser ton arbre.'],
  ['lya.intro3', 'Le voilà épanoui. Touche une branche pour voir ce qui la nourrit.'],
];
let lyaSay = null;        // (label) => affiche la réplique « branche »
let lyaState = null;      // mémoire de la réplique courante (pour relocaliser)
let typeGen = 0;            // jeton anti-superposition du texte de SYL
function typeLine(el, text, done) {
  const gen = ++typeGen;   // toute frappe précédente est invalidée
  if (!el) return;
  el.textContent = '';
  let i = 0;
  const tick = () => {
    if (gen !== typeGen) return;          // une nouvelle frappe a démarré
    if (i <= text.length) {
      el.textContent = text.slice(0, i++);
      setTimeout(tick, 26 + Math.random() * 30);
    } else if (done) { done(); }
  };
  tick();
}
function speak(text, on) {
  if (!on || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR'; u.rate = 0.96; u.pitch = 1.05;
    const fr = speechSynthesis.getVoices().find((x) => x.lang.startsWith('fr'));
    if (fr) u.voice = fr;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}
// Texte d'une réplique « branche » selon la langue courante.
function branchLine(label) {
  return T('lya.branch', '%s - voici ce qui fait grandir cette branche.').replace('%s', label);
}
// Texte courant de SYL selon l'état mémorisé (pour relocalisation).
function lyaCurrentText() {
  if (!lyaState) return '';
  if (lyaState.type === 'branch') return branchLine(lyaState.label);
  return T(lyaState.key, lyaState.fb);
}

function initSYL() {
  const lineEl = document.getElementById('lya-line');
  const voiceBtn = document.getElementById('lya-voice');
  let voiceOn = false;
  const introTimers = [];
  const voiceLabel = () => (voiceOn ? '🔊 ' : '🔇 ') + T('lya.voice', 'Voix de SYL');
  if (voiceBtn) {
    voiceBtn.textContent = voiceLabel();
    voiceBtn.addEventListener('click', () => {
      voiceOn = !voiceOn;
      voiceBtn.classList.toggle('on', voiceOn);
      voiceBtn.setAttribute('aria-pressed', String(voiceOn));
      voiceBtn.textContent = voiceLabel();
      if (voiceOn && lineEl) speak(lineEl.textContent, true);
    });
  }
  const beats = [400, 3600, GROWTH_SECONDS * 1000 + 300];
  LYA_INTRO.forEach(([key, fb], i) => {
    introTimers.push(setTimeout(() => {
      lyaState = { type: 'key', key, fb };
      const text = T(key, fb);
      if (lineEl) { typeLine(lineEl, text); speak(text, voiceOn); }
    }, beats[i]));
  });
  // une nouvelle réplique annule l'intro encore en attente → plus de saut
  lyaSay = (label) => {
    introTimers.forEach(clearTimeout);
    lyaState = { type: 'branch', label };
    const text = branchLine(label);
    if (lineEl) { typeLine(lineEl, text); speak(text, voiceOn); }
  };
  // Changement de langue : re-typer la réplique courante + relibeller la voix.
  window.addEventListener('cyl:langchange', () => {
    if (voiceBtn) voiceBtn.textContent = voiceLabel();
    const text = lyaCurrentText();
    if (text && lineEl) typeLine(lineEl, text);
  });
}

// ── Init 3D ─────────────────────────────────────────────────────────────────
function initTree3D(canvas) {
  const { renderer, scene, camera, treeGroup, nodes, subNodes, grow, animateCosmos, setEarthLocation, infoSats, ez, orbits, plaque, gfx } = initScene(canvas);
  geolocateTree(setEarthLocation);
  let orbitT = 0;   // avancement de la révélation des tracés d'orbites (0..1)

  // ── Résolution dynamique : on mesure le FPS et on ajuste la finesse de rendu
  // pour rester fluide (= profite du Hz max de l'écran) sans jamais ramer.
  let renderScale = 1, fpsFrames = 0, fpsWinStart = 0;
  function adaptResolution(t) {
    fpsFrames++;
    if (!fpsWinStart) fpsWinStart = t;
    const span = t - fpsWinStart;
    if (span < 1) return;
    const fps = fpsFrames / span;
    fpsFrames = 0; fpsWinStart = t;
    let ns = renderScale;
    if (fps < 50) ns = Math.max(0.6, renderScale - 0.12);        // ça rame -> on allège
    else if (fps > 58 && renderScale < 1) ns = Math.min(1, renderScale + 0.08); // marge -> on raffine
    if (ns !== renderScale) {
      renderScale = ns;
      renderer.setPixelRatio(gfx.basePR * renderScale);
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix();
    }
  }
  const controls = initControls(canvas, camera);
  const labels = initLabels(nodes, subNodes);
  const satInfo = initSatInfo(infoSats);
  const hud = initHud();
  const branchPanel = initBranchPanel(() => { labels.hideSubs(); controls.setAutoRotate(true); });

  const scrub = document.getElementById('scrub');
  const playBtn = document.getElementById('scrub-play');
  const timeline = document.getElementById('timeline');

  let phase = 'auto';   // 'auto' | 'live' | 'scrub' | 'play'
  let age = 0;

  if (scrub) {
    scrub.addEventListener('input', () => {
      phase = 'scrub';
      age = Math.max(0, Math.min(1, Number(scrub.value) / 1000));
    });
    scrub.addEventListener('change', () => { if (age >= 0.999) phase = 'live'; });
  }
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (age >= 0.999) { age = 0; hud.resetBeats(); }
      phase = 'play';
    });
  }

  // ── Facilitateur de clic : on cible le nœud le plus PROCHE du curseur ────
  // (pas besoin de viser pile au centre - seuil généreux en pixels écran)
  const _proj = new THREE.Vector3();
  const growTarget = new THREE.Vector3();
  let hovered = null;
  let pointerDown = false;

  // ── Bouton URGENCE -> pointillés animés jusqu'au satellite SYL ──────────────
  const urgBtn = document.getElementById('urgence-btn');
  const urgSvg = document.getElementById('urgence-link');
  const urgPath = urgSvg && urgSvg.querySelector('path');
  const sylSat = (infoSats || []).find((s) => s.userData && s.userData.info === 'syl');
  const _projU = new THREE.Vector3();
  let urgenceOn = false;
  if (urgBtn) urgBtn.addEventListener('click', () => {
    urgenceOn = !urgenceOn;
    urgBtn.classList.toggle('active', urgenceOn);
    if (urgSvg) urgSvg.classList.toggle('on', urgenceOn);
    // ouvre aussi la fiche de SYL pour amorcer le contact
    if (urgenceOn && sylSat && SAT_INFO.syl) {
      branchPanel.openInfo({ title: SAT_INFO.syl.title, body: SAT_INFO.syl.body, color: '#7fd1ff', link: SAT_INFO.syl.link });
    }
  });
  function updateUrgence() {
    if (!urgenceOn || !urgPath || !sylSat || !urgBtn) return;
    const r = urgBtn.getBoundingClientRect();
    const bx = r.left + r.width / 2, by = r.top + r.height / 2;
    sylSat.getWorldPosition(_projU).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const sx = (_projU.x * 0.5 + 0.5) * w, sy = (-_projU.y * 0.5 + 0.5) * h;
    const mx = (bx + sx) / 2, my = Math.min(by, sy) - 70;   // courbe douce
    urgPath.setAttribute('d', `M ${bx.toFixed(1)} ${by.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${sx.toFixed(1)} ${sy.toFixed(1)}`);
  }
  function nearestNode(clientX, clientY) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    let best = null, bestD = 9999;
    for (const m of nodes) {
      m.getWorldPosition(_proj).project(camera);
      if (_proj.z > 1) continue;
      const sx = (_proj.x * 0.5 + 0.5) * w;
      const sy = (-_proj.y * 0.5 + 0.5) * h;
      const d = Math.hypot(sx - clientX, sy - clientY);
      if (d < bestD) { bestD = d; best = m; }
    }
    return bestD < 66 ? best : null;   // seuil ~66 px = clic facile
  }
  // Satellite explicatif le plus proche du curseur (cliquable -> panneau).
  function nearestSat(clientX, clientY) {
    if (!infoSats || !infoSats.length) return null;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    let best = null, bestD = 9999;
    for (const s of infoSats) {
      s.getWorldPosition(_proj).project(camera);
      if (_proj.z > 1) continue;
      const sx = (_proj.x * 0.5 + 0.5) * w;
      const sy = (-_proj.y * 0.5 + 0.5) * h;
      const d = Math.hypot(sx - clientX, sy - clientY);
      if (d < bestD) { bestD = d; best = s; }
    }
    return bestD < 48 ? best : null;
  }
  // La plaque de Pioneer est-elle cliquée ? (projection écran de son centre)
  function hitPlaque(clientX, clientY) {
    if (!plaque || !plaque.obj) return false;
    plaque.obj.getWorldPosition(_proj).project(camera);
    if (_proj.z > 1) return false;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const sx = (_proj.x * 0.5 + 0.5) * w, sy = (-_proj.y * 0.5 + 0.5) * h;
    return Math.hypot(sx - clientX, sy - clientY) < 64;
  }
  canvas.addEventListener('pointerdown', () => { pointerDown = true; });
  canvas.addEventListener('pointermove', (e) => {
    if (pointerDown || phase !== 'live') return;
    hovered = nearestNode(e.clientX, e.clientY);
    const overSat = !hovered && (nearestSat(e.clientX, e.clientY) || hitPlaque(e.clientX, e.clientY));
    canvas.style.cursor = (hovered || overSat) ? 'pointer' : '';
  });
  canvas.addEventListener('pointerup', (e) => {
    pointerDown = false;
    if (phase !== 'live' || controls.wasDrag()) return;
    // 0) clic sur la plaque de Pioneer -> explication
    if (hitPlaque(e.clientX, e.clientY)) {
      branchPanel.openInfo({
        title: '🛸 La plaque de Pioneer',
        body: "Gravée et envoyée dans l'espace en 1972 sur les sondes Pioneer : un message d'humanité aux étoiles. Elle dit qui nous sommes (un homme, une femme), où se trouve la Terre (carte de 14 pulsars) et notre système solaire. Comme cet arbre : une trace de ce que tu es, lancée vers l'avenir.",
        color: '#bcd0ff', link: { label: 'En savoir plus (Wikipédia) ↗', href: 'https://fr.wikipedia.org/wiki/Plaque_de_Pioneer' },
      });
      return;
    }
    // 1) clic sur un satellite explicatif -> panneau (comme une branche)
    const sat = nearestSat(e.clientX, e.clientY);
    if (sat) {
      const info = SAT_INFO[sat.userData.info];
      if (info) { branchPanel.openInfo({ title: info.title, body: info.body, color: '#7fd1ff', link: info.link }); return; }
    }
    // 2) sinon, clic sur une branche
    const hit = nearestNode(e.clientX, e.clientY);
    if (hit) {
      const u = hit.userData;
      branchPanel.open(u.key, u.label, u.color);
      labels.showSubs(u.key);
      if (lyaSay) lyaSay(u.label);
    }
  });

  let lastW = 0, lastH = 0;
  function maybeResize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w !== lastW || h !== lastH) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      lastW = w; lastH = h;
    }
  }

  const clock = new THREE.Clock();
  let lastT = 0, prevAge = 0, timelineReady = false, labelsOn = false;

  function enableTimeline() {
    if (scrub) scrub.disabled = false;
    if (playBtn) playBtn.disabled = false;
    if (timeline) timeline.classList.add('on');
  }

  function animate() {
    const t = clock.getElapsedTime();
    const dt = Math.min(0.1, t - lastT); lastT = t;
    adaptResolution(t);   // ajuste la résolution selon le FPS (fluide partout)

    if (phase === 'auto') {
      age = Math.min(1, t / GROWTH_SECONDS);
      if (age >= 1) { phase = 'live'; grow(1); }
    } else if (phase === 'play') {
      age = Math.min(1, age + dt / REPLAY_SECONDS);
      if (age >= 1) { phase = 'live'; grow(1); }
    }

    // pop-ups synchronisés à la position de la barre de temps
    hud.syncBeats(age, prevAge);
    prevAge = age;

    // Orbite lente des planètes (visible quand on dézoome)
    if (typeof animateCosmos === 'function') animateCosmos(dt);
    // l'étiquette suit le satellite ; masquée passé la plaque de Pioneer (dézoom)
    satInfo.update(camera, canvas, controls.getRadius() > 360);
    // Tracés d'orbites (atome) : se révèlent 1 par 1 au début, puis RESTENT.
    if (orbits) {
      orbitT = Math.min(1, orbitT + dt / 6);   // ~6 s pour dessiner l'atome complet
      orbits.setProgress(orbitT);
    }
    updateUrgence();   // pointillés bouton -> satellite SYL
    // Croissance animée de l'ez-tree : on remonte le plan de coupe (bas -> haut).
    if (ez.clip) {
      const e = easeOut(Math.min(1, Math.max(0, age)));
      ez.clip.plane.constant = ez.clip.baseY + e * (ez.clip.topY - ez.clip.baseY + 6);
    }

    if (phase === 'live') {
      treeGroup.rotation.z = Math.sin(t * 0.32) * 0.016;
      for (const m of nodes) {
        let mult = 1 + Math.sin(t * 2 + m.position.y) * 0.09;
        if (m === hovered) mult *= 1.4;          // facilitateur : survol → grossit
        m.scale.setScalar(m.userData.baseR * mult);
      }
      controls.autoSpin(dt);
      controls.apply();
      labels.update(camera, canvas);
      if (!labelsOn) { labels.reveal(); labelsOn = true; }
      if (scrub) scrub.value = '1000';
      hud.updateXp(1);
      if (!timelineReady) { timelineReady = true; enableTimeline(); }
    } else {
      grow(age);
      // La caméra suit la cime via les contrôles → l'arbre reste manipulable
      // (rotation, zoom) pendant toute la croissance.
      const e = easeOut(age);
      growTarget.set(0, 12 + e * 28, 0);
      controls.setRadius(70 + e * 130);  // dézoom +30% (repos ~200)
      controls.apply(growTarget);
      hud.updateXp(age);
      if (labelsOn) { labels.hide(); labelsOn = false; }
      if (phase !== 'scrub' && scrub) scrub.value = String(Math.round(age * 1000));
      if (!timelineReady && phase !== 'auto') { timelineReady = true; enableTimeline(); }
    }

    maybeResize();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

function init() {
  const canvas = document.getElementById('arbre-canvas');
  if (canvas) {
    try { initTree3D(canvas); }
    catch (e) { console.error('[arbre3d] init failed', e); }
  }
  initSYL();
  document.body.classList.add('tree-ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
