// /js/sommeil.js - externalisé depuis sommeil/index.html

    import { auth, db } from '/js/firebase.js';
    import { serieAvecPardon } from '/js/growth.js';
    import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import { doc, setDoc, collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
    import { initUserMenu } from '/js/userMenu.js';
    import { setContext, toast, escapeHtml } from '/js/common.js';

    try { initUserMenu(); } catch(e) {}

    // L'echelle de qualite (--q1..--q5) est posee par la page, en tokens.
    const QUALITY_LABEL = { 1:'Mauvaise', 2:'Passable', 3:'Bonne', 4:'Excellente', 5:'Parfaite' };
    const QUALITY_COLOR = { 1:'var(--q1)', 2:'var(--q2)', 3:'var(--q3)', 4:'var(--q4)', 5:'var(--q5)' };

    let currentUser, allLogs = {}; // dateStr → {bedtime, waketime, quality, note, duration}

    // ── Set today's date ──
    const todayInput = document.getElementById('sleep-date');
    todayInput.value = new Date().toISOString().slice(0,10);
    todayInput.max = new Date().toISOString().slice(0,10);

    // Le curseur dit sa valeur en mots au lecteur d'ecran.
    const qualitySlider = document.getElementById('quality-slider');
    const sayQuality = () => qualitySlider.setAttribute('aria-valuetext', QUALITY_LABEL[qualitySlider.value] || qualitySlider.value);
    qualitySlider.addEventListener('input', sayQuality);
    sayQuality();

    // ── Duration calculator ──
    function calcDuration(bed, wake) {
      if (!bed || !wake) return null;
      const [bh, bm] = bed.split(':').map(Number);
      const [wh, wm] = wake.split(':').map(Number);
      let mins = (wh * 60 + wm) - (bh * 60 + bm);
      if (mins < 0) mins += 24 * 60; // overnight
      return mins;
    }
    function fmtDuration(mins) {
      if (mins === null) return '-';
      const h = Math.floor(mins / 60), m = mins % 60;
      return `${h}h${m > 0 ? String(m).padStart(2,'0') : '00'}`;
    }
    function updateDuration() {
      const mins = calcDuration(document.getElementById('bedtime').value, document.getElementById('waketime').value);
      document.getElementById('duration-val').textContent = fmtDuration(mins);
      const color = mins === null ? 'var(--text-3)' : mins >= 480 ? 'var(--q5)' : mins >= 360 ? 'var(--q3)' : 'var(--q1)';
      document.getElementById('duration-val').style.color = color;
    }
    document.getElementById('bedtime').addEventListener('input', updateDuration);
    document.getElementById('waketime').addEventListener('input', updateDuration);
    updateDuration();

    // ── Firebase ──
    onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.replace('/login'); return; }
      currentUser = user;
      await loadLogs();
      renderAll();
    });

    function dateKey(d = new Date()) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    async function loadLogs() {
      const col = collection(db, 'users', currentUser.uid, 'sleep');
      const snap = await getDocs(query(col, orderBy('date', 'desc'), limit(60)));
      allLogs = {};
      snap.forEach(d => { allLogs[d.id] = d.data(); });

      // Pre-fill form if today already logged
      const today = dateKey();
      if (allLogs[today]) {
        const l = allLogs[today];
        document.getElementById('bedtime').value = l.bedtime || '23:00';
        document.getElementById('waketime').value = l.waketime || '07:00';
        document.getElementById('quality-slider').value = l.quality || 3;
        sayQuality();
        document.getElementById('sleep-note').value = l.note || '';
        document.getElementById('entry-title').textContent = 'Modifier la nuit d\'aujourd\'hui';
        document.getElementById('save-sleep-btn').textContent = 'Mettre à jour';
        updateDuration();
      }
    }

    // ── Save ──
    document.getElementById('save-sleep-btn').addEventListener('click', async () => {
      const btn = document.getElementById('save-sleep-btn');
      const dateStr = document.getElementById('sleep-date').value || dateKey();
      const bedtime = document.getElementById('bedtime').value;
      const waketime = document.getElementById('waketime').value;
      const quality = parseInt(document.getElementById('quality-slider').value, 10);
      const note = document.getElementById('sleep-note').value.trim();
      const duration = calcDuration(bedtime, waketime);
      const isNewNight = !allLogs[dateStr];

      btn.disabled = true; btn.textContent = 'Enregistrement…';
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'sleep', dateStr), {
          date: dateStr, bedtime, waketime, quality, note: note || null,
          duration, savedAt: Date.now()
        });
        allLogs[dateStr] = { date:dateStr, bedtime, waketime, quality, note:note||null, duration };
        // XP via Cloud Function addXp → branche Physiologique (le sommeil = base vitale)
        if (isNewNight) {
          try { await window._cyfFirebase.awardXp('physio', 10); } catch(_) {}
        }
        renderAll();
        toast(isNewNight ? '+10 XP. Nuit enregistrée.' : 'Nuit mise à jour.', { type: 'success' });
        btn.textContent = 'Mettre à jour';
      } catch(e) {
        console.error(e);
        toast('Impossible d\'enregistrer. Réessaie.', { type: 'error' });
        btn.textContent = 'Enregistrer cette nuit';
      }
      btn.disabled = false;
    });

    // ── Render ──
    function renderAll() {
      publishContext();
      renderStats();
      renderBarChart();
      renderLog();
    }

    // Durees et qualite moyennes pour CYL. Pas de detail nuit par nuit : elle
    // a besoin de la tendance, pas du journal de bord.
    function publishContext() {
      try {
        const logs = Object.values(allLogs);
        const last7 = logs.filter((l) => new Date(l.date) >= new Date(Date.now() - 7 * 86400000));
        const avgMins = last7.length ? Math.round(last7.reduce((s, l) => s + (l.duration || 0), 0) / last7.length) : null;
        const avgQ = last7.length ? (last7.reduce((s, l) => s + (l.quality || 3), 0) / last7.length).toFixed(1) : null;
        setContext('sommeil', {
          'nuits enregistrees': logs.length,
          'duree moyenne 7 jours': avgMins === null ? 'aucune donnee' : fmtDuration(avgMins),
          'qualite moyenne 7 jours': avgQ === null ? 'aucune donnee' : `${avgQ}/5`,
          'nuit du jour': allLogs[dateKey(new Date())] ? 'enregistree' : 'pas encore enregistree',
        });
      } catch (_) { /* la page marche meme si CYL n'apprend rien */ }
    }

    function renderStats() {
      const logs = Object.values(allLogs);
      const total = logs.length;
      document.getElementById('stat-streak').textContent = total;

      const last7 = logs.filter(l => {
        const d = new Date(l.date);
        return d >= new Date(Date.now() - 7 * 86400000);
      });
      // Sans nuit cette semaine, les moyennes se taisent : leurs blocs disparaissent.
      const avgBlock = document.getElementById('stat-avg-block');
      const qBlock = document.getElementById('stat-quality-block');
      if (last7.length) {
        const avgMins = last7.reduce((s,l) => s + (l.duration||0), 0) / last7.length;
        document.getElementById('stat-avg').textContent = fmtDuration(Math.round(avgMins));
        const avgColor = avgMins >= 480 ? 'var(--q5)' : avgMins >= 360 ? 'var(--q3)' : 'var(--q1)';
        document.getElementById('stat-avg').style.color = avgColor;
        const avgQ = (last7.reduce((s,l) => s + (l.quality||3), 0) / last7.length).toFixed(1);
        document.getElementById('stat-quality').textContent = avgQ + '/5';
        document.getElementById('stat-quality').style.color = QUALITY_COLOR[Math.round(parseFloat(avgQ))] || 'var(--text-1)';
        if (avgBlock) avgBlock.hidden = false;
        if (qBlock) qBlock.hidden = false;
      } else {
        if (avgBlock) avgBlock.hidden = true;
        if (qBlock) qBlock.hidden = true;
      }

      // Streak badge
      // Série avec pardon (growth.js) : une nuit manquée par semaine ne casse rien.
      const streak = serieAvecPardon((k) => !!allLogs[k]).jours;
      if (streak > 1) {
        document.getElementById('streak-val').textContent = streak;
        document.getElementById('streak-badge').style.display = 'inline-flex';
      }
    }

    function renderBarChart() {
      const chart = document.getElementById('bar-chart');
      chart.innerHTML = '';
      const today = new Date();
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate()-i);
        const k = dateKey(d);
        days.push({ k, d, log: allLogs[k] || null });
      }
      const maxMins = Math.max(...days.map(x => x.log?.duration || 0), 600);
      const DAY = ['Di','Lu','Ma','Me','Je','Ve','Sa'];
      days.forEach(({ d, log }) => {
        const wrap = document.createElement('div'); wrap.className = 'bar-wrap';
        const bg = document.createElement('div'); bg.className = 'bar-bg';
        const fill = document.createElement('div'); fill.className = 'bar-fill';
        const pct = log ? Math.min(100, Math.round((log.duration||0) / maxMins * 100)) : 0;
        fill.style.height = pct + '%';
        if (log) fill.style.setProperty('--q-color', QUALITY_COLOR[log.quality||3]);
        fill.title = log ? `${fmtDuration(log.duration)} - ${QUALITY_LABEL[log.quality||3]}` : 'Pas de données';
        bg.appendChild(fill);
        const label = document.createElement('div'); label.className = 'bar-day';
        label.textContent = DAY[d.getDay()];
        wrap.appendChild(bg); wrap.appendChild(label);
        chart.appendChild(wrap);
      });
    }

    function renderLog() {
      const list = document.getElementById('log-list');
      const sorted = Object.values(allLogs).sort((a,b) => b.date.localeCompare(a.date)).slice(0,14);
      if (!sorted.length) return;
      list.innerHTML = sorted.map(l => {
        const color = QUALITY_COLOR[l.quality||3];
        const [y,m,d] = l.date.split('-');
        const dateObj = new Date(+y,+m-1,+d);
        const label = dateObj.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
        return `<div class="log-item" style="--qi-color:${color}">
          <span class="log-date">${label}</span>
          <span class="log-hours t-num">${fmtDuration(l.duration)}</span>
          <span class="chip log-quality">${QUALITY_LABEL[l.quality||3]}</span>
          <span class="log-note">${l.note ? escapeHtml(l.note) : '<em>Sans note</em>'}</span>
        </div>`;
      }).join('');
    }


