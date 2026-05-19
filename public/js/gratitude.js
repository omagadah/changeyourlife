// /js/gratitude.js — externalisé depuis gratitude/index.html

    import { auth, db } from '/js/firebase.js';
    import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
    import {
      doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, getCountFromServer
    } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
    import { updateGlobalAvatar } from '/js/common.js';
    import { initUserMenu } from '/js/userMenu.js';
    try { updateGlobalAvatar(); initUserMenu(); } catch(e){}

    // ── Utils ──
    function toDateStr(d) {
      return d.toISOString().slice(0, 10);
    }
    function todayStr() { return toDateStr(new Date()); }
    function formatDate(str) {
      const [y, m, d] = str.split('-');
      return new Date(+y, +m - 1, +d).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
    }
    function showToast(msg, dur = 3000) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), dur);
    }
    function showXpPop(x, y) {
      const el = document.createElement('div');
      el.className = 'xp-pop';
      el.textContent = '+5 XP';
      el.style.cssText = `left:${x}px;top:${y}px;`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1200);
    }

    function escapeHtml(s) {
      return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    }

    const MOOD_EMOJIS = { 1:'😔', 2:'😕', 3:'😐', 4:'😊', 5:'😁' };

    let uid = null;
    let entries = {}; // { dateStr: { g1, g2, g3, mood, savedAt } }
    let selectedMood = 3;
    let todayAlreadySaved = false;

    // ── Date badge ──
    const today = todayStr();
    document.getElementById('date-badge').textContent =
      '📅 ' + formatDate(today).replace(/^\w/, c => c.toUpperCase());

    // ── Mood selection ──
    document.querySelectorAll('.mood-btn').forEach(btn => {
      if (+btn.dataset.mood === selectedMood) btn.classList.add('active');
      btn.addEventListener('click', () => {
        selectedMood = +btn.dataset.mood;
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // ── Suggestion chips ──
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const forNum = chip.closest('.prompt-block').querySelector('.prompt-input');
        const cur = forNum.value.trim();
        forNum.value = cur ? cur + ', ' + chip.dataset.text : chip.dataset.text;
        forNum.focus();
      });
    });

    // ── Auth ──
    onAuthStateChanged(auth, async user => {
      if (!user) { window.location.replace('/login'); return; }
      uid = user.uid;
      await loadEntries();
    });

    async function loadEntries() {
      const col = collection(db, 'users', uid, 'gratitude');
      const snap = await getDocs(query(col, orderBy('savedAt', 'desc'), limit(60)));
      entries = {};
      snap.forEach(d => { entries[d.id] = d.data(); });
      renderAll();
    }

    function renderAll() {
      renderStats();
      renderHeatmap();
      renderHistory();
      prefillToday();
    }

    function prefillToday() {
      const e = entries[today];
      if (e) {
        todayAlreadySaved = true;
        document.getElementById('g1').value = e.g1 || '';
        document.getElementById('g2').value = e.g2 || '';
        document.getElementById('g3').value = e.g3 || '';
        if (e.mood) {
          selectedMood = e.mood;
          document.querySelectorAll('.mood-btn').forEach(b => {
            b.classList.toggle('active', +b.dataset.mood === e.mood);
          });
        }
        document.getElementById('btn-save').textContent = '✏️ Modifier ma gratitude';
        document.getElementById('btn-save').style.background = 'linear-gradient(135deg,rgba(251,191,36,.4),rgba(245,158,11,.5))';
        document.getElementById('btn-save').style.color = '#fde68a';
      }
    }

    function renderStats() {
      const dates = Object.keys(entries).sort();
      const totalDays = dates.length;

      // Streak
      let streak = 0;
      const check = new Date();
      while (true) {
        const ds = toDateStr(check);
        if (entries[ds]) { streak++; check.setDate(check.getDate() - 1); }
        else if (ds === today) { check.setDate(check.getDate() - 1); } // today not saved yet
        else break;
      }

      // This month
      const monthPrefix = today.slice(0, 7);
      const thisMonth = dates.filter(d => d.startsWith(monthPrefix)).length;

      document.getElementById('stat-streak').textContent = streak;
      document.getElementById('stat-total').textContent = totalDays;
      document.getElementById('stat-month').textContent = thisMonth;
      document.getElementById('streak-badge').textContent = `🔥 ${streak} jour${streak !== 1 ? 's' : ''} de suite`;
    }

    function renderHeatmap() {
      const heatmap = document.getElementById('heatmap');
      heatmap.innerHTML = '';

      // Build 28-day grid starting from Monday 4 weeks ago
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - 27);
      // Go back to the Monday of that week
      const dow = start.getDay(); // 0=Sun
      const toMon = (dow === 0 ? -6 : 1 - dow);
      start.setDate(start.getDate() + toMon);

      const cur = new Date(start);
      while (cur <= end) {
        const ds = toDateStr(cur);
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        if (entries[ds]) cell.dataset.has = '1';
        if (ds === today) cell.classList.add('today');
        cell.title = formatDate(ds);
        heatmap.appendChild(cell);
        cur.setDate(cur.getDate() + 1);
      }
    }

    function renderHistory() {
      const list = document.getElementById('history-list');
      const sorted = Object.keys(entries).sort().reverse().slice(0, 14);
      if (!sorted.length) {
        list.innerHTML = '<div style="color:#3a4a5a;font-size:.85rem;padding:12px 0;">Aucune entrée pour l\'instant.</div>';
        return;
      }
      list.innerHTML = '';
      sorted.forEach(ds => {
        const e = entries[ds];
        const item = document.createElement('div');
        item.className = 'history-item';
        const moodEmoji = e.mood ? MOOD_EMOJIS[e.mood] : '';
        item.innerHTML = `
          <div class="history-date">
            <span>${formatDate(ds)}</span>
            ${moodEmoji ? `<span class="history-mood">${moodEmoji}</span>` : ''}
          </div>
          <div class="history-entries">
            ${e.g1 ? `<div class="history-entry"><span class="history-entry-num">1</span><span>${escapeHtml(e.g1)}</span></div>` : ''}
            ${e.g2 ? `<div class="history-entry"><span class="history-entry-num">2</span><span>${escapeHtml(e.g2)}</span></div>` : ''}
            ${e.g3 ? `<div class="history-entry"><span class="history-entry-num">3</span><span>${escapeHtml(e.g3)}</span></div>` : ''}
          </div>`;
        list.appendChild(item);
      });
    }

    // ── Save ──
    document.getElementById('btn-save').addEventListener('click', async () => {
      const g1 = document.getElementById('g1').value.trim();
      const g2 = document.getElementById('g2').value.trim();
      const g3 = document.getElementById('g3').value.trim();
      if (!g1 && !g2 && !g3) { showToast('Écris au moins une gratitude 🌟'); return; }

      const data = {
        g1, g2, g3,
        mood: selectedMood,
        savedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', uid, 'gratitude', today), data);
      entries[today] = data;

      if (!todayAlreadySaved) {
        // XP via Cloud Function addXp → branche Transcendance (la gratitude)
        try { await window._cyfFirebase.awardXp('transcendance', 5); } catch(_) {}
        const btn = document.getElementById('btn-save');
        const r = btn.getBoundingClientRect();
        showXpPop(r.left + r.width / 2 - 20, r.top - 10);
        todayAlreadySaved = true;
      }

      renderAll();
      showToast('Gratitude enregistrée 🌟');
    });
