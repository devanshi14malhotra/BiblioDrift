/**
 * BiblioDrift Configuration
 * Environment-specific configuration for portable deployment
 */

const CONFIG = {
    // Google Books API - loaded from backend config endpoint
    // Leave empty - it will be populated by loadConfig() in app.js
    GOOGLE_BOOKS_API_KEY: '',

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
}

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

