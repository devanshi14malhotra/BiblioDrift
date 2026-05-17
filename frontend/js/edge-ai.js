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
        this.localCatalog = [
            {
                id: 'local_1',
                volumeInfo: {
                    title: 'The Night Circus',
                    authors: ['Erin Morgenstern'],
                    description: 'A magical, melancholy romance set in a mysterious wandering circus.',
                    categories: ['Fantasy', 'Romance', 'Magic', 'Melancholy'],
                    imageLinks: { thumbnail: 'https://books.google.com/books/content?id=Z01n0zB5Z_oC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
                }
            },
            {
                id: 'local_2',
                volumeInfo: {
                    title: 'The Secret History',
                    authors: ['Donna Tartt'],
                    description: 'A dark, thrilling tale of a group of eccentric students and a fatal secret.',
                    categories: ['Mystery', 'Thriller', 'Tragedy'],
                    imageLinks: { thumbnail: 'https://books.google.com/books/content?id=E8m_eK1G6ZQC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
                }
            },
            {
                id: 'local_3',
                volumeInfo: {
                    title: 'A Psalm for the Wild-Built',
                    authors: ['Becky Chambers'],
                    description: 'A cozy, healing sci-fi journey about a tea monk and a robot.',
                    categories: ['Sci-Fi', 'Cozy', 'Healing', 'Adventure'],
                    imageLinks: { thumbnail: 'https://books.google.com/books/content?id=h3P1DwAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
                }
            },
            {
                id: 'local_4',
                volumeInfo: {
                    title: 'Pride and Prejudice',
                    authors: ['Jane Austen'],
                    description: 'A classic historical comedy of manners and enemies-to-lovers romance.',
                    categories: ['Romance', 'Historical', 'Comedy'],
                    imageLinks: { thumbnail: 'https://books.google.com/books/content?id=s1gVAAAAYAAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
                }
            },
            {
                id: 'local_5',
                volumeInfo: {
                    title: 'The Book Thief',
                    authors: ['Markus Zusak'],
                    description: 'A tragic, beautiful historical novel narrated by Death.',
                    categories: ['Historical', 'Tragedy', 'Grief', 'Melancholy'],
                    imageLinks: { thumbnail: 'https://books.google.com/books/content?id=mF_1wB2H6KUC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
                }
            }
        ];
    }

    async init(onProgress = null) {
        if (this.isReady || this.isInitializing) return;
        this.isInitializing = true;

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
     * Searches the local fallback catalog using extracted keywords.
     * @param {Array<string>} keywords 
     * @returns {Array<Object>} Matches from the local catalog
     */
    searchLocalCatalog(keywords) {
        if (!keywords || keywords.length === 0) {
            // Return random 3 if no keywords
            return this.localCatalog.sort(() => 0.5 - Math.random()).slice(0, 3);
        }

        const normalizedKeywords = keywords.map(k => k.toLowerCase());

        // Score each book in the local catalog
        const scoredBooks = this.localCatalog.map(book => {
            let score = 0;
            const textToSearch = [
                book.volumeInfo.title,
                book.volumeInfo.description,
                ...(book.volumeInfo.categories || [])
            ].join(' ').toLowerCase();

            normalizedKeywords.forEach(keyword => {
                if (textToSearch.includes(keyword)) {
                    score += 1;
                }
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
            return this.localCatalog.sort(() => 0.5 - Math.random()).slice(0, 2);
        }

        return matches.slice(0, 3); // Return top 3 matches
    }
}

// Attach to window so it can be used globally
window.edgeAI = new EdgeAIEngine();
