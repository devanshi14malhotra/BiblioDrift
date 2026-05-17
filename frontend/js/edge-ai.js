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
}

// Attach to window so it can be used globally
window.edgeAI = new EdgeAIEngine();
