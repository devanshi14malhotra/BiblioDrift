// Chat with Bookseller - JavaScript functionality
// Handles chat interface, message sending, and book recommendations

class ChatInterface {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.quickSuggestions = document.getElementById('quickSuggestions');

        this.conversationHistory = [];
        this.isProcessing = false;

        this.init();
    }

    init() {
        // Load conversation history from localStorage
        this.loadConversationHistory();

        // Initialize personal taste profile
        this.initVibeProfile();

        // Set up event listeners
        this.setupEventListeners();

        // Initialize with welcome message if no history
        if (this.conversationHistory.length === 0) {
            this.addWelcomeMessage();
        }
    }

    /**
     * Sanitize user input before sending to server.
     * Client-side sanitization provides defense-in-depth alongside server-side validation.
     * 
     * Security Measures:
     * 1. Trim whitespace
     * 2. Enforce maximum length (2000 characters)
     * 3. Detect encoded attack vectors
     * 4. Remove dangerous patterns
     * 5. Use textContent for safe rendering
     * 
     * @param {string} input - Raw user input
     * @returns {string} Sanitized input
     */
    sanitizeUserInput(input) {
        if (!input || typeof input !== 'string') {
            return '';
        }

        // Step 1: Trim and check for empty input
        let sanitized = input.trim();
        if (!sanitized) {
            return '';
        }

        // Step 2: Enforce maximum length (matches server-side validation: 2000 chars)
        if (sanitized.length > 2000) {
            sanitized = sanitized.substring(0, 2000);
        }

        // Step 3: Decode HTML entities to catch encoded attacks
        try {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = sanitized;
            sanitized = textarea.textContent || textarea.innerText || sanitized;
        } catch (e) {
            // Use original if decoding fails
        }

        // Step 4: Remove dangerous patterns
        const dangerousPatterns = [
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<script/gi,
            /<iframe/gi,
            /data:text\/html/gi,
            /vbscript:/gi,
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(sanitized)) {
                // Log but continue - server will handle validation
                console.warn('Suspicious pattern detected in input:', pattern);
                sanitized = sanitized.replace(pattern, '');
            }
        }

        // Step 5: Use DOMPurify if available for additional security
        if (typeof DOMPurify !== 'undefined') {
            sanitized = DOMPurify.sanitize(sanitized, {
                ALLOWED_TAGS: [],
                ALLOWED_ATTR: [],
                KEEP_CONTENT: true
            });
        }

        return sanitized;
    }

    setupEventListeners() {
        // Send button click
        this.sendBtn.addEventListener('click', () => this.sendMessage());

        // Enter key to send message
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.chatInput.addEventListener('input', () => {
            this.adjustTextareaHeight();
        });

        // Taste Profile panel controls
        const tasteBtn = document.getElementById('tasteProfileBtn');
        const tastePanel = document.getElementById('tasteProfilePanel');
        const closeTasteBtn = document.getElementById('closeTasteProfile');
        const resetTasteBtn = document.getElementById('resetTasteProfile');

        if (tasteBtn && tastePanel) {
            tasteBtn.addEventListener('click', () => {
                if (tastePanel.style.display === 'none') {
                    tastePanel.style.display = 'flex';
                    this.updateVibeDashboardUI();
                } else {
                    tastePanel.style.display = 'none';
                }
            });
        }

        if (closeTasteBtn && tastePanel) {
            closeTasteBtn.addEventListener('click', () => {
                tastePanel.style.display = 'none';
            });
        }

        if (resetTasteBtn) {
            resetTasteBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear your reading taste profile? This resets all learned vibe scores.')) {
                    this.vibeProfile = this.getDefaultVibeProfile();
                    this.saveVibeProfile();
                }
            });
        }
    }

    addWelcomeMessage() {
        const welcomeMessage = {
            type: 'bookseller',
            content: `Ah, a wandering soul has found their way through the door... Welcome.

I am Elara — keeper of stories, reader of moods, and devoted guide to the worlds that live between pages. Whether your heart is heavy with rain or light as a summer afternoon, I will find you the perfect book.

Tell me: what is stirring in you today?`,
            timestamp: new Date().toISOString()
        };

        this.conversationHistory.push(welcomeMessage);
        this.renderMessage(welcomeMessage);
        this.saveConversationHistory();
    }

    async sendMessage() {
        let message = this.chatInput.value.trim();
        if (!message || this.isTyping) return;

        // Sanitize message before sending to server (defense-in-depth)
        message = this.sanitizeUserInput(message);

        if (!message) {
            // If sanitization resulted in empty string, don't send
            this.chatInput.value = '';
            return;
        }


        // Add user message
        const userMessage = {
            type: 'user',
            content: message,
            timestamp: new Date().toISOString()
        };

        this.conversationHistory.push(userMessage);
        this.renderMessage(userMessage);
        this.chatInput.value = '';
        this.adjustTextareaHeight();

        // Hide quick suggestions after first message
        if (this.quickSuggestions) {
            this.quickSuggestions.style.display = 'none';
        }

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Get AI response
            const response = await this.getBooksellerResponse(message);

            // Hide typing indicator
            this.hideTypingIndicator();

            // Add bookseller response
            const booksellerMessage = {
                type: 'bookseller',
                content: response.message,
                books: response.books || null,
                timestamp: new Date().toISOString()
            };

            this.conversationHistory.push(booksellerMessage);
            this.renderMessage(booksellerMessage);

        } catch (error) {
            // Log error silently in production
            this.hideTypingIndicator();

            // Add error message in Elara's voice
            const errorMessage = {
                type: 'bookseller',
                content: "The candles are flickering and something seems amiss with my connection to the literary spirits. Give me a moment — the books are waiting, and so is the perfect story for you.",
                timestamp: new Date().toISOString()
            };

            this.conversationHistory.push(errorMessage);
            this.renderMessage(errorMessage);
        }

        this.saveConversationHistory();
        this.scrollToBottom();
    }

    async getBooksellerResponse(userMessage) {
        // First, try to use the dedicated chat endpoint
        try {
            const moodApiBase = window.MOOD_API_BASE || '/api/v1';
            const chatResponse = await fetch(`${moodApiBase}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage,
                    // Send token-budget-trimmed history so the backend receives
                    // only what fits in the context window. The backend also
                    // trims independently, but trimming here reduces payload size.
                    history: this._buildTokenBudgetHistory(userMessage)
                })
            });

            if (chatResponse.ok) {
                const chatData = await chatResponse.json();
                if (chatData.success) {
                    // Try to get actual books from Google Books API
                    const books = await this.searchGoogleBooks(userMessage);
                    const parsedResponse = chatData.response || (chatData.data && chatData.data.response) || "I have cataloged some wonderful books for you.";
                    return {
                        message: parsedResponse,
                        books: books
                    };
                }
            }
        } catch (error) {
            // Fallback to mood search
        }

        // Fallback to mood search
        try {
            const moodApiBase = window.MOOD_API_BASE || '/api/v1';
            const moodResponse = await fetch(`${moodApiBase}/mood-search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: userMessage
                })
            });

            if (moodResponse.ok) {
                const moodData = await moodResponse.json();
                if (moodData.success) {
                    const books = await this.searchGoogleBooks(userMessage);
                    return {
                        message: this.generateContextualResponse(userMessage, books),
                        books: books
                    };
                }
            }
        } catch (error) {
            // Final fallback to Google Books only
        }

        // Final fallback to Google Books API only
        const books = await this.searchGoogleBooks(userMessage);
        return {
            message: this.generateContextualResponse(userMessage, books),
            books: books
        };
    }

    /**
     * Estimate the token count of a string using the standard ~4 chars/token
     * heuristic. Mirrors the backend's _estimate_tokens() method so both sides
     * agree on budget calculations without requiring a tokenizer library.
     *
     * @param {string} text
     * @returns {number} Estimated token count (minimum 1)
     */
    _estimateTokens(text) {
        return Math.max(1, Math.floor((text || '').length / 4));
    }

    /**
     * Build a trimmed conversation history array that fits within the token
     * budget before sending to the backend.
     *
     * Budget calculation (conservative, matches backend logic):
     *   available = MODEL_CONTEXT_LIMIT - SYSTEM_PROMPT_TOKENS - RESPONSE_RESERVE - SAFETY_MARGIN
     *
     * We use the smallest common context limit (4096 for gpt-3.5-turbo) so the
     * payload is safe regardless of which LLM the backend selects.
     *
     * Only 'type' and 'content' fields are sent — the backend ChatMessage
     * schema only accepts those two fields.
     *
     * @param {string} currentMessage - The message about to be sent (used for budget accounting)
     * @returns {Array<{type: string, content: string}>} Trimmed history
     */
    _buildTokenBudgetHistory(currentMessage) {
        // Conservative limits matching the smallest supported model (gpt-3.5-turbo)
        const MODEL_CONTEXT_LIMIT = 4096;
        const SYSTEM_PROMPT_TOKENS = 400;  // ~1600 chars for Elara's system prompt
        const RESPONSE_RESERVE = 600;      // tokens reserved for the model's reply
        const SAFETY_MARGIN = 64;
        const CURRENT_MSG_TOKENS = this._estimateTokens(currentMessage);

        const budget =
            MODEL_CONTEXT_LIMIT -
            SYSTEM_PROMPT_TOKENS -
            RESPONSE_RESERVE -
            SAFETY_MARGIN -
            CURRENT_MSG_TOKENS;

        if (budget <= 0) {
            // Current message alone is near the limit — send no history
            return [];
        }

        // Walk history newest-first, accumulate until budget is exhausted
        const kept = [];
        let tokensUsed = 0;

        for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
            const msg = this.conversationHistory[i];
            // Skip messages without content (e.g. welcome message edge cases)
            if (!msg || !msg.content) continue;

            const msgTokens = this._estimateTokens(msg.content);
            if (tokensUsed + msgTokens > budget) {
                break; // Adding this message would overflow the budget
            }

            kept.push({ type: msg.type, content: msg.content });
            tokensUsed += msgTokens;
        }

        // Reverse so history is chronological (oldest → newest)
        kept.reverse();
        return kept;
    }

    async searchGoogleBooks(query) {
        try {
            // Transform user query into book search terms
            const searchQuery = this.transformQueryForBooks(query);
            const client = window.GoogleBooksClient;
            const data = client
                ? await client.fetchVolumes(searchQuery, { maxResults: 6, extraParams: '&printType=books&langRestrict=en' })
                : await (async () => {
                    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=6&printType=books&langRestrict=en`);
                    if (!response.ok) throw new Error('Google Books API error');
                    return await response.json();
                })();

            return data.items || [];
        } catch (error) {
            return [];
        }
    }

    // Dictionaries for local parsing
    getVibeDictionaries() {
        return {
            moods: {
                melancholy: ["melancholy", "melancholic", "sad", "depressing", "heavy heart", "grief", "melancholia", "rainy day", "lonely", "autumn"],
                cozy: ["cozy", "comforting", "warm", "tea", "blankets", "fireplace", "peaceful", "quiet", "calm", "gentle", "soft", "nostalgic"],
                escape: ["escape", "another world", "magical", "whimsical", "wonder", "dreamy", "portal", "enchanting", "dreamlike", "surreal"],
                thrilling: ["thrilling", "tense", "dark", "mysterious", "suspense", "mystery", "chilling", "creepy", "spooky", "scary", "thriller", "spies"],
                heartwarming: ["heartwarming", "healing", "uplifting", "hopeful", "beautiful", "inspiring", "touching", "sweet", "wholesome"],
                intellectual: ["intellectual", "mind-expanding", "deep", "thought-provoking", "existential", "philosophical", "reflective", "clever"]
            },
            genres: {
                romance: ["romance", "romantic", "love story", "love", "passion", "relationship", "relationships", "marriage"],
                fantasy: ["fantasy", "magic", "wizards", "witches", "spells", "dragons", "mythology", "mythical", "kingdom"],
                sciFi: ["sci-fi", "science fiction", "space", "future", "futuristic", "aliens", "technology", "time travel", "dystopian"],
                mystery: ["mystery", "detective", "clue", "clues", "investigation", "crime", "murder", "puzzle", "secrets"],
                thriller: ["thriller", "suspense", "danger", "psychological", "horror", "spooky", "ghost", "stalker"],
                historical: ["historical", "history", "past", "victorian", "war", "century", "ancient", "era"]
            },
            tropes: {
                tragicEnd: ["tragic end", "tragic ending", "sad ending", "tragedy", "heartbreak", "heartbroken", "tearjerker"],
                enemiesToLovers: ["enemies to lovers", "enemies-to-lovers", "hate to love", "rivals"],
                slowBurn: ["slow burn", "slow-burn", "patience", "gradual"],
                darkAcademia: ["dark academia", "university", "boarding school", "secret society", "library", "gothic"],
                foundFamily: ["found family", "ragtag", "crew", "misfits", "loyal friends"]
            },
            stopwords: [
                "suggest me", "recommend", "books", "novel", "novels", "about", "with", "that", "feels", "like", 
                "looking for", "want to", "read", "some", "something", "i want", "please", "give me", "find me",
                "show me", "can you", "could you", "tell me"
            ]
        };
    }

    initVibeProfile() {
        const stored = localStorage.getItem('bibliodrift_vibe_profile');
        if (stored) {
            try {
                this.vibeProfile = JSON.parse(stored);
            } catch (e) {
                this.vibeProfile = this.getDefaultVibeProfile();
            }
        } else {
            this.vibeProfile = this.getDefaultVibeProfile();
        }
        
        // Render or update UI panel if elements exist
        setTimeout(() => this.updateVibeDashboardUI(), 100);
    }

    getDefaultVibeProfile() {
        return {
            genres: { romance: 0, fantasy: 0, sciFi: 0, mystery: 0, thriller: 0, historical: 0 },
            moods: { melancholy: 0, cozy: 0, escape: 0, thrilling: 0, heartwarming: 0, intellectual: 0 },
            tropes: { tragicEnd: 0, enemiesToLovers: 0, slowBurn: 0, darkAcademia: 0, foundFamily: 0 },
            history: []
        };
    }

    saveVibeProfile() {
        localStorage.setItem('bibliodrift_vibe_profile', JSON.stringify(this.vibeProfile));
        this.updateVibeDashboardUI();
    }

    updateVibeProfileFromText(text) {
        if (!text) return;
        const lower = text.toLowerCase();
        const dicts = this.getVibeDictionaries();
        
        let profileChanged = false;
        
        // Scan moods
        for (const [mood, keywords] of Object.entries(dicts.moods)) {
            keywords.forEach(kw => {
                if (lower.includes(kw)) {
                    this.vibeProfile.moods[mood] = (this.vibeProfile.moods[mood] || 0) + 1;
                    profileChanged = true;
                }
            });
        }
        
        // Scan genres
        for (const [genre, keywords] of Object.entries(dicts.genres)) {
            keywords.forEach(kw => {
                if (lower.includes(kw)) {
                    this.vibeProfile.genres[genre] = (this.vibeProfile.genres[genre] || 0) + 1;
                    profileChanged = true;
                }
            });
        }
        
        // Scan tropes
        for (const [trope, keywords] of Object.entries(dicts.tropes)) {
            keywords.forEach(kw => {
                if (lower.includes(kw)) {
                    this.vibeProfile.tropes[trope] = (this.vibeProfile.tropes[trope] || 0) + 1;
                    profileChanged = true;
                }
            });
        }
        
        if (profileChanged) {
            this.saveVibeProfile();
        }
    }

    transformQueryForBooks(userQuery) {
        // Update user taste profile first
        this.updateVibeProfileFromText(userQuery);
        
        const lower = userQuery.toLowerCase();
        const dicts = this.getVibeDictionaries();
        
        // We'll collect actual words to search
        let matchedMoods = [];
        let matchedGenres = [];
        let matchedTropes = [];
        
        for (const [mood, keywords] of Object.entries(dicts.moods)) {
            keywords.forEach(kw => {
                if (lower.includes(kw) && !matchedMoods.includes(mood)) {
                    matchedMoods.push(mood);
                }
            });
        }
        for (const [genre, keywords] of Object.entries(dicts.genres)) {
            keywords.forEach(kw => {
                if (lower.includes(kw) && !matchedGenres.includes(genre)) {
                    matchedGenres.push(genre);
                }
            });
        }
        for (const [trope, keywords] of Object.entries(dicts.tropes)) {
            keywords.forEach(kw => {
                if (lower.includes(kw) && !matchedTropes.includes(trope)) {
                    matchedTropes.push(trope);
                }
            });
        }
        
        // Clean query by removing common bookseller stopwords to isolate target keywords
        let cleaned = lower;
        dicts.stopwords.forEach(word => {
            cleaned = cleaned.replace(new RegExp('\\b' + word + '\\b', 'g'), '');
        });
        cleaned = cleaned.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s{2,}/g, " ").trim();
        
        // Build optimized Google Books query
        let searchTerms = [];
        
        if (matchedGenres.length > 0) {
            searchTerms.push(`subject:"${matchedGenres[0]}"`);
        }
        
        if (matchedMoods.length > 0) {
            searchTerms.push(matchedMoods[0]);
        }
        
        if (matchedTropes.length > 0) {
            searchTerms.push(matchedTropes[0] === 'tragicEnd' ? 'tragedy' : matchedTropes[0]);
        }
        
        // If the user's cleaned input has actual content words left, append them!
        if (cleaned && cleaned.split(' ').length <= 4 && matchedGenres.length === 0 && matchedMoods.length === 0) {
            return userQuery;
        }
        
        const topGenre = Object.entries(this.vibeProfile.genres).sort((a,b) => b[1] - a[1])[0];
        if (topGenre && topGenre[1] > 2 && !matchedGenres.includes(topGenre[0])) {
            searchTerms.push(topGenre[0]);
        }
        
        if (searchTerms.length > 0) {
            return searchTerms.join(' ');
        }
        
        return cleaned.split(' ').slice(0, 4).join(' ') || userQuery;
    }

    generateContextualResponse(userQuery, books) {
        const bookCount = books.length;
        
        // If we couldn't find any books, generate a poetic response and show local curated recommendations
        if (bookCount === 0) {
            const topMood = Object.entries(this.vibeProfile.moods).sort((a,b) => b[1] - a[1])[0]?.[0] || 'melancholy';
            
            const poeticFallbacks = {
                melancholy: "Ah, I hear the quiet murmur of a heavy heart... The high shelves are filled with stories that know how to hold grief and tenderness in the same breath. Let us wander through these rooms together until you find the words you need.",
                cozy: "Welcome to this quiet corner of the sanctuary. I can offer you a warm cup of tea and a blanket on a rainy Sunday morning. Here are a few soft, comforting stories to keep your heart warm.",
                escape: "A weary soul seeking to drift away from reality... Step through the archway into another world, where magic is real and dreams weave the sky. Let these pages carry you to places untouched by time.",
                thrilling: "The shadows grow long, and a mystery whispers from the dark shelves... You are seeking a story that catches your breath and keeps you turning pages deep into the night. Step carefully into the dark.",
                heartwarming: "Ah, the light filtering through the stained glass... Let us find stories of healing, connection, and the beautiful threads that bind wandering souls together. Here is a place of hope.",
                intellectual: "A restless mind seeking deep waters... The philosophical halls are calling. Let us explore books that challenge the shape of the world, asking the great questions of existence and identity."
            };
            
            const responseText = poeticFallbacks[topMood] || poeticFallbacks.cozy;
            
            // Populate books with local curated fallback list of beautiful books matching topMood!
            const localCuratedBooks = {
                melancholy: [
                    { volumeInfo: { title: "A Little Life", authors: ["Hanya Yanagihara"], description: "A beautifully written, devastating exploration of trauma, friendship, and grief that will break and heal your heart.", imageLinks: { thumbnail: "https://books.google.com/books/content?id=cK0pBwAAQBAJ&printsec=frontcover&img=1&zoom=1" } } },
                    { volumeInfo: { title: "Norwegian Wood", authors: ["Haruki Murakami"], description: "A quiet, nostalgic, and melancholic novel about loss, burgeoning sexuality, and student activism in 1960s Tokyo.", imageLinks: { thumbnail: "https://books.google.com/books/content?id=3eCjCQAAQBAJ&printsec=frontcover&img=1&zoom=1" } } }
                ],
                cozy: [
                    { volumeInfo: { title: "The House in the Cerulean Sea", authors: ["TJ Klune"], description: "A comforting, heartwarming fantasy about a quiet caseworker who is sent to inspect a peculiar orphanage on a beautiful island.", imageLinks: { thumbnail: "https://books.google.com/books/content?id=NreNDwAAQBAJ&printsec=frontcover&img=1&zoom=1" } } },
                    { volumeInfo: { title: "Before the Coffee Gets Cold", authors: ["Toshikazu Kawaguchi"], description: "In a small back alley in Tokyo, there is a cafe that offers its customers the chance to travel back in time, cozy and gentle.", imageLinks: { thumbnail: "https://books.google.com/books/content?id=vF2dDwAAQBAJ&printsec=frontcover&img=1&zoom=1" } } }
                ],
                escape: [
                    { volumeInfo: { title: "The Night Circus", authors: ["Erin Morgenstern"], description: "A magical, cinematic, and atmospheric fantasy about an enchanted competition between two young magicians inside a mysterious circus.", imageLinks: { thumbnail: "https://books.google.com/books/content?id=3T-h5LzR5PQC&printsec=frontcover&img=1&zoom=1" } } },
                    { volumeInfo: { title: "Piranesi", authors: ["Susanna Clarke"], description: "A whimsical and dreamlike exploration of a spectacular infinite house containing an ocean, halls filled with statues, and a lonely inhabitant.", imageLinks: { thumbnail: "https://books.google.com/books/content?id=tBzoDwAAQBAJ&printsec=frontcover&img=1&zoom=1" } } }
                ]
            };
            
            const selectedBooks = localCuratedBooks[topMood] || localCuratedBooks.cozy;
            books.push(...selectedBooks);
            
            return responseText;
        }

        // Build a contextual, data-driven response using the returned books
        const titles = books
            .map(book => {
                if (book && typeof book.title === 'string' && book.title.trim()) {
                    return book.title.trim();
                }
                if (book && book.volumeInfo && typeof book.volumeInfo.title === 'string' && book.volumeInfo.title.trim()) {
                    return book.volumeInfo.title.trim();
                }
                return null;
            })
            .filter(Boolean)
            .slice(0, 3);

        let titleSnippet = '';
        if (titles.length === 1) {
            titleSnippet = `**${titles[0]}**`;
        } else if (titles.length === 2) {
            titleSnippet = `**${titles[0]}** and **${titles[1]}**`;
        } else if (titles.length === 3) {
            titleSnippet = `**${titles[0]}**, **${titles[1]}**, and **${titles[2]}**`;
        }

        let response = `Ah, I have searched the quiet corridors and found some wonderful matches for you. I have selected ${bookCount} volumes that harmonize with your current mood`;
        if (titleSnippet) {
            response += `, including the beautiful pages of ${titleSnippet}`;
        }
        response += `. \n\nEach of these books holds a room you might want to wander in. Which one speaks to you?`;

        return response;
    }

    /**
     * Build DOM nodes for lightweight markdown.
     * Supports: **bold** for book titles, *italic* for authors, \n for line breaks.
     * @param {HTMLElement} container - The container element
     * @param {string} text - The raw message text
     */
    buildMarkdownNodes(container, text) {
        const regex = /\*\*(.+?)\*\*|\*(.+?)\*|(\n)/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                container.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }

            if (match[1]) {
                const strong = document.createElement('strong');
                strong.textContent = match[1];
                container.appendChild(strong);
            } else if (match[2]) {
                const em = document.createElement('em');
                em.textContent = match[2];
                container.appendChild(em);
            } else if (match[3]) {
                container.appendChild(document.createElement('br'));
            }

            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            container.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
    }

    /**
     * Render lightweight markdown in AI responses.
     * Supports: **bold** for book titles, *italic* for authors, \n\n for paragraphs.
     * Uses textContent assignment (not innerHTML) for user messages to prevent XSS.
     * @param {HTMLElement} bubble - The message bubble element
     * @param {string} text - The raw message text
     * @param {boolean} isAI - Whether this is an AI message (allows markdown)
     */
    renderTextContent(bubble, text, isAI) {
        const paragraphs = text.split('\n\n');
        paragraphs.forEach(paragraph => {
            if (!paragraph.trim()) return;
            const p = document.createElement('p');
            if (isAI) {
                this.buildMarkdownNodes(p, paragraph.trim());
            } else {
                p.textContent = paragraph.trim();
            }
            bubble.appendChild(p);
        });
    }

    renderMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type}-message`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        // Elara uses a book-magic icon; users get a person icon
        avatar.innerHTML = message.type === 'user'
            ? '<i class="fas fa-user"></i>'
            : '<i class="fas fa-book-open"></i>';

        const content = document.createElement('div');
        content.className = 'message-content';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';

        // Render text with markdown support for AI messages
        this.renderTextContent(bubble, message.content, message.type === 'bookseller');

        // Add book recommendations if present
        if (message.books && message.books.length > 0) {
            const bookRec = this.createBookRecommendations(message.books);
            bubble.appendChild(bookRec);
        }

        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = this.formatTime(message.timestamp);

        content.appendChild(bubble);
        content.appendChild(time);

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    createBookRecommendations(books) {
        const container = document.createElement('div');
        container.className = 'book-recommendation';

        const header = document.createElement('div');
        header.className = 'book-rec-header';

        const title = document.createElement('div');
        title.className = 'book-rec-title';
        title.textContent = 'Recommended Books';

        const count = document.createElement('div');
        count.className = 'book-rec-count';
        count.textContent = `${books.length} books`;

        header.appendChild(title);
        header.appendChild(count);

        const grid = document.createElement('div');
        grid.className = 'book-rec-grid';

        books.forEach(book => {
            const item = this.createBookItem(book);
            grid.appendChild(item);
        });

        container.appendChild(header);
        container.appendChild(grid);

        return container;
    }

    createBookItem(book) {
        const item = document.createElement('div');
        item.className = 'book-rec-item';
        item.onclick = () => this.showBookDetails(book);

        const cover = document.createElement('div');
        cover.className = 'book-rec-cover';

        if (book.volumeInfo?.imageLinks?.thumbnail) {
            const img = document.createElement('img');
            img.src = book.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:');
            img.alt = book.volumeInfo.title || 'Book cover';
            cover.appendChild(img);
        } else {
            cover.innerHTML = '<i class="fas fa-book"></i>';
        }

        const info = document.createElement('div');
        info.className = 'book-rec-info';

        const title = document.createElement('h4');
        title.textContent = book.volumeInfo?.title || 'A Mysterious Tome';

        const author = document.createElement('p');
        author.textContent = book.volumeInfo?.authors?.join(', ') || 'A Mysterious Pen';

        info.appendChild(title);
        info.appendChild(author);

        item.appendChild(cover);
        item.appendChild(info);

        return item;
    }

    showBookDetails(book) {
        // Boost profile based on details clicked!
        if (book && book.volumeInfo) {
            const categories = book.volumeInfo.categories || [];
            const title = book.volumeInfo.title || "";
            const description = book.volumeInfo.description || "";
            const combinedText = (title + " " + description).toLowerCase();
            const dicts = this.getVibeDictionaries();
            let profileChanged = false;
            
            // Scan categories
            categories.forEach(cat => {
                const lowerCat = cat.toLowerCase();
                for (const genre of Object.keys(dicts.genres)) {
                    if (lowerCat.includes(genre)) {
                        this.vibeProfile.genres[genre] = (this.vibeProfile.genres[genre] || 0) + 2;
                        profileChanged = true;
                    }
                }
            });
            
            // Scan text for keywords
            for (const [genre, keywords] of Object.entries(dicts.genres)) {
                keywords.forEach(kw => {
                    if (combinedText.includes(kw)) {
                        this.vibeProfile.genres[genre] = (this.vibeProfile.genres[genre] || 0) + 1;
                        profileChanged = true;
                    }
                });
            }
            
            for (const [mood, keywords] of Object.entries(dicts.moods)) {
                keywords.forEach(kw => {
                    if (combinedText.includes(kw)) {
                        this.vibeProfile.moods[mood] = (this.vibeProfile.moods[mood] || 0) + 1;
                        profileChanged = true;
                    }
                });
            }

            for (const [trope, keywords] of Object.entries(dicts.tropes)) {
                keywords.forEach(kw => {
                    if (combinedText.includes(kw)) {
                        this.vibeProfile.tropes[trope] = (this.vibeProfile.tropes[trope] || 0) + 1;
                        profileChanged = true;
                    }
                });
            }
            
            if (profileChanged) {
                this.saveVibeProfile();
            }
        }

        // Use existing modal functionality from app.js
        if (typeof showBookModal === 'function') {
            showBookModal(book);
        } else {
            // Fallback: simple alert with book info
            const title = book.volumeInfo?.title || 'Unknown Title';
            const author = book.volumeInfo?.authors?.[0] || 'Unknown Author';
            const description = book.volumeInfo?.description || 'No description available.';

            // Create a simple book details modal instead of alert
            const modal = document.getElementById('bookModal');
            const modalContent = document.getElementById('bookModalContent');

            if (modal && modalContent) {
                modalContent.innerHTML = `
                    <div class="book-details">
                        <h3>${title}</h3>
                        <p><strong>Author:</strong> ${author}</p>
                        <p><strong>Description:</strong> ${description.substring(0, 300)}...</p>
                    </div>
                `;
                modal.style.display = 'flex';
            }
        }
    }

    showTypingIndicator() {
        if (this.isTyping) return;

        this.isTyping = true;
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typingIndicator';

        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-book-open"></i>
            </div>
            <div class="typing-bubble">
                <span class="typing-label">Elara is finding your story</span>
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.isTyping = false;
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    adjustTextareaHeight() {
        const textarea = this.chatInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

        return date.toLocaleDateString();
    }

    /**
     * Comprehensive message sanitization with defense-in-depth XSS prevention.
     * 
     * Security Layers:
     * 1. Validate message structure
     * 2. Check message length (max 2000 chars)
     * 3. Detect encoded attack vectors (HTML entities, Unicode escapes)
     * 4. Use DOMPurify library to strip all dangerous elements
     * 5. Escape remaining HTML entities
     * 6. Remove JavaScript protocol URLs
     * 7. Remove event handler patterns
     * 
     * @param {Object} rawMessage - Message object from storage
     * @returns {Object|null} Sanitized message or null if invalid
     */
    sanitizeMessage(rawMessage) {
        if (!rawMessage || typeof rawMessage !== 'object') {
            return null;
        }

        // Validate message type
        const allowedTypes = ['user', 'bookseller'];
        let type = typeof rawMessage.type === 'string' ? rawMessage.type : 'user';
        if (!allowedTypes.includes(type)) {
            type = 'user';
        }

        // Extract and convert content to string
        let content = '';
        if (typeof rawMessage.content === 'string') {
            content = rawMessage.content;
        } else if (rawMessage.content != null) {
            content = String(rawMessage.content);
        }

        // Enforce maximum message length (server-side validation: 2000 chars)
        if (content.length > 2000) {
            content = content.substring(0, 2000);
        }

        // Layer 1: Detect and decode HTML entities to catch encoded attacks
        // e.g., &lt;script> becomes <script>, then gets blocked
        let decodedContent = content;
        try {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = content;
            decodedContent = textarea.textContent || textarea.innerText;
        } catch (e) {
            // If decoding fails, use original content
            decodedContent = content;
        }

        // Layer 2: Detect dangerous patterns before sanitization
        const dangerousPatterns = [
            /javascript:/gi,                    // JavaScript protocol
            /on\w+\s*=/gi,                      // Event handlers (onclick, onerror, etc.)
            /<script/gi,                        // Script tags
            /<iframe/gi,                        // IFrame tags
            /<embed/gi,                         // Embed tags
            /<object/gi,                        // Object tags
            /data:text\/html/gi,               // Data URI with HTML
            /vbscript:/gi,                      // VBScript protocol
        ];

        let hasDangerousPattern = false;
        for (const pattern of dangerousPatterns) {
            if (pattern.test(decodedContent)) {
                console.warn('XSS attack pattern detected and removed:', pattern);
                hasDangerousPattern = true;
                break;
            }
        }

        // Layer 3: Use DOMPurify to strip all dangerous elements and attributes
        // DOMPurify configuration: only allow plain text, no HTML tags
        const purifyConfig = {
            ALLOWED_TAGS: [],                   // No HTML tags allowed
            ALLOWED_ATTR: [],                   // No attributes allowed
            KEEP_CONTENT: true,                 // Keep text content after stripping tags
            FORCE_BODY: false,                  // Don't wrap in body tags
            SANITIZE_DOM: true,                 // Sanitize DOM functionality
            IN_PLACE: false                     // Don't modify in place
        };

        // Use DOMPurify if available, otherwise fall back to basic sanitization
        if (typeof DOMPurify !== 'undefined') {
            content = DOMPurify.sanitize(content, purifyConfig);
        } else {
            // Fallback: Remove all HTML tags
            content = content.replace(/<[^>]*>/g, '');
        }

        // Layer 4: Additional HTML escaping for defense-in-depth
        // Convert &, <, >, ", ' to HTML entities
        content = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');

        // Layer 5: Remove JavaScript protocol and common XSS vectors
        content = content
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/on\w+=/gi, '')
            .replace(/data:text\/html/gi, '');

        // Validate timestamp
        let timestamp = Date.now();
        if (typeof rawMessage.timestamp === 'number' && isFinite(rawMessage.timestamp)) {
            timestamp = rawMessage.timestamp;
        } else if (typeof rawMessage.timestamp === 'string') {
            const parsed = Date.parse(rawMessage.timestamp);
            if (!isNaN(parsed)) {
                timestamp = parsed;
            }
        }

        const books = Array.isArray(rawMessage.books) ? rawMessage.books : undefined;
        return { type, content, timestamp, books };
    }

    loadConversationHistory() {
        try {
            const saved = localStorage.getItem('bibliodrift_chat_history');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    const sanitizedMessages = parsed
                        .map(message => this.sanitizeMessage(message))
                        .filter(message => message !== null);
                    this.conversationHistory = sanitizedMessages;
                    this.conversationHistory.forEach(message => {
                        this.renderMessage(message);
                    });
                } else {
                    this.conversationHistory = [];
                }
            }
        } catch (error) {
            this.conversationHistory = [];
        }
    }

    saveConversationHistory() {
        try {
            localStorage.setItem('bibliodrift_chat_history', JSON.stringify(this.conversationHistory));
        } catch (error) {
            // Silent fail for localStorage issues
        }
    }

    clearChat() {
        if (confirm('Are you sure you want to clear the conversation? This cannot be undone.')) {
            this.conversationHistory = [];
            this.chatMessages.innerHTML = '';
            localStorage.removeItem('bibliodrift_chat_history');
            this.addWelcomeMessage();

            // Show quick suggestions again
            if (this.quickSuggestions) {
                this.quickSuggestions.style.display = 'block';
            }
        }
    }

    exportChat() {
        const chatText = this.conversationHistory.map(message => {
            const sender = message.type === 'user' ? 'You' : 'Bookseller';
            const time = this.formatTime(message.timestamp);
            return `[${time}] ${sender}: ${message.content}`;
        }).join('\n\n');

        const blob = new Blob([chatText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bibliodrift-chat-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    extractMoodKeywordsFromHistory() {
        try {
            const textBlob = this.conversationHistory.map(m => (m.content || '')).join(' ');
            const keywords = [];
            const moodHints = ['cozy','comfort','romance','mystery','thriller','dark','uplifting','melancholy','adventure','fantasy','science fiction','sci-fi','historical','literary'];
            const lower = textBlob.toLowerCase();
            moodHints.forEach(h => { if (lower.includes(h)) keywords.push(h); });
            return Array.from(new Set(keywords)).slice(0,4);
        } catch (e) {
            return [];
        }
    }

    createSuggestionButton(text, icon) {
        const btn = document.createElement('button');
        btn.className = 'suggestion-btn';
        if (icon) btn.innerHTML = `<i class="fa-solid ${icon}"></i> ${text}`;
        else btn.textContent = text;
        btn.onclick = () => sendQuickMessage(text);
        return btn;
    }

    updateSuggestionChips() {
        if (!this.quickSuggestions || !this.quickSuggestionsList) return;
        // Clear existing
        this.quickSuggestionsList.innerHTML = '';

        // Build dynamic suggestions from history
        const kws = this.extractMoodKeywordsFromHistory();
        const chips = [];
        if (kws.length) {
            kws.forEach(k => chips.push({text: `I'm in the mood for ${k}`, icon: 'fa-mug-hot'}));
        }

        // If no keywords, provide context-aware defaults
        if (chips.length === 0) {
            chips.push({text: 'I want something cozy and comforting', icon: 'fa-mug-hot'});
            chips.push({text: 'Looking for a thrilling mystery', icon: 'fa-magnifying-glass'});
            chips.push({text: 'Something romantic and heartwarming', icon: 'fa-heart'});
            chips.push({text: 'I need an escape to another world', icon: 'fa-wand-sparkles'});
        }

        chips.slice(0,6).forEach(c => {
            const btn = this.createSuggestionButton(c.text, c.icon.replace('fa-', 'fa-') );
            this.quickSuggestionsList.appendChild(btn);
        });

        this.quickSuggestions.style.display = 'block';
    }

    async addToLibrary(book) {
        try {
            const user = window.currentUser || null;
            if (!user) {
                alert('Sign in to add books to your library.');
                return;
            }

            const payload = {
                user_id: user.id,
                google_books_id: book.id,
                title: book.volumeInfo?.title || '',
                authors: book.volumeInfo?.authors || [],
                thumbnail: book.volumeInfo?.imageLinks?.thumbnail || '' ,
                shelf_type: 'owned'
            };

            const resp = await fetch((window.MOOD_API_BASE || '/api/v1') + '/library', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (resp.ok) {
                alert('Added to your library');
                
                // Boost profile when book is successfully added to library!
                if (book && book.volumeInfo) {
                    const categories = book.volumeInfo.categories || [];
                    const title = book.volumeInfo.title || "";
                    const description = book.volumeInfo.description || "";
                    const combinedText = (title + " " + description).toLowerCase();
                    const dicts = this.getVibeDictionaries();
                    let profileChanged = false;
                    
                    categories.forEach(cat => {
                        const lowerCat = cat.toLowerCase();
                        for (const genre of Object.keys(dicts.genres)) {
                            if (lowerCat.includes(genre)) {
                                this.vibeProfile.genres[genre] = (this.vibeProfile.genres[genre] || 0) + 3; // Extra heavy boost!
                                profileChanged = true;
                            }
                        }
                    });
                    
                    for (const [genre, keywords] of Object.entries(dicts.genres)) {
                        keywords.forEach(kw => {
                            if (combinedText.includes(kw)) {
                                this.vibeProfile.genres[genre] = (this.vibeProfile.genres[genre] || 0) + 2;
                                profileChanged = true;
                            }
                        });
                    }
                    
                    for (const [mood, keywords] of Object.entries(dicts.moods)) {
                        keywords.forEach(kw => {
                            if (combinedText.includes(kw)) {
                                this.vibeProfile.moods[mood] = (this.vibeProfile.moods[mood] || 0) + 2;
                                profileChanged = true;
                            }
                        });
                    }
                    
                    if (profileChanged) {
                        this.saveVibeProfile();
                    }
                }
            } else if (resp.status === 401) {
                alert('Please sign in to add books to your library.');
            } else {
                const data = await resp.json().catch(()=>({}));
                alert((data && data.message) || 'Failed to add book to library');
            }
        } catch (e) {
            console.error('Add to library failed', e);
            alert('Failed to add book to library');
        }
    }

    updateVibeDashboardUI() {
        const container = document.getElementById('vibeTagsContainer');
        const tropesContainer = document.getElementById('vibeTropesContainer');
        if (!container || !this.vibeProfile) return;
        
        container.innerHTML = '';
        if (tropesContainer) tropesContainer.innerHTML = '';
        
        // Render top active genres and moods
        const topMoods = Object.entries(this.vibeProfile.moods)
            .filter(([_, score]) => score > 0)
            .sort((a,b) => b[1] - a[1]);
            
        const topGenres = Object.entries(this.vibeProfile.genres)
            .filter(([_, score]) => score > 0)
            .sort((a,b) => b[1] - a[1]);
            
        const topTropes = Object.entries(this.vibeProfile.tropes)
            .filter(([_, score]) => score > 0)
            .sort((a,b) => b[1] - a[1]);
            
        // Render moods
        topMoods.forEach(([mood, val]) => {
            const span = document.createElement('span');
            span.style.cssText = "background: rgba(139, 69, 19, 0.08); border: 1px solid rgba(139, 69, 19, 0.15); border-radius: 20px; padding: 4px 10px; font-size: 0.75rem; color: #2c2420; display: inline-flex; align-items: center; gap: 4px; animation: fadeIn 0.3s ease;";
            span.innerHTML = `<i class="fa-solid fa-cloud" style="color: #b8860b; font-size: 0.65rem;"></i> ${mood} <small style="opacity: 0.6;">(${val})</small>`;
            container.appendChild(span);
        });
        
        // Render genres
        topGenres.forEach(([genre, val]) => {
            const span = document.createElement('span');
            span.style.cssText = "background: rgba(184, 134, 11, 0.1); border: 1px solid rgba(184, 134, 11, 0.25); border-radius: 20px; padding: 4px 10px; font-size: 0.75rem; color: #2c2420; display: inline-flex; align-items: center; gap: 4px; animation: fadeIn 0.3s ease;";
            span.innerHTML = `<i class="fa-solid fa-book-open" style="color: #8b4513; font-size: 0.65rem;"></i> ${genre} <small style="opacity: 0.6;">(${val})</small>`;
            container.appendChild(span);
        });
        
        if (topMoods.length === 0 && topGenres.length === 0) {
            container.innerHTML = '<span style="font-size: 0.75rem; opacity: 0.6; font-style: italic;">No active preferences yet. Start chatting to build your profile!</span>';
        }
        
        // Render tropes in their section
        if (tropesContainer) {
            topTropes.forEach(([trope, val]) => {
                const span = document.createElement('span');
                span.style.cssText = "background: rgba(44, 36, 32, 0.05); border: 1px solid rgba(44, 36, 32, 0.1); border-radius: 12px; padding: 2px 6px; font-size: 0.7rem; color: #2c2420; display: inline-flex; align-items: center; gap: 4px;";
                span.innerHTML = `<i class="fa-solid fa-feather" style="color: #b8860b; font-size: 0.6rem;"></i> ${this.formatTropeName(trope)} <small style="opacity: 0.6;">(${val})</small>`;
                tropesContainer.appendChild(span);
            });
            
            if (topTropes.length === 0) {
                tropesContainer.innerHTML = '<span style="font-size: 0.75rem; opacity: 0.6; font-style: italic;">No tropes discovered yet.</span>';
            }
        }
    }
    
    formatTropeName(trope) {
        return trope.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }
}

// Global functions for HTML onclick handlers
function sendQuickMessage(message) {
    if (window.chatInterface) {
        window.chatInterface.chatInput.value = message;
        window.chatInterface.sendMessage();
    }
}

function clearChat() {
    if (window.chatInterface) {
        window.chatInterface.clearChat();
    }
}

function exportChat() {
    if (window.chatInterface) {
        window.chatInterface.exportChat();
    }
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (window.chatInterface) {
            window.chatInterface.sendMessage();
        }
    }
}

function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function closeBookModal() {
    const modal = document.getElementById('bookModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialize chat interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatInterface = new ChatInterface();
});