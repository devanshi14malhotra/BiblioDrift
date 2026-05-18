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

        // Ensure backend connection is initialized
        if (typeof window !== 'undefined' && !window.MOOD_API_BASE) {
            window.MOOD_API_BASE = 'http://127.0.0.1:5000/api/v1';
        }

        this.init();
    }

    init() {
        // Load conversation history from localStorage
        this.loadConversationHistory();

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
            const moodApiBase = window.MOOD_API_BASE || 'http://127.0.0.1:5000/api/v1';
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
                    return {
                        message: chatData.response,
                        books: books
                    };
                }
            }
        } catch (error) {
            // Fallback to mood search
        }

        // Fallback to mood search
        try {
            const moodApiBase = window.MOOD_API_BASE || 'http://127.0.0.1:5000/api/v1';
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

    transformQueryForBooks(userQuery) {
        // Use the original user query directly - let Google Books API handle the search
        // This ensures no hardcoded mappings and truly AI-driven recommendations
        return userQuery;
    }

    generateContextualResponse(userQuery, books) {
        const bookCount = books.length;

        // If we couldn't find any books, guide the user to refine their request
        if (bookCount === 0) {
            return "I'm having trouble finding books for that specific request right now. Could you try describing what kind of mood or feeling you're going for? For example, 'something cozy for a rainy day' or 'an exciting adventure story'?";
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
            titleSnippet = titles[0];
        } else if (titles.length === 2) {
            titleSnippet = `${titles[0]} and ${titles[1]}`;
        } else if (titles.length === 3) {
            titleSnippet = `${titles[0]}, ${titles[1]}, and ${titles[2]}`;
        }

        let response = `I've found ${bookCount} books that match what you're looking for`;
        if (titleSnippet) {
            response += `, including ${titleSnippet}`;
        }
        response += '.';

        return response;
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
                // Render **bold** and *italic* safely — no raw HTML from user
                p.innerHTML = paragraph.trim()
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                    .replace(/\n/g, '<br>');
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