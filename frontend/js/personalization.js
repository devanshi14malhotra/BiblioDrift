/**
 * Deep Personalization Engine
 * Manages user reading history, preferences, and the local feedback loop.
 */

class PersonalizationEngine {
    constructor() {
        this.storageKey = 'bibliodrift_preferences';
        this.preferences = this.loadPreferences();
    }

    loadPreferences() {
        const defaultPrefs = {
            genres: {}, // format: { 'fantasy': 1.0, 'mystery': 0.5 }
            tropes: {},
            history: [] // stores IDs or titles of clicked/liked books
        };

        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                return { ...defaultPrefs, ...JSON.parse(saved) };
            } catch (e) {
                console.error("Failed to parse preferences:", e);
                return defaultPrefs;
            }
        }
        return defaultPrefs;
    }

    savePreferences() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.preferences));
    }

    /**
     * Feedback Loop ("Training")
     * Increases the weight of a genre or trope based on user interaction.
     * @param {string} type - 'genres' or 'tropes'
     * @param {string} item - The specific genre or trope
     * @param {number} weight - Amount to adjust (e.g., 0.5 for implicit click, 1.0 for explicit like)
     */
    updateWeight(type, item, weight) {
        if (!this.preferences[type]) this.preferences[type] = {};
        
        const currentWeight = this.preferences[type][item] || 0;
        this.preferences[type][item] = Math.min(currentWeight + weight, 5.0); // Cap at 5.0
        
        this.savePreferences();
    }

    /**
     * Record a book interaction (click or like)
     */
    recordBookInteraction(book, isExplicitLike = false) {
        if (!book || !book.volumeInfo) return;

        // Add to history
        const id = book.id || book.volumeInfo.title;
        if (!this.preferences.history.includes(id)) {
            this.preferences.history.push(id);
            // Keep history manageable
            if (this.preferences.history.length > 50) {
                this.preferences.history.shift();
            }
        }

        // Adjust genre weights
        const categories = book.volumeInfo.categories || [];
        const weight = isExplicitLike ? 1.0 : 0.5;
        
        categories.forEach(cat => {
            const normalized = cat.toLowerCase().split(' / ')[0]; // Take main category
            this.updateWeight('genres', normalized, weight);
        });
    }

    /**
     * Get top preferences to augment search queries
     * @returns {string} Comma-separated string of top preferences
     */
    getTopPreferences() {
        const allPrefs = { ...this.preferences.genres, ...this.preferences.tropes };
        const sorted = Object.entries(allPrefs)
            .sort((a, b) => b[1] - a[1]) // Sort by weight descending
            .filter(([_, weight]) => weight >= 1.0) // Only include significant preferences
            .map(([item, _]) => item);
            
        return sorted.slice(0, 3).join(', '); // Return top 3
    }
}

// Attach to window so it can be used globally
window.personalization = new PersonalizationEngine();
