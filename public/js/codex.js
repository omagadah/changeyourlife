// /codex/ - base de connaissances + notes user.
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { updateGlobalAvatar, toast } from '/js/common.js';
import { initUserMenu } from '/js/userMenu.js';

// ── Vanta bootstrap ──────────────────────────────────────────────────────────
function bootVanta() {
  try {
    if (window.VANTA && window.VANTA.BIRDS) {
      window.VANTA.BIRDS({el:"#vanta-bg",mouseControls:true,touchControls:true,backgroundColor:0x07192f,color1:0x7192ff,color2:0xd1ff,colorMode:"varianceGradient",quantity:3});
    } else {
      setTimeout(bootVanta, 80);
    }
  } catch (e) { /* ignore */ }
}
bootVanta();

if(!window._cyfFirebase){await import('/js/firebase.js');}
let {app,auth,db}=window._cyfFirebase;
let currentUser=null;
try { updateGlobalAvatar(); initUserMenu(); } catch(e){}
onAuthStateChanged(auth,u=>{currentUser=u;if(u)loadUserNotes();});

const COLORS={corps:'#2dd4bf',coeur:'#f87171',etre:'#a78bfa',ordre:'#fbbf24',gen:'#60aeff'};
const CAT_LABELS={corps:'Corps',coeur:'Cœur',etre:'Être',ordre:'Ordre'};
const HTML_ESCAPES={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,ch=>HTML_ESCAPES[ch]);
// User-supplied bodies are escaped then wrapped; built-in bodies are trusted hardcoded HTML.
const renderBody=(item)=>item.isUser
  ? '<p>'+esc(item.body||item.summary||'').replace(/\n+/g,'</p><p>')+'</p>'
  : (item.body||'<p>'+esc(item.summary||'')+'</p>');
const safeCat=(c)=>CAT_LABELS[c]||esc(c||'');

// ── BUILT-IN KNOWLEDGE BASE ───────────────────────────────────────────────────
const BUILT_IN=[
  // CORPS
  {id:'b1',cat:'corps',emoji:'😴',title:'Hygiène du sommeil',tagline:'La qualité de ton sommeil détermine 80% de ta performance.',
  summary:'Le sommeil est le levier n°1 de la récupération physique et mentale. 7 à 9 heures par nuit, avec une heure de coucher régulière.',
  body:`<h4>Principes clés</h4><ul><li>Couche-toi et lève-toi à la même heure chaque jour (même le week-end)</li><li>Évite les écrans 60 min avant de dormir (lumière bleue bloque la mélatonine)</li><li>Chambre fraîche (16-19°C) et entièrement sombre</li><li>Pas de caféine après 14h</li><li>Exposition à la lumière naturelle dès le matin</li></ul><h4>Protocole simple</h4><ul><li>21h30 : baisse les lumières, coupe les notifications</li><li>22h00 : lecture, stretching ou méditation</li><li>22h30 : extinction des lumières</li></ul><blockquote>"Le sommeil n'est pas une perte de temps, c'est la charge de ta batterie." - Matthew Walker</blockquote>`,
  tags:['sommeil','récupération','énergie','routine']},

  {id:'b2',cat:'corps',emoji:'🏃',title:'Entraînement par zone 2',tagline:'La base de la forme physique durable.',
  summary:'L\'entraînement en zone 2 (cardio modéré) est la fondation de l\'endurance. 80% de ton volume d\'entraînement devrait être à faible intensité.',
  body:`<h4>C'est quoi la Zone 2 ?</h4><p>Effort où tu peux tenir une conversation complète. FC entre 60-70% de ton max. Ressenti "confortable mais pas paresseux".</p><h4>Pourquoi c'est puissant</h4><ul><li>Augmente la densité des mitochondries (usines d'énergie cellulaire)</li><li>Améliore l'utilisation des graisses comme carburant</li><li>Récupération plus rapide et moins de blessures</li><li>Base pour tous les autres types d'effort</li></ul><h4>Plan minimal</h4><ul><li>3x 45 min/semaine de marche rapide, vélo ou natation modérée</li><li>Test : tu peux parler en phrases complètes = bonne zone</li></ul>`,
  tags:['sport','cardio','endurance','énergie']},

  {id:'b3',cat:'corps',emoji:'🥗',title:'Alimentation anti-inflammatoire',tagline:'Mange pour nourrir ton cerveau et ton énergie.',
  summary:'L\'alimentation impacte directement l\'humeur, l\'énergie et la cognition. Les bases : vraie nourriture, peu de transformé, protéines suffisantes.',
  body:`<h4>Les piliers</h4><ul><li><strong>Protéines</strong> : 1,6-2g/kg de poids corporel (viande, poisson, œufs, légumineuses)</li><li><strong>Oméga-3</strong> : saumon, sardines, noix, graines de chia (anti-inflammatoire)</li><li><strong>Légumes & fibres</strong> : microbiote = 2ème cerveau</li><li><strong>Hydratation</strong> : 30-40ml/kg/jour</li></ul><h4>À réduire</h4><ul><li>Sucres raffinés et ultra-transformés</li><li>Huiles végétales industrielles (tournesol, maïs)</li><li>Alcool (perturbateur du sommeil et de la testostérone)</li></ul>`,
  tags:['nutrition','énergie','santé','cerveau']},

  // CŒUR
  {id:'b4',cat:'coeur',emoji:'🧠',title:'Régulation émotionnelle',tagline:'Tes émotions sont des données, pas des ordres.',
  summary:'Apprendre à identifier et réguler ses émotions est la compétence de vie la plus sous-estimée. Elle se travaille comme un muscle.',
  body:`<h4>Le modèle STOP</h4><ul><li><strong>S</strong>top : pause volontaire dans la réaction</li><li><strong>T</strong>hink : qu'est-ce que je ressens vraiment ?</li><li><strong>O</strong>bserve : d'où vient cette émotion ?</li><li><strong>P</strong>roceed : quelle est la réponse utile ?</li></ul><h4>Techniques de régulation</h4><ul><li><strong>Respiration 4-7-8</strong> : inspire 4s, retiens 7s, expire 8s (active le parasympathique)</li><li><strong>Labeling</strong> : nommer précisément l'émotion réduit son intensité de 50%</li><li><strong>Journaling</strong> : écrire 10 min libère l'anxiété</li></ul><blockquote>"Entre le stimulus et la réponse, il y a un espace. Dans cet espace réside notre liberté." - Viktor Frankl</blockquote>`,
  tags:['émotions','mindset','stress','intelligence émotionnelle']},

  {id:'b5',cat:'coeur',emoji:'💬',title:'Communication non-violente (CNV)',tagline:'Exprimer ses besoins sans blesser ni se taire.',
  summary:'La CNV de Marshall Rosenberg est un cadre pour communiquer avec authenticité et empathie, même dans les conflits.',
  body:`<h4>Les 4 étapes (OSBD)</h4><ul><li><strong>O</strong>bservation : décrire les faits sans jugement ("Quand tu…")</li><li><strong>S</strong>entiment : exprimer ce que tu ressens ("Je me sens…")</li><li><strong>B</strong>esoin : identifier le besoin sous-jacent ("Parce que j'ai besoin de…")</li><li><strong>D</strong>emande : formuler une demande concrète et négociable ("Est-ce que tu pourrais…?")</li></ul><h4>Exemple</h4><blockquote>"Quand tu n'as pas répondu à mon message (observation), je me suis senti ignoré (sentiment) parce que j'ai besoin de connexion (besoin). Est-ce qu'on peut convenir d'un moment pour parler ? (demande)"</blockquote>`,
  tags:['communication','relations','conflits','empathie']},

  {id:'b6',cat:'coeur',emoji:'🤝',title:'Théorie de l\'attachement',tagline:'Comprendre ton style relationnel pour mieux t\'y adapter.',
  summary:'Notre style d\'attachement (sécure, anxieux, évitant) façonne toutes nos relations. Le reconnaître est la première étape pour le transformer.',
  body:`<h4>Les 3 styles principaux</h4><ul><li><strong>Sécure</strong> : à l'aise avec l'intimité et l'autonomie. Base saine.</li><li><strong>Anxieux</strong> : peur d'être abandonné, hypervigilant aux signaux relationnels</li><li><strong>Évitant</strong> : peur de l'intimité, tendance à l'autosuffisance défensive</li></ul><h4>Comment évoluer vers le sécure</h4><ul><li>Identifier ses réactions automatiques en relation</li><li>Thérapie (TCC, thérapie d'attachement)</li><li>Choisir des partenaires et amis au style sécure</li><li>Pratiquer la vulnérabilité graduelle</li></ul>`,
  tags:['relations','psychologie','attachement','couple']},

  // ÊTRE
  {id:'b7',cat:'etre',emoji:'🧭',title:'Ikigai - Raison d\'être',tagline:'Trouver l\'intersection de ce que tu aimes, sais faire, peux monétiser et dont le monde a besoin.',
  summary:'L\'Ikigai est un concept japonais pour trouver son sens profond. Il se situe à l\'intersection de 4 cercles.',
  body:`<h4>Les 4 cercles</h4><ul><li>Ce que tu <strong>aimes</strong> (passion)</li><li>Ce en quoi tu es <strong>bon(ne)</strong> (talent)</li><li>Ce dont le <strong>monde a besoin</strong> (mission)</li><li>Ce pour quoi tu peux être <strong>payé(e)</strong> (vocation)</li></ul><h4>Comment le trouver</h4><ul><li>Fais la liste de 20 activités qui te font perdre la notion du temps</li><li>Quels problèmes du monde t'indignent ou t'inspirent ?</li><li>Quels compliments reçois-tu régulièrement sans effort de ta part ?</li><li>L'intersection des réponses = ton Ikigai</li></ul><blockquote>"Un ikigai ne se trouve pas, il se construit dans l'action."</blockquote>`,
  tags:['sens','purpose','identité','carrière']},

  {id:'b8',cat:'etre',emoji:'🪞',title:'Modèle de croissance - Growth Mindset',tagline:'L\'intelligence n\'est pas fixe, elle se développe.',
  summary:'Carol Dweck a montré que croire que ses capacités sont modifiables (growth mindset) change radicalement les résultats à long terme.',
  body:`<h4>Fixed vs Growth</h4><ul><li><strong>Fixed</strong> : "Je suis nul en maths" → évite les défis, peur de l'échec</li><li><strong>Growth</strong> : "Je ne suis pas encore bon en maths" → cherche les défis, apprend de l'échec</li></ul><h4>Comment cultiver le Growth Mindset</h4><ul><li>Ajoute "encore" à chaque phrase limitative ("Je n'arrive pas encore à…")</li><li>Celebrate l'effort, pas le résultat</li><li>Vois les critiques comme un GPS, pas une attaque</li><li>Entoure-toi de personnes qui te challengent</li></ul>`,
  tags:['mindset','croissance','apprentissage','résilience']},

  {id:'b9',cat:'etre',emoji:'🧘',title:'Pleine conscience (Mindfulness)',tagline:'Être présent, pas parfait.',
  summary:'La pleine conscience est la capacité à observer ses pensées et émotions sans s\'y identifier. Pratique scientifiquement validée contre l\'anxiété et le stress.',
  body:`<h4>Les bases</h4><ul><li>Observer sans juger : les pensées sont des nuages, pas toi</li><li>Revenir au présent via les sens (respiration, corps, sons)</li><li>Pratiquer 10 min/jour = changements cérébraux mesurables en 8 semaines (MBSR)</li></ul><h4>Exercice de base - Scan corporel</h4><ul><li>Assieds-toi, ferme les yeux, respire naturellement</li><li>Dirige ton attention des pieds vers la tête</li><li>Note les sensations sans les analyser</li><li>Si une pensée arrive, observe-la et reviens au corps</li></ul><blockquote>"Tu ne peux pas arrêter les vagues, mais tu peux apprendre à surfer." - Jon Kabat-Zinn</blockquote>`,
  tags:['méditation','présence','stress','bien-être']},

  // ORDRE
  {id:'b10',cat:'ordre',emoji:'🎯',title:'Méthode OKR',tagline:'Objectifs clairs + indicateurs mesurables = exécution redoutable.',
  summary:'Les OKR (Objectives & Key Results) sont utilisés par Google, Intel et des milliers d\'équipes pour aligner ambition et action concrète.',
  body:`<h4>Structure</h4><ul><li><strong>Objective</strong> : ce que tu veux accomplir (inspirant, qualitatif)</li><li><strong>Key Results</strong> : comment tu mesures le succès (2-5 métriques concrètes)</li></ul><h4>Exemple personnel</h4><ul><li><strong>O :</strong> Devenir plus en forme physiquement ce trimestre</li><li><strong>KR1 :</strong> S'entraîner 3x/semaine pendant 90 jours</li><li><strong>KR2 :</strong> Perdre 4kg de masse grasse (mesure bimensuelle)</li><li><strong>KR3 :</strong> Courir 10km sans m'arrêter</li></ul><h4>Règles d'or</h4><ul><li>Max 3-5 objectives par trimestre</li><li>Un KR doit être binaire ou mesurable</li><li>Review hebdomadaire obligatoire</li></ul>`,
  tags:['objectifs','productivité','stratégie','carrière']},

  {id:'b11',cat:'ordre',emoji:'⏱',title:'Time Blocking',tagline:'Planifie tes heures avant que les autres ne le fassent.',
  summary:'Le time blocking consiste à assigner chaque tâche à un bloc horaire dédié dans ton calendrier. C\'est la méthode de Cal Newport et Elon Musk.',
  body:`<h4>Principe</h4><p>Plutôt qu'une to-do list, tu réserves des créneaux horaires pour chaque type de travail. Les tâches non planifiées n'existent pas.</p><h4>Mise en place</h4><ul><li><strong>Deep work blocks</strong> : 90-120 min de travail cognitif intense (matin, notifications off)</li><li><strong>Shallow work blocks</strong> : emails, réunions, admin (après-midi)</li><li><strong>Buffer blocks</strong> : 30 min entre les blocs pour absorber les imprévus</li></ul><h4>Règles</h4><ul><li>Planifie le lendemain soir (10 min)</li><li>Sois réaliste : plan 60% du temps max</li><li>Respecte les blocs comme des réunions externes</li></ul>`,
  tags:['productivité','temps','focus','organisation']},

  {id:'b12',cat:'ordre',emoji:'💰',title:'Règle des 50/30/20',tagline:'La base de toute liberté financière.',
  summary:'Budgétisation simple et universelle : 50% besoins, 30% envies, 20% épargne/investissement.',
  body:`<h4>La répartition</h4><ul><li><strong>50% - Besoins</strong> : loyer, nourriture, transport, assurances</li><li><strong>30% - Envies</strong> : restaurants, sorties, abonnements, voyage</li><li><strong>20% - Épargne</strong> : fonds d'urgence (3-6 mois de dépenses), investissement, remboursement dettes</li></ul><h4>Ordre de priorité pour l'épargne</h4><ul><li>D'abord : fonds d'urgence (3 mois de dépenses)</li><li>Ensuite : rembourser les dettes à taux élevé (>5%)</li><li>Puis : investissements long terme (index funds, immobilier)</li></ul><blockquote>"Ce n'est pas votre revenu qui vous rend riche, c'est vos habitudes." - Robert Kiyosaki</blockquote>`,
  tags:['finances','épargne','budget','liberté']},

  {id:'b13',cat:'ordre',emoji:'📦',title:'Méthode GTD (Getting Things Done)',tagline:'Vider son esprit pour mieux penser.',
  summary:'La GTD de David Allen est le système de productivité le plus influent au monde. Principe : ton cerveau est fait pour avoir des idées, pas pour les stocker.',
  body:`<h4>Les 5 étapes</h4><ul><li><strong>1. Capturer</strong> : tout noter dans un inbox unique (app, carnet)</li><li><strong>2. Clarifier</strong> : chaque élément est-il actionnable ? Si oui, quelle est la prochaine action ?</li><li><strong>3. Organiser</strong> : projets, actions suivantes, en attente, un jour/peut-être</li><li><strong>4. Réviser</strong> : review hebdomadaire de tout le système</li><li><strong>5. Engager</strong> : choisir la bonne tâche au bon moment</li></ul><h4>La règle des 2 minutes</h4><p>Si une action prend moins de 2 minutes, fais-la immédiatement. Ne la planifie pas.</p>`,
  tags:['productivité','organisation','GTD','clarté']},
];

// ── STATE ─────────────────────────────────────────────────────────────────────
let allItems=[...BUILT_IN];
let userNotes=[];
let currentCat='all';
let currentView='grid';
let activeItem=null;

// ── INIT ──────────────────────────────────────────────────────────────────────
updateCounts();renderCards();

function updateCounts(){
  const all=[...BUILT_IN,...userNotes];
  document.getElementById('cnt-all').textContent=all.length;
  ['corps','coeur','etre','ordre'].forEach(c=>{
    document.getElementById('cnt-'+c).textContent=all.filter(i=>i.cat===c).length;
  });
  document.getElementById('cnt-user').textContent=userNotes.length;
}

async function loadUserNotes(){
  if(!currentUser||!db)return;
  try{
    const q=query(collection(db,'codexNotes'),where('uid','==',currentUser.uid));
    const snap=await getDocs(q);
    userNotes=snap.docs.map(d=>({...d.data(),id:d.id,isUser:true}));
    allItems=[...BUILT_IN,...userNotes];
    updateCounts();renderCards();
  }catch(e){console.error('loadNotes',e);}
}

window.filterCat=(cat,btn)=>{
  currentCat=cat;
  document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const titles={all:'Tout le Codex',corps:'Corps',coeur:'Cœur',etre:'Être',ordre:'Ordre',user:'Mes notes'};
  document.getElementById('main-title').textContent=titles[cat]||'Codex';
  renderCards();
};

window.applyFilters=()=>renderCards();
window.setView=(v)=>{
  currentView=v;
  document.getElementById('vt-grid').classList.toggle('active',v==='grid');
  document.getElementById('vt-list').classList.toggle('active',v==='list');
  renderCards();
};

function getFiltered(){
  const search=document.getElementById('search-input').value.toLowerCase().trim();
  let items=[...BUILT_IN,...userNotes];
  if(currentCat==='user')items=userNotes;
  else if(currentCat!=='all')items=items.filter(i=>i.cat===currentCat);
  if(search)items=items.filter(i=>
    i.title.toLowerCase().includes(search)||
    i.summary.toLowerCase().includes(search)||
    (i.tags||[]).some(t=>t.includes(search))
  );
  return items;
}

function catColor(cat){return COLORS[cat]||COLORS.gen;}

function renderCards(){
  const items=getFiltered();
  const cont=document.getElementById('cards-container');
  cont.className=currentView==='grid'?'cards-grid':'cards-list';
  if(!items.length){cont.innerHTML='<div class="no-results"><div class="ni">🔍</div><p>Aucun résultat pour cette recherche.</p></div>';return;}
  cont.innerHTML=items.map((item,i)=>{
    const c=catColor(item.cat);
    const badgeStyle=`color:${c};border-color:${c}44;`;
    const tags=(item.tags||[]).slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
    const userBadge=item.isUser?'<span class="user-badge">Ma note</span>':'';
    const emoji=esc(item.emoji||'📌');
    const title=esc(item.title||'');
    const summary=esc(item.summary||'');
    const catLabel=safeCat(item.cat);
    if(currentView==='list'){
      return `<div class="ccard ccard-list" style="border-color:${c}22;" data-idx="${i}">
        <div class="ccard-emoji">${emoji}</div>
        <div class="cl-body">
          <h3>${title}</h3>
          <p style="color:var(--muted);font-size:0.8rem;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;">${summary}</p>
        </div>
        <div class="ccard-badge" style="${badgeStyle}">${catLabel}</div>
        ${userBadge}
      </div>`;
    }
    return `<div class="ccard" style="--c:${c};" data-idx="${i}">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${c};border-radius:16px 16px 0 0;"></div>
      <div class="ccard-top">
        <div class="ccard-emoji">${emoji}</div>
        <div class="ccard-badge" style="${badgeStyle}">${catLabel}</div>
      </div>
      <h3>${title}</h3>
      <p>${summary}</p>
      <div class="ccard-tags">${tags}${item.isUser?'<span class="tag" style="color:#60aeff;border-color:#60aeff33;">Ma note</span>':''}</div>
    </div>`;
  }).join('');

  // store filtered for modal ref
  window._filteredItems=items;
}

window.openConcept=(idx)=>{
  const items=window._filteredItems||getFiltered();
  const item=items[idx];if(!item)return;
  activeItem=item;
  const c=catColor(item.cat);
  document.getElementById('modal-content').innerHTML=`
    <div class="modal-emoji">${esc(item.emoji||'📌')}</div>
    <div class="modal-cat" style="color:${c};border-color:${c}44;">${safeCat(item.cat)}</div>
    <h2>${esc(item.title||'')}</h2>
    <div class="modal-tagline">${esc(item.tagline||item.summary||'')}</div>
    <div class="modal-body">${renderBody(item)}</div>
    <div class="modal-tags">${(item.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>`;
  document.getElementById('concept-modal').classList.add('open');
};

window.closeModal=(e)=>{if(e.target.id==='concept-modal')closeConceptModal();};
window.closeConceptModal=()=>document.getElementById('concept-modal').classList.remove('open');

// ADD NOTE
window.openAddModal=()=>document.getElementById('add-modal').classList.add('open');
window.closeAddModal=(e)=>{
  if(!e||e.target.id==='add-modal')document.getElementById('add-modal').classList.remove('open');
};

window.saveNote=async()=>{
  const title=document.getElementById('note-title').value.trim();
  const summary=document.getElementById('note-summary').value.trim();
  if(!title||!summary){alert('Titre et résumé obligatoires');return;}
  const note={
    title,summary,
    cat:document.getElementById('note-cat').value,
    body:document.getElementById('note-body').value.trim()||null,
    tags:document.getElementById('note-tags').value.split(',').map(t=>t.trim()).filter(Boolean),
    emoji:'📌',isUser:true,tagline:summary
  };
  if(currentUser&&db){
    try{
      const ref=await addDoc(collection(db,'codexNotes'),{...note,uid:currentUser.uid,createdAt:serverTimestamp()});
      note.id=ref.id;
      // XP via Cloud Function addXp → branche Cognitif (apprendre, noter, comprendre)
      try{ await window._cyfFirebase.awardXp('cognitif', 8); }catch(_){}
    }catch(e){
      // Ne PAS faire croire a un succes : sans return, la note serait ajoutee a
      // l'UI et la modale fermee alors que rien n'est persiste (perte silencieuse).
      console.error('saveNote',e);
      toast("Ta note n'a pas pu être enregistrée. Vérifie ta connexion et réessaie.", { type: 'error' });
      return;
    }
  }
  userNotes.push(note);allItems=[...BUILT_IN,...userNotes];
  updateCounts();renderCards();
  document.getElementById('add-modal').classList.remove('open');
  ['note-title','note-summary','note-body','note-tags'].forEach(id=>{document.getElementById(id).value='';});
};

// ── Event listeners (remplacent les onclick/oninput inline pour CSP stricte) ──
// Search input
const searchInput = document.getElementById('search-input');
if (searchInput) searchInput.addEventListener('input', () => window.applyFilters());

// Category buttons (sidebar)
document.querySelectorAll('.cat-btn[data-cat]').forEach(btn => {
  btn.addEventListener('click', () => window.filterCat(btn.dataset.cat, btn));
});

// View toggle (grille/liste)
document.querySelectorAll('.vt-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => window.setView(btn.dataset.view));
});

// Add note button
const btnAddNote = document.getElementById('btn-add-note');
if (btnAddNote) btnAddNote.addEventListener('click', () => window.openAddModal());

// Concept modal (overlay click + close button)
const conceptModal = document.getElementById('concept-modal');
if (conceptModal) conceptModal.addEventListener('click', (e) => window.closeModal(e));

// Add modal (overlay click + close button + cancel)
const addModal = document.getElementById('add-modal');
if (addModal) addModal.addEventListener('click', (e) => window.closeAddModal(e));

// Modal action buttons (delegated via data-action)
document.querySelectorAll('[data-action="close-concept"]').forEach(el => {
  el.addEventListener('click', (e) => { e.stopPropagation(); window.closeConceptModal(); });
});
document.querySelectorAll('[data-action="close-add"]').forEach(el => {
  el.addEventListener('click', (e) => { e.stopPropagation(); window.closeAddModal(); });
});
document.querySelectorAll('[data-action="save-note"]').forEach(el => {
  el.addEventListener('click', () => window.saveNote());
});

// Cards container - event delegation pour openConcept (cards générées dynamiquement)
const cardsContainer = document.getElementById('cards-container');
if (cardsContainer) {
  cardsContainer.addEventListener('click', (e) => {
    const card = e.target.closest('[data-idx]');
    if (!card) return;
    const idx = Number(card.dataset.idx);
    if (!Number.isNaN(idx)) window.openConcept(idx);
  });
}
