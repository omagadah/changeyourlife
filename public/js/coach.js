// /coach/ - IA Coach Gemini 2.0 + arbre de vie + stats par axe.
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { updateGlobalAvatar, saveWithFeedback } from '/js/common.js';
import { initUserMenu } from '/js/userMenu.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

try { updateGlobalAvatar(); } catch(e) {}
try { initUserMenu(); } catch(e) {}

// ── Vanta (waits until VANTA is loaded) ──────────────────────────────────────
function bootVanta() {
  try {
    if (window.VANTA && window.VANTA.BIRDS) {
      window.VANTA.BIRDS({ el:'#vanta-birds-bg', mouseControls:true, touchControls:true, backgroundColor:0x07192f, quantity:2.0, birdSize:1.2, wingSpan:20 });
    } else {
      setTimeout(bootVanta, 80);
    }
  } catch (e) { /* ignore */ }
}
bootVanta();

// ── Firebase ──
let auth, db, uid;
if (window._cyfFirebase) {
  ({ auth, db } = window._cyfFirebase);
} else {
  await import('/js/firebase.js');
  ({ auth, db } = window._cyfFirebase);
}

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
const state = {
  messages:     [],       // {role, content}
  stats:        { mental:0, corps:0, social:0, pro:0 },
  totalXP:      0,
  nodes:        [],       // { label, branch, xp, x, y, angle }
  userProfile:  {},
  isTyping:     false,
};

// Branch config
const BRANCHES = {
  serenite:   { color:'#2dd4bf', emoji:'🌊', angle:-140, label:'Sérénité' },
  vitalite:   { color:'#4ade80', emoji:'💪', angle:-100, label:'Vitalité' },
  ambition:   { color:'#f97316', emoji:'🎯', angle: -60, label:'Ambition' },
  liens:      { color:'#f87171', emoji:'❤️', angle: -20, label:'Liens' },
  conscience: { color:'#a78bfa', emoji:'📔', angle:-170, label:'Conscience' },
  discipline: { color:'#fbbf24', emoji:'⚡', angle: -10, label:'Discipline' },
};

// ═══════════════════════════════════════════════════════════
// CANVAS - Life Tree
// ═══════════════════════════════════════════════════════════
const canvas = document.getElementById('tree-canvas');
const ctx    = canvas.getContext('2d');
let animFrame = null;

function resizeCanvas() {
  const panel = document.getElementById('tree-panel');
  canvas.width  = panel.clientWidth;
  canvas.height = panel.clientHeight;
  drawTree();
}

function drawTree() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const groundY = H - 30;
  const trunkH  = Math.min(H * 0.38, 160);
  const trunkTop = groundY - trunkH;

  // ── Ground glow ──
  const grd = ctx.createRadialGradient(cx, groundY, 0, cx, groundY, 90);
  grd.addColorStop(0, 'rgba(59,130,246,0.08)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.ellipse(cx, groundY, 90, 18, 0, 0, Math.PI*2); ctx.fill();

  // ── Trunk ──
  const trunkGrd = ctx.createLinearGradient(cx-6, trunkTop, cx+6, groundY);
  trunkGrd.addColorStop(0, 'rgba(139,92,246,0.7)');
  trunkGrd.addColorStop(1, 'rgba(59,130,246,0.5)');
  ctx.beginPath();
  ctx.moveTo(cx-6, groundY); ctx.lineTo(cx-4, trunkTop);
  ctx.lineTo(cx+4, trunkTop); ctx.lineTo(cx+6, groundY);
  ctx.fillStyle = trunkGrd; ctx.fill();

  // ── XP node at trunk tip ──
  ctx.beginPath(); ctx.arc(cx, trunkTop, 14, 0, Math.PI*2);
  const nodeGrd = ctx.createRadialGradient(cx, trunkTop, 0, cx, trunkTop, 14);
  nodeGrd.addColorStop(0, '#6366f1');
  nodeGrd.addColorStop(1, '#3b82f6');
  ctx.fillStyle = nodeGrd;
  ctx.shadowColor = '#6366f1'; ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(`${state.totalXP}XP`, cx, trunkTop + 4);

  // ── Branches ──
  const branchKeys = [...new Set(state.nodes.map(n => n.branch))];

  branchKeys.forEach((brKey, bi) => {
    const br = BRANCHES[brKey];
    if (!br) return;
    const branchNodes = state.nodes.filter(n => n.branch === brKey);
    const angleRad    = (br.angle * Math.PI) / 180;
    const branchLen   = Math.min(60 + branchNodes.length * 20, 130);

    const bx = cx + Math.cos(angleRad) * branchLen;
    const by = trunkTop + Math.sin(angleRad) * branchLen;

    // Branch line
    ctx.beginPath();
    ctx.moveTo(cx, trunkTop); ctx.lineTo(bx, by);
    ctx.strokeStyle = br.color + 'aa'; ctx.lineWidth = 2.5;
    ctx.lineCap = 'round'; ctx.stroke();

    // Branch label node
    ctx.beginPath(); ctx.arc(bx, by, 16, 0, Math.PI*2);
    const bGrd = ctx.createRadialGradient(bx, by, 0, bx, by, 16);
    bGrd.addColorStop(0, br.color + 'cc'); bGrd.addColorStop(1, br.color + '55');
    ctx.fillStyle = bGrd;
    ctx.shadowColor = br.color; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = '13px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(br.emoji, bx, by + 5);

    // Leaf nodes (individual skills)
    branchNodes.slice(0, 5).forEach((node, ni) => {
      const spread = (ni - (branchNodes.length-1)/2) * 28;
      const leafAngle = angleRad + (spread / 80);
      const leafDist  = branchLen + 36 + ni * 10;
      const lx = cx + Math.cos(leafAngle) * leafDist;
      const ly = trunkTop + Math.sin(leafAngle) * leafDist;

      // Leaf twig
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(lx, ly);
      ctx.strokeStyle = br.color + '55'; ctx.lineWidth = 1.2; ctx.stroke();

      // Leaf circle
      ctx.beginPath(); ctx.arc(lx, ly, 8, 0, Math.PI*2);
      ctx.fillStyle = br.color + '33';
      ctx.strokeStyle = br.color + '88'; ctx.lineWidth = 1.2;
      ctx.fill(); ctx.stroke();

      // Leaf label
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '6.5px system-ui'; ctx.textAlign = 'center';
      const lbl = node.label.length > 9 ? node.label.slice(0,9)+'…' : node.label;
      ctx.fillText(lbl, lx, ly + 3);
    });
  });

  // Empty state hint
  if (state.nodes.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '13px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Parle au coach pour faire pousser ton arbre…', cx, trunkTop - 24);
  }
}

window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 100);

// ═══════════════════════════════════════════════════════════
// STATS UPDATE
// ═══════════════════════════════════════════════════════════
function updateStats(delta) {
  const MAX = 100;
  ['mental','corps','social','pro'].forEach(k => {
    const d = delta[k] || 0;
    state.stats[k] = Math.min(MAX, state.stats[k] + d);
    document.getElementById(`stat-${k}`).textContent = state.stats[k];
    document.getElementById(`bar-${k}`).style.width = `${state.stats[k]}%`;
  });
}

function addNodes(newNodes) {
  newNodes.forEach(n => {
    if (!n.label || !n.branch) return;
    // Avoid duplicates
    const exists = state.nodes.find(x => x.label.toLowerCase() === n.label.toLowerCase());
    if (!exists) {
      state.nodes.push({ label:n.label, branch:n.branch, xp:n.xp||10 });
      state.totalXP += n.xp || 10;
      document.getElementById('total-xp').textContent = state.totalXP;
    }
  });
  drawTree();
}

// ═══════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════
function appendMsg(role, content, typing=false) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${role}${typing?' typing':''}`;
  if (typing) {
    div.innerHTML = '<span class="typing-dots"><span>●</span><span>●</span><span>●</span></span>';
    div.id = 'typing-indicator';
  } else {
    div.textContent = content;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function removeTyping() {
  document.getElementById('typing-indicator')?.remove();
}

async function sendMessage(userText) {
  if (!userText.trim() || state.isTyping) return;
  state.isTyping = true;

  // Hide onboarding if still visible
  document.getElementById('onboard-overlay').classList.add('hidden');

  // Show user message
  appendMsg('user', userText);
  state.messages.push({ role:'user', content:userText });

  // Disable input
  const input   = document.getElementById('chat-input');
  const sendBtn = document.getElementById('btn-send');
  input.value = ''; input.disabled = true; sendBtn.disabled = true;
  input.style.height = 'auto';

  // Typing indicator
  appendMsg('assistant', '', true);

  try {
    if (!auth.currentUser) {
      removeTyping();
      appendMsg('assistant', 'Tu dois être connecté pour parler avec le coach.');
      window.location.href = '/login';
      return;
    }
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ idToken, messages: state.messages.slice(-10), userProfile: state.userProfile })
    });

    removeTyping();

    if (!res.ok) {
      const err = await res.json().catch(()=>({error:'Erreur réseau'}));
      if (res.status === 429) {
        appendMsg('assistant', `Tu as atteint la limite d'appels. Réessaie dans ${err.retryAfter || 60}s.`);
      } else if (err.setup) {
        appendMsg('assistant', '⚙️ La clé API Gemini n\'est pas encore configurée. Ajoute GEMINI_API_KEY dans tes variables Vercel (gratuit sur aistudio.google.com/apikey).');
      } else {
        appendMsg('assistant', 'Une erreur est survenue. Réessaie dans un moment.');
      }
      return;
    }

    const data = await res.json();
    const reply    = data.reply || 'Je suis là pour t\'aider !';
    const analysis = data.analysis || {};

    // Show reply
    appendMsg('assistant', reply);
    state.messages.push({ role:'assistant', content:reply });

    // Update insight bar
    if (analysis.insight) {
      const bar = document.getElementById('insight-bar');
      bar.textContent = analysis.insight;
      bar.classList.add('fresh');
      setTimeout(() => bar.classList.remove('fresh'), 3000);
    }

    // Update stats
    if (analysis.stats_delta) updateStats(analysis.stats_delta);

    // Add tree nodes
    if (analysis.new_nodes?.length) addNodes(analysis.new_nodes);

    // Persist to Firebase
    if (uid) {
      await saveWithFeedback(() => setDoc(doc(db,'users',uid), {
        coach: {
          stats: state.stats,
          totalXP: state.totalXP,
          nodes: state.nodes,
          profile: state.userProfile,
          lastMessageAt: Date.now()
        }
      }, { merge:true }));
    }

    // Update prompt chips based on priority modules
    if (analysis.priority_modules?.length) updateChips(analysis.priority_modules);

  } catch(e) {
    removeTyping();
    appendMsg('assistant', 'Une erreur de connexion est survenue. Vérifie ta connexion et réessaie.');
  } finally {
    state.isTyping = false;
    input.disabled = false; sendBtn.disabled = false;
    input.focus();
  }
}

// ── Contextual prompt chips ──
const MODULE_CHIPS = {
  meditation: { text:'Aide-moi à méditer', label:'🧘 Méditer', href:'/meditation/' },
  journal:    { text:'Je veux écrire dans mon journal', label:'📔 Journal', href:'/journal/' },
  objectifs:  { text:'Parlons de mes objectifs', label:'🎯 Objectifs', href:'/objectifs/' },
  habitudes:  { text:'Je veux créer une bonne habitude', label:'⚡ Habitudes', href:'/habitudes/' },
  sommeil:    { text:'Mon sommeil est problématique', label:'😴 Sommeil', href:'/sommeil/' },
  humeur:     { text:'Comment va mon humeur en ce moment ?', label:'🌡️ Humeur', href:'/humeur/' },
};
function updateChips(modules) {
  const row = document.getElementById('prompt-chips');
  row.innerHTML = '';
  modules.slice(0,4).forEach(m => {
    const cfg = MODULE_CHIPS[m];
    if (!cfg) return;
    const chip = document.createElement('span');
    chip.className = 'prompt-chip';
    chip.textContent = cfg.label;
    chip.dataset.text = cfg.text;
    chip.addEventListener('click', () => sendMessage(cfg.text));
    row.appendChild(chip);
  });
  // "Go to module" link
  const first = modules[0]; const firstCfg = MODULE_CHIPS[first];
  if (firstCfg) {
    const link = document.createElement('a');
    link.href = firstCfg.href;
    link.className = 'prompt-chip';
    link.style.borderColor = 'rgba(59,130,246,.4)'; link.style.color = '#93c5fd';
    link.textContent = `→ Ouvrir ${firstCfg.label}`;
    row.appendChild(link);
  }
}

// ── Input handlers ──
const chatInput = document.getElementById('chat-input');
const sendBtn   = document.getElementById('btn-send');

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
});
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput.value); }
});
sendBtn.addEventListener('click', () => sendMessage(chatInput.value));

// Prompt chips
document.getElementById('prompt-chips').addEventListener('click', e => {
  const chip = e.target.closest('.prompt-chip[data-text]');
  if (chip) sendMessage(chip.dataset.text);
});

// Onboarding start
document.getElementById('onboard-start').addEventListener('click', () => {
  document.getElementById('onboard-overlay').classList.add('hidden');
  chatInput.focus();
  // Auto-send greeting
  setTimeout(() => {
    appendMsg('assistant', 'Salut ! Je suis ton coach IA sur Change Your Life. Parle-moi de toi - tes objectifs, tes défis, ce que tu veux transformer dans ta vie. Ton arbre va pousser au fil de notre conversation. 🌱');
    state.messages.push({ role:'assistant', content:'Salut ! Je suis ton coach IA sur Change Your Life. Parle-moi de toi - tes objectifs, tes défis, ce que tu veux transformer dans ta vie. Ton arbre va pousser au fil de notre conversation. 🌱' });
  }, 300);
});

// ═══════════════════════════════════════════════════════════
// AUTH + LOAD SAVED STATE
// ═══════════════════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/login'; return; }
  uid = user.uid;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const coachData = snap.data().coach || {};
      if (coachData.stats)   { Object.assign(state.stats, coachData.stats); updateStats({mental:0,corps:0,social:0,pro:0}); }
      if (coachData.nodes)   { state.nodes = coachData.nodes; drawTree(); }
      if (coachData.totalXP) { state.totalXP = coachData.totalXP; document.getElementById('total-xp').textContent = state.totalXP; }
      if (coachData.profile) { state.userProfile = coachData.profile; }
      // Restore stats display
      ['mental','corps','social','pro'].forEach(k => {
        document.getElementById(`stat-${k}`).textContent = state.stats[k];
        document.getElementById(`bar-${k}`).style.width = `${state.stats[k]}%`;
      });
      drawTree();
    }
  } catch(e) {}
});
