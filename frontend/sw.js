/**
 * ==============================================================================
 * BiblioDrift Service Worker
 * ==============================================================================
 *
 * Caching strategies:
 *
 *   STATIC_CACHE  — Cache-first
 *     All local CSS, JS, HTML, images, sounds.
 *     Served from cache immediately; updated in background on next visit.
 *
 *   API_CACHE     — Network-first with cache fallback
 *     Requests to the BiblioDrift backend (/api/v1/*) and Google Books API.
 *     Online: always fetches fresh data, caches the response.
 *     Offline: serves the last cached response if available.
 *
 *   FONT_CACHE    — Cache-first (long TTL)
 *     Google Fonts and CDN assets (Font Awesome, DOMPurify).
 *     These rarely change; cache indefinitely.
 *
 * Cache versioning:
 *   Bump CACHE_VERSION when deploying breaking changes to force all clients
 *   to discard stale caches and re-fetch assets.
 *
 * Offline fallback:
 *   If a navigation request fails and no cache entry exists, the SW serves
 *   the offline page (pages/index.html) so the user always sees something.
 *
 * Library data:
 *   The user's book library is already persisted in localStorage + IndexedDB
 *   by the app itself (SafeStorage in app.js). The SW does not need to
 *   duplicate this — it just ensures the app shell loads offline.
 * ==============================================================================
 */

const CACHE_VERSION   = 'v1';
const STATIC_CACHE    = `bibliodrift-static-${CACHE_VERSION}`;
const API_CACHE       = `bibliodrift-api-${CACHE_VERSION}`;
const FONT_CACHE      = `bibliodrift-fonts-${CACHE_VERSION}`;

// All caches managed by this SW — used during activation to purge old ones
const ALL_CACHES = [STATIC_CACHE, API_CACHE, FONT_CACHE];

// Core app shell — pre-cached on install so the app works offline immediately
const APP_SHELL = [
  '/frontend/pages/index.html',
  '/frontend/pages/library.html',
  '/frontend/pages/chat.html',
  '/frontend/pages/auth.html',
  '/frontend/pages/profile.html',
  '/frontend/pages/404.html',
  '/frontend/css/style.css',
  '/frontend/css/style-responsive.css',
  '/frontend/css/keyboard-shortcuts.css',
  '/frontend/js/config.js',
  '/frontend/js/app.js',
  '/frontend/js/library-3d.js',
  '/frontend/js/chat.js',
  '/frontend/js/ambient.js',
  '/frontend/js/footer.js',
  '/frontend/js/book-preview.js',
  '/frontend/js/pwa.js',
  '/frontend/assets/images/biblioDrift_favicon.png',
  '/frontend/assets/images/dune.jpg',
  '/frontend/assets/images/1984.jpg',
  '/frontend/assets/images/hobbit.jpg',
  '/frontend/assets/images/pride.jpg',
  '/frontend/assets/images/gatsby.jpg',
  '/frontend/assets/images/sapiens.jpg',
  '/frontend/assets/images/hail_mary.jpg',
  '/frontend/assets/sounds/page-flip.mp3',
  '/frontend/assets/sounds/rain.mp3',
  '/frontend/assets/sounds/fire.mp3',
  '/frontend/manifest.json',
];

// ── Install ────────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Pre-cache the app shell. Individual failures are caught so a single
      // missing asset doesn't abort the entire install.
      return Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Pre-cache failed for ${url}:`, err.message);
          })
        )
      );
    }).then(() => {
      // Activate immediately — don't wait for old SW to be released
      return self.skipWaiting();
    })
  );
});

// ── Activate ───────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !ALL_CACHES.includes(name))
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Take control of all open clients immediately
      return self.clients.claim();
    })
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests — POST/PUT/DELETE go straight to network
  if (request.method !== 'GET') return;

  // ── 1. Third-party fonts and CDN assets → Cache-first ──────────────────────
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdnjs.cloudflare.com' ||
    url.hostname === 'cdn.jsdelivr.net'
  ) {
    event.respondWith(_cacheFirst(request, FONT_CACHE));
    return;
  }

  // ── 2. BiblioDrift backend API → Network-first with cache fallback ──────────
  if (
    url.pathname.startsWith('/api/v1/') ||
    url.pathname.startsWith('/api/')
  ) {
    event.respondWith(_networkFirst(request, API_CACHE));
    return;
  }

  // ── 3. Google Books API → Network-first with cache fallback ────────────────
  if (url.hostname === 'www.googleapis.com' && url.pathname.startsWith('/books/')) {
    event.respondWith(_networkFirst(request, API_CACHE));
    return;
  }

  // ── 4. Google Books jsapi / viewer → Cache-first ───────────────────────────
  if (url.hostname === 'www.google.com' && url.pathname.startsWith('/books/')) {
    event.respondWith(_cacheFirst(request, FONT_CACHE));
    return;
  }

  // ── 5. Local app assets → Stale-while-revalidate ───────────────────────────
  // Covers HTML pages, CSS, JS, images, sounds
  if (url.origin === self.location.origin) {
    event.respondWith(_staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Everything else: let the browser handle it normally
});

// ── Strategy implementations ───────────────────────────────────────────────────

/**
 * Cache-first: serve from cache, fall back to network, cache the result.
 * Best for assets that rarely change (fonts, icons, CDN libs).
 */
async function _cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return new Response('Offline — resource unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Network-first: try network, fall back to cache.
 * Best for API responses where freshness matters but offline fallback is useful.
 */
async function _networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return a structured offline JSON response for API calls
    return new Response(
      JSON.stringify({
        success: false,
        offline: true,
        error: 'You are offline. Showing cached data where available.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Stale-while-revalidate: serve from cache immediately, update cache in background.
 * Best for HTML pages and local JS/CSS — fast loads with eventual freshness.
 */
async function _staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Kick off a background network fetch regardless
  const networkFetch = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // Return cached immediately if available, otherwise wait for network
  return cached || networkFetch || _offlineFallback();
}

/**
 * Offline fallback page for navigation requests.
 */
async function _offlineFallback() {
  const cached = await caches.match('/frontend/pages/index.html');
  if (cached) return cached;

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BiblioDrift — Offline</title>
  <style>
    body {
      font-family: 'Georgia', serif;
      background: #f9f7f2;
      color: #2c2420;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
      padding: 2rem;
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    p  { color: #6b5e55; line-height: 1.6; max-width: 40ch; }
    a  { color: #d4af37; }
  </style>
</head>
<body>
  <h1>📚 You're offline</h1>
  <p>BiblioDrift can't reach the internet right now, but your saved library is still available.</p>
  <p><a href="/frontend/pages/library.html">Open My Library</a></p>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}

// ── Background sync (future-proof stub) ───────────────────────────────────────
// When the app queues a library sync while offline, this fires once connectivity
// is restored. The actual sync logic lives in LibraryManager.syncLocalToBackend().
self.addEventListener('sync', (event) => {
  if (event.tag === 'bibliodrift-library-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_LIBRARY' });
        });
      })
    );
  }
});
