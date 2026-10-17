// /js/gratitude.js - externalisé depuis gratitude/index.html

    import { auth, db } from '/js/firebase.js';
    import { serieAvecPardon } from '/js/growth.js';
    import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
    import {
      doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, getCountFromServer
    } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
    import { updateGlobalAvatar, saveWithFeedback, setContext, toast, escapeHtml } from '/js/common.js';
    import { initUserMenu } from '/js/userMenu.js';
    import { showXpFloat } from '/js/xp.js';
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
    const MOOD_EMOJIS = { 1:'😔', 2:'😕', 3:'😐', 4:'😊', 5:'😁' };

    let uid = null;
    let entries = {}; // { dateStr: { g1, g2, g3, mood, savedAt } }
    let selectedMood = 3;
    let todayAlreadySaved = false;

    // ── Date badge ──
    const today = todayStr();
    // La pastille garde son icone : on ne remplace que le texte.
    {
      const badge = document.getElementById('date-badge');
      const ic = badge.querySelector('.ic');
      badge.textContent = '';
      if (ic) badge.appendChild(ic);
      badge.appendChild(document.createTextNode(formatDate(today).replace(/^\w/, c => c.toUpperCase())));
    }

    // ── Mood selection : des boutons presses, aria-pressed porte l'etat ──
    function markMood(level) {
      document.querySelectorAll('.mood-btn').forEach(b => {
        const on = +b.dataset.mood === level;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    markMood(selectedMood);
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedMood = +btn.dataset.mood;
        markMood(selectedMood);
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
          markMood(e.mood);
        }
        const btn = document.getElementById('btn-save');
        btn.textContent = 'Modifier ma gratitude';
        btn.classList.remove('primary');
      }
    }

    function renderStats() {
      const dates = Object.keys(entries).sort();
      const totalDays = dates.length;

      // Streak
      // Série avec pardon (growth.js) : un jour manqué par semaine ne casse rien.
      const streak = serieAvecPardon((k) => !!entries[k]).jours;

      // This month
      const monthPrefix = today.slice(0, 7);
      const thisMonth = dates.filter(d => d.startsWith(monthPrefix)).length;

      document.getElementById('stat-streak').textContent = streak;
      document.getElementById('stat-total').textContent = totalDays;
      document.getElementById('stat-month').textContent = thisMonth;
      // Sans serie, la pastille se tait.
      const badge = document.getElementById('streak-badge');
      document.getElementById('streak-text').textContent = `${streak} jour${streak !== 1 ? 's' : ''} de suite`;
      badge.hidden = streak === 0;

      // Des compteurs pour CYL, jamais le CONTENU des gratitudes : c'est ce
      // que la personne a de plus personnel sur cette page.
      setContext('gratitude', {
        'jours notes au total': totalDays,
        'serie en cours': streak ? streak + ' jours' : 'aucune serie en cours',
        'ce mois-ci': thisMonth,
        'aujourd hui': entries[today] ? 'deja note' : 'pas encore note',
      });
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
        list.innerHTML = '<div class="empty"><h3>Aucune entrée pour l\'instant</h3><p>Tes trois gratitudes du jour, une fois enregistrées, viendront se ranger ici.</p></div>';
        return;
      }
      list.innerHTML = '';
      sorted.forEach(ds => {
        const e = entries[ds];
        const item = document.createElement('div');
        item.className = 'card history-item';
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
      if (!g1 && !g2 && !g3) { toast('Écris au moins une gratitude'); document.getElementById('g1').focus(); return; }

      const data = {
        g1, g2, g3,
        mood: selectedMood,
        savedAt: new Date().toISOString(),
      };
      const _res = await saveWithFeedback(
        () => setDoc(doc(db, 'users', uid, 'gratitude', today), data)
      );
      if (!_res.ok) return;   // échec déjà signalé (toast + Réessayer) → pas de faux succès
      entries[today] = data;

      if (!todayAlreadySaved) {
        // XP via Cloud Function addXp → branche Transcendance (la gratitude)
        try { await window._cyfFirebase.awardXp('transcendance', 5); } catch(_) {}
        try { showXpFloat(5, document.getElementById('btn-save')); } catch(_) {}
        todayAlreadySaved = true;
      }

      renderAll();
      toast('Gratitude enregistrée', { type: 'success' });
    });
