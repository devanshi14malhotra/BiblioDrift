const LOCAL_MOOD_API_BASE = 'http://127.0.0.1:5000/api/v1';

/**
 * Resolve API base for dev vs static hosting (Netlify, etc.).
 * Public HTTPS pages must not call loopback (127.0.0.1); use same-origin /api/v1
 * when a reverse proxy or Netlify redirect points /api to a deployed backend.
 * Optional build-time override: window.__MOOD_API_BASE_OVERRIDE__ (see build_netlify.py).
 */
function resolveMoodApiBase() {
    if (typeof window !== 'undefined' && window.__MOOD_API_BASE_OVERRIDE__) {
        return String(window.__MOOD_API_BASE_OVERRIDE__).replace(/\/$/, '');
    }
    if (typeof window === 'undefined') {
        return LOCAL_MOOD_API_BASE;
    }
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        return LOCAL_MOOD_API_BASE;
    }
    return `${window.location.origin}/api/v1`;
}

const MOOD_API_BASE = resolveMoodApiBase();

const CONFIG = {
    // Google Books API - loaded from backend config endpoint
    // Leave empty - it will be populated by loadConfig() in app.js
    GOOGLE_BOOKS_API_KEY: '',
    GOOGLE_BOOKS_API_KEYS: [],

    // Backend API Base - use relative path for proxy-aware deployment
    // In development: proxy to localhost:5000
    // In production: served from same origin
    MOOD_API_BASE: MOOD_API_BASE,

    // Google Books API endpoint
    API_BASE: 'https://www.googleapis.com/books/v1/volumes',

    // Dynamic base URL helper for auth endpoints
    // Returns the current origin (works in dev and prod)
    getApiBaseUrl: function() {
        return window.location.origin;
    }
};

if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    window.MOOD_API_BASE = MOOD_API_BASE;
    window.API_BASE = CONFIG.API_BASE;
    window.GoogleBooksClient = {
        // ─── In-memory response cache (survives page session) ──────────────
        _cache: new Map(),
        _CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes

        // ─── Sequential request queue with minimum inter-request delay ─────
        _queue: Promise.resolve(),
        _MIN_DELAY_MS: 300, // ms between outgoing requests

        setKeys(keys) {
            CONFIG.GOOGLE_BOOKS_API_KEYS = Array.from(
                new Set((keys || []).map(key => String(key || '').trim()).filter(Boolean))
            );
        },

        getKeys() {
            return CONFIG.GOOGLE_BOOKS_API_KEYS || [];
        },

        /** Returns cached data if still fresh, otherwise null. */
        _getCache(cacheKey) {
            const entry = this._cache.get(cacheKey);
            if (!entry) return null;
            if (Date.now() - entry.timestamp > this._CACHE_TTL_MS) {
                this._cache.delete(cacheKey);
                return null;
            }
            return entry.data;
        },

        /** Stores a response in the in-memory cache. */
        _setCache(cacheKey, data) {
            this._cache.set(cacheKey, { data, timestamp: Date.now() });
        },

        /**
         * Public entry-point. Checks cache first, then serialises the real
         * HTTP call through _queue so requests go out one-at-a-time with a
         * minimum _MIN_DELAY_MS gap — preventing 429 burst errors.
         */
        async fetchVolumes(query, options = {}) {
            const maxResults = options.maxResults || 5;
            const extraParams = options.extraParams || '';
            const cacheKey = `${query}|${maxResults}|${extraParams}`;

            const cached = this._getCache(cacheKey);
            if (cached) return cached;

            // Chain onto the existing queue so calls are serialised.
            const result = await (this._queue = this._queue.then(async () => {
                await new Promise(r => setTimeout(r, this._MIN_DELAY_MS));
                return this._doFetch(query, maxResults, extraParams);
            }));

            this._setCache(cacheKey, result);
            return result;
        },

        /** Internal: performs the actual fetch with key-rotation on 429/403/503. */
        async _doFetch(query, maxResults, extraParams) {
            const keys = this.getKeys();
            const candidates = keys.length > 0 ? keys : [null];
            let lastError = null;

            for (let index = 0; index < candidates.length; index += 1) {
                const key = candidates[index];
                const keyParam = key ? `&key=${encodeURIComponent(key)}` : '';
                const url = `${CONFIG.API_BASE}?q=${encodeURIComponent(query)}&maxResults=${maxResults}${extraParams}${keyParam}`;

                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        return await response.json();
                    }

                    const retryableStatuses = [429, 403, 503];
                    if (retryableStatuses.includes(response.status) && index < candidates.length - 1) {
                        // Brief pause before trying the next key
                        await new Promise(r => setTimeout(r, 500));
                        lastError = new Error(`Google Books API returned ${response.status}`);
                        continue;
                    }

                    throw new Error(`Google Books API returned ${response.status}`);
                } catch (error) {
                    lastError = error;
                    if (index < candidates.length - 1) continue;
                }
            }

            throw lastError || new Error('Google Books request failed');
        }
    };
}

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

