// /js/habitudes.js — externalisé depuis habitudes/index.html

    import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
    import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
    import { initUserMenu } from '/js/userMenu.js';
    import { updateGlobalAvatar } from '/js/common.js';
    import { showXpFloat } from '/js/xp.js';

    let auth, db, uid, habits = [], editingIdx = null;
    let selectedEmoji = '✅';

    if (window._cyfFirebase) {
      ({ auth, db } = window._cyfFirebase);
    } else {
      await import('/js/firebase.js');
      ({ auth, db } = window._cyfFirebase);
    }

    try { initUserMenu(); } catch(e) {}

    const DOMAINS = [
      {key:'body',  label:'Corps', emoji:'💪', color:'#2dd4bf'},
      {key:'heart', label:'Cœur',  emoji:'❤️', color:'#f87171'},
      {key:'etre',  label:'Être',  emoji:'✨', color:'#a78bfa'},
      {key:'order', label:'Ordre', emoji:'⚡', color:'#fbbf24'},
    ];

    const todayStr = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    function escapeHtml(s) {
      return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    }

    function isDoneToday(h) {
      return h.lastDoneAt && new Date(h.lastDoneAt).toDateString() === new Date().toDateString();
    }

    function getStreak(h) { return h.streak || 0; }

    onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      uid = user.uid;
      try { updateGlobalAvatar((user.email||'U').charAt(0).toUpperCase()); } catch(e) {}
      try { initUserMenu(); } catch(e) {}
      await loadHabits();
    });

    async function loadHabits() {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        habits = snap.exists() ? (snap.data().habits || []) : [];
      } catch(e) { habits = []; }
      render();
    }

    async function saveHabits() {
      await setDoc(doc(db, 'users', uid), { habits }, { merge: true });
    }

    function render() {
      const area = document.getElementById('content-area');
      if (!area) return;

      const doneCount = habits.filter(h => isDoneToday(h)).length;
      const totalCount = habits.length;

      if (totalCount === 0) {
        area.innerHTML = `<div class="empty-state">
          <div class="empty-icon">🌱</div>
          <p>Tu n'as pas encore d'habitudes.<br>Crée ta première habitude pour commencer à construire tes routines.</p>
        </div>`;
        return;
      }

      const pct = totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0;
      const domainsDone = DOMAINS.filter(d => habits.filter(h => h.domain === d.key).every(h => isDoneToday(h)) && habits.some(h => h.domain === d.key));

      let html = `<div class="daily-progress-wrap">
        <div class="dp-row">
          <span class="dp-title">Aujourd'hui — ${doneCount}/${totalCount} complétées</span>
          <span class="dp-count">${pct}%</span>
        </div>
        <div class="dp-bar-bg"><div class="dp-bar" style="width:${pct}%"></div></div>
        <div class="dp-domains">
          ${DOMAINS.map(d => {
            const domHabits = habits.filter(h => h.domain === d.key);
            if (!domHabits.length) return '';
            const allDone = domHabits.every(h => isDoneToday(h));
            return `<span class="dp-dom-pill ${allDone?'done':''}">${d.emoji} ${d.label}</span>`;
          }).join('')}
        </div>
      </div>`;

      // Group by domain
      DOMAINS.forEach(d => {
        const domHabits = habits.filter((h, idx) => h.domain === d.key).map((h, _) => {
          return { ...h, _origIdx: habits.indexOf(h) };
        });
        if (!domHabits.length) return;
        html += `<div class="domain-section">
          <div class="domain-section-header">
            <span class="domain-section-title" style="color:${d.color}">${d.emoji} ${d.label}</span>
            <div class="domain-section-line"></div>
          </div>
          <div class="habits-list">
            ${domHabits.map(h => renderHabitCard(h, h._origIdx)).join('')}
          </div>
        </div>`;
      });

      area.innerHTML = html;

      // Wire checkboxes
      area.querySelectorAll('.habit-check').forEach(btn => {
        btn.addEventListener('click', () => toggleDone(parseInt(btn.dataset.idx)));
      });
      area.querySelectorAll('.habit-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openModal(parseInt(btn.dataset.idx)));
      });
      area.querySelectorAll('.habit-del-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteHabit(parseInt(btn.dataset.idx)));
      });
    }

    const HABIT_DOMAIN_COLORS = { corps:'#2dd4bf', coeur:'#f87171', etre:'#a78bfa', ordre:'#fbbf24' };

    function renderHabitCard(h, idx) {
      const done = isDoneToday(h);
      const streak = getStreak(h);
      const hColor = HABIT_DOMAIN_COLORS[h.domain] || 'rgba(255,255,255,0.2)';
      return `<div class="habit-card ${done ? 'done-today' : ''}" style="--habit-color:${hColor}">
        <button class="habit-check" data-idx="${idx}" title="${done ? 'Décocher' : 'Marquer comme fait'}">✓</button>
        <span class="habit-emoji">${escapeHtml(h.emoji || '✅')}</span>
        <div class="habit-body">
          <div class="habit-name">${escapeHtml(h.name)}</div>
          <div class="habit-meta">
            <span class="habit-streak">🔥 ${streak} jour${streak !== 1 ? 's' : ''}</span>
            ${done ? '<span style="color:#22c55e">✓ Fait aujourd\'hui</span>' : ''}
          </div>
        </div>
        <div class="habit-actions">
          <button class="habit-action-btn habit-edit-btn" data-idx="${idx}">✏️</button>
          <button class="habit-action-btn del habit-del-btn" data-idx="${idx}">🗑️</button>
        </div>
      </div>`;
    }

    async function toggleDone(idx) {
      const h = habits[idx];
      if (!h) return;
      const wasAlreadyDone = isDoneToday(h);

      if (!wasAlreadyDone) {
        // Mark done
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const lastDayStr = h.lastDoneAt ? new Date(h.lastDoneAt).toDateString() : null;
        const newStreak = lastDayStr === yesterday ? (h.streak || 0) + 1 : 1;
        habits[idx] = { ...h, lastDoneAt: Date.now(), streak: newStreak };
        await saveHabits();
        // Award XP via Cloud Function (validation + level-up server-side)
        try {
          await window._cyfFirebase.awardXp(h.domain || 'physio', 5);
          try { showXpFloat(5); } catch(e) {}
        } catch(_) {}
        showToast(`+5 XP · Habitude complétée ! 🔥 ${newStreak} jour${newStreak!==1?'s':''}`, 'xp');
      } else {
        // Uncheck (deduct streak if today was the only day)
        habits[idx] = { ...h, lastDoneAt: null };
        await saveHabits();
        showToast('Habitude décochée');
      }
      render();
    }

    async function deleteHabit(idx) {
      const name = habits[idx]?.name || 'cette habitude';
      habits.splice(idx, 1);
      await saveHabits();
      showToast(`"${name}" supprimée`);
      render();
    }

    // ── Modal ──────────────────────────────────────────────────────────────────
    const overlay = document.getElementById('modal-overlay');
    const inputName = document.getElementById('input-name');
    const inputDomain = document.getElementById('input-domain');

    document.getElementById('btn-add').addEventListener('click', () => openModal(null));
    document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('btn-modal-save').addEventListener('click', saveHabit);

    document.getElementById('emoji-picker').addEventListener('click', e => {
      const opt = e.target.closest('.emoji-opt');
      if (!opt) return;
      document.querySelectorAll('.emoji-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedEmoji = opt.dataset.e;
    });

    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    function openModal(idx) {
      editingIdx = idx;
      selectedEmoji = '✅';
      document.getElementById('modal-title').textContent = idx !== null ? 'Modifier l\'habitude' : 'Nouvelle habitude';
      if (idx !== null && habits[idx]) {
        const h = habits[idx];
        inputName.value = h.name || '';
        inputDomain.value = h.domain || 'body';
        selectedEmoji = h.emoji || '✅';
      } else {
        inputName.value = '';
        inputDomain.value = 'body';
      }
      document.querySelectorAll('.emoji-opt').forEach(o => {
        o.classList.toggle('selected', o.dataset.e === selectedEmoji);
      });
      overlay.classList.remove('hidden');
      setTimeout(() => inputName.focus(), 80);
    }

    function closeModal() { overlay.classList.add('hidden'); editingIdx = null; }

    async function saveHabit() {
      const name = inputName.value.trim();
      if (!name) { inputName.focus(); return; }
      const habit = { name, emoji: selectedEmoji, domain: inputDomain.value, streak: 0, lastDoneAt: null, createdAt: Date.now() };
      if (editingIdx !== null) {
        habits[editingIdx] = { ...habits[editingIdx], name: habit.name, emoji: habit.emoji, domain: habit.domain };
      } else {
        habit.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        habits.push(habit);
      }
      await saveHabits();
      closeModal();
      showToast(editingIdx !== null ? 'Habitude modifiée ✓' : 'Habitude créée ! Commence dès aujourd\'hui 🌱');
      render();
    }

    // ── Toast ──────────────────────────────────────────────────────────────────
    let _toastTimer;
    function showToast(msg, type = '') {
      const t = document.getElementById('toast');
      t.textContent = msg; t.className = `toast ${type}`;
      void t.offsetWidth; t.classList.add('show');
      clearTimeout(_toastTimer);
      _toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
    }

// ── Vanta birds (extrait du bootstrap inline) ──────────────────────────
// Wrapper qui attend que VANTA soit chargé (script CDN).
function bootVanta_habitudes() {
  if (window.VANTA && window.VANTA.BIRDS) {
    try {     window.addEventListener('DOMContentLoaded', () => {
      VANTA.BIRDS({ el:'#vanta-birds-bg', mouseControls:false, touchControls:false, backgroundColor:0x07192f, color1:0x2d4a3e, color2:0xaaaaaa, quantity:3 });
    }); } catch(e) {}
  } else {
    setTimeout(bootVanta_habitudes, 80);
  }
}
window.addEventListener('DOMContentLoaded', bootVanta_habitudes);

// ── Vanta birds (extrait du bootstrap inline) ──
function bootVantaHabitudes() {
  if (window.VANTA && window.VANTA.BIRDS) {
    try {
      window.VANTA.BIRDS({
        el: '#vanta-birds-bg',
        mouseControls: false, touchControls: false,
        backgroundColor: 0x07192f,
        color1: 0x2d4a3e, color2: 0xaaaaaa,
        quantity: 3,
      });
    } catch (e) {}
  } else {
    setTimeout(bootVantaHabitudes, 80);
  }
}
window.addEventListener('DOMContentLoaded', bootVantaHabitudes);
