// /autoevaluation/ - Roue de Vie 4 axes, quiz + radar + historique.
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { updateGlobalAvatar, toast, setContext } from '/js/common.js';
import { initUserMenu } from '/js/userMenu.js';
import { icon } from '/js/icons.js';


if(!window._cyfFirebase){await import('/js/firebase.js');}
let {app,auth,db}=window._cyfFirebase;
try { updateGlobalAvatar(); initUserMenu(); } catch(e){}

// Les couleurs de domaine sont des tokens. Le canvas (Chart.js) ne lit pas
// un var() : paint() resout la valeur calculee au moment du trace.
const paint=(v)=>{const m=/^var\((--[\w-]+)\)$/.exec(v);return m?getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim()||v:v;};
const mix=(v,pct)=>`color-mix(in srgb, ${v} ${pct}%, transparent)`;

const DOMAINS=[
  {key:'corps',label:'Corps',color:'var(--corps)',questions:[
    "Comment évalues-tu ton niveau d'énergie physique au quotidien ?",
    "Es-tu satisfait(e) de la qualité de ton sommeil (durée, récupération) ?",
    "Pratiques-tu une activité physique régulière (sport, marche, etc.) ?",
    "Comment évalues-tu la qualité de tes habitudes alimentaires ?",
    "Ton corps te semble-t-il en bonne santé générale ?"
  ]},
  {key:'coeur',label:'Cœur',color:'var(--coeur)',questions:[
    "Comment évalues-tu la qualité de tes relations proches (famille, amis) ?",
    "Te sens-tu émotionnellement équilibré(e) la plupart du temps ?",
    "Es-tu satisfait(e) de ta vie amoureuse ou affective actuelle ?",
    "As-tu un réseau de soutien solide sur qui tu peux compter ?",
    "Exprimes-tu facilement tes émotions et besoins à tes proches ?"
  ]},
  {key:'etre',label:'Être',color:'var(--etre)',questions:[
    "As-tu un sentiment clair de tes valeurs profondes et de ton identité ?",
    "Te sens-tu aligné(e) avec ton but ou ta mission de vie ?",
    "Consacres-tu du temps régulier à ton développement personnel ?",
    "Comment évalues-tu ton niveau de confiance et d'estime de toi ?",
    "Ta vie actuelle correspond-elle à la personne que tu veux devenir ?"
  ]},
  {key:'ordre',label:'Ordre',color:'var(--ordre)',questions:[
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
  const pct=Math.round((gIdx/total)*100);
  document.getElementById('prog-fill').style.width=pct+'%';
  const pw=document.getElementById('prog-wrap');if(pw)pw.setAttribute('aria-valuenow',pct);
  const badge=document.getElementById('dom-badge');
  badge.textContent=D.label;
  badge.style.setProperty('--dc',D.color);
  document.getElementById('quiz-ctr').textContent=`Question ${gIdx+1} sur ${total}`;
  document.getElementById('q-text').textContent=D.questions[qIdx];
  document.getElementById('qdots').style.setProperty('--dc',D.color);

  const rr=document.getElementById('rating-row');rr.innerHTML='';
  const saved=answers[D.key][qIdx];
  for(let i=1;i<=10;i++){
    const b=document.createElement('button');
    b.type='button';
    b.className='rb'+(saved===i?' sel':'');
    b.setAttribute('aria-pressed',saved===i?'true':'false');
    b.textContent=i;b.onclick=()=>pick(i);rr.appendChild(b);
  }

  const qd=document.getElementById('qdots');qd.innerHTML='';
  D.questions.forEach((_,i)=>{
    const dot=document.createElement('div');
    dot.className='qdot'+(i===qIdx?' cur':(answers[D.key][i]!==null?' done':''));
    qd.appendChild(dot);
  });
  syncBtn();
}

function pick(v){
  const D=DOMAINS[dIdx];answers[D.key][qIdx]=v;
  document.querySelectorAll('.rb').forEach((b,i)=>{b.classList.toggle('sel',i+1===v);b.setAttribute('aria-pressed',i+1===v?'true':'false');});
  document.querySelectorAll('.qdot').forEach((d,i)=>{
    d.className='qdot'+(i===qIdx?' cur':(answers[D.key][i]!==null?' done':''));
  });
  syncBtn();
}

function syncBtn(){
  const D=DOMAINS[dIdx];
  const ok=answers[D.key][qIdx]!==null;
  const btn=document.getElementById('btn-nxt');
  btn.classList.toggle('ok',ok);
  btn.disabled=!ok;
  const last=dIdx===DOMAINS.length-1&&qIdx===DOMAINS[dIdx].questions.length-1;
  btn.innerHTML=(last?'Voir mes résultats':'Suivant')+icon('chevronRight');
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

  // Les axes tels que la personne VIENT de les noter elle-meme. Ce sont ses
  // propres reponses, pas un jugement porte sur elle : CYL peut les reprendre
  // pour l'aider a y voir clair, jamais pour la classer.
  const tries=DOMAINS.map(d=>({nom:d.label,note:scores[d.key]})).sort((a,b)=>a.note-b.note);
  setContext('autoevaluation',{
    'axes notes par la personne':tries.map(x=>`${x.nom} : ${x.note}/10`),
    'axe le plus a l etroit':tries[0]?tries[0].nom:'-',
    'axe le plus a l aise':tries.length?tries[tries.length-1].nom:'-',
  });

  if(radarChart)radarChart.destroy();
  radarChart=buildRadar(document.getElementById('radar-chart'),DOMAINS.map(d=>scores[d.key]));

  document.getElementById('dom-scores').innerHTML=domScoresHtml(scores,true);

  const sorted=[...DOMAINS].sort((a,b)=>scores[a.key]-scores[b.key]);
  const low=sorted[0],high=sorted[sorted.length-1];
  const allSame=sorted.every(d=>scores[d.key]===scores[sorted[0].key]);
  const allVeryHigh=global>=9;

  let insightsHtml='';
  if(allVeryHigh){
    insightsHtml=`
      <div class="insight gold">
        <h4>Un moment d'honnêteté</h4>
        <p>Tu as mis une note très élevée partout. Si c'est sincère, tant mieux. Cette évaluation n'est vue que par toi : plus tes réponses sont honnêtes, plus les repères te servent. Tu peux la refaire en prenant le temps de réfléchir à chaque réponse.</p>
        <button class="btn sm" type="button" data-action="start-quiz">${icon('refresh',{size:14})}Refaire tranquillement</button>
      </div>`;
  } else if(allSame){
    insightsHtml=`
      <div class="insight leaf">
        <h4>Tout au même niveau</h4>
        <p>Tes quatre domaines sont à ${scores[low.key]}/10. C'est rare : choisis celui qui te tient le plus à cœur pour commencer.</p>
      </div>`;
  } else {
    insightsHtml=`
      <div class="insight low" style="--ic:${low.color}">
        <h4>À l'étroit : ${low.label}</h4>
        <p>Tu l'as noté <strong>${scores[low.key]}/10</strong>. C'est le domaine que tu as placé le plus bas. Un objectif concret cette semaine peut suffire à le faire bouger.</p>
      </div>
      <div class="insight high" style="--ic:${high.color}">
        <h4>À l'aise : ${high.label}</h4>
        <p>Tu l'as noté <strong>${scores[high.key]}/10</strong>. C'est ta base solide : elle peut porter les autres.</p>
      </div>`;
  }
  document.getElementById('insights').innerHTML=insightsHtml;

  // ── Pont vers objectifs ────────────────────────────────────────────────────
  const actionEl = document.getElementById('action-bridge');
  if(actionEl) {
    if(!allVeryHigh) {
      const target = allSame ? sorted[0] : low;
      actionEl.innerHTML=`
        <div class="bridge" style="--dc:${target.color}">
          <div class="sec-label">Et maintenant</div>
          <p>Ton domaine <strong>${target.label}</strong> est celui que tu as placé le plus bas. Si tu veux, un objectif concret cette semaine.</p>
          <a href="/objectifs/?domain=${target.key}" class="btn primary">Créer un objectif ${target.label}${icon('arrowRight')}</a>
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

// Le radar, une seule fois : resultats du jour et detail d'une evaluation passee.
function buildRadar(canvas,data){
  const leaf=paint('var(--leaf)');
  return new Chart(canvas.getContext('2d'),{
    type:'radar',
    data:{
      labels:DOMAINS.map(d=>d.label),
      datasets:[{
        label:'Score',data,
        backgroundColor:mix(leaf,14),borderColor:leaf,borderWidth:2,
        pointBackgroundColor:DOMAINS.map(d=>paint(d.color)),pointBorderColor:'transparent',pointRadius:6,pointHoverRadius:8
      }]
    },
    options:{responsive:true,scales:{r:{
      min:0,max:10,ticks:{stepSize:2,color:paint('var(--text-3)'),backdropColor:'transparent',font:{size:9}},
      grid:{color:paint('var(--line)')},angleLines:{color:paint('var(--line)')},
      pointLabels:{color:paint('var(--text-2)'),font:{size:12,weight:'600'}}
    }},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw}/10`}}}}
  });
}

// Une ligne par domaine. Un score absent se tait.
function domScoresHtml(scores,animate){
  return DOMAINS.map(d=>{
    const v=scores[d.key];
    if(v==null)return '';
    return `
    <div class="dsrow">
      <div class="ds-dot" style="background:${d.color}"></div>
      <div class="ds-name">${d.label}</div>
      <div class="ds-bar-bg"><div class="ds-bar" style="width:${animate?0:v*10}%;background:${d.color}" data-w="${v*10}"></div></div>
      <div class="ds-val" style="color:${d.color}">${v}</div>
    </div>`;
  }).join('');
}

window.showHistDetail=(i)=>{
  const d=window._histDocs?.[i];if(!d)return;
  const scores=d.scores||{};
  const global=d.globalScore;
  const date=d.createdAt?.toDate?d.createdAt.toDate().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}):'';

  document.getElementById('detail-title').textContent=date?'Évaluation du '+date:'Évaluation';
  show('s-hist-detail');

  // Rebuild radar + scores + insights identical to showResults()
  if(radarChart)radarChart.destroy();
  const grid=document.getElementById('detail-grid');
  grid.innerHTML=`
    <div class="card rcard wide">
      <h3>Ta roue de vie${date?' le '+date:''}</h3>
      <div class="chart-box"><canvas id="radar-chart-detail"></canvas></div>
      ${global!=null?`<div class="global-score"><div class="global-num t-num">${global}</div><div class="global-label">Score global sur 10</div></div>`:''}
    </div>
    <div class="card rcard"><h3>Par domaine</h3><div id="detail-dom-scores"></div></div>
    <div class="card rcard"><h3>Ce que ça disait</h3><div id="detail-insights"></div></div>`;

  radarChart=buildRadar(document.getElementById('radar-chart-detail'),DOMAINS.map(dm=>scores[dm.key]??0));

  document.getElementById('detail-dom-scores').innerHTML=domScoresHtml(scores,false);

  const sorted=[...DOMAINS].sort((a,b)=>(scores[a.key]??0)-(scores[b.key]??0));
  const low=sorted[0],high=sorted[sorted.length-1];
  const allSame=sorted.every(dm=>(scores[dm.key]??0)===(scores[sorted[0].key]??0));
  const numericGlobal=typeof global==='number'?global:parseFloat(global);
  document.getElementById('detail-insights').innerHTML= numericGlobal>=9
    ?`<div class="insight gold"><h4>Tout très haut</h4><p>Score global de ${global}/10 ce jour-là.</p></div>`
    : allSame
    ?`<div class="insight leaf"><h4>Tout au même niveau</h4><p>Les quatre domaines à ${scores[low.key]}/10.</p></div>`
    :`<div class="insight low" style="--ic:${low.color}">
        <h4>À l'étroit : ${low.label}</h4>
        <p>Noté <strong>${scores[low.key]}/10</strong>, le plus bas à cette date.</p>
      </div>
      <div class="insight high" style="--ic:${high.color}">
        <h4>À l'aise : ${high.label}</h4>
        <p>Noté <strong>${scores[high.key]}/10</strong>, le plus haut à cette date.</p>
      </div>`;
};

async function save(scores,global){
  if(!currentUser)return;
  try{
    await addDoc(collection(db,'assessments'),{uid:currentUser.uid,scores,globalScore:global,answers:JSON.parse(JSON.stringify(answers)),createdAt:serverTimestamp()});
    // XP via Cloud Function addXp → branche Estime (faire le point sur soi)
    try{ await window._cyfFirebase.awardXp('estime', 30); }catch(_){}
  }
  catch(e){console.error('save',e); toast("Ton bilan n'a pas pu être enregistré. Vérifie ta connexion et réessaie.", { type: 'error' });}
}

async function loadHistory(){
  const cont=document.getElementById('hist-list');
  cont.innerHTML='<span class="sk" style="height:60px"></span><span class="sk" style="height:60px"></span>';
  // Wait for auth if needed
  if(!currentUser){
    await new Promise(r=>setTimeout(r,1200));
    if(!currentUser){cont.innerHTML='<div class="empty"><h3>Connecte-toi</h3><p>Ton historique est lié à ton compte.</p></div>';return;}
  }
  const vide='<div class="empty"><h3>Aucune évaluation pour l\'instant</h3><p>La première prend cinq minutes. Elle restera ici, pour comparer plus tard.</p><button class="btn primary" type="button" data-action="start-quiz">Commencer</button></div>';
  try{
    // No orderBy to avoid composite index requirement - sort in JS
    const q=query(collection(db,'assessments'),where('uid','==',currentUser.uid));
    const snap=await getDocs(q);
    if(snap.empty){cont.innerHTML=vide;return;}
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
      const date=d.createdAt?.toDate?d.createdAt.toDate().toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'';
      const chips=DOMAINS.filter(dm=>d.scores?.[dm.key]!=null).map(dm=>`<span class="hchip" title="${dm.label}"><span class="hchip-dot" style="background:${dm.color}"></span>${d.scores[dm.key]}</span>`).join('');
      return `<button type="button" class="hist-item" data-hist-idx="${i}" title="Voir le détail">
        <span class="hist-date">${date}</span>
        <span class="hist-chips">${chips}</span>
        ${d.globalScore!=null?`<span class="hist-global t-num">${d.globalScore}/10</span>`:''}
        <span class="hist-arrow" aria-hidden="true">${icon('chevronRight')}</span>
      </button>`;
    }).join('');
  }catch(e){
    console.error('loadHistory error:',e);
    cont.innerHTML=vide;
  }
}

// ── Event listeners (remplacent les onclick/onmouseover inline pour CSP stricte) ──
// Boutons statiques avec data-action - délégation sur le document pour gérer aussi les boutons injectés (insight refaire honnêtement)
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

// Hist list - délégation pour showHistDetail (items injectés via innerHTML)
const histList = document.getElementById('hist-list');
if (histList) {
  histList.addEventListener('click', (e) => {
    const item = e.target.closest('[data-hist-idx]');
    if (!item) return;
    const idx = Number(item.dataset.histIdx);
    if (!Number.isNaN(idx)) window.showHistDetail(idx);
  });
}
