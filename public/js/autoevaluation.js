// /autoevaluation/ — Roue de Vie 4 axes, quiz + radar + historique.
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { updateGlobalAvatar } from '/js/common.js';
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
try { updateGlobalAvatar(); initUserMenu(); } catch(e){}

const DOMAINS=[
  {key:'corps',label:'Corps',color:'#2dd4bf',emoji:'💪',questions:[
    "Comment évalues-tu ton niveau d'énergie physique au quotidien ?",
    "Es-tu satisfait(e) de la qualité de ton sommeil (durée, récupération) ?",
    "Pratiques-tu une activité physique régulière (sport, marche, etc.) ?",
    "Comment évalues-tu la qualité de tes habitudes alimentaires ?",
    "Ton corps te semble-t-il en bonne santé générale ?"
  ]},
  {key:'coeur',label:'Cœur',color:'#f87171',emoji:'❤️',questions:[
    "Comment évalues-tu la qualité de tes relations proches (famille, amis) ?",
    "Te sens-tu émotionnellement équilibré(e) la plupart du temps ?",
    "Es-tu satisfait(e) de ta vie amoureuse ou affective actuelle ?",
    "As-tu un réseau de soutien solide sur qui tu peux compter ?",
    "Exprimes-tu facilement tes émotions et besoins à tes proches ?"
  ]},
  {key:'etre',label:'Être',color:'#a78bfa',emoji:'✨',questions:[
    "As-tu un sentiment clair de tes valeurs profondes et de ton identité ?",
    "Te sens-tu aligné(e) avec ton but ou ta mission de vie ?",
    "Consacres-tu du temps régulier à ton développement personnel ?",
    "Comment évalues-tu ton niveau de confiance et d'estime de toi ?",
    "Ta vie actuelle correspond-elle à la personne que tu veux devenir ?"
  ]},
  {key:'ordre',label:'Ordre',color:'#fbbf24',emoji:'⚡',questions:[
    "Es-tu satisfait(e) de ta situation financière actuelle ?",
    "Ton environnement de vie et de travail te convient-il ?",
    "Comment évalues-tu ton organisation et ta gestion du temps ?",
    "As-tu des objectifs clairs et un plan concret pour ta carrière/projets ?",
    "Ton espace de vie est-il ordonné et agréable au quotidien ?"
  ]}
];

let dIdx=0,qIdx=0,answers={},radarChart=null,currentUser=null;
DOMAINS.forEach(d=>{answers[d.key]=Array(d.questions.length).fill(null);});
onAuthStateChanged(auth,u=>{currentUser=u;});

// screens
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');}
window.goIntro=()=>show('s-intro');
window.goHistory=()=>{loadHistory();show('s-history');};

// quiz
window.startQuiz=()=>{
  dIdx=0;qIdx=0;
  DOMAINS.forEach(d=>{answers[d.key]=Array(d.questions.length).fill(null);});
  show('s-quiz');render();
};

function totalQ(){return DOMAINS.reduce((s,d)=>s+d.questions.length,0);}
function globalIdx(){let i=0;for(let k=0;k<dIdx;k++)i+=DOMAINS[k].questions.length;return i+qIdx;}

function render(){
  const D=DOMAINS[dIdx];
  const gIdx=globalIdx(),total=totalQ();
  document.getElementById('prog-fill').style.width=((gIdx/total)*100)+'%';
  const badge=document.getElementById('dom-badge');
  badge.textContent=D.emoji+' '+D.label;
  badge.style.color=D.color;badge.style.borderColor=D.color+'55';
  document.getElementById('quiz-ctr').textContent=`Q${gIdx+1}/${total}`;
  document.getElementById('q-text').textContent=D.questions[qIdx];

  const rr=document.getElementById('rating-row');rr.innerHTML='';
  const saved=answers[D.key][qIdx];
  for(let i=1;i<=10;i++){
    const b=document.createElement('button');
    b.className='rb'+(saved===i?' sel':'');
    b.textContent=i;b.onclick=()=>pick(i);rr.appendChild(b);
  }

  const qd=document.getElementById('qdots');qd.innerHTML='';
  D.questions.forEach((_,i)=>{
    const dot=document.createElement('div');
    dot.className='qdot'+(i===qIdx?' cur':''+(answers[D.key][i]!==null?' done':''));
    if(i===qIdx)dot.style.background=D.color;
    else if(answers[D.key][i]!==null)dot.style.background=D.color+'88';
    qd.appendChild(dot);
  });
  syncBtn();
}

function pick(v){
  const D=DOMAINS[dIdx];answers[D.key][qIdx]=v;
  document.querySelectorAll('.rb').forEach((b,i)=>b.classList.toggle('sel',i+1===v));
  const dots=document.querySelectorAll('.qdot');
  dots.forEach((d,i)=>{
    d.className='qdot'+(i===qIdx?' cur':'');
    if(i===qIdx)d.style.background=D.color;
    else if(answers[D.key][i]!==null){d.style.background=D.color+'88';}
    else d.style.background='';
  });
  syncBtn();
}

function syncBtn(){
  const D=DOMAINS[dIdx];
  const ok=answers[D.key][qIdx]!==null;
  const btn=document.getElementById('btn-nxt');
  btn.classList.toggle('ok',ok);
  const last=dIdx===DOMAINS.length-1&&qIdx===DOMAINS[dIdx].questions.length-1;
  btn.textContent=last?'Voir mes résultats →':'Suivant →';
}

function transition(cb){
  const c=document.getElementById('qcard');c.classList.add('fading');
  setTimeout(()=>{cb();render();c.classList.remove('fading');},220);
}

window.nextQ=()=>{
  const D=DOMAINS[dIdx];if(answers[D.key][qIdx]===null)return;
  if(qIdx<D.questions.length-1)transition(()=>qIdx++);
  else if(dIdx<DOMAINS.length-1)transition(()=>{dIdx++;qIdx=0;});
  else showResults();
};
window.prevQ=()=>{
  if(qIdx>0)transition(()=>qIdx--);
  else if(dIdx>0)transition(()=>{dIdx--;qIdx=DOMAINS[dIdx].questions.length-1;});
};

// results
function avg(arr){const v=arr.filter(x=>x!==null);return v.length?Math.round((v.reduce((a,b)=>a+b,0)/v.length)*10)/10:0;}

function showResults(){
  const scores={};DOMAINS.forEach(d=>{scores[d.key]=avg(answers[d.key]);});
  const global=Math.round((Object.values(scores).reduce((a,b)=>a+b,0)/DOMAINS.length)*10)/10;
  show('s-results');
  document.getElementById('g-score').textContent=global;

  if(radarChart)radarChart.destroy();
  radarChart=new Chart(document.getElementById('radar-chart').getContext('2d'),{
    type:'radar',
    data:{
      labels:DOMAINS.map(d=>d.emoji+' '+d.label),
      datasets:[{
        label:'Score',data:DOMAINS.map(d=>scores[d.key]),
        backgroundColor:'rgba(0,112,243,0.12)',borderColor:'#0070f3',borderWidth:2,
        pointBackgroundColor:DOMAINS.map(d=>d.color),pointBorderColor:'transparent',pointRadius:6,pointHoverRadius:8
      }]
    },
    options:{responsive:true,scales:{r:{
      min:0,max:10,ticks:{stepSize:2,color:'rgba(155,179,208,0.5)',backdropColor:'transparent',font:{size:9}},
      grid:{color:'rgba(255,255,255,0.05)'},angleLines:{color:'rgba(255,255,255,0.05)'},
      pointLabels:{color:'#9bb3d0',font:{size:12,weight:'600'}}
    }},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw}/10`}}}}
  });

  document.getElementById('dom-scores').innerHTML=DOMAINS.map(d=>`
    <div class="dsrow">
      <div class="ds-dot" style="background:${d.color}"></div>
      <div class="ds-name">${d.label}</div>
      <div class="ds-bar-bg"><div class="ds-bar" style="width:${scores[d.key]*10}%;background:${d.color}" data-w="${scores[d.key]*10}"></div></div>
      <div class="ds-val" style="color:${d.color}">${scores[d.key]}</div>
    </div>`).join('');

  const sorted=[...DOMAINS].sort((a,b)=>scores[a.key]-scores[b.key]);
  const low=sorted[0],high=sorted[sorted.length-1];
  const allSame=sorted.every(d=>scores[d.key]===scores[sorted[0].key]);
  const allVeryHigh=global>=9;

  let insightsHtml='';
  if(allVeryHigh){
    insightsHtml=`
      <div class="insight" style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);">
        <h4><span style="color:#fbbf24">🪞 Un moment d'honnêteté</span></h4>
        <p>Tu as obtenu un score très élevé partout. Si c'est sincère, c'est remarquable ! Mais souviens-toi : <strong>tricher ici, c'est te tromper toi-même</strong>. Cette évaluation n'est vue que par toi. Plus tes réponses sont honnêtes, plus les insights t'aident vraiment. Tu peux refaire le questionnaire en prenant le temps de réfléchir à chaque réponse.</p>
      </div>
      <div style="margin-top:10px;">
        <button class="btn-prev" data-action="start-quiz" style="width:100%;justify-content:center;">↺ Refaire honnêtement</button>
      </div>`;
  } else if(allSame){
    insightsHtml=`
      <div class="insight" style="background:rgba(96,174,255,0.07);border:1px solid rgba(96,174,255,0.2);">
        <h4><span style="color:#60aeff">⚖️ Équilibre parfait</span></h4>
        <p>Tous tes domaines sont au même niveau (${scores[low.key]}/10). C'est rare — choisis le domaine qui te tient le plus à cœur pour commencer à progresser.</p>
      </div>`;
  } else {
    insightsHtml=`
      <div class="insight" style="background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);">
        <h4><span style="color:${low.color}">${low.emoji} Priorité — ${low.label}</span></h4>
        <p>Score <strong>${scores[low.key]}/10</strong>. C'est le domaine qui mérite le plus ton attention. Fixe un objectif concret cette semaine.</p>
      </div>
      <div class="insight" style="background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.2);margin-top:10px;">
        <h4><span style="color:#34d399">${high.emoji} Point fort — ${high.label}</span></h4>
        <p>Score <strong>${scores[high.key]}/10</strong>. C'est ta base solide. Utilise cette énergie pour faire progresser les autres domaines.</p>
      </div>`;
  }
  document.getElementById('insights').innerHTML=insightsHtml;

  // ── Pont vers objectifs ────────────────────────────────────────────────────
  const actionEl = document.getElementById('action-bridge');
  if(actionEl) {
    if(!allVeryHigh) {
      const target = allSame ? sorted[0] : low;
      const domainLabels = {corps:'Corps',coeur:'Cœur',etre:'Être',ordre:'Ordre'};
      actionEl.innerHTML=`
        <div style="margin-top:16px;padding:16px 18px;background:rgba(0,112,243,0.06);border:1px solid rgba(0,112,243,0.2);border-radius:12px">
          <div style="font-size:0.78rem;text-transform:uppercase;letter-spacing:.6px;color:#60aeff;font-weight:700;margin-bottom:8px">💡 Passe à l'action maintenant</div>
          <p style="font-size:0.85rem;color:#9bb3d0;margin-bottom:12px">Ton domaine <strong style="color:${target.color}">${target.emoji} ${target.label}</strong> a le plus besoin d'attention. Crée un objectif concret cette semaine.</p>
          <a href="/objectifs/?domain=${target.key}" data-action="hover-shadow" style="display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#0070f3,#0056cc);color:white;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:0.86rem;transition:box-shadow .2s">
            🎯 Créer un objectif ${target.label} →
          </a>
        </div>`;
    } else {
      actionEl.innerHTML='';
    }
  }

  // animate bars
  setTimeout(()=>{
    document.querySelectorAll('.ds-bar').forEach(b=>{
      b.style.width=b.dataset.w+'%';
    });
  },100);

  save(scores,global);
}

window.showHistDetail=(i)=>{
  const d=window._histDocs?.[i];if(!d)return;
  const scores=d.scores||{};
  const global=d.globalScore??'—';
  const date=d.createdAt?.toDate?d.createdAt.toDate().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}):'—';

  document.getElementById('detail-title').textContent='Évaluation du '+date;
  show('s-hist-detail');

  // Rebuild radar + scores + insights identical to showResults()
  if(radarChart)radarChart.destroy();
  const canvas=document.createElement('canvas');canvas.id='radar-chart-detail';
  const grid=document.getElementById('detail-grid');
  grid.innerHTML=`
    <div class="rcard wide">
      <h3>🕸 Roue de Vie — ${date}</h3>
      <div class="chart-box"><canvas id="radar-chart-detail"></canvas></div>
      <div class="global-score"><div class="global-num">${global}</div><div class="global-label">Score global / 10</div></div>
    </div>
    <div class="rcard"><h3>📊 Scores par domaine</h3><div id="detail-dom-scores"></div></div>
    <div class="rcard"><h3>💡 Insights</h3><div id="detail-insights"></div></div>`;

  radarChart=new Chart(document.getElementById('radar-chart-detail').getContext('2d'),{
    type:'radar',
    data:{
      labels:DOMAINS.map(d=>d.emoji+' '+d.label),
      datasets:[{label:'Score',data:DOMAINS.map(d=>scores[d.key]??0),
        backgroundColor:'rgba(0,112,243,0.12)',borderColor:'#0070f3',borderWidth:2,
        pointBackgroundColor:DOMAINS.map(d=>d.color),pointBorderColor:'transparent',pointRadius:6,pointHoverRadius:8}]
    },
    options:{responsive:true,scales:{r:{min:0,max:10,ticks:{stepSize:2,color:'rgba(155,179,208,0.5)',backdropColor:'transparent',font:{size:9}},
      grid:{color:'rgba(255,255,255,0.05)'},angleLines:{color:'rgba(255,255,255,0.05)'},
      pointLabels:{color:'#9bb3d0',font:{size:12,weight:'600'}}}},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw}/10`}}}}
  });

  document.getElementById('detail-dom-scores').innerHTML=DOMAINS.map(dm=>`
    <div class="dsrow">
      <div class="ds-dot" style="background:${dm.color}"></div>
      <div class="ds-name">${dm.label}</div>
      <div class="ds-bar-bg"><div class="ds-bar" style="width:${(scores[dm.key]??0)*10}%;background:${dm.color}"></div></div>
      <div class="ds-val" style="color:${dm.color}">${scores[dm.key]??'—'}</div>
    </div>`).join('');

  const sorted=[...DOMAINS].sort((a,b)=>(scores[a.key]??0)-(scores[b.key]??0));
  const low=sorted[0],high=sorted[sorted.length-1];
  const allSame=sorted.every(dm=>(scores[dm.key]??0)===(scores[sorted[0].key]??0));
  const numericGlobal=typeof global==='number'?global:parseFloat(global);
  document.getElementById('detail-insights').innerHTML= numericGlobal>=9
    ?`<div class="insight" style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);"><h4><span style="color:#fbbf24">🪞 Score très élevé</span></h4><p>Score global de ${global}/10. Si ces réponses reflètent ta réalité, c'est excellent !</p></div>`
    : allSame
    ?`<div class="insight" style="background:rgba(96,174,255,0.07);border:1px solid rgba(96,174,255,0.2);"><h4><span style="color:#60aeff">⚖️ Équilibre parfait</span></h4><p>Tous les domaines à ${scores[low.key]}/10.</p></div>`
    :`<div class="insight" style="background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);">
        <h4><span style="color:${low.color}">${low.emoji} Priorité — ${low.label}</span></h4>
        <p>Score <strong>${scores[low.key]}/10</strong> — domaine le plus à travailler.</p>
      </div>
      <div class="insight" style="background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.2);margin-top:10px;">
        <h4><span style="color:#34d399">${high.emoji} Point fort — ${high.label}</span></h4>
        <p>Score <strong>${scores[high.key]}/10</strong> — ton meilleur domaine à cette date.</p>
      </div>`;
};

async function save(scores,global){
  if(!currentUser)return;
  try{
    await addDoc(collection(db,'assessments'),{uid:currentUser.uid,scores,globalScore:global,answers:JSON.parse(JSON.stringify(answers)),createdAt:serverTimestamp()});
    // XP via Cloud Function addXp → branche Estime (faire le point sur soi)
    try{ await window._cyfFirebase.awardXp('estime', 30); }catch(_){}
  }
  catch(e){console.error('save',e);}
}

async function loadHistory(){
  const cont=document.getElementById('hist-list');
  cont.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted)">Chargement…</div>';
  // Wait for auth if needed
  if(!currentUser){
    await new Promise(r=>setTimeout(r,1200));
    if(!currentUser){cont.innerHTML='<div class="empty"><div class="ei">🔒</div><p>Connecte-toi pour voir ton historique</p></div>';return;}
  }
  try{
    // No orderBy to avoid composite index requirement — sort in JS
    const q=query(collection(db,'assessments'),where('uid','==',currentUser.uid));
    const snap=await getDocs(q);
    if(snap.empty){cont.innerHTML='<div class="empty"><div class="ei">📊</div><p>Aucune évaluation encore.<br>Lance ta première !</p></div>';return;}
    // Sort by date descending in JS (avoids composite index)
    const docs=snap.docs.slice().sort((a,b)=>{
      const ta=a.data().createdAt?.toMillis?.()??0;
      const tb=b.data().createdAt?.toMillis?.()??0;
      return tb-ta;
    });
    // Store for click handler
    window._histDocs = docs.map(doc => doc.data());

    cont.innerHTML=docs.map((doc,i)=>{
      const d=doc.data();
      const date=d.createdAt?.toDate?d.createdAt.toDate().toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'—';
      const chips=DOMAINS.map(dm=>`<div class="hchip"><div class="hchip-dot" style="background:${dm.color}"></div>${dm.emoji} ${d.scores?.[dm.key]??'—'}</div>`).join('');
      return `<div class="hist-item" data-hist-idx="${i}" title="Voir le détail">
        <div class="hist-date">${date}</div>
        <div class="hist-chips">${chips}</div>
        <div class="hist-global">${d.globalScore??'—'}/10</div>
        <div style="color:var(--muted);font-size:0.8rem;flex-shrink:0;">→</div>
      </div>`;
    }).join('');
  }catch(e){
    console.error('loadHistory error:',e);
    cont.innerHTML='<div class="empty"><div class="ei">📊</div><p>Aucune évaluation effectuée pour l\'instant.<br>Lance ta première évaluation !</p></div>';
  }
}

// ── Event listeners (remplacent les onclick/onmouseover inline pour CSP stricte) ──
// Boutons statiques avec data-action — délégation sur le document pour gérer aussi les boutons injectés (insight refaire honnêtement)
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  switch (action) {
    case 'start-quiz': window.startQuiz(); break;
    case 'go-history': window.goHistory(); break;
    case 'go-intro': window.goIntro(); break;
    case 'prev-q': window.prevQ(); break;
    case 'next-q': window.nextQ(); break;
  }
});

// Hist list — délégation pour showHistDetail (items injectés via innerHTML)
const histList = document.getElementById('hist-list');
if (histList) {
  histList.addEventListener('click', (e) => {
    const item = e.target.closest('[data-hist-idx]');
    if (!item) return;
    const idx = Number(item.dataset.histIdx);
    if (!Number.isNaN(idx)) window.showHistDetail(idx);
  });
}

// Hover shadow effect (remplace onmouseover/onmouseout sur le CTA injecté) — délégation sur action-bridge
const actionBridge = document.getElementById('action-bridge');
if (actionBridge) {
  actionBridge.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-action="hover-shadow"]');
    if (el) el.style.boxShadow = '0 4px 20px rgba(0,112,243,0.5)';
  });
  actionBridge.addEventListener('mouseout', (e) => {
    const el = e.target.closest('[data-action="hover-shadow"]');
    if (el) el.style.boxShadow = 'none';
  });
}
