// service-worker.js
const CACHE_NAME = 'changeyourlife-v5';
const urlsToCache = [
  '/',
  '/app/',
  '/login/',
  '/settings/',
  '/profile/',
  '/yourlife/',
  '/css/main.min.css',
  '/js/common.min.js',
  '/js/common.js',
  '/js/userMenu.js',
  '/js/profile.js',
  '/js/inscription.js',
  '/js/agent-builder.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js',
  'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.birds.min.js',
  'https://cdn.jsdelivr.net/npm/shepherd.js@10.0.1/dist/css/shepherd.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  // Activate this SW immediately (no waiting state)
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          response => {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response as it's a stream and can only be consumed once
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});