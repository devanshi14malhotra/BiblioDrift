/**
 * BiblioDrift Configuration
 * Environment-specific configuration for portable deployment
 */

const CONFIG = {
    // Google Books API - loaded from backend config endpoint
    // Leave empty - it will be populated by loadConfig() in app.js
    GOOGLE_BOOKS_API_KEY: '',
    GOOGLE_BOOKS_API_KEYS: [],

    // Backend API Base - use relative path for proxy-aware deployment
    // In development: proxy to localhost:5000
    // In production: served from same origin
    MOOD_API_BASE: '/api/v1',

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
    window.MOOD_API_BASE = CONFIG.MOOD_API_BASE;
    window.GoogleBooksClient = {
        setKeys(keys) {
            CONFIG.GOOGLE_BOOKS_API_KEYS = Array.from(new Set((keys || []).map(key => String(key || '').trim()).filter(Boolean)));
        },
        getKeys() {
            return CONFIG.GOOGLE_BOOKS_API_KEYS || [];
        },
        async fetchVolumes(query, options = {}) {
            const maxResults = options.maxResults || 5;
            const extraParams = options.extraParams || '';
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

