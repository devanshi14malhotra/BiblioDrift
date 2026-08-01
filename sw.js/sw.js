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
        .catch(err => console.error(err))