// /js/arbre3d.js — Page d'accueil : arbre de vie procédural + croissance + Lya.
// Cf. docs/VISION.md, docs/ARCHITECTURE.md.
//
// v7 — fix du texte de Lya (plus de superposition au clic rapide), flux de
// pop-ups « tâche accomplie » (satisfaisant), panneau explicatif au clic sur
// une branche. Barre de temps + caméra cinématique conservées.

import * as THREE from '/vendor/three/three.module.min.js';
import { createDemoModel, buildTree } from '/js/tree-model.js';

const ORBIT_TARGET = new THREE.Vector3(0, 40, 0);
const GROWTH_SECONDS = 9;
const REPLAY_SECONDS = 4.5;
const TOTAL_XP = 24800;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

// ── Contenu des 8 dimensions = 8 niveaux de la pyramide de Maslow ───────────
const BRANCHES_INFO = {
  physio: {
    desc: 'Le besoin vital — la base de tout. Sans énergie ni sommeil, rien d’autre ne tient debout.',
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
    desc: 'Se sentir à l’abri — un toit, des ressources, un lendemain serein.',
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
    desc: 'Être reconnu — et d’abord se reconnaître soi-même de la valeur.',
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
    desc: 'Le besoin de beauté, d’harmonie et d’ordre — autour de soi et en soi.',
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
    desc: 'Devenir pleinement soi — réaliser son potentiel.',
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
    desc: 'Aller au-delà de soi — donner du sens, contribuer, transmettre. La cime s’épanouit tard, et c’est normal.',
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

// ── Scène ───────────────────────────────────────────────────────────────────
function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.7;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    42, canvas.clientWidth / canvas.clientHeight, 0.1, 900);

  scene.add(new THREE.HemisphereLight(0x9ecaff, 0x070e1a, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(30, 70, 36);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x4a90e2, 0.7);
  fill.position.set(-36, 30, -20);
  scene.add(fill);

  const { group, nodes, grow } = buildTree(THREE, createDemoModel());
  scene.add(group);
  return { renderer, scene, camera, treeGroup: group, nodes, grow };
}

// ── Contrôles : orbite (glisser) + zoom borné (molette) ─────────────────────
function initControls(canvas, camera) {
  const s = {
    azimuth: 0.5, polar: 1.06, radius: 110,
    tAz: 0.5, tPo: 1.06, tR: 110,
    minR: 64, maxR: 205, minPo: 0.55, maxPo: 1.45,
  };
  let dragging = false, moved = false, px = 0, py = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = false; px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    px = e.clientX; py = e.clientY;
    s.tAz -= dx * 0.006;
    s.tPo = Math.min(s.maxPo, Math.max(s.minPo, s.tPo - dy * 0.005));
  });
  const end = (e) => {
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    s.tR = Math.min(s.maxR, Math.max(s.minR, s.tR + e.deltaY * 0.06));
  }, { passive: false });

  return {
    apply() {
      s.azimuth += (s.tAz - s.azimuth) * 0.12;
      s.polar += (s.tPo - s.polar) * 0.12;
      s.radius += (s.tR - s.radius) * 0.12;
      const sp = Math.sin(s.polar), cp = Math.cos(s.polar);
      camera.position.set(
        ORBIT_TARGET.x + s.radius * sp * Math.sin(s.azimuth),
        ORBIT_TARGET.y + s.radius * cp,
        ORBIT_TARGET.z + s.radius * sp * Math.cos(s.azimuth));
      camera.lookAt(ORBIT_TARGET);
    },
    wasDrag: () => moved,
  };
}

function growthCamera(camera, age) {
  const e = easeOut(age);
  const targetY = 12 + e * 28;
  const radius = 58 + e * 52;
  const sp = Math.sin(1.06), cp = Math.cos(1.06);
  camera.position.set(
    radius * sp * Math.sin(0.5),
    targetY + radius * cp,
    radius * sp * Math.cos(0.5));
  camera.lookAt(0, targetY, 0);
}

// ── HUD : compteur XP + flux de pop-ups « tâche accomplie » ─────────────────
const BEATS = [
  { at: 0.10, icon: '🌅', task: 'Réveil en pleine forme', xp: '+60 XP' },
  { at: 0.18, icon: '🧘', task: 'Méditation du matin', xp: '+180 XP' },
  { at: 0.26, icon: '💧', task: 'Hydratation', xp: '+40 XP' },
  { at: 0.34, icon: '📓', task: 'Journal du jour', xp: '+120 XP' },
  { at: 0.42, icon: '🏃', task: 'Séance de sport', xp: '+260 XP' },
  { at: 0.50, icon: '🎯', task: 'Objectif atteint', xp: '+420 XP' },
  { at: 0.58, icon: '🙏', task: 'Gratitude notée', xp: '+90 XP' },
  { at: 0.66, icon: '📚', task: '30 min de lecture', xp: '+140 XP' },
  { at: 0.73, icon: '🤝', task: 'Appel à un proche', xp: '+160 XP' },
  { at: 0.80, icon: '😴', task: 'Nuit réparatrice', xp: '+150 XP' },
  { at: 0.87, icon: '✅', task: 'Habitude tenue 7 jours', xp: '+300 XP' },
  { at: 0.93, icon: '🏆', task: 'Nouveau palier de niveau', xp: '+500 XP' },
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
      stageEl.textContent = age < 0.12 ? 'Sapling'
        : age < 0.42 ? 'Jeune arbre'
        : age < 0.78 ? 'Arbre mature' : 'Arbre centenaire';
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
      `<span class="bd"><span class="nm">${b.task}</span><span class="xp">${b.xp}</span></span>` +
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
function initBranchPanel() {
  const panel = document.getElementById('branch-panel');
  const dot = document.getElementById('bp-dot');
  const title = document.getElementById('bp-title');
  const desc = document.getElementById('bp-desc');
  const subsEl = document.getElementById('bp-subs');
  const modsEl = document.getElementById('bp-modules');
  const closeBtn = document.getElementById('bp-close');

  function close() { if (panel) panel.classList.remove('open'); }
  if (closeBtn) closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  function open(key, label, colorHex) {
    const info = BRANCHES_INFO[key];
    if (!panel || !info) return;
    const col = '#' + colorHex.toString(16).padStart(6, '0');
    if (dot) dot.style.background = col;
    if (title) { title.textContent = label; title.style.color = col; }
    if (desc) desc.textContent = info.desc;
    if (subsEl) {
      subsEl.innerHTML = '';
      info.subs.forEach(([name, note], i) => {
        const row = document.createElement('div');
        row.className = 'bp-sub';
        row.style.animationDelay = (0.12 + i * 0.09) + 's';
        row.innerHTML =
          `<span class="bp-sub-dot" style="background:${col}"></span>` +
          `<span class="bp-sub-txt"><b>${name}</b>${note}</span>`;
        subsEl.appendChild(row);
      });
    }
    if (modsEl) modsEl.textContent = info.modules;
    panel.classList.add('open');
  }
  return { open, close };
}

// ── Labels HTML projetés (style ESP) ────────────────────────────────────────
function initLabels(nodes) {
  const css = document.createElement('style');
  css.textContent = `
    .esp-labels{position:absolute;inset:0;pointer-events:none;z-index:2;
      opacity:0;transition:opacity .6s;}
    .esp-labels.on{opacity:1;}
    .esp-label{position:absolute;transform:translate(-50%,-50%);
      font:600 11px -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.6px;
      text-transform:uppercase;white-space:nowrap;padding:2px 8px;border-radius:6px;
      background:rgba(6,14,26,0.72);border:1px solid rgba(255,255,255,0.14);}
  `;
  document.head.appendChild(css);
  const wrap = document.createElement('div');
  wrap.className = 'esp-labels';
  document.querySelector('.scene')?.appendChild(wrap);

  const labels = nodes.map((m) => {
    const el = document.createElement('div');
    el.className = 'esp-label';
    el.textContent = m.userData.label;
    el.style.color = '#' + m.userData.color.toString(16).padStart(6, '0');
    if (m.userData.state === 'dormant') el.style.opacity = '0.55';
    wrap.appendChild(el);
    return { el, mesh: m };
  });
  const v = new THREE.Vector3();
  return {
    reveal: () => wrap.classList.add('on'),
    hide: () => wrap.classList.remove('on'),
    update(camera, canvas) {
      for (const { el, mesh } of labels) {
        mesh.getWorldPosition(v).project(camera);
        if (v.z > 1) { el.style.visibility = 'hidden'; continue; }
        el.style.visibility = 'visible';
        el.style.left = ((v.x * 0.5 + 0.5) * canvas.clientWidth) + 'px';
        el.style.top = ((-v.y * 0.5 + 0.5) * canvas.clientHeight - 24) + 'px';
      }
    },
  };
}

// ── Lya ─────────────────────────────────────────────────────────────────────
const LYA_LINES = [
  'Bonjour. Je m’appelle Lya.',
  'Regarde — chaque chose que tu accomplis fait grandir ton arbre.',
  'Le voilà adulte. Touche une branche pour l’explorer.',
];
let lyaSay = null;
let typeGen = 0;            // jeton anti-superposition du texte de Lya
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
function initLya() {
  const lineEl = document.getElementById('lya-line');
  const voiceBtn = document.getElementById('lya-voice');
  let voiceOn = false;
  const introTimers = [];
  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      voiceOn = !voiceOn;
      voiceBtn.classList.toggle('on', voiceOn);
      voiceBtn.setAttribute('aria-pressed', String(voiceOn));
      voiceBtn.textContent = voiceOn ? '🔊 Voix de Lya' : '🔇 Voix de Lya';
      if (voiceOn && lineEl) speak(lineEl.textContent, true);
    });
  }
  const beats = [400, 3600, GROWTH_SECONDS * 1000 + 300];
  LYA_LINES.forEach((text, i) => {
    introTimers.push(setTimeout(() => {
      if (lineEl) { typeLine(lineEl, text); speak(text, voiceOn); }
    }, beats[i]));
  });
  // une nouvelle réplique annule l'intro encore en attente → plus de saut
  lyaSay = (text) => {
    introTimers.forEach(clearTimeout);
    if (lineEl) { typeLine(lineEl, text); speak(text, voiceOn); }
  };
}

// ── Init 3D ─────────────────────────────────────────────────────────────────
function initTree3D(canvas) {
  const { renderer, scene, camera, treeGroup, nodes, grow } = initScene(canvas);
  const controls = initControls(canvas, camera);
  const labels = initLabels(nodes);
  const hud = initHud();
  const branchPanel = initBranchPanel();

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
  // (pas besoin de viser pile au centre — seuil généreux en pixels écran)
  const _proj = new THREE.Vector3();
  let hovered = null;
  let pointerDown = false;
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
  canvas.addEventListener('pointerdown', () => { pointerDown = true; });
  canvas.addEventListener('pointermove', (e) => {
    if (pointerDown || phase !== 'live') return;
    hovered = nearestNode(e.clientX, e.clientY);
    canvas.style.cursor = hovered ? 'pointer' : '';
  });
  canvas.addEventListener('pointerup', (e) => {
    pointerDown = false;
    if (phase !== 'live' || controls.wasDrag()) return;
    const hit = nearestNode(e.clientX, e.clientY);
    if (hit) {
      const u = hit.userData;
      branchPanel.open(u.key, u.label, u.color);
      if (lyaSay) lyaSay(`${u.label} — voici ce qui fait grandir cette branche.`);
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

    if (phase === 'live') {
      treeGroup.rotation.z = Math.sin(t * 0.32) * 0.016;
      for (const m of nodes) {
        let mult = 1 + Math.sin(t * 2 + m.position.y) * 0.09;
        if (m === hovered) mult *= 1.4;          // facilitateur : survol → grossit
        m.scale.setScalar(m.userData.baseR * mult);
      }
      controls.apply();
      labels.update(camera, canvas);
      if (!labelsOn) { labels.reveal(); labelsOn = true; }
      if (scrub) scrub.value = '1000';
      hud.updateXp(1);
      if (!timelineReady) { timelineReady = true; enableTimeline(); }
    } else {
      grow(age);
      growthCamera(camera, age);
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
  initLya();
  document.body.classList.add('tree-ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
