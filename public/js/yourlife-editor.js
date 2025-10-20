// Your Life Editor: interactive graph with drag, edit, categories, sleep branches, XP on completion
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

const $ = (id) => document.getElementById(id);

const colorByDomain = {
  body: '#2dd4bf',
  heart: '#ef4444',
  etre: '#9ca3ff',
  order: '#f59e0b'
};

function defaultGraph() {
  return {
    nodes: [
      { id:'root', label:'Moi', x:0, y:0, domain:'etre', color:'#9ca3ff', completed:false },
      { id:'needs', label:'Besoins fondamentaux', x:250, y:-150, domain:'body', color:'#2dd4bf' },
      { id:'sleep', label:'Sommeil', x:420, y:-200, domain:'body' },
      { id:'nutrition', label:'Nutrition', x:420, y:-150, domain:'body' },
      { id:'sante', label:'Santé', x:420, y:-100, domain:'body' },
      { id:'social', label:'Cercle social', x:220, y:40, domain:'heart', color:'#ef4444' },
      { id:'famille', label:'Famille', x:380, y:0, domain:'heart' },
      { id:'amis', label:'Amis', x:380, y:40, domain:'heart' },
      { id:'communaute', label:'Communauté', x:380, y:80, domain:'heart' },
      { id:'identite', label:'Identité', x:-250, y:-120, domain:'etre' },
      { id:'valeurs', label:'Valeurs', x:-420, y:-160, domain:'etre' },
      { id:'forces', label:'Forces', x:-420, y:-120, domain:'etre' },
      { id:'vision', label:'Vision', x:-420, y:-80, domain:'etre' },
      { id:'pro', label:'Professionnel', x:-220, y:120, domain:'order', color:'#f59e0b' },
      { id:'competences', label:'Compétences', x:-380, y:80, domain:'order' },
      { id:'objectifs', label:'Objectifs', x:-380, y:120, domain:'order' },
      { id:'organisation', label:'Organisation', x:-380, y:160, domain:'order' }
    ],
    edges: [
      ['root','needs'],['root','social'],['root','identite'],['root','pro'],
      ['needs','sleep'],['needs','nutrition'],['needs','sante'],
      ['social','famille'],['social','amis'],['social','communaute'],
      ['identite','valeurs'],['identite','forces'],['identite','vision'],
      ['pro','competences'],['pro','objectifs'],['pro','organisation']
    ]
  };
}

function toElements(graph) {
  const nodes = graph.nodes.map(n => ({ data: { id: n.id, label: n.label, domain: n.domain||'etre', completed: !!n.completed, asleep: !!n.asleep }, position: { x: n.x, y: n.y } }));
  const edges = graph.edges.map(([s,t],i) => ({ data: { id: 'e'+i, source: s, target: t }}));
  return nodes.concat(edges);
}

function fromCy(cy) {
  const nodes = cy.nodes().map(n => ({ id:n.id(), label:n.data('label')||'', domain:n.data('domain')||'etre', completed:!!n.data('completed'), asleep:!!n.data('asleep'), x:n.position('x'), y:n.position('y') }));
  const edges = cy.edges().map(e => [e.data('source'), e.data('target')]);
  return { nodes, edges };
}

async function award(domain, amount=5) {
  try {
    const addXp = httpsCallable(functions, 'addXp');
    await addXp({ domain, amount });
  } catch(e) {}
}

async function save(uid, cy) {
  const g = fromCy(cy);
  await setDoc(doc(db,'users',uid), { yourLifeGraph: g }, { merge: true });
}

async function load(uid) {
  const snap = await getDoc(doc(db,'users',uid));
  const data = snap.exists() ? (snap.data()||{}) : {};
  return data.yourLifeGraph || defaultGraph();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  const uid = user.uid;
  const initial = await load(uid);

  const cy = cytoscape({
    container: document.getElementById('cy-graph'),
    elements: toElements(initial),
    style: [
      {
        selector: 'node',
        style: {
          'background-color': ele => ele.data('completed') ? (colorByDomain[ele.data('domain')]||'#9ca3ff') : '#1f2937',
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'color': '#e5eef8',
          'text-outline-color': '#000',
          'text-outline-width': 0,
          'border-width': 2,
          'border-color': ele => ele.data('asleep') ? 'rgba(255,255,255,0.2)' : (colorByDomain[ele.data('domain')]||'#9ca3ff'),
          'width': ele => ele.id()==='root' ? 80 : 44,
          'height': ele => ele.id()==='root' ? 80 : 44,
          'shape': 'ellipse',
          'font-size': 10,
          'opacity': ele => ele.data('asleep') ? 0.5 : 1
        }
      },
      {
        selector: 'edge',
        style: {
          'line-color': 'rgba(255,255,255,0.25)',
          'width': 2,
          'curve-style': 'straight'
        }
      },
      { selector: '.selected', style: { 'border-color': '#60a5fa', 'border-width': 4 } }
    ],
    layout: { name: 'preset' },
    wheelSensitivity: 0.2
  });

  cy.on('tap', 'node', (evt) => {
    cy.elements().removeClass('selected');
    evt.target.addClass('selected');
    const n = evt.target; // load into sidebar
    $('node-label').value = n.data('label')||'';
    $('node-domain').value = n.data('domain')||'etre';
    $('node-color').value = colorByDomain[n.data('domain')]||'#9ca3ff';
    $('node-completed').checked = !!n.data('completed');
    $('node-asleep').checked = !!n.data('asleep');
  });

  cy.on('dragfree', 'node', async () => { await save(uid, cy); });

  // double-click to toggle completed and award XP
  let lastTap = 0;
  cy.on('tap', 'node', async (evt) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      const n = evt.target; const was = !!n.data('completed');
      n.data('completed', !was);
      if (!was) { await award(n.data('domain')||'etre', 5); }
      await save(uid, cy);
    }
    lastTap = now;
  });

  $('btn-fit').addEventListener('click', () => cy.fit(cy.elements(), 30));

  $('btn-save').addEventListener('click', async () => { await save(uid, cy); });

  $('btn-add').addEventListener('click', async () => {
    const id = 'n'+Math.random().toString(36).slice(2,7);
    cy.add({ data: { id, label: 'Nouveau', domain: 'etre' }, position: cy.center() });
    await save(uid, cy);
  });

  let linking = false; let linkSource = null;
  $('btn-add-edge').addEventListener('click', () => { linking = true; linkSource = null; alert('Clique une source puis une cible'); });
  cy.on('tap', 'node', async (evt) => {
    if (!linking) return;
    if (!linkSource) { linkSource = evt.target.id(); return; }
    const target = evt.target.id();
    if (linkSource !== target) {
      cy.add({ data: { id: 'e'+Math.random().toString(36).slice(2,7), source: linkSource, target } });
      await save(uid, cy);
    }
    linking = false; linkSource = null;
  });

  $('btn-delete').addEventListener('click', async () => {
    const sel = cy.$('.selected');
    if (sel.nonempty()) { sel.remove(); await save(uid, cy); }
  });

  $('btn-apply').addEventListener('click', async () => {
    const sel = cy.$('.selected'); if (sel.nonempty()) {
      const n = sel[0];
      n.data('label', $('node-label').value || '');
      n.data('domain', $('node-domain').value || 'etre');
      n.data('completed', $('node-completed').checked);
      n.data('asleep', $('node-asleep').checked);
      await save(uid, cy);
    }
  });
});
