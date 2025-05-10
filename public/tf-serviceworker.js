
// Face-api.js service worker
// This service worker provides caching for models and optimizes performance

const CACHE_NAME = 'face-api-model-cache-v1';

// Install event - precache model files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        // Face-api model files will be cached here
        '/models/face-api/tiny_face_detector_model-weights_manifest.json',
        '/models/face-api/tiny_face_detector_model-shard1',
        '/models/face-api/face_landmark_68_model-weights_manifest.json',
        '/models/face-api/face_landmark_68_model-shard1',
        '/models/face-api/face_expression_model-weights_manifest.json',
        '/models/face-api/face_expression_model-shard1'
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
  if (event.request.url.includes('/models/face-api/') || 
      event.request.url.includes('.json') || 
      event.request.url.includes('shard')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        return fetch(event.request).then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        });
      })
    );
  }
});
