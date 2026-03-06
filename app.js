/**
 * Library Application Core Logic
 * * This file contains the LibraryManager and ThemeManager classes.
 * It has been updated to safely handle QuotaExceededError when 
 * interacting with localStorage.
 */

// Global Utility for UI feedback (referenced in the bug report)
function showToast(message, type = "info") {
    console.log(`[Toast ${type.toUpperCase()}]: ${message}`);
    // implementation would normally render a UI element
}

/**
 * Robust Wrapper for LocalStorage
 * Prevents application crashes when the 5MB quota is exceeded.
 */
const SafeStorage = {
    /**
     * Attempts to save data to localStorage with error handling.
     * @param {string} key 
     * @param {string} value 
     * @returns {boolean} Success status
     */
    set(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            // Check specifically for QuotaExceededError across different browsers
            const isQuotaError = 
                error instanceof DOMException && (
                error.code === 22 || 
                error.code === 1014 || 
                error.name === 'QuotaExceededError' || 
                error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

            if (isQuotaError) {
                showToast("Local storage full! Please sync to cloud and clear cache.", "error");
            } else {
                console.error("LocalStorage Error:", error);
            }
            return false;
        }
    },

    /**
     * Safely retrieves data from localStorage.
     */
    get(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }
};

class ThemeManager {
    constructor() {
        this.theme = SafeStorage.get('ui_theme') || 'light';
        this.applyTheme();
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        // FIXED: Using SafeStorage instead of direct localStorage.setItem
        if (SafeStorage.set('ui_theme', this.theme)) {
            this.applyTheme();
        }
    }

    applyTheme() {
        document.body.className = this.theme;
        console.log(`Theme applied: ${this.theme}`);
    }
}

class LibraryManager {
    constructor() {
        this.books = this.loadFromStorage();
        this.authToken = SafeStorage.get('auth_token');
    }

    loadFromStorage() {
        const data = SafeStorage.get('library_cache');
        return data ? JSON.parse(data) : [];
    }

    /**
     * Persists the library state locally.
     * Updated to handle storage limits.
     */
    saveLocally() {
        const serializedData = JSON.stringify(this.books);
        // FIXED: Wrapped in SafeStorage to catch QuotaExceededError
        SafeStorage.set('library_cache', serializedData);
    }

    addBook(book) {
        this.books.push(book);
        this.saveLocally();
        showToast(`Added: ${book.title}`, "success");
    }

    updateAuthToken(token) {
        this.authToken = token;
        // FIXED: Securely attempt to store token
        SafeStorage.set('auth_token', token);
    }

    clearCache() {
        localStorage.removeItem('library_cache');
        this.books = [];
        showToast("Cache cleared.", "info");
    }
}

// Initialization
const themeManager = new ThemeManager();
const library = new LibraryManager();

// Example usage that might trigger the bug if quota is full:
// library.addBook({ title: "My Large Journal", content: "..." });