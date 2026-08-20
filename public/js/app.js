// /js/app.js - bootstrap pour /app/ (dashboard logged-in).
// Module ESM externalisé depuis app/index.html.

        import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
        import { doc, getDoc, setDoc, collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
        import { updateGlobalAvatar } from '/js/common.js?v=16';
        import { initUserMenu } from '/js/userMenu.js';
        import { initLivingTree } from '/js/living-tree.js';

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
        // L'ancien panneau utilisateur a été remplacé par le user-menu - ce champ
        // n'existe plus dans le DOM. Garde-fou pour ne pas casser toute la suite
        // (notamment initTreeWidget) sur un getElementById nul.
        const userEmailEl = document.getElementById('user-email');
        if (userEmailEl) userEmailEl.textContent = user.email || "Utilisateur Anonyme";
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
                    if (greetEl) greetEl.textContent = displayName ? `${greetWord}, ${displayName}` : `${greetWord}`;
                    if (greetSub) greetSub.textContent = '';
                    const subEl = document.getElementById('welcome-sub');
                    const tEl = document.getElementById('user-title');
                    const t = userData.selectedTitle || '';
                    if (tEl && t) tEl.textContent = `· ${t}`;
                    // Motivational sub based on time
                    const subs = ['Prêt à avancer aujourd\'hui ?', 'Chaque jour compte.', 'Construis ta meilleure version.'];
                    if (subEl && !t) subEl.childNodes[0].textContent = subs[new Date().getDay() % subs.length];
                } catch(e) {}
                const needsOnboarding = (!userDoc.exists() || userData.hasSeenTutorial !== true);

                // ── Welcome date ──
                const wd = document.getElementById('welcome-date');
                if (wd) {
                  const now = new Date();
                  wd.textContent = now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}).replace(/^\w/,c=>c.toUpperCase());
                }
                // ── Arbre de vie : bel arbre ez-tree qui grandit avec l'XP ──
                try {
                  window._cyfLivingTree = initLivingTree(userData);
                } catch(e) { console.warn('living tree failed', e); }

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

        // L'onboarding est désormais conversationnel : CYL accueille le nouvel
        // utilisateur et plante l'arbre avec lui (cf. tree-widget.js). L'ancien
        // tutoriel guidé Shepherd a été retiré.

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
                if (hEl) hEl.textContent = habits.length ? `${habitsDoneToday}/${habits.length}` : '-';

                // ── Meditation streak + sessions ──
                const med = userData.meditation || {};
                const today = new Date().toDateString();
                const yesterday = new Date(Date.now() - 86400000).toDateString();
                const lastDay = med.lastSessionAt ? new Date(med.lastSessionAt).toDateString() : null;
                const streak = (lastDay === today || lastDay === yesterday) ? (med.streak || 1) : 0;
                const streakEl = document.getElementById('stat-streak');
                if (streakEl) streakEl.textContent = streak;
                const medSessEl = document.getElementById('stat-med-sessions');
                if (medSessEl) medSessEl.textContent = med.totalSessions || '-';
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
                        if (mlEl) mlEl.textContent = total ? `${pct}%` : '-';
                        const cardMl = document.getElementById('card-stat-mylife');
                        if (cardMl) cardMl.textContent = total ? `Score : ${pct}% - ${done}/${total} compétences` : '';
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
                    const jEl = document.getElementById('stat-journal'); if (jEl) jEl.textContent = '-';
                }
            } catch(e) { console.warn('stats load failed', e); }
        }

        // ── Roue de Vie widget ──────────────────────────────────────────────────
        async function loadWheelWidget(db, uid) {
          const WHEEL_DOMAINS = [
            {key:'corps', label:'Corps', color:'#44bd48', emoji:'💪'},
            {key:'coeur', label:'Cœur',  color:'#f87171', emoji:'❤️'},
            {key:'etre',  label:'Être',  color:'#bdafd6', emoji:'✨'},
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
              : '-';

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
                    backgroundColor: 'rgba(132,194,94,0.12)',
                    borderColor: '#84c25e', borderWidth: 1.5,
                    pointBackgroundColor: WHEEL_DOMAINS.map(wd => wd.color),
                    pointBorderColor: 'transparent', pointRadius: 4
                  }]
                },
                options: {
                  responsive: true, maintainAspectRatio: true,
                  scales: { r: {
                    min:0, max:10,
                    ticks: { display:false },
                    grid: { color:'rgba(244,239,225,0.07)' },
                    angleLines: { color:'rgba(244,239,225,0.07)' },
                    pointLabels: { color:'#b4ad94', font:{size:9} }
                  }},
                  plugins: { legend:{display:false}, tooltip:{enabled:false} }
                }
              });
            }
          } catch(e) { console.warn('Wheel widget:', e); }
        }

        // ── XP par branche de l'arbre ──────────────────────────────────────────
        // Source de vérité = `tree` (8 branches Maslow), PAS le miroir legacy
        // `levels` qui ne couvre que 4 domaines. Bug corrigé (AUDIT 2026-08-16) :
        // BRANCH_TO_LEGACY ne mappe que physio/appartenance/cognitif/securite —
        // l'XP gagné sur estime, esthétique, accomplissement et transcendance
        // (les branches les plus fréquentes via l'ORGANIZER) n'apparaissait
        // NULLE PART à l'écran : anneaux figés et total XP bloqué.
        const BRANCHES_UI = [
          {key:'physio',          label:'Physiologique',   emoji:'🌱', color:'#84c25e'},
          {key:'securite',        label:'Sécurité',        emoji:'🛡️', color:'#e7b15c'},
          {key:'appartenance',    label:'Appartenance',    emoji:'🤝', color:'#e0785f'},
          {key:'estime',          label:'Estime',          emoji:'🏆', color:'#c39a6b'},
          {key:'cognitif',        label:'Cognitif',        emoji:'📚', color:'#9d8ec4'},
          {key:'esthetique',      label:'Esthétique',      emoji:'🎨', color:'#d98cae'},
          {key:'accomplissement', label:'Accomplissement', emoji:'🚀', color:'#6f9a52'},
          {key:'transcendance',   label:'Transcendance',   emoji:'✨', color:'#f1cd92'},
        ];
        const LEGACY_TO_BRANCH = { body:'physio', heart:'appartenance', etre:'cognitif', order:'securite' };

        function loadXPRings(userData) {
          const DOMAINS = BRANCHES_UI;
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

          // `tree.branches` = { <cle>: { xp, lastActionAt } }. Repli : on remonte
          // l'ancien `levels` (comptes antérieurs à la refonte de l'arbre).
          const treeBranches = (userData.tree && userData.tree.branches) || null;
          const legacy = userData.levels || {};
          const levels = {};
          BRANCHES_UI.forEach(b => { levels[b.key] = treeBranches ? (treeBranches[b.key] || { xp: 0 }) : { xp: 0 }; });
          if (!treeBranches) {
            Object.entries(LEGACY_TO_BRANCH).forEach(([old, branch]) => {
              const v = legacy[old];
              if (v) levels[branch] = { xp: typeof v === 'number' ? v : (v.xp || 0) };
            });
          }
          const grid = document.getElementById('rings-grid');
          if (!grid) return;

          // Update total XP badge
          const totalXP = DOMAINS.reduce((s,d) => s + (getInfo(levels[d.key]).xp), 0);
          const badge = document.getElementById('total-xp-badge');
          if (badge) badge.textContent = totalXP.toLocaleString('fr-FR') + ' XP';
          const corner = document.getElementById('xp-corner-val');
          if (corner) corner.textContent = totalXP.toLocaleString('fr-FR') + ' XP';
          // synchronise la croissance de l'arbre vivant avec l'XP réel
          try { window._cyfLivingTree && window._cyfLivingTree.setXp(totalXP); } catch (_) {}
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
              const col = r.dataset.color || '#8dca67';
              r.style.background = `conic-gradient(${col} ${pct}%, rgba(255,255,255,0.05) 0%)`;
            });
          }, 200);
        }

        // ── Action du jour ─────────────────────────────────────────────────────
        function loadActionDuJour(userData) {
          const el = document.getElementById('action-today');
          if (!el) return;
          // Chaque branche mène à SA page de drill-down (cf. /physio/, /securite/…)
          const DOMAINS = BRANCHES_UI.map(b => ({ ...b, href: `/${b.key}/` }));

          // Posture NON-DIRECTIVE (règle produit non négociable) : on décrit un
          // état observé, on ne prescrit pas d'action et on ne culpabilise pas.
          // L'utilisateur fixe lui-même ce qui compte pour lui.
          const branches = (userData.tree && userData.tree.branches) || {};
          const sorted = DOMAINS.slice().sort((a,b) => (branches[a.key]?.xp||0) - (branches[b.key]?.xp||0));
          const quiet = sorted[0];
          const active = sorted[sorted.length - 1];
          const hasXp = (branches[active.key]?.xp || 0) > 0;
          if (!hasXp) return;   // rien d'observé -> on n'affiche rien plutôt que d'inventer

          const icon = quiet.emoji;
          const label = 'Ce que ton arbre montre';
          const text = `Ces temps-ci, <strong>${active.label}</strong> reçoit le plus de ton énergie ; `
            + `<strong>${quiet.label}</strong> est la plus silencieuse. `
            + `C'est un constat, pas un reproche - peut-être que c'est exactement ce que tu veux en ce moment.`;
          const btnText = `Voir ${quiet.label} →`;
          const href = quiet.href;

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
          // 475 citations dans /js/quotes.js (une par jour). Repli sur la liste locale.
          const q = (window.CYL_quoteOfDay && window.CYL_quoteOfDay())
            || (function () { const x = QUOTES[Math.floor(Date.now() / 86400000) % QUOTES.length]; return { t: x.text, a: x.author }; })();
          el.innerHTML = `<div class="quote-card">
            <span class="quote-mark">"</span>
            <div class="quote-body">
              <div class="quote-text">${q.t}</div>
              <div class="quote-author">- ${q.a}</div>
            </div>
          </div>`;
        }
        loadQuoteDuJour();

// Le fond Vanta « oiseaux » (template v1) a été retiré : le fond est désormais
// un dégradé organique en CSS pur (cf. app/index.html) - zéro JS, zéro CDN.
// Le hover de « Voir profil complet » est géré en CSS (.rings-link:hover).
