// /js/app.js — bootstrap pour /app/ (dashboard logged-in).
// Module ESM externalisé depuis app/index.html.

        import { onAuthStateChanged, signOut, getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
        import { updateGlobalAvatar } from '/js/common.js?v=16';
        import { initUserMenu } from '/js/userMenu.js';

        // Early initialization of the user menu so the button responds immediately even before auth state fires.
        try { initUserMenu(); } catch(e) { console.warn('initUserMenu early failed', e); }

        // Reuse singleton firebase init if available
        let auth, db;
        if (window._cyfFirebase) {
            ({ auth, db } = window._cyfFirebase);
        } else {
            await import('/js/firebase.js');
            ({ auth, db } = window._cyfFirebase);
        }

    const userPanelTrigger = document.querySelector('.user-panel-trigger');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
        // Guard: email/password users must verify their email before accessing /app
        const isEmailProvider = user.providerData.some(p => p.providerId === 'password');
        if (isEmailProvider && !user.emailVerified) {
            window.location.replace('/verify-email');
            return;
        }
        document.getElementById('user-email').textContent = user.email || "Utilisateur Anonyme";
                // keep trigger logo intact; use updateGlobalAvatar to refresh any avatar state
                // if you want personal avatar, set localStorage 'userAvatarUrl' and call updateGlobalAvatar()
                if (document.referrer.includes("/login")) {
                    const toast = document.getElementById('login-toast');
                    if(toast) { toast.classList.add('show'); setTimeout(() => { toast.classList.remove('show'); }, 4000); }
                }
                // ── Personalized greeting ──
        const hour = new Date().getHours();
        const greetWord = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
        const greetEl = document.getElementById('greeting-h1');
        const greetSub = document.getElementById('greeting-sub');

        const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                const userData = userDoc.exists() ? userDoc.data() : {};
                // update lastActive and reflect selectedTitle
                try { await setDoc(userDocRef, { lastActive: new Date() }, { merge: true }); } catch(e) {}
                try {
                    const displayName = userData.displayName || userData.username || '';
                    if (greetEl) greetEl.textContent = displayName ? `${greetWord}, ${displayName} 👋` : `${greetWord} 👋`;
                    if (greetSub) greetSub.textContent = '';
                    const subEl = document.getElementById('welcome-sub');
                    const tEl = document.getElementById('user-title');
                    const t = userData.selectedTitle || '';
                    if (tEl && t) tEl.textContent = `· ${t}`;
                    // Motivational sub based on time
                    const subs = ['Prêt à avancer aujourd\'hui ?', 'Chaque jour compte.', 'Construis ta meilleure version.'];
                    if (subEl && !t) subEl.childNodes[0].textContent = subs[new Date().getDay() % subs.length];
                } catch(e) {}
                if (!userDoc.exists() || userData.hasSeenTutorial !== true) { startTutorial(userDocRef); }

                // ── Welcome date ──
                const wd = document.getElementById('welcome-date');
                if (wd) {
                  const now = new Date();
                  wd.textContent = now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}).replace(/^\w/,c=>c.toUpperCase());
                }
                // ── Load dashboard stats (async, non-blocking) ──
                loadDashboardStats(db, user.uid, userData);
                loadXPRings(userData);
                loadActionDuJour(userData);
                loadWheelWidget(db, user.uid);
                loadTodayProgress(db, user.uid, userData);

                // Re-run init to ensure avatar + current path highlighting once auth is known
                try { initUserMenu(); } catch(e) {}
                try { updateGlobalAvatar((user.email || 'U').charAt(0).toUpperCase()); } catch(e) {}
            } else { window.location.href = '/login'; }
        });

        // no legacy panel DOM — new menu handles toggle & sign-out
        function startTutorial(userDocRef) {
            const tour = new Shepherd.Tour({ useModalOverlay: true, defaultStepOptions: { classes: 'shepherd-element', scrollTo: { behavior: 'smooth', block: 'center' } } });
            tour.addStep({
              title: '👋 Bienvenue sur Change Your Life',
              text: "Ce tableau de bord est ton <strong>espace de transformation personnelle</strong>.<br><br>Tout est organisé autour de <strong>4 domaines de vie</strong> : 💪 Corps, ❤️ Cœur, ✨ Être et ⚡ Ordre. Chaque action dans ces domaines te fait progresser.",
              attachTo: { element: '.app-container', on: 'top' },
              buttons: [{ action: tour.next, text: 'Suivant →' }]
            });
            tour.addStep({
              title: '🕸 Ta première étape : la Roue de Vie',
              text: "Commence par une <strong>autoévaluation de 5 minutes</strong>.<br><br>Elle va révéler tes forces et tes points d'amélioration à travers 20 questions. Résultat immédiat avec un radar visuel.",
              attachTo: { element: '#card-autoeval', on: 'top' },
              buttons: [
                { action: tour.back, classes: 'shepherd-button-secondary', text: '← Retour' },
                { action: tour.next, text: 'Suivant →' }
              ]
            });
            tour.addStep({
              title: '🎯 Objectifs & Journal',
              text: "Crée des <strong>objectifs concrets</strong> dans chacun de tes 4 domaines et écris dans ton <strong>journal quotidien</strong> pour suivre ton évolution.<br><br>Ton XP augmente à chaque action.",
              attachTo: { element: '#card-objectifs', on: 'top' },
              buttons: [
                { action: tour.back, classes: 'shepherd-button-secondary', text: '← Retour' },
                { action: tour.next, text: 'Compris !' }
              ]
            });
            tour.addStep({
              title: '🚀 C\'est parti !',
              text: "Tu n'es pas seul(e) dans cette aventure.<br><br><strong>Lance ton autoévaluation</strong> maintenant — 5 minutes qui peuvent changer ta perspective sur ta vie.",
              buttons: [
                { action: () => { tour.complete(); window.location.href='/autoevaluation/'; }, text: '🕸 Faire mon évaluation' },
                { action: tour.complete, classes: 'shepherd-button-secondary', text: 'Explorer d\'abord' }
              ]
            });
            const markSeen = () => setDoc(userDocRef, { hasSeenTutorial: true }, { merge: true }).catch(()=>{});
            tour.on('complete', markSeen);
            tour.on('cancel', markSeen);
            tour.start();
        }
        // ── Dashboard stats loader ─────────────────────────────────────────────
        async function loadDashboardStats(db, uid, userData) {
            try {
                // ── Goals ──
                const goals = userData.goals || [];
                const activeGoals  = goals.filter(g => !g.completed).length;
                const doneGoals    = goals.filter(g => g.completed).length;
                const avgPct       = goals.length ? Math.round(goals.reduce((s,g)=>s+(g.progress||0),0)/goals.length) : 0;
                const gEl = document.getElementById('stat-goals');
                if (gEl) gEl.textContent = activeGoals;
                const cgEl = document.getElementById('card-stat-goals');
                if (cgEl) cgEl.textContent = goals.length ? `${activeGoals} actifs · ${doneGoals} complétés · ${avgPct}% moy.` : '';

                // ── Habits ──
                const habits = Array.isArray(userData.habits) ? userData.habits : [];
                const todayStr = new Date().toDateString();
                const habitsDoneToday = habits.filter(h => h.lastDoneAt && new Date(h.lastDoneAt).toDateString() === todayStr).length;
                const hEl = document.getElementById('stat-habits');
                if (hEl) hEl.textContent = habits.length ? `${habitsDoneToday}/${habits.length}` : '—';

                // ── Meditation streak + sessions ──
                const med = userData.meditation || {};
                const today = new Date().toDateString();
                const yesterday = new Date(Date.now() - 86400000).toDateString();
                const lastDay = med.lastSessionAt ? new Date(med.lastSessionAt).toDateString() : null;
                const streak = (lastDay === today || lastDay === yesterday) ? (med.streak || 1) : 0;
                const streakEl = document.getElementById('stat-streak');
                if (streakEl) streakEl.textContent = streak;
                const medSessEl = document.getElementById('stat-med-sessions');
                if (medSessEl) medSessEl.textContent = med.totalSessions || '—';
                const cardMed = document.getElementById('card-stat-med');
                if (cardMed) {
                    const mins = med.totalMinutes || 0;
                    const timeStr = mins >= 60 ? `${Math.floor(mins/60)}h${mins%60?` ${mins%60}m`:''}` : `${mins} min`;
                    cardMed.textContent = med.totalSessions ? `${med.totalSessions} sessions · ${timeStr} · ${streak} jours de suite` : '';
                }

                // ── My Life score (yourlife skills) ──
                try {
                    const ylSnap = await getDoc(doc(db,'users',uid));
                    if (ylSnap.exists()) {
                        const ylData = ylSnap.data().yourlife || {};
                        let total=0, done=0;
                        ['self-actualization','esteem','love','safety','physiological'].forEach(lvl => {
                            const s = ylData[lvl] || [];
                            total += s.length; done += s.filter(x=>x.done).length;
                        });
                        const pct = total ? Math.round(done/total*100) : 0;
                        const mlEl = document.getElementById('stat-mylife');
                        if (mlEl) mlEl.textContent = total ? `${pct}%` : '—';
                        const cardMl = document.getElementById('card-stat-mylife');
                        if (cardMl) cardMl.textContent = total ? `Score : ${pct}% — ${done}/${total} compétences` : '';
                    }
                } catch(e) {}

                // ── Journal entries count ──
                try {
                    const jSnap = await getDocs(query(collection(db,'users',uid,'journal'), limit(300)));
                    const jEl = document.getElementById('stat-journal');
                    if (jEl) jEl.textContent = jSnap.size;
                    const cardJ = document.getElementById('card-stat-journal');
                    if (cardJ) cardJ.textContent = jSnap.size ? `${jSnap.size} entrée${jSnap.size>1?'s':''} · Journal actif` : '';
                } catch(e) {
                    const jEl = document.getElementById('stat-journal'); if (jEl) jEl.textContent = '—';
                }
            } catch(e) { console.warn('stats load failed', e); }
        }

        // ── Roue de Vie widget ──────────────────────────────────────────────────
        async function loadWheelWidget(db, uid) {
          const WHEEL_DOMAINS = [
            {key:'corps', label:'Corps', color:'#2dd4bf', emoji:'💪'},
            {key:'coeur', label:'Cœur',  color:'#f87171', emoji:'❤️'},
            {key:'etre',  label:'Être',  color:'#a78bfa', emoji:'✨'},
            {key:'ordre', label:'Ordre', color:'#fbbf24', emoji:'⚡'}
          ];
          try {
            const snap = await getDocs(query(collection(db,'assessments'), where('uid','==',uid)));
            if (snap.empty) {
              const el = document.getElementById('wheel-cta-section');
              if (el) el.style.display = 'block';
              return;
            }
            const sorted = snap.docs.slice().sort((a,b) =>
              (b.data().createdAt?.toMillis?.()??0) - (a.data().createdAt?.toMillis?.()??0));
            const d = sorted[0].data();
            const scores = d.scores || {};
            const date = d.createdAt?.toDate
              ? d.createdAt.toDate().toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})
              : '—';

            const sec = document.getElementById('wheel-section');
            if (sec) sec.style.display = 'block';
            const dateEl = document.getElementById('wheel-eval-date');
            if (dateEl) dateEl.textContent = date;

            // Domain bars
            const barsEl = document.getElementById('dash-domain-bars');
            if (barsEl) {
              barsEl.innerHTML = WHEEL_DOMAINS.map(wd => {
                const s = scores[wd.key] ?? 0;
                return `<div class="wdb-row">
                  <div class="wdb-label">${wd.emoji} ${wd.label}</div>
                  <div class="wdb-bar-bg"><div class="wdb-bar" style="background:${wd.color}" data-w="${s*10}"></div></div>
                  <div class="wdb-val" style="color:${wd.color}">${s}</div>
                </div>`;
              }).join('');
              setTimeout(() => {
                barsEl.querySelectorAll('.wdb-bar').forEach(b => { b.style.width = b.dataset.w + '%'; });
              }, 300);
            }

            // Radar chart
            const canvas = document.getElementById('dash-radar');
            if (canvas && window.Chart) {
              new Chart(canvas.getContext('2d'), {
                type: 'radar',
                data: {
                  labels: WHEEL_DOMAINS.map(wd => wd.emoji + ' ' + wd.label),
                  datasets: [{
                    data: WHEEL_DOMAINS.map(wd => scores[wd.key] ?? 0),
                    backgroundColor: 'rgba(0,112,243,0.1)',
                    borderColor: '#0070f3', borderWidth: 1.5,
                    pointBackgroundColor: WHEEL_DOMAINS.map(wd => wd.color),
                    pointBorderColor: 'transparent', pointRadius: 4
                  }]
                },
                options: {
                  responsive: true, maintainAspectRatio: true,
                  scales: { r: {
                    min:0, max:10,
                    ticks: { display:false },
                    grid: { color:'rgba(255,255,255,0.06)' },
                    angleLines: { color:'rgba(255,255,255,0.06)' },
                    pointLabels: { color:'#7ba3c8', font:{size:9} }
                  }},
                  plugins: { legend:{display:false}, tooltip:{enabled:false} }
                }
              });
            }
          } catch(e) { console.warn('Wheel widget:', e); }
        }

        // ── XP Domain Rings ────────────────────────────────────────────────────
        function loadXPRings(userData) {
          const DOMAINS = [
            {key:'body',  label:'Corps', emoji:'💪', color:'#2dd4bf'},
            {key:'heart', label:'Cœur',  emoji:'❤️', color:'#f87171'},
            {key:'etre',  label:'Être',  emoji:'✨', color:'#a78bfa'},
            {key:'order', label:'Ordre', emoji:'⚡', color:'#fbbf24'},
          ];
          const THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 4000, 8000, Infinity];
          const TITLES = ['Novice','Apprenti','Initié','Pratiquant','Avancé','Expert','Maître','Légende'];
          const getInfo = rawXp => {
            const xp = typeof rawXp === 'number' ? rawXp : (rawXp?.xp || 0);
            let lvl = 0;
            while (lvl < THRESHOLDS.length - 2 && xp >= THRESHOLDS[lvl+1]) lvl++;
            const nextXP = THRESHOLDS[Math.min(lvl+1, THRESHOLDS.length-2)];
            const prevXP = THRESHOLDS[lvl];
            const pct = nextXP === Infinity ? 100 : Math.round((xp - prevXP) / (nextXP - prevXP) * 100);
            return { xp, lvl: lvl+1, title: TITLES[Math.min(lvl, TITLES.length-1)], pct };
          };
          const levels = userData.levels || {};
          const grid = document.getElementById('rings-grid');
          if (!grid) return;

          // Update total XP badge
          const totalXP = DOMAINS.reduce((s,d) => s + (getInfo(levels[d.key]).xp), 0);
          const badge = document.getElementById('total-xp-badge');
          if (badge) badge.textContent = totalXP.toLocaleString('fr-FR') + ' XP';
          const statXp = document.getElementById('stat-xp');
          if (statXp) statXp.textContent = totalXP.toLocaleString('fr-FR');
          const xpBar = document.getElementById('stat-xp-bar');
          if (xpBar) setTimeout(() => { xpBar.style.width = `${Math.min(100,(totalXP%1000)/10)}%`; }, 400);

          grid.innerHTML = DOMAINS.map(d => {
            const { xp, lvl, title, pct } = getInfo(levels[d.key]);
            return `<div class="ring-card">
              <div class="ring-wrap" data-pct="${pct}" data-color="${d.color}" style="background:conic-gradient(rgba(255,255,255,0.04) 100%,transparent 0)">
                <div class="ring-inner">
                  <span class="ring-emoji">${d.emoji}</span>
                  <span class="ring-level" style="color:${d.color}">Lv${lvl}</span>
                </div>
              </div>
              <div class="ring-meta">
                <div class="ring-title" style="color:${d.color}">${title}</div>
                <div class="ring-xp">${xp} XP</div>
              </div>
            </div>`;
          }).join('');
          // Animate rings filling in
          setTimeout(() => {
            grid.querySelectorAll('.ring-wrap').forEach(r => {
              const pct = parseInt(r.dataset.pct) || 0;
              const col = r.dataset.color || '#3b82f6';
              r.style.background = `conic-gradient(${col} ${pct}%, rgba(255,255,255,0.05) 0%)`;
            });
          }, 200);
        }

        // ── Action du jour ─────────────────────────────────────────────────────
        function loadActionDuJour(userData) {
          const el = document.getElementById('action-today');
          if (!el) return;
          const DOMAINS = [
            {key:'body',  label:'Corps', emoji:'💪', color:'#2dd4bf', href:'/meditation/'},
            {key:'heart', label:'Cœur',  emoji:'❤️', color:'#f87171', href:'/journal/'},
            {key:'etre',  label:'Être',  emoji:'✨', color:'#a78bfa', href:'/journal/'},
            {key:'order', label:'Ordre', emoji:'⚡', color:'#fbbf24', href:'/objectifs/'},
          ];
          const med = userData.meditation || {};
          const today = new Date().toDateString();
          const meditatedToday = med.lastSessionAt && new Date(med.lastSessionAt).toDateString() === today;

          let icon, label, text, btnText, href;
          if (!meditatedToday) {
            icon = '🧘'; label = 'Action du jour';
            text = 'Tu n\'as pas encore médité aujourd\'hui. Une séance de 10 min peut transformer ta journée.';
            btnText = 'Méditer maintenant (+15 XP)'; href = '/meditation/';
          } else {
            // Suggest weakest domain
            const levels = userData.levels || {};
            const sorted = DOMAINS.slice().sort((a,b) => (levels[a.key]?.xp||0) - (levels[b.key]?.xp||0));
            const weak = sorted[0];
            icon = weak.emoji; label = 'Domaine à renforcer';
            text = `Ton domaine <strong>${weak.label}</strong> a le moins d'XP. Quelques actions ciblées peuvent faire une grande différence.`;
            btnText = `Agir sur ${weak.label} →`; href = weak.href;
          }

          el.innerHTML = `<div class="action-card">
            <div class="action-card-icon">${icon}</div>
            <div class="action-card-body">
              <div class="action-card-label">${label}</div>
              <div class="action-card-text">${text}</div>
              <a href="${href}" class="action-card-btn">${btnText}</a>
            </div>
          </div>`;
        }

        // ── Today's progress card ──────────────────────────────────────────────
        async function loadTodayProgress(db, uid, userData) {
          const card = document.getElementById('today-progress-card');
          const items = document.getElementById('today-items');
          if (!card || !items) return;

          const todayStr = new Date().toDateString();
          const checks = [];

          // Meditation
          const med = userData.meditation || {};
          const meditatedToday = med.lastSessionAt && new Date(med.lastSessionAt).toDateString() === todayStr;
          checks.push({ label: '🧘 Méditation', done: meditatedToday });

          // Habits
          const habits = Array.isArray(userData.habits) ? userData.habits : [];
          if (habits.length > 0) {
            const done = habits.filter(h => h.lastDoneAt && new Date(h.lastDoneAt).toDateString() === todayStr).length;
            const all = done === habits.length;
            checks.push({ label: `✅ Habitudes`, done: all, partial: !all && done > 0, count: `${done}/${habits.length}` });
          }

          // Journal (try subcollection)
          try {
            const jSnap = await getDocs(query(collection(db,'users',uid,'journal'), limit(5)));
            const writtenToday = jSnap.docs.some(d => {
              const ts = d.data().createdAt;
              const date = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
              return date && date.toDateString() === todayStr;
            });
            checks.push({ label: '📔 Journal', done: writtenToday });
          } catch(e) {
            checks.push({ label: '📔 Journal', done: false });
          }

          // Humeur
          try {
            const now = new Date();
            const moodDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
            const moodDoc = await getDocs(query(collection(db,'users',uid,'moods'), limit(1)));
            const loggedToday = moodDoc.docs.some(d => d.id === moodDateStr);
            checks.push({ label: '😌 Humeur', done: loggedToday });
          } catch(e) {
            checks.push({ label: '😌 Humeur', done: false });
          }

          // Only show if user has some activity data
          const hasData = meditatedToday || habits.length > 0;
          if (!hasData) return;

          items.innerHTML = checks.map(c => `
            <span class="today-item${c.done?' done':c.partial?' partial':''}">
              <span class="today-dot"></span>
              ${c.label}${c.count ? ` <span class="today-pct">${c.count}</span>` : ''}
            </span>
          `).join('');
          card.style.display = 'flex';
        }

        // ── Citation du jour ───────────────────────────────────────────────────
        function loadQuoteDuJour() {
          const el = document.getElementById('quote-du-jour');
          if (!el) return;
          const QUOTES = [
            { text: "La discipline est le pont entre les objectifs et l'accomplissement.", author: "Jim Rohn" },
            { text: "Tu n'as pas besoin d'être parfait, tu as besoin d'être constant.", author: "Marie Forleo" },
            { text: "Chaque action que tu fais, bonne ou mauvaise, forge ton caractère.", author: "Sénèque" },
            { text: "Le secret du changement est de concentrer toute ton énergie non pas à lutter contre l'ancien, mais à construire le nouveau.", author: "Socrate" },
            { text: "Vous êtes la somme de vos habitudes. Changez vos habitudes, changez votre vie.", author: "John C. Maxwell" },
            { text: "Le plus grand voyage est celui de la connaissance de soi.", author: "Socrate" },
            { text: "Chaque matin, tu as deux choix : continuer à dormir avec tes rêves, ou te lever et les poursuivre.", author: "Anonyme" },
            { text: "Le succès n'est pas final, l'échec n'est pas fatal. Ce qui compte, c'est le courage de continuer.", author: "Winston Churchill" },
            { text: "Prends soin de ton corps, c'est le seul endroit où tu dois vivre.", author: "Jim Rohn" },
            { text: "Tout ce que l'esprit peut concevoir et croire, il peut l'accomplir.", author: "Napoleon Hill" },
            { text: "La souffrance que tu ressens aujourd'hui est la force que tu ressentiras demain.", author: "Anonyme" },
            { text: "Investis en toi-même. Ta carrière est le moteur de ta richesse.", author: "Paul Clitheroe" },
            { text: "Ce n'est pas la montagne que nous conquérons, mais nous-mêmes.", author: "Edmund Hillary" },
            { text: "Ne compte pas les jours, fais que les jours comptent.", author: "Muhammad Ali" },
            { text: "Le changement commence au bord de ta zone de confort.", author: "Roy T. Bennett" },
            { text: "Les miracles se produisent chaque jour, changez simplement votre perception de ce qu'est un miracle.", author: "Tony Robbins" },
            { text: "Ta vie ne s'améliore pas par chance, elle s'améliore par le changement.", author: "Jim Rohn" },
            { text: "Connais-toi toi-même.", author: "Oracle de Delphes" },
            { text: "La plus grande gloire n'est pas de ne jamais tomber, mais de se relever à chaque fois qu'on tombe.", author: "Confucius" },
            { text: "Un voyage de mille lieues commence toujours par un premier pas.", author: "Lao Tzu" },
            { text: "Ce que tu penses, tu le deviens. Ce que tu ressens, tu l'attires. Ce que tu imagines, tu le crées.", author: "Bouddha" },
            { text: "La motivation te met en marche, l'habitude te garde en marche.", author: "Jim Ryun" },
            { text: "Les gens heureux n'ont pas la meilleure de tout, ils font le meilleur de tout ce qu'ils ont.", author: "Anonyme" },
            { text: "Pour avoir une nouvelle idée, il faut être prêt à remettre en question les anciennes.", author: "Aldous Huxley" },
            { text: "Vis comme si tu mourais demain, apprends comme si tu vivais pour toujours.", author: "Gandhi" },
            { text: "La gratitude transforme ce que nous avons en suffisance.", author: "Melody Beattie" },
            { text: "Chaque expert a d'abord été un débutant.", author: "Helen Hayes" },
            { text: "Le succès est la somme de petits efforts répétés jour après jour.", author: "Robert Collier" },
            { text: "Croire en soi est la première étape vers la réussite.", author: "Anonyme" },
            { text: "Le meilleur investissement que tu puisses faire est en toi-même.", author: "Warren Buffett" },
          ];
          const dayIdx = Math.floor(Date.now() / 86400000) % QUOTES.length;
          const q = QUOTES[dayIdx];
          el.innerHTML = `<div class="quote-card">
            <span class="quote-mark">"</span>
            <div class="quote-body">
              <div class="quote-text">${q.text}</div>
              <div class="quote-author">— ${q.author}</div>
            </div>
          </div>`;
        }
        loadQuoteDuJour();

        const card = document.getElementById('tool-card-1');
        if (card) {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; const centerX = rect.width / 2; const centerY = rect.height / 2; const rotateX = ((y - centerY) / centerY) * -7; const rotateY = ((x - centerX) / centerX) * 7;
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
            });
            card.addEventListener('mouseleave', () => { card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)'; });
        }

// ── Vanta birds (background) — bootstrap après les imports/init ──
function bootVanta() {
  try {
    if (window.VANTA && window.VANTA.BIRDS) {
      window.VANTA.BIRDS({
        el: "#vanta-birds-bg",
        mouseControls: true, touchControls: true,
        backgroundColor: 0x07192f,
        color1: 0x4a3a3a, color2: 0xcccccc,
        quantity: 4.0,
      });
    } else {
      setTimeout(bootVanta, 80);
    }
  } catch (e) { /* ignore */ }
}
window.addEventListener("DOMContentLoaded", bootVanta);
