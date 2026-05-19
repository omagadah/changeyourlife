// service-worker.js - v29 (arbre 3D EZ-Tree)
const CACHE_NAME = 'changeyourlife-v29';
const urlsToCache = [
  '/',
  '/arbre/',
  '/app/',
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
  '/js/arbre3d.js'
  // Bundles vendor (three + ez-tree, total ~4.6 MB) volontairement omis ici :
  // - addAll() est atomique, un échec ferait planter tout l'install
  // - Ils sont gros et seront mis en cache automatiquement par la stratégie
  //   "cache first" du fetch handler dès la 1re visite de /arbre/.
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
});

self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Network first for navigation (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(response => {
            return response || new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // Cache first for other requests
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        return caches.match('/');
      })
  );
});