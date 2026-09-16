// /js/cyl-panel.js - CYL, le panneau lateral permanent.
//
// Remplace l'ancienne bulle flottante (cyl-chat.js). La difference n'est pas
// cosmetique : une bulle est un bouton qu'on va chercher, une colonne est une
// presence. CYL sait sur quelle page on est, ce qu'on y fait, et propose des
// entrees en matiere qui collent a l'endroit.
//
// CE QUI EST CONSERVE DE L'ANCIEN MODULE, et pourquoi :
//   - le consentement `cyl_consent_v1` : exigence de conformite, meme cle donc
//     personne ne se le revoit apres la mise a jour ;
//   - `window.cylChat.open/close` : appele par /js/urgence.js ;
//   - l'evenement `cyl:chat-open` avec `{ prefill }` : appele par
//     app-organizer.js (2 endroits) et cyl-brief.js (2 endroits). Un prefill
//     n'est JAMAIS envoye tout seul : il se pose dans la zone de saisie et
//     l'utilisateur garde la main.
//
// POSTURE : CYL constate, propose, n'ordonne pas. Les suggestions de l'onglet
// Actions sont des questions que l'utilisateur POSE, jamais des consignes
// qu'il recoit. Regle non negociable du projet.
//
// VIE PRIVEE : le contexte de page part dans le meme et unique appel sortant
// que le message (/api/chat vers Anthropic). Aucun tiers supplementaire.

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { mountAvatar, setThinking } from '/js/cyl-avatar.js';
import * as prefs from '/js/cyl-prefs.js';

let auth;
if (window._cyfFirebase) { ({ auth } = window._cyfFirebase); }
else { await import('/js/firebase.js'); ({ auth } = window._cyfFirebase); }

if (window.__cylPanel) { /* deja charge */ } else {
  window.__cylPanel = true;

  // ── Cles de stockage ──────────────────────────────────────────────────────
  // La session porte l'etat de la conversation (sessionStorage : on ne traine
  // pas une discussion d'hier), le consentement reste durable (localStorage).
  const HIST_KEY = 'cyl_panel_hist';
  const STATE_KEY = 'cyl_panel_state';
  const TAB_KEY = 'cyl_panel_tab';
  const SHEET_KEY = 'cyl_panel_sheet_h';
  const CONSENT_KEY = 'cyl_consent_v1';
  const MAX_HIST = 40;   // garde en session
  const SEND_HIST = 10;  // envoye a l'API (qui tronque aussi de son cote)
  const TIMEOUT_MS = 30000;

  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (_) {} },
  };

  // ── Les pages, et ce que CYL peut y proposer ──────────────────────────────
  // Le libelle s'affiche sous le nom de CYL : elle dit ou elle regarde.
  // Les actions sont formulees a la premiere personne, du point de vue de
  // l'utilisateur : c'est lui qui demande, CYL ne prescrit pas.
  const PAGES = {
    app: {
      label: 'Ton espace',
      acts: [
        { ic: '🌱', ask: "Par quoi je pourrais commencer aujourd'hui ?" },
        { ic: '🧭', ask: "Aide-moi a y voir clair dans ce que j'ai en cours." },
        { ic: '📊', ask: "Qu'est-ce qui a bouge chez moi cette semaine ?" },
        { ic: '🗂️', href: '/plan/', label: 'Ouvrir ma journee' },
      ],
    },
    plan: {
      label: "Aujourd'hui",
      acts: [
        { ic: '🎯', ask: "Ma journee me parait chargee. Aide-moi a la regarder autrement." },
        { ic: '⏳', ask: "Qu'est-ce qui pourrait attendre demain, selon toi ?" },
        { ic: '🪫', ask: "Je manque d'energie aujourd'hui. Comment je fais avec ca ?" },
        { ic: '🗃️', href: '/organizer/', label: 'Voir toutes mes fiches' },
      ],
    },
    organizer: {
      label: 'ORGANIZER',
      acts: [
        { ic: '🧹', ask: "Aide-moi a trier ce qui traine dans mon organizer." },
        { ic: '🥱', ask: "Je repousse certaines fiches depuis longtemps. Qu'est-ce que ca peut vouloir dire ?" },
        { ic: '⚖️', ask: "Comment je decide entre urgent et important ?" },
        { ic: '📅', href: '/agenda/', label: 'Poser tout ca dans l agenda' },
      ],
    },
    agenda: {
      label: 'Agenda',
      acts: [
        { ic: '🫁', ask: "Mon agenda laisse-t-il de la place pour souffler ?" },
        { ic: '🧩', ask: "Comment caler une habitude dans une semaine deja pleine ?" },
        { ic: '🌙', ask: "Mes journees finissent tard. Qu'est-ce que j'en pense, moi ?" },
      ],
    },
    objectifs: {
      label: 'Objectifs',
      acts: [
        { ic: '🔍', ask: "Mon objectif est flou. Aide-moi a le formuler avec mes mots." },
        { ic: '🪜', ask: "Quelle serait la toute premiere marche ?" },
        { ic: '🫥', ask: "J'ai perdu de vue pourquoi je voulais ca." },
        { ic: '📈', href: '/bilan/', label: 'Regarder ou j en suis' },
      ],
    },
    bilan: {
      label: 'Bilan',
      acts: [
        { ic: '🪞', ask: "Aide-moi a relire ma semaine sans me juger." },
        { ic: '✨', ask: "Qu'est-ce que je pourrais reconnaitre comme une vraie avancee ?" },
        { ic: '🌿', ask: "Quelle branche de mon arbre a ete la plus nourrie ?" },
      ],
    },
    humeur: {
      label: 'Humeur',
      acts: [
        { ic: '💬', ask: "J'ai du mal a nommer ce que je ressens." },
        { ic: '🔗', ask: "Est-ce que mon humeur suit quelque chose, ces temps-ci ?" },
        { ic: '🧘', href: '/meditation/', label: 'Prendre dix minutes' },
      ],
    },
    sommeil: {
      label: 'Sommeil',
      acts: [
        { ic: '🌙', ask: "Je dors mal en ce moment. Je peux t'en parler ?" },
        { ic: '🔄', ask: "Qu'est-ce qui, dans mes journees, pourrait jouer sur mes nuits ?" },
        { ic: '🛏️', ask: "A quoi ressemblerait une soiree qui me convient vraiment ?" },
      ],
    },
    habitudes: {
      label: 'Habitudes',
      acts: [
        { ic: '🪫', ask: "J'ai laisse tomber une habitude. Comment je regarde ca ?" },
        { ic: '🐣', ask: "Par quelle toute petite version je pourrais reprendre ?" },
        { ic: '⚓', ask: "Comment accrocher une habitude a quelque chose que je fais deja ?" },
      ],
    },
    gratitude: {
      label: 'Gratitude',
      acts: [
        { ic: '🫀', ask: "Je ne trouve rien aujourd'hui. Aide-moi a chercher autrement." },
        { ic: '🔭', ask: "Qu'est-ce que je pourrais remarquer que je ne remarque plus ?" },
      ],
    },
    journal: {
      label: 'Journal',
      acts: [
        { ic: '🪶', ask: "Je ne sais pas par ou commencer a ecrire." },
        { ic: '🌀', ask: "J'ai quelque chose en tete qui tourne. Je te raconte ?" },
        { ic: '🔁', ask: "Aide-moi a relire ce que j'ecris depuis quelque temps." },
      ],
    },
    meditation: {
      label: 'Meditation',
      acts: [
        { ic: '🌬️', ask: "Je suis agite. Qu'est-ce qui pourrait m'aider la, maintenant ?" },
        { ic: '🕰️', ask: "Je n'ai que cinq minutes. Ca vaut le coup quand meme ?" },
        { ic: '🧠', ask: "Mon esprit part dans tous les sens quand j'essaie." },
      ],
    },
    yourlife: {
      label: 'Ta pyramide',
      acts: [
        { ic: '🌳', ask: "Quelle partie de ma vie me parait la plus a l'etroit ?" },
        { ic: '🪴', ask: "Une branche est en jachere. Qu'est-ce que ca t'evoque ?" },
        { ic: '🧭', ask: "Aide-moi a comprendre ce que Maslow raconte de moi." },
      ],
    },
    frise: {
      label: 'Frise',
      acts: [
        { ic: '🕯️', ask: "Aide-moi a relire mon histoire sans la juger." },
        { ic: '🌊', ask: "Quels moments ont vraiment change quelque chose ?" },
        { ic: '🔮', ask: "Et la suite, j'en fais quoi ?" },
      ],
    },
    autoevaluation: {
      label: 'Roue de vie',
      acts: [
        { ic: '⚖️', ask: "Ma roue est desequilibree. C'est grave, selon toi ?" },
        { ic: '🎯', ask: "Sur quel axe je me sens le plus a l'aise d'agir ?" },
        { ic: '🌿', href: '/yourlife/', label: 'Voir ca sur mon arbre' },
      ],
    },
    competences: {
      label: 'Competences',
      acts: [
        { ic: '🌱', ask: "Qu'est-ce que je suis en train d'apprendre sans m'en rendre compte ?" },
        { ic: '🧗', ask: "Je stagne sur une competence. Comment je le vis ?" },
      ],
    },
    codex: {
      label: 'Codex',
      acts: [
        { ic: '📚', ask: "Aide-moi a relier ce que je lis a ce que je vis." },
        { ic: '✍️', ask: "Comment je transforme une note en quelque chose de concret ?" },
      ],
    },
    profile: {
      label: 'Ton profil',
      acts: [
        { ic: '🪪', ask: "Qu'est-ce que mon parcours ici raconte de moi ?" },
        { ic: '🌳', href: '/yourlife/', label: 'Retour a mon arbre' },
      ],
    },
    settings: {
      label: 'Parametres',
      acts: [
        { ic: '🔐', ask: "Quelles donnees sont stockees a mon sujet ?" },
        { ic: '🧭', href: '/', label: 'Revenir a mon espace' },
      ],
    },
  };

  // Les huit branches de l'arbre partagent la meme trame : leur libelle change,
  // et la question s'ecrit avec le nom de la branche.
  const BRANCHES = {
    physio: 'Physiologique', securite: 'Securite', appartenance: 'Appartenance',
    estime: 'Estime', cognitif: 'Cognitif', esthetique: 'Esthetique',
    accomplissement: 'Accomplissement', transcendance: 'Transcendance',
  };
  for (const [key, nom] of Object.entries(BRANCHES)) {
    PAGES[key] = {
      label: nom,
      acts: [
        { ic: '🌿', ask: `Qu'est-ce qui nourrit vraiment ma branche ${nom.toLowerCase()} ?` },
        { ic: '🤔', ask: `Cette branche est en retrait chez moi. Je peux t'en parler ?` },
        { ic: '🌳', href: '/yourlife/', label: 'Voir tout l arbre' },
      ],
    };
  }

  const FALLBACK = {
    label: 'Ton espace',
    acts: [
      { ic: '🌱', ask: "Par quoi je pourrais commencer aujourd'hui ?" },
      { ic: '🧭', ask: "Aide-moi a y voir clair." },
      { ic: '💬', ask: "J'ai juste besoin de parler." },
    ],
  };

  // ── Ou sommes-nous ? ──────────────────────────────────────────────────────
  // La racine sert deux pages selon le temoin `cyl_in` : l'adresse ne suffit
  // pas a trancher, c'est le contenu servi qui le dit (.app-container).
  function routeKey() {
    let p = location.pathname;
    if (p === '/' || p === '' || p === '/index.html') return 'app';
    const seg = p.split('/').filter(Boolean);
    if (!seg.length) return 'app';
    if (seg[0] === 'admin') return 'app';
    return seg[0];
  }

  // Le contexte fourni par la page a la priorite ; sinon on deduit de l'URL.
  // Lu au moment de l'envoi, pas au chargement : une page qui calcule ses
  // donnees en asynchrone (Firestore) peut le poser plus tard sans rien casser.
  function readContext() {
    // Le réglage « Ce que CYL voit » se applique ICI, au plus près de l'envoi :
    // couper le contexte doit le couper pour de bon, pas seulement l'afficher
    // grisé dans un écran d'options.
    const niveau = prefs.contextePermis();
    if (niveau === 'aucun') return null;

    const raw = window.CYL_CONTEXT;
    const ctx = raw && typeof raw === 'object' ? raw : null;
    const page = (ctx && typeof ctx.page === 'string' && ctx.page) || routeKey();
    let data = ctx && ctx.data && typeof ctx.data === 'object' ? ctx.data : null;

    // « Chiffres seuls » : on garde les compteurs, on retire tout libellé.
    // Un titre de fiche en dit plus long qu'un nombre, c'est précisément la
    // raison d'être de ce niveau intermédiaire.
    if (niveau === 'chiffres' && data) {
      const filtre = {};
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'number') filtre[k] = v;
        else if (Array.isArray(v)) filtre[k] = v.length;
      }
      data = Object.keys(filtre).length ? filtre : null;
    }
    return { page, data };
  }

  function pageDef() {
    const { page } = readContext();
    return PAGES[page] || FALLBACK;
  }

  // ── Etat ──────────────────────────────────────────────────────────────────
  let history = [];
  // « Garder la conversation d'une page à l'autre » : décoché, on n'ouvre même
  // pas ce qui traîne en session, et on l'efface pour ne pas le laisser derrière.
  if (!prefs.lire().memoire) { ss.del(HIST_KEY); }
  else {
    try {
      const raw = ss.get(HIST_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        history = parsed
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-MAX_HIST);
      }
    } catch (_) { history = []; }
  }

  function saveHist() {
    if (!prefs.lire().memoire) return;
    ss.set(HIST_KEY, JSON.stringify(history.slice(-MAX_HIST)));
  }

  const hasConsent = () => { try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch (_) { return false; } };

  let panel, fab, msgsEl, inputEl, sendBtn, actsEl, consentEl, avatarSvg, railBadge, fabBadge, subEl;
  let unread = 0;
  let busy = false;

  // ── Feuille de style ──────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('cyl-panel-css')) return;
    const l = document.createElement('link');
    l.id = 'cyl-panel-css';
    l.rel = 'stylesheet';
    l.href = '/css/cyl-panel.css';
    document.head.appendChild(l);
  }

  // ── Construction ──────────────────────────────────────────────────────────
  function build() {
    injectCSS();

    panel = document.createElement('aside');
    panel.className = 'cylp';
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-label', 'CYL, ton assistant de vie');
    panel.innerHTML = `
      <button class="cylp-rail" type="button" aria-label="Ouvrir CYL" aria-expanded="false">
        <span class="cylp-rail-orb"></span>
        <span class="cylp-rail-name">CYL</span>
      </button>
      <div class="cylp-main">
        <div class="cylp-grab" aria-hidden="true"></div>
        <header class="cylp-head">
          <!-- L'identité EST le bouton des réglages : c'est le geste attendu
               (on clique sur le nom pour régler la chose qui le porte), et ça
               évite une troisième icône dans une entête qui en a déjà deux. -->
          <button class="cylp-id-btn" type="button" id="cylp-prefs-btn"
                  aria-expanded="false" aria-controls="cylp-pane-prefs"
                  title="Réglages de CYL">
            <span class="cylp-head-orb"></span>
            <span class="cylp-head-id">
              <span class="cylp-head-name">CYL <span class="cylp-chev" aria-hidden="true">⌄</span></span>
              <span class="cylp-head-sub"></span>
            </span>
          </button>
          <button class="cylp-ico cylp-clear" type="button" title="Nouvelle conversation" aria-label="Nouvelle conversation">⟳</button>
          <button class="cylp-ico cylp-min-btn" type="button" title="Reduire (Echap)" aria-label="Reduire le panneau">⇥</button>
        </header>
        <div class="cylp-tabs" role="tablist" aria-label="Sections de CYL">
          <button class="cylp-tab" type="button" role="tab" id="cylp-tab-chat" aria-controls="cylp-pane-chat" aria-selected="true">Chat</button>
          <button class="cylp-tab" type="button" role="tab" id="cylp-tab-acts" aria-controls="cylp-pane-acts" aria-selected="false">Actions</button>
        </div>
        <div class="cylp-panes">
          <div class="cylp-pane" id="cylp-pane-chat" role="tabpanel" aria-labelledby="cylp-tab-chat" tabindex="0">
            <div class="cylp-msgs" aria-live="polite"></div>
          </div>
          <div class="cylp-pane" id="cylp-pane-acts" role="tabpanel" aria-labelledby="cylp-tab-acts" tabindex="0" hidden>
            <p class="cylp-acts-note">Des entrees en matiere, pas des consignes. Le choix reste le tien.</p>
            <div class="cylp-acts"></div>
          </div>
          <!-- Les réglages : un troisième volet, pas une fenêtre par-dessus.
               Ouverts, ils remplacent la conversation ; fermés, on revient
               exactement où on en était. -->
          <div class="cylp-pane" id="cylp-pane-prefs" role="region" aria-label="Réglages de CYL" tabindex="0" hidden>
            <div class="cylp-prefs-host"></div>
          </div>
        </div>
        <form class="cylp-compose">
          <textarea class="cylp-input" rows="1" placeholder="Parle a CYL... (Ctrl+K)" aria-label="Ton message pour CYL"></textarea>
          <button class="cylp-send" type="submit" title="Envoyer" aria-label="Envoyer">➤</button>
        </form>
        <div class="cylp-mention" id="cylp-mention">CYL est une IA. Elle ne décide pas à ta place.</div>
        <div class="cylp-consent" role="dialog" aria-label="Avant de parler a CYL">
          <div class="cylp-consent-orb"></div>
          <div class="cylp-consent-title">Avant de commencer</div>
          <div class="cylp-consent-body">
            CYL est une intelligence artificielle, pas un professionnel de sante.
            <ul>
              <li>Elle <b>ne decide jamais</b> a ta place et ne te dit pas quoi faire de ta vie.</li>
              <li>Elle ne remplace ni un medecin, ni un psychologue, ni un avocat.</li>
              <li>Tes messages sont envoyes a un modele de langage pour generer la reponse. <b>Ne partage rien que tu ne veuilles pas transmettre.</b></li>
              <li>En cas de detresse : <b>3114</b> (prevention du suicide, 24h/24), <b>15</b>, <b>112</b>.</li>
            </ul>
          </div>
          <label class="cylp-consent-check">
            <input type="checkbox" id="cylp-consent-cb"/>
            <span>J'ai compris et je veux parler a CYL.</span>
          </label>
          <button class="cylp-consent-ok" type="button" id="cylp-consent-ok" disabled>Commencer</button>
        </div>
      </div>`;
    document.body.appendChild(panel);

    // Le bouton flottant est un FRERE place APRES le panneau : la feuille de
    // style le masque via `.cylp[data-state='open'] ~ .cylp-fab`, ce qui exige
    // cet ordre dans le DOM.
    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'cylp-fab';
    fab.setAttribute('aria-label', 'Ouvrir CYL');
    fab.innerHTML = '<span class="cylp-fab-orb"></span>';
    document.body.appendChild(fab);

    msgsEl = panel.querySelector('.cylp-msgs');
    inputEl = panel.querySelector('.cylp-input');
    sendBtn = panel.querySelector('.cylp-send');
    actsEl = panel.querySelector('.cylp-acts');
    consentEl = panel.querySelector('.cylp-consent');
    subEl = panel.querySelector('.cylp-head-sub');

    avatarSvg = mountAvatar(panel.querySelector('.cylp-head-orb'), { size: 34, ring: true });
    mountAvatar(panel.querySelector('.cylp-rail-orb'), { size: 34, ring: true });
    mountAvatar(fab.querySelector('.cylp-fab-orb'), { size: 38, ring: true });
    mountAvatar(panel.querySelector('.cylp-consent-orb'), { size: 48, ring: true });

    // Les badges viennent APRES l'avatar : mountAvatar() fait un
    // replaceChildren() sur son hote, il les effacerait s'ils etaient poses
    // dans le gabarit HTML.
    const badge = (host) => {
      const b = document.createElement('span');
      b.className = 'cylp-badge';
      b.hidden = true;
      b.textContent = '0';
      host.appendChild(b);
      return b;
    };
    railBadge = badge(panel.querySelector('.cylp-rail-orb'));
    fabBadge = badge(fab.querySelector('.cylp-fab-orb'));

    document.body.classList.add('has-cylp');

    renderContext();
    renderHistory();
    renderActions();
    wire();

    // ETAT INITIAL : ouvert la ou CYL a le plus de sens (l'accueil de l'espace),
    // reduit ailleurs pour ne pas retrecir une page de travail dense sans
    // qu'on l'ait demande. Le choix de l'utilisateur, lui, prime toujours.
    // Le réglage « À l'ouverture d'une page » prime sur l'heuristique : quelqu'un
    // qui a demandé « toujours réduit » ne veut pas d'exception sur l'accueil.
    const voulu = prefs.lire().etatDefaut;
    const saved = ss.get(STATE_KEY);
    let etat;
    if (voulu === 'open' || voulu === 'min') etat = voulu;
    else if (saved === 'open' || saved === 'min') etat = saved;
    else etat = routeKey() === 'app' ? 'open' : 'min';
    setState(etat, { silent: true });

    const savedTab = ss.get(TAB_KEY) || prefs.lire().ongletDefaut;
    setTab(savedTab === 'acts' ? 'acts' : 'chat', { silent: true });

    // Hauteur de la feuille mobile retenue d'une page a l'autre.
    const h = parseInt(ss.get(SHEET_KEY) || '', 10);
    if (Number.isFinite(h)) panel.style.setProperty('--cylp-h', h + 'px');
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  function renderContext() {
    const def = pageDef();
    subEl.textContent = def.label;
  }

  function addMsg(role, text, modules) {
    const d = document.createElement('div');
    d.className = 'cylp-msg ' + (role === 'user' ? 'user' : role === 'err' ? 'cyl err' : role === 'wait' ? 'cyl wait' : 'cyl');
    d.textContent = text; // contenu utilisateur ou LLM : jamais d'innerHTML
    msgsEl.appendChild(d);
    if (Array.isArray(modules) && modules.length) {
      const wrap = document.createElement('div');
      wrap.className = 'cylp-mods';
      for (const m of modules) {
        if (!m || !m.href) continue;
        const a = document.createElement('a');
        a.className = 'cylp-mod';
        a.href = m.href;
        a.textContent = MODULE_LABELS[m.key] || m.key;
        wrap.appendChild(a);
      }
      if (wrap.children.length) msgsEl.appendChild(wrap);
    }
    msgsEl.parentElement.scrollTop = msgsEl.parentElement.scrollHeight;
    return d;
  }

  const MODULE_LABELS = {
    meditation: 'Meditation', journal: 'Journal', objectifs: 'Objectifs', habitudes: 'Habitudes',
    sommeil: 'Sommeil', humeur: 'Humeur', gratitude: 'Gratitude', bilan: 'Bilan',
    autoevaluation: 'Roue de vie', codex: 'Codex', organizer: 'ORGANIZER', plan: 'Ma journee',
    competences: 'Competences', agenda: 'Agenda', yourlife: 'Ma pyramide',
    physio: 'Physiologique', securite: 'Securite', appartenance: 'Appartenance', estime: 'Estime',
    cognitif: 'Cognitif', esthetique: 'Esthetique', accomplissement: 'Accomplissement', transcendance: 'Transcendance',
  };

  function renderHistory() {
    msgsEl.replaceChildren();
    if (!history.length) {
      addMsg('cyl', "Bonjour. Je suis CYL. Je regarde " + pageDef().label.toLowerCase() + " avec toi, si tu veux. Comment ca va, aujourd'hui ?");
      return;
    }
    for (const m of history) addMsg(m.role === 'user' ? 'user' : 'cyl', m.content, m.modules);
  }

  function renderActions() {
    const def = pageDef();
    actsEl.replaceChildren();
    for (const a of (def.acts || []).slice(0, 5)) {
      const isGo = !!a.href;
      const el = document.createElement(isGo ? 'a' : 'button');
      el.className = 'cylp-act' + (isGo ? ' go' : '');
      if (isGo) { el.href = a.href; } else { el.type = 'button'; }
      const ic = document.createElement('span');
      ic.className = 'cylp-act-ic';
      ic.textContent = a.ic || '•';
      const tx = document.createElement('span');
      tx.textContent = a.label || a.ask || '';
      el.append(ic, tx);
      if (!isGo) {
        el.addEventListener('click', () => {
          setTab('chat');
          // Un clic sur une suggestion est une intention explicite : on envoie.
          // (Un prefill venu d'un AUTRE module, lui, ne part jamais seul.)
          send(a.ask);
        });
      }
      actsEl.appendChild(el);
    }
  }

  // ── Etat ouvert / reduit ──────────────────────────────────────────────────
  function setState(next, opts) {
    const st = next === 'open' ? 'open' : 'min';
    panel.dataset.state = st;
    document.body.classList.toggle('cylp-min', st === 'min');
    panel.querySelector('.cylp-rail').setAttribute('aria-expanded', String(st === 'open'));
    if (st === 'open') { unread = 0; paintBadge(); }
    if (!opts || !opts.silent) ss.set(STATE_KEY, st);
  }

  // Trois volets pour deux onglets : « prefs » n'a pas d'onglet à lui, il
  // s'ouvre depuis l'entête et se referme sur le dernier onglet utilisé.
  let ongletAvantPrefs = 'chat';

  function setTab(which, opts) {
    const isPrefs = which === 'prefs';
    const isActs = which === 'acts';
    panel.querySelector('#cylp-tab-chat').setAttribute('aria-selected', String(!isActs && !isPrefs));
    panel.querySelector('#cylp-tab-acts').setAttribute('aria-selected', String(isActs));
    panel.querySelector('#cylp-pane-chat').hidden = isActs || isPrefs;
    panel.querySelector('#cylp-pane-acts').hidden = !isActs;
    panel.querySelector('#cylp-pane-prefs').hidden = !isPrefs;
    const btn = panel.querySelector('#cylp-prefs-btn');
    if (btn) btn.setAttribute('aria-expanded', String(isPrefs));
    panel.classList.toggle('prefs-on', isPrefs);
    // On ne mémorise jamais « prefs » comme onglet de départ : personne ne veut
    // rouvrir le site sur un écran de réglages.
    if (!isPrefs && (!opts || !opts.silent)) ss.set(TAB_KEY, isActs ? 'acts' : 'chat');
    if (!isPrefs) ongletAvantPrefs = isActs ? 'acts' : 'chat';
  }

  function basculerPrefs() {
    const ouvert = !panel.querySelector('#cylp-pane-prefs').hidden;
    if (ouvert) { setTab(ongletAvantPrefs); return; }
    const hote = panel.querySelector('.cylp-prefs-host');
    prefs.rendre(hote, {
      // Le panneau est le seul à savoir ce qu'il enverrait vraiment : on montre
      // le paquet réel, pas une reconstitution approximative.
      apercuEnvoi: () => JSON.stringify({
        messages: history.slice(-SEND_HIST).map((m) => ({ role: m.role, content: m.content })),
        context: readContext(),
        preferences: prefs.pourApi(),
      }, null, 2),
      effacerConversation: () => { history = []; ss.del(HIST_KEY); renderHistory(); },
      consentementRevoque: () => { consentEl.classList.add('show'); },
    });
    setTab('prefs');
  }

  function paintBadge() {
    const show = unread > 0 && prefs.lire().badge;
    for (const b of [railBadge, fabBadge]) {
      if (!b) continue;
      b.hidden = !show;
      b.textContent = unread > 9 ? '9+' : String(unread);
    }
  }

  function open(focus) {
    setState('open');
    if (!hasConsent()) { consentEl.classList.add('show'); return; }
    if (focus !== false) { try { inputEl.focus(); } catch (_) {} }
  }
  function minimize() { setState('min'); }

  // ── Envoi ─────────────────────────────────────────────────────────────────
  async function send(text) {
    const raw = typeof text === 'string' ? text : inputEl.value;
    const msg = String(raw || '').trim();
    if (!msg || busy) return;
    if (!hasConsent()) { open(); return; }

    if (typeof text !== 'string') { inputEl.value = ''; inputEl.style.height = 'auto'; }
    busy = true;
    sendBtn.disabled = true;

    addMsg('user', msg);
    history.push({ role: 'user', content: msg });
    saveHist();

    const wait = addMsg('wait', 'CYL reflechit...');
    setThinking(avatarSvg, true);

    // Plafond de temps obligatoire sur tout appel sortant (regle du projet :
    // sans AbortController, /api/translate avait tourne 300 secondes).
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('AUTH');
      const idToken = await user.getIdToken();
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          idToken,
          messages: history.slice(-SEND_HIST).map((m) => ({ role: m.role, content: m.content })),
          context: readContext(),
          // Style de réponse : quatre clés d'énumération, revalidées serveur.
          preferences: prefs.pourApi(),
        }),
      });
      const data = await r.json().catch(() => ({}));
      wait.remove();
      if (!r.ok) {
        addMsg('err', data.error || "CYL est momentanement indisponible. Reessaie dans un instant.");
      } else {
        const reply = String(data.reply || '').trim() || 'Je suis la.';
        addMsg('cyl', reply, data.modules);
        history.push({ role: 'assistant', content: reply, modules: data.modules || [] });
        saveHist();
        if (panel.dataset.state === 'min') { unread += 1; paintBadge(); }
      }
    } catch (e) {
      wait.remove();
      if (e && e.name === 'AbortError') addMsg('err', "CYL met trop de temps a repondre. Reessaie.");
      else if (e && e.message === 'AUTH') addMsg('err', 'Reconnecte-toi pour parler a CYL.');
      else addMsg('err', "La connexion a echoue. Verifie ton reseau et reessaie.");
    } finally {
      clearTimeout(timer);
      setThinking(avatarSvg, false);
      busy = false;
      sendBtn.disabled = false;
    }
  }

  // ── Branchements ──────────────────────────────────────────────────────────
  function wire() {
    panel.querySelector('.cylp-rail').addEventListener('click', () => open());
    fab.addEventListener('click', () => open());
    panel.querySelector('.cylp-min-btn').addEventListener('click', minimize);

    panel.querySelector('.cylp-clear').addEventListener('click', () => {
      if (history.length && !confirm('Effacer cette conversation avec CYL ?')) return;
      history = [];
      ss.del(HIST_KEY);
      renderHistory();
      try { inputEl.focus(); } catch (_) {}
    });

    panel.querySelector('#cylp-tab-chat').addEventListener('click', () => setTab('chat'));
    panel.querySelector('#cylp-tab-acts').addEventListener('click', () => setTab('acts'));

    panel.querySelector('#cylp-prefs-btn').addEventListener('click', basculerPrefs);

    panel.querySelector('.cylp-compose').addEventListener('submit', (e) => { e.preventDefault(); send(); });
    inputEl.addEventListener('keydown', (e) => {
      // « Envoyer avec » : Entrée, ou Ctrl+Entrée pour qui écrit des paragraphes.
      const ctrl = prefs.lire().entree === 'ctrl';
      if (e.key !== 'Enter') return;
      if (ctrl) { if (e.ctrlKey || e.metaKey) { e.preventDefault(); send(); } return; }
      if (!e.shiftKey) { e.preventDefault(); send(); }
    });
    // La zone grandit avec le texte, sans depasser le plafond de la feuille.
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(140, inputEl.scrollHeight) + 'px';
    });

    // Consentement
    const cb = panel.querySelector('#cylp-consent-cb');
    const ok = panel.querySelector('#cylp-consent-ok');
    cb.addEventListener('change', () => { ok.disabled = !cb.checked; });
    ok.addEventListener('click', () => {
      try { localStorage.setItem(CONSENT_KEY, '1'); } catch (_) {}
      consentEl.classList.remove('show');
      try { inputEl.focus(); } catch (_) {}
    });

    // Ctrl+K / Cmd+K : ouvre et donne le curseur. Le raccourci n'est pas
    // intercepte quand on est deja en train d'ecrire dans CYL.
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        if (!prefs.lire().raccourci) return;   // désactivable : Ctrl+K sert ailleurs
        e.preventDefault();
        open();
      } else if (e.key === 'Escape' && panel.dataset.state === 'open') {
        // Echap ne ferme que si le focus est dans le panneau : ailleurs, il
        // appartient a la page (une fiche ouverte, un menu...).
        if (panel.contains(document.activeElement)) { minimize(); }
      }
    });

    // Une page peut publier son contexte apres coup (donnees Firestore).
    document.addEventListener('cyl:context', () => { renderContext(); renderActions(); });

    // Un réglage changé se voit TOUT DE SUITE, y compris depuis l'autre porte
    // d'entrée (la page des paramètres, dans un onglet ouvert en parallèle).
    const appliquerPrefs = () => {
      const p = prefs.lire();
      const m = panel.querySelector('#cylp-mention');
      if (m) m.hidden = !p.rappelPro;
      inputEl.placeholder = p.raccourci ? 'Parle a CYL... (Ctrl+K)' : 'Parle a CYL...';
      paintBadge();
    };
    document.addEventListener('cyl:prefs', appliquerPrefs);
    appliquerPrefs();

    wireSheet();
  }

  // ── Feuille mobile : on la remonte du doigt ───────────────────────────────
  function wireSheet() {
    const mq = window.matchMedia('(max-width: 900px)');
    const grabZones = [panel.querySelector('.cylp-grab'), panel.querySelector('.cylp-head')];
    for (const zone of grabZones) {
      if (!zone) continue;
      zone.addEventListener('pointerdown', (e) => {
        if (!mq.matches) return;
        // Un bouton de l'entete reste cliquable : on ne detourne pas son geste.
        if (e.target.closest('button') && zone.classList.contains('cylp-head')) return;
        e.preventDefault();
        const y0 = e.clientY;
        const h0 = panel.getBoundingClientRect().height;
        panel.classList.add('dragging');
        try { zone.setPointerCapture(e.pointerId); } catch (_) {}
        const move = (ev) => {
          const h = Math.max(120, Math.min(window.innerHeight * 0.92, h0 - (ev.clientY - y0)));
          panel.style.setProperty('--cylp-h', h + 'px');
        };
        const up = () => {
          zone.removeEventListener('pointermove', move);
          zone.removeEventListener('pointerup', up);
          zone.removeEventListener('pointercancel', up);
          panel.classList.remove('dragging');
          const h = panel.getBoundingClientRect().height;
          // Tire suffisamment vers le bas : la feuille se range.
          if (h < 180) { panel.style.setProperty('--cylp-h', '68vh'); minimize(); return; }
          ss.set(SHEET_KEY, String(Math.round(h)));
        };
        zone.addEventListener('pointermove', move);
        zone.addEventListener('pointerup', up);
        zone.addEventListener('pointercancel', up);
      });
    }
  }

  // ── Contrat public, inchange depuis l'ancienne bulle ──────────────────────
  let openChat = null;
  let pendingOpen = null;

  document.addEventListener('cyl:chat-open', (e) => {
    const prefill = (e.detail && e.detail.prefill) || null;
    if (openChat) openChat(prefill);
    else pendingOpen = { prefill };
  });

  onAuthStateChanged(auth, (user) => {
    if (!user || document.querySelector('.cylp')) return;
    build();

    openChat = (prefill) => {
      // Sans prefill, l'appel est une BASCULE : recliquer sur l'encart CYL
      // referme le panneau. Avec un prefill, l'intention est explicite.
      if (!prefill && panel.dataset.state === 'open') { minimize(); return; }
      open();
      setTab('chat');
      if (prefill) {
        // JAMAIS d'envoi automatique : la personne relit, modifie, efface.
        inputEl.value = prefill;
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(140, inputEl.scrollHeight) + 'px';
        try { inputEl.focus(); } catch (_) {}
      }
    };

    // `open` est une OUVERTURE FRANCHE, pas une bascule : /js/urgence.js
    // l'appelle depuis le flux de detresse (« parler a CYL »), ou refermer le
    // panneau parce qu'il etait deja ouvert serait le pire moment pour le faire.
    // La bascule reste reservee a `cyl:chat-open` sans prefill (l'encart CYL
    // de /app/, qu'on reclique pour refermer).
    window.cylChat = { open: () => open(), close: minimize };
    window.cylPanel = {
      open: () => open(),
      close: minimize,
      ask: (t) => { open(); setTab('chat'); send(t); },
      setContext: (ctx) => {
        window.CYL_CONTEXT = ctx;
        document.dispatchEvent(new CustomEvent('cyl:context'));
      },
    };

    if (pendingOpen) { const p = pendingOpen; pendingOpen = null; openChat(p.prefill); }
  });
}
