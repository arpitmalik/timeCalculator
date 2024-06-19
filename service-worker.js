// service-worker.js
const CACHE_NAME = 'time-calculator-v1';
const urlsToCache = [
  '/',
  'index.html',
  'style.css', // If you have a separate CSS file
  'script.js', // Your existing JavaScript file
  // Add other static assets like images, fonts, etc.
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
