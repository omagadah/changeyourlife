// Arbre de compétences basé sur la Pyramide de Maslow
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCvEtaivyC5QD0dGyPKh97IgYU8U8QrrWg",
  authDomain: "changeyourlife-cc210.firebaseapp.com",
  projectId: "changeyourlife-cc210",
  storageBucket: "changeyourlife-cc210.appspot.com",
  messagingSenderId: "801720080785",
  appId: "1:801720080785:web:1a74aadba5755ea26c2230"
};

let app, auth, db;
if (!window._cyfFirebase) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  window._cyfFirebase = { app, auth, db };
} else {
  ({ app, auth, db } = window._cyfFirebase);
}

// Couleurs par catégorie
const categoryColors = {
  physiological: '#FF6B6B',    // Rouge
  safety: '#FFA500',            // Orange
  love: '#FFD700',              // Or
  esteem: '#4ECDC4',            // Turquoise
  'self-actualization': '#95E1D3' // Vert menthe
};

// Données par défaut - Pyramide de Maslow
const defaultSkillTree = {
  nodes: [
    // Racine
    { id: 'root', label: 'Moi', category: 'physiological', x: 0, y: 0, completed: false },
    
    // Niveau 1: Besoins Physiologiques
    { id: 'phys-1', label: 'Sommeil', category: 'physiological', x: -300, y: -200, completed: false },
    { id: 'phys-2', label: 'Nutrition', category: 'physiological', x: -100, y: -250, completed: false },
    { id: 'phys-3', label: 'Exercice', category: 'physiological', x: 100, y: -250, completed: false },
    { id: 'phys-4', label: 'Santé', category: 'physiological', x: 300, y: -200, completed: false },
    
    // Niveau 2: Sécurité
    { id: 'safe-1', label: 'Sécurité Financière', category: 'safety', x: -350, y: -50, completed: false },
    { id: 'safe-2', label: 'Stabilité', category: 'safety', x: -150, y: -80, completed: false },
    { id: 'safe-3', label: 'Protection', category: 'safety', x: 150, y: -80, completed: false },
    { id: 'safe-4', label: 'Confiance', category: 'safety', x: 350, y: -50, completed: false },
    
    // Niveau 3: Amour & Appartenance
    { id: 'love-1', label: 'Famille', category: 'love', x: -300, y: 100, completed: false },
    { id: 'love-2', label: 'Amis', category: 'love', x: -100, y: 120, completed: false },
    { id: 'love-3', label: 'Communauté', category: 'love', x: 100, y: 120, completed: false },
    { id: 'love-4', label: 'Relations', category: 'love', x: 300, y: 100, completed: false },
    
    // Niveau 4: Estime de Soi
    { id: 'esteem-1', label: 'Confiance', category: 'esteem', x: -280, y: 250, completed: false },
    { id: 'esteem-2', label: 'Compétences', category: 'esteem', x: -80, y: 280, completed: false },
    { id: 'esteem-3', label: 'Réussite', category: 'esteem', x: 120, y: 280, completed: false },
    { id: 'esteem-4', label: 'Reconnaissance', category: 'esteem', x: 320, y: 250, completed: false },
    
    // Niveau 5: Réalisation de Soi
    { id: 'self-1', label: 'Créativité', category: 'self-actualization', x: -250, y: 400, completed: false },
    { id: 'self-2', label: 'Spiritualité', category: 'self-actualization', x: -50, y: 430, completed: false },
    { id: 'self-3', label: 'Développement', category: 'self-actualization', x: 150, y: 430, completed: false },
    { id: 'self-4', label: 'Contribution', category: 'self-actualization', x: 350, y: 400, completed: false }
  ],
  edges: [
    // Racine vers Niveau 1
    ['root', 'phys-1'], ['root', 'phys-2'], ['root', 'phys-3'], ['root', 'phys-4'],
    // Niveau 1 vers Niveau 2
    ['phys-1', 'safe-1'], ['phys-2', 'safe-2'], ['phys-3', 'safe-3'], ['phys-4', 'safe-4'],
    // Niveau 2 vers Niveau 3
    ['safe-1', 'love-1'], ['safe-2', 'love-2'], ['safe-3', 'love-3'], ['safe-4', 'love-4'],
    // Niveau 3 vers Niveau 4
    ['love-1', 'esteem-1'], ['love-2', 'esteem-2'], ['love-3', 'esteem-3'], ['love-4', 'esteem-4'],
    // Niveau 4 vers Niveau 5
    ['esteem-1', 'self-1'], ['esteem-2', 'self-2'], ['esteem-3', 'self-3'], ['esteem-4', 'self-4']
  ]
};

// Convertir les données en format Cytoscape
function toElements(data) {
  const nodes = data.nodes.map(n => ({
    data: {
      id: n.id,
      label: n.label,
      category: n.category,
      completed: n.completed
    },
    position: { x: n.x, y: n.y }
  }));
  
  const edges = data.edges.map((e, i) => ({
    data: { id: `e${i}`, source: e[0], target: e[1] }
  }));
  
  return nodes.concat(edges);
}

// Charger les données depuis Firestore
async function loadSkillTree(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists() && snap.data().skillTree) {
      return snap.data().skillTree;
    }
  } catch (e) {
    console.error('Erreur chargement:', e);
  }
  return defaultSkillTree;
}

// Sauvegarder les données
async function saveSkillTree(uid, data) {
  try {
    await setDoc(doc(db, 'users', uid), { skillTree: data }, { merge: true });
    document.getElementById('save-status').textContent = 'Sauvegardé ✓';
    setTimeout(() => {
      document.getElementById('save-status').textContent = 'Prêt';
    }, 2000);
  } catch (e) {
    console.error('Erreur sauvegarde:', e);
    document.getElementById('save-status').textContent = 'Erreur!';
  }
}

// Initialiser Cytoscape
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/login';
    return;
  }

  const uid = user.uid;
  const skillTree = await loadSkillTree(uid);

  const cy = cytoscape({
    container: document.getElementById('cy-container'),
    elements: toElements(skillTree),
    style: [
      {
        selector: 'node',
        style: {
          'background-color': node => {
            const category = node.data('category');
            return node.data('completed') ? categoryColors[category] : '#2a2a2a';
          },
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'color': '#fff',
          'font-size': 12,
          'width': 60,
          'height': 60,
          'border-width': 2,
          'border-color': node => categoryColors[node.data('category')],
          'opacity': node => node.data('completed') ? 1 : 0.7,
          'text-outline-width': 2,
          'text-outline-color': '#000'
        }
      },
      {
        selector: 'edge',
        style: {
          'line-color': 'rgba(255, 255, 255, 0.2)',
          'width': 2,
          'curve-style': 'bezier',
          'target-arrow-color': 'rgba(255, 255, 255, 0.2)',
          'target-arrow-shape': 'triangle'
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#0070f3',
          'box-shadow': '0 0 20px rgba(0, 112, 243, 0.6)'
        }
      }
    ],
    layout: { name: 'preset' },
    wheelSensitivity: 0.1
  });

  // Centrer le graphe
  function fitGraph() {
    cy.fit(cy.elements(), 50);
  }

  setTimeout(fitGraph, 100);

  // Bouton Centrer
  document.getElementById('btn-fit').addEventListener('click', fitGraph);

  // Bouton Réinitialiser
  document.getElementById('btn-reset').addEventListener('click', async () => {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser l\'arbre ?')) {
      cy.elements().remove();
      cy.add(toElements(defaultSkillTree));
      fitGraph();
      await saveSkillTree(uid, defaultSkillTree);
    }
  });

  // Clic sur un nœud
  let selectedNode = null;
  cy.on('tap', 'node', (evt) => {
    selectedNode = evt.target;
    cy.elements().unselect();
    selectedNode.select();

    // Remplir le formulaire
    document.getElementById('node-label').value = selectedNode.data('label');
    document.getElementById('node-category').value = selectedNode.data('category');
    document.getElementById('node-completed').checked = selectedNode.data('completed');
  });

  // Double-clic pour marquer comme accompli
  let lastTap = 0;
  cy.on('tap', 'node', (evt) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      const node = evt.target;
      const completed = !node.data('completed');
      node.data('completed', completed);
      document.getElementById('node-completed').checked = completed;
      updateStats();
      saveData();
    }
    lastTap = now;
  });

  // Mettre à jour les données
  function updateData() {
    if (!selectedNode) return;
    selectedNode.data('label', document.getElementById('node-label').value);
    selectedNode.data('category', document.getElementById('node-category').value);
    selectedNode.data('completed', document.getElementById('node-completed').checked);
    updateStats();
    saveData();
  }

  // Mettre à jour les statistiques
  function updateStats() {
    const nodes = cy.nodes();
    const total = nodes.length - 1; // Exclure la racine
    const completed = nodes.filter(n => n.data('completed')).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('stat-nodes').textContent = total;
    document.getElementById('stat-completed').textContent = completed;
    document.getElementById('stat-progress').textContent = progress + '%';
  }

  // Sauvegarder les données
  async function saveData() {
    const nodes = cy.nodes().map(n => ({
      id: n.id(),
      label: n.data('label'),
      category: n.data('category'),
      completed: n.data('completed'),
      x: n.position('x'),
      y: n.position('y')
    }));

    const edges = cy.edges().map(e => [e.data('source'), e.data('target')]);

    await saveSkillTree(uid, { nodes, edges });
  }

  // Événements du formulaire
  document.getElementById('node-label').addEventListener('input', updateData);
  document.getElementById('node-category').addEventListener('change', updateData);
  document.getElementById('node-completed').addEventListener('change', updateData);

  // Sauvegarder quand on déplace un nœud
  cy.on('dragfree', 'node', saveData);

  // Initialiser les statistiques
  updateStats();
});
