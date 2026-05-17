/**
 * Local Edge AI Engine for BiblioDrift using Transformers.js
 * Runs directly in the browser to extract keywords and classify moods.
 */

class EdgeAIEngine {
    constructor() {
        this.classifier = null;
        this.isReady = false;
        this.isInitializing = false;
        // Standard labels to map user conversational prompts to book-searchable keywords
        this.labels = [
            'romance', 'mystery', 'thriller', 'fantasy', 'sci-fi', 
            'non-fiction', 'horror', 'historical', 'comedy', 'tragedy', 
            'cozy', 'melancholy', 'adventure', 'healing', 'grief', 'magic'
        ];

        // Local fallback catalog for when Google Books API rate limits (HTTP 429)
        // Will be populated dynamically from catalog.json
        this.localCatalog = [];
    }

    async init(onProgress = null) {
        if (this.isReady || this.isInitializing) return;
        this.isInitializing = true;

        // Load dynamic 300+ book catalog first
        if (this.localCatalog.length === 0) {
            try {
                const catalogResponse = await fetch('../js/catalog.json');
                if (catalogResponse.ok) {
                    this.localCatalog = await catalogResponse.json();
                    console.log(`Loaded ${this.localCatalog.length} books into the offline catalog.`);
                } else {
                    console.warn("Failed to load catalog.json - Offline catalog may be empty");
                }
            } catch (error) {
                console.warn("Error loading catalog.json:", error);
            }
        }

        try {
            // Import from CDN if not already available
            if (!window.transformers) {
                const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
                window.transformers = transformers;
            }

            const { pipeline, env } = window.transformers;

            // Configure for browser execution
            env.allowLocalModels = false;

            // Load a lightweight zero-shot classification model
            // mobilebert is small enough to load quickly in-browser
            this.classifier = await pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli', {
                progress_callback: (info) => {
                    if (onProgress) onProgress(info);
                }
            });

            this.isReady = true;
            this.isInitializing = false;
            console.log("Edge AI Engine initialized successfully.");
        } catch (error) {
            console.error("Failed to initialize Edge AI Engine:", error);
            this.isInitializing = false;
        }
    }

    /**
     * Analyzes a conversational prompt to extract relevant book search keywords.
     * @param {string} text - User prompt
     * @returns {Array<string>} Top keywords
     */
    async extractKeywords(text) {
        if (!this.isReady) {
            await this.init();
        }

        if (!this.classifier) {
            console.error("Classifier not loaded.");
            return [];
        }

        try {
            const output = await this.classifier(text, this.labels, { multi_label: true });
            
            // Get labels with a score higher than 0.3 or at least the top 2
            const topKeywords = [];
            for (let i = 0; i < output.labels.length; i++) {
                if (output.scores[i] > 0.3 || i < 2) {
                    topKeywords.push(output.labels[i]);
                }
                if (topKeywords.length >= 3) break; // Limit to 3 keywords
            }

            return topKeywords;
        } catch (error) {
            console.error("Error during Edge AI inference:", error);
            return [];
        }
    }

    /**
     * Searches the local fallback catalog using extracted keywords and raw query.
     * @param {Array<string>} keywords 
     * @param {string} rawQuery
     * @returns {Array<Object>} Matches from the local catalog
     */
    searchLocalCatalog(keywords, rawQuery = "") {
        if (this.localCatalog.length === 0) return [];

        if ((!keywords || keywords.length === 0) && !rawQuery) {
            // Return random 3 if no keywords and no raw query
            return [...this.localCatalog].sort(() => 0.5 - Math.random()).slice(0, 3);
        }

        const normalizedKeywords = (keywords || []).map(k => k.toLowerCase());
        const rawTokens = rawQuery.toLowerCase().split(/\W+/).filter(t => t.length > 2);

        // Score each book in the local catalog
        const scoredBooks = this.localCatalog.map(book => {
            let score = 0;
            
            const title = (book.volumeInfo.title || '').toLowerCase();
            const authors = (book.volumeInfo.authors || []).join(' ').toLowerCase();
            const description = (book.volumeInfo.description || '').toLowerCase();
            const categories = (book.volumeInfo.categories || []).join(' ').toLowerCase();
            
            const textToSearch = [title, description, categories].join(' ');

            // 1. Direct raw query matching (Massive Boosts)
            rawTokens.forEach(token => {
                if (authors.includes(token)) score += 50; // Author match is most important
                if (title.includes(token)) score += 20;   // Title match is second most important
            });

            // 2. Mood/Genre Keyword matching
            normalizedKeywords.forEach(keyword => {
                if (categories.includes(keyword)) score += 5;
                else if (textToSearch.includes(keyword)) score += 1;
            });

            return { book, score };
        });

        // Filter and sort
        const matches = scoredBooks
            .filter(b => b.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(b => b.book);

        // If no matches found with keywords, return random fallback
        if (matches.length === 0) {
            return [...this.localCatalog].sort(() => 0.5 - Math.random()).slice(0, 2);
        }

        return matches.slice(0, 3); // Return top 3 matches
    }
}

// Attach to window so it can be used globally
window.edgeAI = new EdgeAIEngine();
