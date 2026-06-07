// service-worker.js - v82 (8 espaces-branches de l'arbre + liens depuis l'arbre)
const CACHE_NAME = 'changeyourlife-v82';
const urlsToCache = [
  '/',
  '/app/',
  '/plan/',
  '/competences/',
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
  '/js/userMenu.js',
  '/js/inscription.js',
  '/js/firebase.js',
  '/js/arbre3d.js',
  '/js/i18n.js',
  '/js/plan.js',
  '/js/skills.js',
  '/js/competences.js',
  '/js/branche.js',
  '/js/tree-model.js',
  '/js/tree-data.js',
  '/js/tree-widget.js',
  '/js/xp-reward.js',
  '/js/lya-overlay.js',
  '/js/login-bg.js',
  '/js/login-init.js'
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
  event.waitUntil((async () => {
    await clients.claim();
    // Auto-recharge les onglets contrôlés : sans ça, l'utilisateur reste
    // bloqué sur d'anciens assets en cache après un déploiement. Une seule
    // recharge par mise à jour du SW (pas de boucle).
    try {
      const all = await clients.matchAll({ type: 'window' });
      for (const c of all) {
        try { c.navigate(c.url); } catch (_) { /* ignore */ }
      }
    } catch (_) { /* matchAll/navigate non supporté → tant pis */ }
  })());
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