// Your Life: static skill tree UI (beta)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable, getFunctions } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

let app, auth, db, functions;
if (!window._cyfFirebase) {
  const firebaseConfig = {
    apiKey: "AIzaSyCvEtaivyC5QD0dGyPKh97IgYU8U8QrrWg",
    authDomain: "changeyourlife-cc210.firebaseapp.com",
    projectId: "changeyourlife-cc210",
    storageBucket: "changeyourlife-cc210.appspot.com",
    messagingSenderId: "801720080785",
    appId: "1:801720080785:web:1a74aadba5755ea26c2230"
  };
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  window._cyfFirebase = { app, auth, db };
} else {
  ({ app, auth, db } = window._cyfFirebase);
  try { functions = getFunctions(app); } catch (e) {}
}

const $ = (s) => document.querySelector(s);

// Basic tree data (beta) inspired by screenshot
const tree = {
  id: 'root', label: 'Moi', x: 400, y: 320, children: [
    { id: 'needs', label: 'Besoins fondamentaux', x: 720, y: 160, domain: 'body', children: [
      { id: 'sleep', label: 'Sommeil', x: 860, y: 120, domain: 'body' },
      { id: 'nutrition', label: 'Nutrition', x: 860, y: 160, domain: 'body' },
      { id: 'sante', label: 'Santé', x: 860, y: 200, domain: 'body' },
    ]},
    { id: 'social', label: 'Cercle social', x: 660, y: 380, domain: 'heart', children: [
      { id: 'famille', label: 'Famille', x: 800, y: 340, domain: 'heart' },
      { id: 'amis', label: 'Amis', x: 800, y: 380, domain: 'heart' },
      { id: 'communaute', label: 'Communauté', x: 800, y: 420, domain: 'heart' },
    ]},
    { id: 'identite', label: 'Identité', x: 280, y: 180, domain: 'etre', children: [
      { id: 'valeurs', label: 'Valeurs', x: 140, y: 140, domain: 'etre' },
      { id: 'forces', label: 'Forces', x: 140, y: 180, domain: 'etre' },
      { id: 'vision', label: 'Vision', x: 140, y: 220, domain: 'etre' },
    ]},
    { id: 'pro', label: 'Professionnel', x: 280, y: 460, domain: 'order', children: [
      { id: 'competences', label: 'Compétences', x: 140, y: 420, domain: 'order' },
      { id: 'objectifs', label: 'Objectifs', x: 140, y: 460, domain: 'order' },
      { id: 'organisation', label: 'Organisation', x: 140, y: 500, domain: 'order' },
    ]},
  ]
};

function walk(node, cb) { cb(node); (node.children||[]).forEach(ch => walk(ch, cb)); }

function renderTree(svg, state) {
  // clear
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const make = (n) => document.createElementNS('http://www.w3.org/2000/svg', n);
  const gEdges = make('g'); svg.appendChild(gEdges);
  const gNodes = make('g'); svg.appendChild(gNodes);

  const pos = {}; walk(tree, n => { pos[n.id] = { x: n.x, y: n.y }; });
  // edges
  walk(tree, n => {
    (n.children||[]).forEach(ch => {
      const p = pos[n.id], c = pos[ch.id];
      const line = make('line');
      line.setAttribute('x1', p.x); line.setAttribute('y1', p.y);
      line.setAttribute('x2', c.x); line.setAttribute('y2', c.y);
      line.setAttribute('stroke', 'rgba(255,255,255,0.2)');
      line.setAttribute('stroke-width', '2');
      gEdges.appendChild(line);
    });
  });

  // nodes
  walk(tree, n => {
    const group = make('g'); group.setAttribute('transform', `translate(${n.x},${n.y})`);
    const isRoot = n.id === 'root';
    const completed = !!state[n.id];
    const radius = isRoot ? 46 : 22;
    const colorMap = { body:'#2dd4bf', heart:'#ef4444', etre:'#9ca3ff', order:'#f59e0b' };
    const color = completed ? (colorMap[n.domain]||'#60a5fa') : 'rgba(255,255,255,0.15)';

    const circle = make('circle'); circle.setAttribute('r', radius); circle.setAttribute('cx', 0); circle.setAttribute('cy', 0);
    circle.setAttribute('fill', 'rgba(0,0,0,0.35)'); circle.setAttribute('stroke', color); circle.setAttribute('stroke-width', isRoot? '6':'3');
    group.appendChild(circle);

    const label = make('text'); label.textContent = n.label; label.setAttribute('fill', '#e5eef8'); label.setAttribute('font-size', isRoot? '14':'12');
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('y', isRoot? 70: 40);
    gNodes.appendChild(group); group.appendChild(label);

    // click to toggle progress and award XP
    group.style.cursor = 'pointer';
    group.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newVal = !state[n.id]; state[n.id] = newVal;
      renderTree(svg, state);
      try {
        const uid = auth?.currentUser?.uid; if (!uid) return;
        await setDoc(doc(db,'users',uid), { yourLife: state }, { merge: true });
        if (n.domain) {
          const addXp = httpsCallable(functions, 'addXp');
          await addXp({ domain: n.domain, amount: newVal ? 5 : 0 });
        }
      } catch (e) {}
    });
  });
}

async function loadState(uid) {
  const snap = await getDoc(doc(db,'users',uid));
  const data = snap.exists() ? (snap.data()||{}) : {};
  return data.yourLife || {};
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  const svg = document.getElementById('yourlife-svg');
  const state = await loadState(user.uid);
  renderTree(svg, state);
});
