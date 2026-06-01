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
        // 🌟 Tier 0: Isolated genre cache dictionary
        _genreCache: {},

        setKeys(keys) {
            CONFIG.GOOGLE_BOOKS_API_KEYS = Array.from(new Set((keys || []).map(key => String(key || '').trim()).filter(Boolean)));
        },
        getKeys() {
            return CONFIG.GOOGLE_BOOKS_API_KEYS || [];
        },
        async fetchVolumes(query, options = {}) {
            const maxResults = options.maxResults || 5;
            const extraParams = options.extraParams || '';
            
            // 🌟 Tier 0: Check if we have already fetched this specific query/genre
            const cacheKey = `${query}_${maxResults}_${extraParams}`;
            if (this._genreCache[cacheKey]) {
                console.log(`[Cache Hit] Serving recommendations for: ${query}`);
                return this._genreCache[cacheKey];
            }

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
                        const data = await response.json();

                        // 🌟 Tier 1: Content-Based Filtering / Sorting Logic
                        // "Weight by: genre match → avg rating → publication recency"
                        if (data && data.items) {
                            data.items.sort((a, b) => {
                                // 1. Average Rating Weighting (Descending)
                                const ratingA = a.volumeInfo?.averageRating || 0;
                                const ratingB = b.volumeInfo?.averageRating || 0;
                                if (ratingB !== ratingA) {
                                    return ratingB - ratingA;
                                }
                                
                                // 2. Publication Recency Weighting (Newest First)
                                const dateA = new Date(a.volumeInfo?.publishedDate || 0);
                                const dateB = new Date(b.volumeInfo?.publishedDate || 0);
                                return dateB - dateA;
                            });
                        }

                        // 🌟 Tier 0: Save the sorted data into our localized cache
                        this._genreCache[cacheKey] = data;
                        return data;
                    }

                    const retryableStatuses = [429, 403, 503];
                    if (retryableStatuses.includes(response.status) && index < candidates.length - 1) {
                        lastError = new Error(`Google Books API returned ${response.status}`);
                        continue;
                    }

                    throw new Error(`Google Books API returned ${response.status}`);
                } catch (error) {
                    lastError = error;
                    if (index < candidates.length - 1) {
                        continue;
                    }
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

