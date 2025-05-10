
// Face-api.js service worker
// This service worker provides caching for models and optimizes performance

const CACHE_NAME = 'face-api-model-cache-v2';

// Install event - precache model files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        // Face-api tiny face detector model files - ONLY including what we use
        '/models/face-api/tiny_face_detector_model-weights_manifest.json',
        '/models/face-api/tiny_face_detector_model-shard1'
      ]);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve cached resources or fetch from network
self.addEventListener('fetch', (event) => {
  // Only cache face-api model files
  if (event.request.url.includes('/models/face-api/')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // Cache hit - return response
        if (response) {
          console.log('Serving from cache:', event.request.url);
          return response;
        }
        
        console.log('Fetching from network:', event.request.url);
        return fetch(event.request).then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200) {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
            console.log('Cached:', event.request.url);
          });
          
          return response;
        });
      })
    );
  }
});
