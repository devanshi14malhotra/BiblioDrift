const CACHE_NAME = 'bibliodrift-cache-v1';
const ASSETS_TO_CACHE = [
    '/frontend/pages/index.html',
    '/frontend/pages/library.html',
    '/frontend/css/style.css',
    '/frontend/css/style_main.css',
    '/frontend/css/style-responsive.css',
    '/frontend/js/app.js',
    '/frontend/js/library-3d.js',
    '/frontend/js/db.js',
    '/manifest.json'
];

// Install Event: Cache all core UI assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching essential UI sanctuary assets...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Fetch Event: Cache-First strategy for core layout files
self.addEventListener('fetch', (event) => {
    // Only intercept local GET requests
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse; // Return local cache copy
            }
            return fetch(event.request); // Fallback to network
        })
    );
});