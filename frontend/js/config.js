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

    // UI Configuration
    CHUNK_SIZE: 20,

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
        // ─── Bounded LRU cache (max 100 entries, 10-min TTL) ───────────────
        // Using a Map so insertion order is preserved — oldest key is always
        // map.keys().next().value, giving us free LRU eviction with no libs.
        _cache: new Map(),
        _CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes per entry
        _CACHE_MAX:    100,              // evict oldest when this is exceeded

        // ─── Token-bucket concurrency limiter ──────────────────────────────
        // Allows up to _BUCKET_SIZE requests in flight simultaneously.
        // Tokens refill at one per _REFILL_MS, preventing 429 bursts while
        // not blocking unrelated searches behind each other in a queue.
        _tokens:      3,    // max concurrent requests
        _BUCKET_SIZE: 3,
        _REFILL_MS:   300,  // one token back every 300 ms

        setKeys(keys) {
            CONFIG.GOOGLE_BOOKS_API_KEYS = Array.from(
                new Set((keys || []).map(key => String(key || '').trim()).filter(Boolean))
            );
        },

        getKeys() {
            return CONFIG.GOOGLE_BOOKS_API_KEYS || [];
        },

        // ─── Cache helpers ──────────────────────────────────────────────────

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

        /** Stores a response, evicting the oldest entry when over the cap. */
        _setCache(cacheKey, data) {
            // Evict oldest (first inserted) entry when at capacity
            if (this._cache.size >= this._CACHE_MAX) {
                const oldest = this._cache.keys().next().value;
                this._cache.delete(oldest);
            }
            this._cache.set(cacheKey, { data, timestamp: Date.now() });
        },

        // ─── Token-bucket helpers ────────────────────────────────────────────

        /** Waits until a token is available, then consumes one. */
        async _acquireToken() {
            while (this._tokens <= 0) {
                await new Promise(r => setTimeout(r, this._REFILL_MS));
            }
            this._tokens -= 1;
        },

        /** Returns a token after a request finishes. */
        _releaseToken() {
            if (this._tokens < this._BUCKET_SIZE) this._tokens += 1;
        },

        /**
         * Public entry-point. Checks cache first, then uses the token bucket
         * so at most _BUCKET_SIZE unrelated requests run simultaneously —
         * preventing 429 bursts without forcing unrelated searches to queue
         * behind each other.
         */
        async fetchVolumes(query, options = {}) {
            const maxResults = options.maxResults || 5;
            const extraParams = options.extraParams || '';
            let keys = this.getKeys();
            if (keys.length === 0 && CONFIG.GOOGLE_BOOKS_API_KEY) {
                keys = [CONFIG.GOOGLE_BOOKS_API_KEY];
            }
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