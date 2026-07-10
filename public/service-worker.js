// service-worker.js - v152 (fix login Chrome : COOP + CSP google.com + redirection explicite)
const CACHE_NAME = 'changeyourlife-v152';
const urlsToCache = [
  '/',
  '/app/',
  '/plan/',
  '/competences/',
  '/organizer/',
  '/agenda/',
  '/physio/',
  '/securite/',
  '/appartenance/',
  '/estime/',
  '/cognitif/',
  '/esthetique/',
  '/accomplissement/',
  '/transcendance/',
  '/login/',
  '/signup/',
  '/verify-email/',
  '/legal/',
  '/cgu/',
  '/confidentialite/',
  '/journal/',
  '/settings/',
  '/profile/',
  '/yourlife/',
  '/meditation/',
  '/objectifs/',
  '/coach/',
  '/codex/',
  '/autoevaluation/',
  '/bilan/',
  '/humeur/',
  '/habitudes/',
  '/sommeil/',
  '/gratitude/',
  '/manifest.json',
  '/css/main.min.css',
  '/js/common.js',
  '/js/home-aura.js',
  '/js/home-auth-modal.js',
  '/js/home-failsafe.js',
  '/js/userMenu.js',
  '/js/inscription.js',
  '/js/firebase.js',
  '/js/arbre3d.js',
  '/js/i18n.js',
  '/js/plan.js',
  '/js/skills.js',
  '/js/competences.js',
  '/js/branche.js',
  '/js/quotes.js',
  '/js/agenda.js',
  '/js/agenda-page.js',
  '/js/emoji.js',
  '/js/organizer.js',
  '/js/tree-model.js',
  '/js/tree-data.js',
  '/js/tree-widget.js',
  '/js/xp-reward.js',
  '/js/lya-overlay.js',
  '/js/login-bg.js',
  '/js/login-init.js',
  '/js/particle-avatar.js',
  '/js/pixel-badge.js',
  '/js/archi-build.js',
  '/js/syl-chat.js',
  '/js/ez-tree-build.js',
  '/js/tree-lab.js',
  '/js/living-tree.js'
  // Bundle vendor three (~733 KB) volontairement omis ici :
  // - addAll() est atomique, un échec ferait planter tout l'install
  // - mis en cache automatiquement par la stratégie "cache first" du
  //   fetch handler dès la 1re visite de /arbre/.
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => caches.keys())
      .then(cacheNames => Promise.all(
        cacheNames.map(name => name !== CACHE_NAME ? caches.delete(name) : null)
      ))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
  // NB : on ne force PLUS de rechargement des onglets ici (c'était la cause du
  // "flash"/refresh au chargement à chaque déploiement). La stratégie fetch est
  // network-first pour HTML/JS/CSS : le contenu frais est servi sans recharger.
});

// Stratégie de cache :
//   - HTML / JS / CSS  → network first (toujours servir la dernière version
//     quand on est en ligne, fallback cache hors ligne).
//   - reste (images, fonts, vendor)  → cache first (rapide).
self.addEventListener('fetch', event => {
  const { request } = event;
  // On ne s'occupe pas des requêtes non-GET ni des chrome-extension://
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isFreshAsset = request.mode === 'navigate'
    || /\.(?:js|mjs|css|html)$/i.test(url.pathname);

  if (isFreshAsset) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/') || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Cache first pour le reste (images, fonts, vendor)
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) return response;
        return fetch(request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache)).catch(() => {});
          return response;
        });
      })
      .catch(() => caches.match('/'))
  );
});