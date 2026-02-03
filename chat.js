// Chat with Bookseller - JavaScript functionality
// Handles chat interface, message sending, and book recommendations

class ChatInterface {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.quickSuggestions = document.getElementById('quickSuggestions');
        
        this.conversationHistory = [];
        this.isTyping = false;
        
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
            content: `Hello! I'm your personal bookseller. I'm here to help you discover your next favorite book based on your mood, preferences, and what you're feeling like reading.

Tell me what kind of vibe you're looking for - maybe something cozy for a rainy evening, or an adventurous tale to spark your imagination?`,
            timestamp: new Date().toISOString()
        };
        
        this.conversationHistory.push(welcomeMessage);
        this.renderMessage(welcomeMessage);
        this.saveConversationHistory();
    }
    
    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || this.isTyping) return;
        
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
            
            // Add error message
            const errorMessage = {
                type: 'bookseller',
                content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment, or let me suggest some popular books based on common preferences!",
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
            const chatResponse = await fetch(`${window.MOOD_API_BASE || 'http://localhost:5001/api/v1'}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage,
                    history: this.conversationHistory.slice(-5) // Only send last 5 messages for context
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
            const moodResponse = await fetch(`${window.MOOD_API_BASE || 'http://localhost:5001/api/v1'}/mood-search`, {
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
    
    async searchGoogleBooks(query) {
        try {
            // Transform user query into book search terms
            const searchQuery = this.transformQueryForBooks(query);
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=6&printType=books&langRestrict=en`);
            
            if (!response.ok) throw new Error('Google Books API error');
            
            const data = await response.json();
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
    
    renderMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type}-message`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = message.type === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-user-tie"></i>';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        // Add text content
        const paragraphs = message.content.split('\n\n');
        paragraphs.forEach(paragraph => {
            if (paragraph.trim()) {
                const p = document.createElement('p');
                p.textContent = paragraph.trim();
                bubble.appendChild(p);
            }
        });
        
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
        title.textContent = book.volumeInfo?.title || 'Unknown Title';
        
        const author = document.createElement('p');
        author.textContent = book.volumeInfo?.authors?.[0] || 'Unknown Author';
        
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
                <i class="fas fa-user-tie"></i>
            </div>
            <div class="typing-bubble">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
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
     * Validate and sanitize a single message object loaded from storage.
     * Ensures expected structure and strips potentially dangerous characters
     * from the content field.
     */
    sanitizeMessage(rawMessage) {
        if (!rawMessage || typeof rawMessage !== 'object') {
            return null;
        }
        
        const allowedTypes = ['user', 'bookseller'];
        let type = typeof rawMessage.type === 'string' ? rawMessage.type : 'user';
        if (!allowedTypes.includes(type)) {
            type = 'user';
        }
        
        let content = '';
        if (typeof rawMessage.content === 'string') {
            content = rawMessage.content;
        } else if (rawMessage.content != null) {
            content = String(rawMessage.content);
        }
        
        // Basic sanitization: remove angle brackets to mitigate HTML/script injection
        content = content.replace(/[<>]/g, '');
        
        let timestamp = Date.now();
        if (typeof rawMessage.timestamp === 'number' && isFinite(rawMessage.timestamp)) {
            timestamp = rawMessage.timestamp;
        } else if (typeof rawMessage.timestamp === 'string') {
            const parsed = Date.parse(rawMessage.timestamp);
            if (!isNaN(parsed)) {
                timestamp = parsed;
            }
        }
        
        return { type, content, timestamp };
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