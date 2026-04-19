/**
 * BiblioDrift Core Logic
 * Handles 3D rendering, API fetching, Persistent Auth, and Genre Browsing.
 */

const API_BASE = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE) ? CONFIG.API_BASE : 'https://www.googleapis.com/books/v1/volumes';
const MOOD_API_BASE = (typeof CONFIG !== 'undefined' && CONFIG.MOOD_API_BASE) ? CONFIG.MOOD_API_BASE : '/api/v1';
const IS_DEV = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

const delay = (ms) => new Promise(res => setTimeout(res, ms));

let GOOGLE_API_KEY = '';

/**
 * Utility to extract a cookie value by name.
 */
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

async function loadConfig() {
    try {
        const res = await fetch(`${MOOD_API_BASE}/config`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            GOOGLE_API_KEY = data.google_books_key || '';
            if (window.GoogleBooksClient) {
                window.GoogleBooksClient.setKeys([
                    data.google_books_key,
                    data.google_books_key_secondary
                ]);
            }
            if (IS_DEV) {
                console.log("Config loaded");
            }
        }
    } catch (e) {
        console.warn("Failed to load backend config", e);
    }
}

// Toast Notification Helper
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Robust Wrapper for LocalStorage
 * Prevents application crashes when the 5MB quota is exceeded.
 */
/**
 * Robust Wrapper for Storage (LocalStorage + IndexedDB Fallback)
 * Prevents application data loss and handles browser storage wipes/quotas.
 */
const SafeStorage = {
    _dbName: 'BiblioDriftDB',
    _storeName: 'library_backup',

    /**
     * Attempts to request persistent storage from the browser.
     * This prevents the browser from clearing storage when disk space is low.
     */
    async requestPersistence() {
        if (navigator.storage && navigator.storage.persist) {
            try {
                const isPersisted = await navigator.storage.persist();
                if (IS_DEV) {
                    console.log(`[Storage] Persistent status: ${isPersisted}`);
                }
            } catch (e) {
                console.warn("[Storage] Persist request failed", e);
            }
        }
    },

    /**
     * Internal: Opens the IndexedDB for backup.
     */
    async _openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this._dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this._storeName)) {
                    db.createObjectStore(this._storeName);
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    /**
     * Attempts to save data to localStorage with IndexedDB backup.
     * @param {string} key 
     * @param {string} value 
     * @returns {boolean} Success status
     */
    set(key, value) {
        // 1. Primary: LocalStorage
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            const isQuotaError = 
                error instanceof DOMException && (
                error.code === 22 || 
                error.code === 1014 || 
                error.name === 'QuotaExceededError' || 
                error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

            if (isQuotaError) {
                showToast("Local storage full! Saving to secure backup.", "info");
            } else {
                console.error("LocalStorage Error:", error);
            }
        }

        // 2. Secondary: IndexedDB (Durable Backup for Library)
        if (key === 'bibliodrift_library') {
            this._saveToDB(key, value);
        }
        return true;
    },

    async _saveToDB(key, value) {
        try {
            const db = await this._openDB();
            const transaction = db.transaction(this._storeName, 'readwrite');
            const store = transaction.objectStore(this._storeName);
            store.put(value, key);
        } catch (e) {
            console.error("IndexedDB Backup Failed", e);
        }

        showToast("Local storage full! Please sync to cloud and clear cache.", "error");
        return false;
    },

    /**
     * Safely retrieves data from localStorage.
     */
    get(key) {
        try {
            const value = localStorage.getItem(key);
            if (value !== null) {
                this.touchKey(key, value);
            }
            return value;
        } catch (e) {
            return null;
        }
    },

    /**
     * Retrieves data with IndexedDB fallback if LocalStorage is wiped.
     */
    async getAsync(key) {
        let val = this.get(key);
        if (!val && key === 'bibliodrift_library') {
            try {
                const db = await this._openDB();
                const transaction = db.transaction(this._storeName, 'readonly');
                const store = transaction.objectStore(this._storeName);
                val = await new Promise((resolve) => {
                    const request = store.get(key);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => resolve(null);
                });
                
                if (val) {
                    if (IS_DEV) console.log("[Storage] Restored from IndexedDB backup");
                    // Try to restore to LocalStorage for future sync calls
                    try { localStorage.setItem(key, val); } catch(e) {}
                }
            } catch (e) {
                console.warn("Backup retrieval failed", e);
            }
        }
        return val;
    },

    /**
     * Safely removes data from storage.
     * @param {string} key 
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            if (key === 'bibliodrift_library') {
                this._saveToDB(key, null);
            }
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Safely clears all localStorage.
     */
    clear() {
        try {
            localStorage.clear();
            this.setMeta({});
            return true;
        } catch (e) {
            return false;
        }
    }
};
const MOCK_BOOKS = [
    {
        id: "mock-dune",
        volumeInfo: {
            title: "Dune",
            authors: ["Frank Herbert"],
            description: "A sweeping science fiction epic set on the desert planet Arrakis. Dune explores complex themes of politics, religion, and man's relationship with nature. Paul Atreides must navigate a treacherous path to becoming the mysterious Muad'Dib.",
            imageLinks: { thumbnail: "assets/images/dune.jpg" }
        }
    },
    {
        id: "mock-1984",
        volumeInfo: {
            title: "1984",
            authors: ["George Orwell"],
            description: "Orwell's chilling prophecy of a totalitarian future where Big Brother is always watching. A profound exploration of surveillance, truth, and the resilience of the human spirit.",
            imageLinks: { thumbnail: "assets/images/1984.jpg" }
        }
    },
    {
        id: "mock-hobbit",
        volumeInfo: {
            title: "The Hobbit",
            authors: ["J.R.R. Tolkien"],
            description: "In a hole in the ground there lived a hobbit. Join Bilbo Baggins on an unexpected journey across Middle-earth, encountering dragons, dwarves, and a rigorous test of courage.",
            imageLinks: { thumbnail: "assets/images/hobbit.jpg" }
        }
    },
    {
        id: "mock-pride",
        volumeInfo: {
            title: "Pride and Prejudice",
            authors: ["Jane Austen"],
            description: "A timeless romance of manners and misunderstanding. Elizabeth Bennet's wit matches Mr. Darcy's pride in this sharp social commentary that remains one of the most loved novels in English literature.",
            imageLinks: { thumbnail: "assets/images/pride.jpg" }
        }
    },
    {
        id: "mock-gatsby",
        volumeInfo: {
            title: "The Great Gatsby",
            authors: ["F. Scott Fitzgerald"],
            description: "The quintessential novel of the Jazz Age. Jay Gatsby's obsessive love for Daisy Buchanan drives a tragic tale of wealth, illusion, and the American Dream.",
            imageLinks: { thumbnail: "assets/images/gatsby.jpg" }
        }
    },
    {
        id: "mock-sapiens",
        volumeInfo: {
            title: "Sapiens",
            authors: ["Yuval Noah Harari"],
            description: "A groundbreaking narrative of humanity's creation and evolution. Harari explores the ways in which biology and history have defined us and enhanced our understanding of what it means to be 'human'.",
            imageLinks: { thumbnail: "assets/images/sapiens.jpg" }
        }
    },
    {
        id: "mock-hail-mary",
        volumeInfo: {
            title: "Project Hail Mary",
            authors: ["Andy Weir"],
            description: "A lone astronaut must save the earth from disaster in this gripping tale of survival and scientific discovery. Full of humor and hard science, it is a celebration of human ingenuity.",
            imageLinks: { thumbnail: "assets/images/hail_mary.jpg" }
        }
    }
];

function normalizeQueryTerms(query) {
    return String(query || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

function scoreMockBook(book, queryTerms) {
    const volumeInfo = book.volumeInfo || {};
    const haystack = [
        volumeInfo.title || '',
        (volumeInfo.authors || []).join(' '),
        volumeInfo.description || '',
        (volumeInfo.categories || []).join(' ')
    ].join(' ').toLowerCase();

    return queryTerms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function getFallbackBooks(query, maxResults = 5) {
    const queryTerms = normalizeQueryTerms(query);
    const ranked = MOCK_BOOKS
        .map(book => ({ book, score: scoreMockBook(book, queryTerms) }))
        .sort((a, b) => b.score - a.score);

    const matches = ranked.filter(item => item.score > 0).map(item => item.book);
    const pool = matches.length > 0 ? matches : MOCK_BOOKS;

    return pool.slice(0, maxResults);
}


class BookRenderer {
    constructor(libraryManager = null) {
        this.libraryManager = libraryManager;
    }

    async createBookElement(bookData, shelf = null) {
        const { id, volumeInfo } = bookData;
        const progress = typeof bookData.progress === 'number' ? bookData.progress : 0;
        const title = volumeInfo.title || "Untitled";
        const authors = volumeInfo.authors ? volumeInfo.authors.join(", ") : "Unknown Author";
        const thumb = volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : 'https://via.placeholder.com/128x196?text=No+Cover';
        const description = volumeInfo.description ? volumeInfo.description.substring(0, 100) + "..." : "A mysterious tome waiting to be opened.";
        const categories = volumeInfo.categories || [];

        const vibe = this.generateVibe(description, categories);
        const spineColors = ['#5D4037', '#4E342E', '#3E2723', '#2C2420', '#8D6E63'];
        const randomSpine = spineColors[Math.floor(Math.random() * spineColors.length)];

        const scene = document.createElement('div');
        scene.className = 'book-scene';

        // Load flip sound
        const flipSound = new Audio('assets/sounds/page-flip.mp3');
        flipSound.volume = 0.5;

        /**
         * ============================================================================
         * SECURE HTML ESCAPING HELPER & XSS PREVENTION
         * ============================================================================
         * Problem:
         * Previously, book title and author data were injected directly into the 
         * scene.innerHTML without sanitization. If data from the Google Books API 
         * contained special HTML characters (e.g., <script> tags, <, >), this could 
         * lead to rendering bugs or Cross-Site Scripting (XSS) vulnerabilities.
         * 
         * Fix:
         * We introduce this `escapeHTML` helper function. It replaces sensitive 
         * HTML characters with their harmless entity equivalents before injection. 
         * This strictly forces the browser to treat the dynamic content as text 
         * rather than executable code or structural markup. This is a crucial 
         * security measure when constructing HTML strings manually.
         * ============================================================================
         */
        const escapeHTML = (str) => {
            if (!str) return "";
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        };

        const safeTitle = escapeHTML(title);
        const safeAuthors = escapeHTML(authors);
        const safeDescription = escapeHTML(description);
        const safeVibe = escapeHTML(vibe);
        const safeThumb = escapeHTML(thumb.replace('http:', 'https:'));

        scene.innerHTML = `
            <div class="book" data-id="${escapeHTML(id)}">
                <div class="book__face book__face--front">
                    <!-- 
                      Using the sanitized title for the 'alt' attribute and 
                      sanitized URL for 'src' ensures no attribute escape attacks.
                    -->
                    <img src="${safeThumb}" alt="${safeTitle}">
                </div>
                <div class="book__face book__face--spine" style="background: ${randomSpine}"></div>
                <div class="book__face book__face--right"></div>
                <div class="book__face book__face--top"></div>
                <div class="book__face book__face--bottom"></div>
                <div class="book__face book__face--back">
                    <div style="overflow-y: auto; height: 100%; padding-right: 5px; scrollbar-width: thin;">
                        <!-- Safe data injection using escaped values -->
                        <div style="font-weight: bold; font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-main);">${safeTitle}</div>
                        <div class="handwritten-note" style="margin-bottom: 0.8rem; font-style: italic; color: var(--wood-dark);">${safeVibe}</div>
                        <div class="book-blurb" style="font-size: 0.8rem; line-height: 1.4; color: var(--text-muted); text-align: justify;">${safeDescription}</div>
                    </div>
                    ${shelf === 'current' ? `
                    <div class="reading-progress">
                        <input type="range" min="0" max="100" value="${progress}" class="progress-slider" />
                        <small>${progress}% read</small>
                    </div>` : ''}
                    <div class="book-actions">
                        <button class="btn-icon add-btn" title="Add to Library"><i class="fa-regular fa-heart"></i></button>
                        <button class="btn-icon info-btn" title="Read Details"><i class="fa-solid fa-info"></i></button>
                        <button class="btn-icon share-btn" title="Share Book"><i class="fa-solid fa-share-nodes"></i></button>
                        <button class="btn-icon flip-back-btn" title="Flip Back"><i class="fa-solid fa-rotate-left"></i></button>
                    </div>
                </div>
            </div>
            <div class="glass-overlay">
                <!-- Safe author and title data injection in the overlay -->
                <strong>${safeTitle}</strong><br><small>${safeAuthors}</small>
            </div>
        `;

        // Interaction: Progress Slider
        const slider = scene.querySelector('.progress-slider');
        if (slider) {
            slider.addEventListener('change', (e) => {
                const newProgress = parseInt(e.target.value);
                if (this.libraryManager) {
                    this.libraryManager.updateBook(id, { progress: newProgress });
                }
                // Update small tag
                const small = slider.nextElementSibling;
                if (small) small.textContent = `${newProgress}% read`;
            });
        }

        // Interaction: Flip
        const bookEl = scene.querySelector('.book');
        scene.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-icon') && !e.target.closest('.reading-progress')) {
                bookEl.classList.toggle('flipped');
                // Play sound
                flipSound.play().catch(e => {
                    if (IS_DEV) {
                        console.log("Audio play failed", e);
                    }
                });
            }
        });

        // Interaction: Add to Library Logic
        const addBtn = scene.querySelector('.add-btn');
        const updateBtn = () => {
            addBtn.innerHTML = this.libraryManager.findBook(id) ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-regular fa-heart"></i>';
        };
        updateBtn();

        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.libraryManager.findBook(id)) {
                this.libraryManager.removeBook(id);
            } else {
                this.libraryManager.addBook(bookData, shelf || 'want');
            }
            updateBtn();
        });

        // Info Button
        scene.querySelector('.info-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openModal(bookData);
        });

        // Share Button
        scene.querySelector('.share-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const shareText = `Check out this book: ${title} by ${authors}`;
            navigator.clipboard.writeText(shareText).then(() => {
                showToast('Book details copied to clipboard!', 'success');
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                showToast('Failed to copy book details.', 'error');
            });
        });

        // Flip Back Button
        scene.querySelector('.flip-back-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            bookEl.classList.remove('flipped');
            flipSound.play().catch(err => {
                if (IS_DEV) {
                    console.log("Audio play failed", err);
                }
            });
        });

        // Async fetch AI Vibe - Hydrate the UI
        this.fetchAIVibe(title, authors, volumeInfo.description || "").then(aiVibe => {
             if (aiVibe) {
                 // Strip any accidental prefix the AI might return
                 const cleanVibe = aiVibe.replace(/^(Bookseller's Note:|Note:|Recommendation:)\s*/i, "");
                 
                 const noteEl = scene.querySelector('.handwritten-note');
                 if (noteEl) {
                    noteEl.innerHTML = cleanVibe;
                    noteEl.classList.add('fade-in'); // Optional animation hook
                 }
             }
        });

        return scene;
    }

    async fetchAIVibe(title, author, description) {
        try {
            const res = await fetch(`${MOOD_API_BASE}/generate-note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ title, author, description })
            });
            if (res.ok) {
                const data = await res.json();
                return data.vibe;
            }
        } catch (e) {
            // Silently fail to mock vibe
        }
        return null;
    }

    generateVibe(text, categories = []) {
        // Fallback vibes if AI hasn't loaded yet.
        const lowerText = text.toLowerCase();
        const lowerCats = categories.join(' ').toLowerCase();

        // 1. Context-aware fallbacks
        if (lowerCats.includes('classic') || lowerText.includes('classic')) return "A timeless tale that defined a genre.";
        if (lowerCats.includes('romance') || lowerText.includes('love')) return "A heartwarming story of connection.";
        if (lowerCats.includes('mystery') || lowerText.includes('murder') || lowerText.includes('detective')) return "Full of twists that keep you guessing.";
        if (lowerCats.includes('fantasy') || lowerText.includes('magic')) return "A magical escape to another world.";
        if (lowerCats.includes('fiction') || lowerText.includes('novel')) return "A compelling narrative voice.";
        if (lowerCats.includes('history') || lowerText.includes('war')) return "A journey into the past.";
        if (lowerCats.includes('science') || lowerText.includes('space')) return "Opens your mind to new possibilities.";
        
        // 2. Generic fallbacks (Deterministic hash)
        const vibes = [
            "Perfect for a rainy afternoon.", 
            "A quiet companion for coffee.", 
            "Intense and thought-provoking.",
            "Will make you laugh and cry.",
            "Best devoured in one sitting.",
            "Prepare to be surprised."
        ];
        
        // Simple hash to pick a stable vibe for this book text
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        
        return vibes[Math.abs(hash) % vibes.length];
    }

    openModal(book) {
        const modal = document.getElementById('book-details-modal');
        if (!modal) return;

        document.getElementById('modal-img').src = book.volumeInfo.imageLinks?.thumbnail.replace('http:', 'https:') || '';
        document.getElementById('modal-title').textContent = book.volumeInfo.title;
        document.getElementById('modal-author').textContent = book.volumeInfo.authors?.join(", ") || "Unknown Author";
        document.getElementById('modal-summary').textContent = book.volumeInfo.description || "No description available.";

        const addBtn = document.getElementById('modal-add-btn');
        const shareBtn = document.getElementById('modal-share-btn');
        const isInLibrary = this.libraryManager && typeof this.libraryManager.findBook === 'function' && this.libraryManager.findBook(book.id);

        if (addBtn) {
            addBtn.onclick = null;
            addBtn.classList.toggle('library-remove-btn', isInLibrary);
            addBtn.innerHTML = isInLibrary
                ? '<i class="fa-solid fa-trash"></i> Remove from Library'
                : '<i class="fa-regular fa-heart"></i> Add to Library';

            addBtn.onclick = async () => {
                if (!this.libraryManager) return;

                if (isInLibrary) {
                    if (confirm('Are you sure you want to remove this book from your library?')) {
                        await this.libraryManager.removeBook(book.id);
                        modal.close();
                    }
                    return;
                }

                await this.libraryManager.addBook(book, 'want');
                addBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Remove from Library';
                addBtn.classList.add('library-remove-btn');
            };
        }

        if (shareBtn) {
            shareBtn.onclick = () => {
                const shareText = `Check out this book: ${book.volumeInfo.title} by ${book.volumeInfo.authors?.join(", ") || "Unknown Author"}`;
                navigator.clipboard.writeText(shareText).then(() => {
                    showToast('Book title and author copied!', 'success');
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    showToast('Failed to copy book details.', 'error');
                });
            };
        }

        modal.showModal();
        document.getElementById('closeModalBtn').onclick = () => modal.close();
    }

    async renderCuratedSection(query, elementId, maxResults = 5) {
        const container = document.getElementById(elementId);
        if (!container) return;
        try {
            const client = window.GoogleBooksClient;
            const data = client
                ? await client.fetchVolumes(query, { maxResults, extraParams: '&printType=books' })
                : await (async () => {
                    const keyParam = GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : '';
                    const encodedQuery = encodeURIComponent(query);
                    const res = await fetch(`${API_BASE}?q=${encodedQuery}&maxResults=${maxResults}&printType=books${keyParam}`);
                    if (!res.ok) {
                        throw new Error(`API Error: ${res.statusText}`);
                    }
                    return await res.json();
                })();

            if (data.items && data.items.length > 0) {
                await this.renderBookCards(container, data.items.slice(0, maxResults));
            } else {
                const fallbackBooks = getFallbackBooks(query, maxResults);
                if (fallbackBooks.length > 0) {
                    await this.renderBookCards(container, fallbackBooks);
                } else {
                    container.innerHTML = `
                        <div class="empty-state">
                            <i class="fa-solid fa-box-open"></i>
                            <p>No books found. The shelves are empty.</p>
                        </div>`;
                }
            }
        } catch (err) {
            console.error("Failed to fetch books", err);
            const fallbackBooks = getFallbackBooks(query, maxResults);
            if (fallbackBooks.length > 0) {
                await this.renderBookCards(container, fallbackBooks);
                return;
            }

            showToast("Failed to load bookshelf.", "error");
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>Bookshelf Empty (API connection failed)</p>
                </div>`;
        }
    }

    async renderBookCards(container, books) {
        container.innerHTML = '';
        for (const book of books) {
            const bookElement = await this.createBookElement(book);
            container.appendChild(bookElement);
        }
    }
}

class LibraryManager {
    constructor() {
        this.storageKey = 'bibliodrift_library';
        // Initialize with empty library to prevent crashes during async load
        this.library = {
            current: [],
            want: [],
            finished: []
        };
        this.apiBase = MOOD_API_BASE; // Fixed: Use global constant (Issue #7)

        // Asynchronous initialization
        this._initPromise = this.init();
    }

    async init() {
        // 1. Request persistent storage to prevent wipes
        await SafeStorage.requestPersistence();

        // 2. Load from LocalStorage or IndexedDB backup (Issue #8)
        const stored = await SafeStorage.getAsync(this.storageKey);
        if (stored) {
            try {
                this.library = JSON.parse(stored);
            } catch (e) {
                console.error("[Library] Failed to parse stored library, resetting to empty.", e);
            }
        }

        // 3. Setup sorting and trigger initial fast render
        this.setupSorting();
        
        if (document.getElementById('shelf-want')) {
            // Fast Render from local data
            this.renderShelf('want', 'shelf-want');
            this.renderShelf('current', 'shelf-current');
            this.renderShelf('finished', 'shelf-finished');
        }

        // 4. Sync with backend if available (Full Refresh)
        await this.syncWithBackend();
    }

    getUser() {
        const userStr = SafeStorage.get('bibliodrift_user');
        return userStr ? JSON.parse(userStr) : null;
    }

    getAuthHeaders() {
        const csrfToken = getCookie('csrf_access_token');
        const headers = {
            'Content-Type': 'application/json'
        };
        // CSRF protection for cookie-based auth
        if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken;
        }
        return new Headers(headers);
    }

    async syncWithBackend() {
        const user = this.getUser();
        if (!user) return;

        try {
            const res = await fetch(`${this.apiBase}/library/${user.id}`, {
                headers: this.getAuthHeaders(),
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();

                // Merge Strategy:
                // 1. Create a map of existing local books for quick lookup
                const localBooksMap = new Map();
                ['current', 'want', 'finished'].forEach(shelf => {
                    this.library[shelf].forEach(book => {
                        localBooksMap.set(book.id, { book, shelf });
                    });
                });

                // 2. Process backend books
                data.library.forEach(item => {
                    const existing = localBooksMap.get(item.google_books_id);

                    // Construct standard book object
                    const remoteBook = {
                        id: item.google_books_id,
                        db_id: item.id,
                        version: item.version,
                        volumeInfo: {
                            title: item.title,
                            authors: item.authors ? item.authors.split(', ') : [],
                            imageLinks: { thumbnail: item.thumbnail }
                        },
                        // Backend data is authoritative during sync DOWN
                        progress: item.progress,
                        date_added: item.created_at || new Date().toISOString()
                    };

                    if (existing) {
                        const localBook = existing.book;
                        
                        // Conflict Resolution Logic:
                        // If backend has a higher version, it wins.
                        if (item.version > (localBook.version || 0)) {
                            if (existing.shelf !== item.shelf_type) {
                                // Remove from old shelf
                                this.library[existing.shelf] = this.library[existing.shelf].filter(b => b.id !== item.google_books_id);
                                // Add to new shelf
                                this.library[item.shelf_type].push(remoteBook);
                            } else {
                                // Update details in place
                                Object.assign(localBook, remoteBook);
                            }
                        } else if (item.version === (localBook.version || 0)) {
                            // Versions match, just ensure db_id is set
                            localBook.db_id = item.id;
                        }
                        // If item.version < localBook.version, we have unsynced local changes.
                        // syncLocalToBackend will handle pushing these.

                        // Mark as processed/merged
                        localBooksMap.delete(item.google_books_id);
                    } else {
                        // New book from backend
                        if (this.library[item.shelf_type]) {
                            this.library[item.shelf_type].push(remoteBook);
                        }
                    }
                });

                // 3. Handle remaining local books (not in backend)
                // These could be:
                // a) Added offline and not yet synced -> Keep them
                // b) Deleted on another device -> Should remove?
                // For this implementation, we will KEEP them to prioritize no data loss (offline first).
                // Ideally, we'd check timestamps or have a specific "sync queue".

                this.saveLocally();

                // Trigger Render
                if (document.getElementById('shelf-want')) {
                    const sortSelect = document.getElementById('sortLibrary');
                    if (sortSelect && typeof this.sortLibrary === 'function') {
                        this.sortLibrary(sortSelect.value);
                    } else {
                        this.renderShelf('want', 'shelf-want');
                        this.renderShelf('current', 'shelf-current');
                        this.renderShelf('finished', 'shelf-finished');
                    }
                }
            }
        } catch (e) {
            console.error("Sync failed", e);
            showToast("Sync failed. Using local library.", "error");
        }
    }

    async syncLocalToBackend(user) {
        if (!user) return;

        // Flatten local library into a list of items with 'shelf' property
        const itemsToSync = [];
        ['current', 'want', 'finished'].forEach(shelf => {
            if (this.library[shelf]) {
                this.library[shelf].forEach(book => {
                    // Sync both new (anonymous) items and potentially updated items (with db_id)
                    // If book.db_id is present, it's an update. If not, it's a new item.
                    itemsToSync.push({
                        ...book,
                        shelf: shelf,
                        // Ensure version is sent if present
                        version: book.version || 0
                    });
                });
            }
        });

        if (itemsToSync.length === 0) return; // Nothing to sync

        try {
            if (IS_DEV) {
                console.log(`Syncing ${itemsToSync.length} items to backend...`);
            }
            const res = await fetch(`${this.apiBase}/library/sync`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    user_id: user.id,
                    items: itemsToSync
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (IS_DEV) {
                    console.log("Sync result:", data);
                }
                
                if (data.conflicts > 0) {
                    showToast(`Synced ${data.message} (${data.conflicts} conflicts resolved by server)`, "info");
                } else {
                    showToast(`Synced ${data.message}`, "success");
                }

                // After upload, pull fresh state from backend to get the new DB IDs and versions
                await this.syncWithBackend();
            } else {
                const data = await res.json();
                console.error("Backend refused sync", data);
                showToast("Sync failed: " + (data.error || "Server error"), "error");
            }
        } catch (e) {
            console.error("Sync upload failed", e);
            showToast("Failed to upload local library", "error");
        }
    }

    setupSorting() {
        const sortSelect = document.getElementById('library-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortLibrary(e.target.value);
            });
        }
    }

    sortLibrary(criteria) {
        const sortFn = (a, b) => {
            switch (criteria) {
                case 'date_desc':
                    return new Date(b.date_added || 0) - new Date(a.date_added || 0);
                case 'date_asc':
                    return new Date(a.date_added || 0) - new Date(b.date_added || 0);
                case 'title_asc':
                    return (a.volumeInfo.title || "").localeCompare(b.volumeInfo.title || "");
                case 'title_desc':
                    return (b.volumeInfo.title || "").localeCompare(a.volumeInfo.title || "");
                case 'author_asc':
                    const authorA = (a.volumeInfo.authors && a.volumeInfo.authors[0]) || "";
                    const authorB = (b.volumeInfo.authors && b.volumeInfo.authors[0]) || "";
                    return authorA.localeCompare(authorB);
                default:
                    return 0;
            }
        };

        ['current', 'want', 'finished'].forEach(shelf => {
            if (this.library[shelf]) {
                this.library[shelf].sort(sortFn);
                this.renderShelf(shelf, `shelf-${shelf}`);
            }
        });
    }

    async addBook(book, shelf) {
        // Check if book exists ANYWHERE in library specifically by ID
        if (this.findBook(book.id)) {
            // It exists. Check where.
            const existingShelf = this.findBookShelf(book.id);
            if (existingShelf === shelf) {
                showToast("Book already in this shelf!", "info");
                return;
            } else if (existingShelf) {
                // Move logic? For now, prevent duplicates and notify user.
                // Or allow "moving" implicitly? 
                // Let's implement move: Remove from old, add to new.
                this.removeBook(book.id);
                // Fall through to add
                showToast(`Moved book from ${existingShelf} to ${shelf}`, "info");
            }
        }

        const enrichedBook = {
            ...book,
            progress: shelf === 'current' ? 0 : null,
            date_added: new Date().toISOString()
        };

        // 1. Update Local State
        this.library[shelf].push(enrichedBook);
        this.saveLocally();
        if (IS_DEV) {
            console.log(`Added ${book.volumeInfo.title} to ${shelf}`);
        }

        // 2. Update Backend
        const user = this.getUser();
        if (user) {
            try {
                const payload = {
                    user_id: user.id,
                    google_books_id: book.id,
                    title: book.volumeInfo.title,
                    authors: book.volumeInfo.authors ? book.volumeInfo.authors.join(", ") : "",
                    thumbnail: book.volumeInfo.imageLinks ? book.volumeInfo.imageLinks.thumbnail : "",
                    shelf_type: shelf
                };

                const res = await fetch(`${this.apiBase}/library`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const data = await res.json();
                    // Store the DB ID and version back to the local object
                    enrichedBook.db_id = data.item.id;
                    enrichedBook.version = data.item.version;
                    this.saveLocally();
                }
            } catch (e) {
                console.error("Failed to save to backend", e);
                showToast("Saved locally (Sync failed)", "info");
            }
        }
    }


    async updateBook(id, updates) {
        const result = this.findBookInShelf(id);
        if (!result) return;

        const { shelf, book } = result;

        // 1. Update Local State
        Object.assign(book, updates);
        
        // Local "Finished" logic
        if (updates.progress === 100 && shelf !== 'finished') {
            // Remove from current, add to finished
            this.library[shelf] = this.library[shelf].filter(b => b.id !== id);
            this.library.finished.push(book);
            showToast(`Congrats! You finished ${book.volumeInfo.title}!`, "success");
        }
        
        this.saveLocally();

        // 2. Update Backend
        const user = this.getUser();
        if (user && book.db_id) {
            try {
                const res = await fetch(`${this.apiBase}/library/${book.db_id}`, {
                    method: 'PUT',
                    headers: this.getAuthHeaders(),
                    credentials: 'include',
                    body: JSON.stringify({
                        ...updates,
                        version: book.version // Optimistic locking
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    book.version = data.item.version;
                    this.saveLocally();
                } else if (res.status === 409) {
                    const data = await res.json();
                    showToast("Conflict detected! Syncing with server...", "error");
                    // Optionally show a more detailed merge UI here
                    await this.syncWithBackend();
                } else {
                    const data = await res.json();
                    console.error("Update failed:", data.error);
                }
            } catch (e) {
                console.error("Failed to update backend", e);
                showToast("Saved locally (Sync failed)", "info");
            }
        }
    }


    findBook(id) {
        for (const shelf in this.library) {
            if (this.library[shelf].some(b => b.id === id)) return true;
        }
        return false;
    }

    findBookShelf(id) {
        for (const shelf in this.library) {
            if (this.library[shelf].some(b => b.id === id)) return shelf;
        }
        return null;
    }

    findBookInShelf(id) {
        for (const shelf in this.library) {
            const book = this.library[shelf].find(b => b.id === id);
            if (book) return { shelf, book };
        }
        return null;
    }
    async removeBook(id) {
        const result = this.findBookInShelf(id);
        if (result) {
            const { shelf, book } = result;

            // 1. Update Local
            this.library[shelf] = this.library[shelf].filter(b => b.id !== id);
            this.saveLocally();
            if (IS_DEV) {
                console.log(`Removed book ${id} from ${shelf}`);
            }

            // 2. Update Backend
            const user = this.getUser();
            // We need the DB ID to delete from backend usually, 
            // but our remove_from_library endpoint uses item_id (DB ID).
            // Do we have it?
            if (user && book.db_id) {
                try {
                    await fetch(`${this.apiBase}/library/${book.db_id}`, { 
                        method: 'DELETE', 
                        headers: this.getAuthHeaders(),
                        credentials: 'include'
                    });
                } catch (e) {
                    console.error("Failed to delete from backend", e);
                    showToast("Removed locally (Backend sync failed)", "info");
                }
            } else if (user) {
                // Fallback: If we don't have db_id locally (maybe added before login logic), 
                // we might need to look it up or accept that local-only items can't be remotely deleted easily
                // without an API change to delete by google_id.
                // For MVP, we proceed.
                console.warn("Could not delete from backend: missing db_id");
            }

            return true;
        }
        return false;
    }

    saveLocally() {
        SafeStorage.set(this.storageKey, JSON.stringify(this.library));
    }

    async renderShelf(shelfName, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;
        const books = this.library[shelfName];
        if (books.length === 0) {
            // If we have no books, ensure empty state is visible (if we cleared it previously)
            container.innerHTML = '<div class="empty-state">This shelf is empty.</div>';
            return;
        }

        // Clear container for re-rendering (essential for sorting)
        container.innerHTML = '';

        (async () => {
            for (const book of books) {
                const renderer = new BookRenderer(this);
                const el = await renderer.createBookElement(book, shelfName);
                container.appendChild(el);
            }
        })();
    }
}


class ThemeManager {
    constructor() {
        this.themeKey = 'bibliodrift_theme';
        this.toggleBtn = document.getElementById('themeToggle');
        const stored = SafeStorage.get(this.themeKey);
        this.currentTheme = stored === 'night' ? 'night' : 'light';

        this.init();
    }


    init() {
        if (!this.toggleBtn) return;

        this.applyTheme(this.currentTheme);

        this.toggleBtn.addEventListener('click', () => {
            this.currentTheme = this.currentTheme === 'night' ? 'light' : 'night';
            this.applyTheme(this.currentTheme);
            SafeStorage.set(this.themeKey, this.currentTheme);
        });
    }


    applyTheme(theme) {
        const icon = this.toggleBtn.querySelector('i');
        if (theme === 'night') {
            document.documentElement.setAttribute('data-theme', 'night');
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            document.documentElement.removeAttribute('data-theme');
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
}



class GenreManager {
    constructor(libraryManager = null) {
        this.libraryManager = libraryManager;
        this.genreGrid = document.getElementById('genre-grid');
        this.modal = document.getElementById('genre-modal');
        this.closeBtn = document.getElementById('close-genre-modal');
        this.modalTitle = document.getElementById('genre-modal-title');
        this.booksGrid = document.getElementById('genre-books-grid');
    }

    init() {
        if (!this.genreGrid) return;

        // Add click listeners to genre cards
        const cards = this.genreGrid.querySelectorAll('.genre-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const genre = card.dataset.genre;
                this.openGenre(genre);
            });
        });

        // Close modal listeners
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.closeModal();
            });
        }
    }

    openGenre(genre) {
        if (!this.modal) return;

        const genreName = genre.charAt(0).toUpperCase() + genre.slice(1);
        this.modalTitle.textContent = `${genreName} Books`;
        this.modal.showModal();
        document.body.style.overflow = 'hidden'; // Prevent scrolling

        this.fetchBooks(genre);
    }

    closeModal() {
        if (!this.modal) return;
        this.modal.close();
        document.body.style.overflow = ''; // Restore scrolling
    }

    async fetchBooks(genre) {
        if (!this.booksGrid) return;

        // Show loading
        this.booksGrid.innerHTML = `
            <div class="genre-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Finding best ${genre} books...</span>
            </div>
        `;

        try {
            const client = window.GoogleBooksClient;
            const data = client
                ? await client.fetchVolumes(`subject:${genre}`, { maxResults: 20, extraParams: '&langRestrict=en&orderBy=relevance' })
                : await (async () => {
                    const keyParam = GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : '';
                    const response = await fetch(`${API_BASE}?q=subject:${genre}&maxResults=20&langRestrict=en&orderBy=relevance${keyParam}`);
                    if (!response.ok) {
                        throw new Error(`API Error: ${response.status}`);
                    }
                    return await response.json();
                })();

            const items = data.items || [];
            if (items.length > 0) {
                this.renderBooks(items);
            } else {
                this.renderBooks(getFallbackBooks(genre, 20));
            }
        } catch (error) {
            console.error('Error fetching genre books:', error);
            this.renderBooks(getFallbackBooks(genre, 20));
        }
    }

    async renderBooks(books) {
        this.booksGrid.innerHTML = '';
        const renderer = new BookRenderer(this.libraryManager);
        for (const book of books) {
            const el = await renderer.createBookElement(book);
            this.booksGrid.appendChild(el);
        }
    }
}

// Init
document.addEventListener('DOMContentLoaded', async () => {
    // Load config first to get API keys
    await loadConfig();

    const libManager = new LibraryManager();
    window.libManager = libManager; // Expose for Auth

    // Auth Page Logic (Toggle Login/Register)
    const toggleLink = document.querySelector('.toggle-link');
    const authTitle = document.querySelector('.auth-container h2');
    const authBtn = document.querySelector('.auth-btn');
    const authForm = document.querySelector('form');

    if (toggleLink && authTitle && authBtn && authForm) {
        let isLogin = true;
        authForm.dataset.mode = 'login'; // Default

        // Create Username Input for Register mode
        const usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.id = 'username';
        usernameInput.className = 'auth-input';
        usernameInput.placeholder = 'Username';
        usernameInput.style.display = 'none';

        // Insert before email
        const emailInput = document.getElementById('email');
        if (emailInput) {
            authForm.insertBefore(usernameInput, emailInput);
        }

        toggleLink.addEventListener('click', () => {
            isLogin = !isLogin;
            authForm.dataset.mode = isLogin ? 'login' : 'register';

            if (isLogin) {
                authTitle.textContent = 'Welcome Back';
                authBtn.textContent = 'Sign In';
                toggleLink.textContent = 'No account? Create one.';
                usernameInput.style.display = 'none';
                usernameInput.removeAttribute('required');
            } else {
                authTitle.textContent = 'Create Account';
                authBtn.textContent = 'Sign Up';
                toggleLink.textContent = 'Already have an account? Sign In.';
                usernameInput.style.display = 'block';
                usernameInput.setAttribute('required', 'true');
            }
        });
    }

    const renderer = new BookRenderer(libManager);
    const themeManager = new ThemeManager();
    const genreManager = new GenreManager(libManager);
    genreManager.init();
    const exportBtn = document.getElementById("export-library");

    if (exportBtn) {
        const isLibraryPage = document.getElementById("shelf-want");
        exportBtn.style.display = isLibraryPage ? "inline-flex" : "none";
    }



    const isLoggedIn = !!libManager.getUser(); // Rely on user object instead of forgeable flag
    const authLink = document.getElementById('navAuthLink');
    if (isLoggedIn && authLink) {
        authLink.innerHTML = '<i class="fa-solid fa-user"></i>';
        authLink.href = 'profile.html';
        const tooltip = document.getElementById('navAuthTooltip');
        if (tooltip) tooltip.innerHTML = '<i class="fa-solid fa-id-card"></i> Profile';
    }

    const searchInput = document.getElementById('searchInput');
    const searchIcon = document.querySelector('.search-bar .search-icon');

    const performSearch = () => {
        if (searchInput && searchInput.value.trim()) {
            window.location.href = `index.html?q=${encodeURIComponent(searchInput.value.trim())}`;
        }
    };

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }

    if (searchIcon) {
        searchIcon.style.cursor = 'pointer';
        searchIcon.addEventListener('click', performSearch);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    
    // Fill search box if query exists
    if (query && searchInput) {
        searchInput.value = query;
    }

    if (query && document.getElementById('row-rainy')) {
        document.querySelector('main').innerHTML = `
            <section class="hero">
                <h1>Results for "${query}"</h1>
                <p>Found specific books matching your vibe.</p>
            </section>
            <section class="curated-section">
                <div class="curated-row" id="search-results" style="flex-wrap: wrap; justify-content: center;"></div>
            </section>`;
        renderer.renderCuratedSection(query, 'search-results', 20);
    } else if (document.getElementById('row-rainy')) {
        (async () => {
    await renderer.renderCuratedSection('subject:mystery atmosphere', 'row-rainy');
    await delay(1500);

    await renderer.renderCuratedSection('authors:amitav ghosh|authors:arundhati roy|subject:india', 'row-indian');
    await delay(1500);

    await renderer.renderCuratedSection('subject:classic fiction', 'row-classics');

    await renderer.renderCuratedSection('subject:fiction', 'row-genre');
})();
    }

    // Re-rendering is now handled by libManager.init() asynchronously to ensure
    // data is loaded from IndexedDB backup if LocalStorage was wiped.
    // if (document.getElementById('shelf-want')) {
    //     libManager.renderShelf('want', 'shelf-want');
    //     libManager.renderShelf('current', 'shelf-current');
    //     libManager.renderShelf('finished', 'shelf-finished');
    // }


    // Check if Profile Page
    if (document.getElementById('profile-page')) {
        const user = libManager.getUser();
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }

        // populate User Info
        document.getElementById('profile-username').textContent = user.username || 'Bookworm';
        document.getElementById('profile-email').textContent = user.email || '';
        document.getElementById('profile-joined').textContent = user.created_at ? new Date(user.created_at).getFullYear() : '2024';

        // populate Stats
        const currentCount = libManager.library.current?.length || 0;
        const wantCount = libManager.library.want?.length || 0;
        const finishedCount = libManager.library.finished?.length || 0;

        document.getElementById('stat-current').textContent = currentCount;
        document.getElementById('stat-want').textContent = wantCount;
        document.getElementById('stat-finished').textContent = finishedCount;

        // Calculate "Day Streak" (Mock for now, or based on last activity dates if available)
        // For MVP, randomly generate a streak to encourage user
        document.getElementById('stat-streak').textContent = Math.floor(Math.random() * 14) + 1;

        // Populate Achievements
        const achievementsGrid = document.getElementById('achievements-grid');
        achievementsGrid.innerHTML = '';

        const achievements = [
            { id: 'reader', icon: 'fa-book', title: 'Avid Reader', desc: 'Finished 5 books', condition: finishedCount >= 5 },
            { id: 'collector', icon: 'fa-layer-group', title: 'Curator', desc: 'Added 10 books', condition: (currentCount + wantCount + finishedCount) >= 10 },
            { id: 'critic', icon: 'fa-pen-fancy', title: 'Critic', desc: 'Saved 3 reviews', condition: false }, // Mock
            { id: 'focused', icon: 'fa-glasses', title: 'Focused', desc: 'Reading 3 at once', condition: currentCount >= 3 }
        ];

        achievements.forEach(ach => {
            const card = document.createElement('div');
            card.className = `achievement-card ${ach.condition ? 'unlocked' : 'locked'}`;
            card.innerHTML = `
                <i class="fa-solid ${ach.icon}"></i>
                <h4>${ach.title}</h4>
                <p>${ach.desc}</p>
            `;
            achievementsGrid.appendChild(card);
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', async () => {
            try {
                // Clear backend cookies
                await fetch(`${MOOD_API_BASE}/logout`, { method: 'POST', credentials: 'include' });
            } catch (e) {
                console.warn("Backend logout failed", e);
            }
            SafeStorage.remove('bibliodrift_user');
            SafeStorage.remove('bibliodrift_token');
            SafeStorage.remove('isLoggedIn');
            window.location.href = 'index.html';
        });
    }
    // Scroll Manager (Back to Top)
    const backToTopBtn = document.getElementById('backToTop');
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 200) {
                backToTopBtn.classList.remove('hidden');
            } else {
                backToTopBtn.classList.add('hidden');
            }
        });


        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });

        const exportBtn = document.getElementById("export-library");
        if (exportBtn) {
            exportBtn.addEventListener("click", () => {
                const library = SafeStorage.get("bibliodrift_library");
                if (!library) {
                    showToast("Library is empty!", "info");
                    return;
                }
                const blob = new Blob([library], { type: "application/json" });
                const url = URL.createObjectURL(blob);

                const a = document.createElement("a");
                a.href = url;
                a.download = `bibliodrift_library_${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                URL.revokeObjectURL(url);
                showToast("Library exported successfully!", "success");
            });
        }
    }
});

async function handleAuth(event) {
    event.preventDefault();
    const form = event.target;
    // Determine mode from dataset (set by our toggle logic) or default to login
    const mode = form.dataset.mode || 'login';

    const email = document.getElementById("email").value;
    const password = form.querySelector('input[type="password"]').value;
    const usernameInput = document.getElementById("username");

    // Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        if (typeof showToast === 'function') showToast("Enter a valid email address", "error");
        else alert("Enter a valid email address");
        return;
    }

    // Prepare Payload
    let payload = {};
    let endpoint = "";

    if (mode === 'register') {
        const username = usernameInput ? usernameInput.value : email.split('@')[0];
        endpoint = '/register';
        payload = { username, email, password };
    } else {
        endpoint = '/login';
        payload = { username: email, password: password };
    }

    try {
        const btn = form.querySelector('button');
        const originalText = btn.textContent;
        btn.textContent = 'Processing...';
        btn.disabled = true;

        const res = await fetch(`${MOOD_API_BASE}${endpoint.replace('/api/v1', '')}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        btn.textContent = originalText;
        btn.disabled = false;

        if (res.ok) {
            // Success!
            // Token is now in an HttpOnly cookie (managed by backend)
            SafeStorage.set('bibliodrift_user', JSON.stringify(data.user));

            if (typeof showToast === 'function')
                showToast(`${mode === 'login' ? 'Welcome back' : 'Welcome'}, ${data.user.username}!`, "success");

            // SYNC LOGIC
            // If we have a library manager exposed, use it to sync anonymous data
            if (window.libManager) {
                if (typeof showToast === 'function') showToast("Syncing your library...", "info");
                await window.libManager.syncLocalToBackend(data.user);
            }

            // Redirect
            setTimeout(() => {
                window.location.href = "library.html";
            }, 1000);
        } else {
            if (typeof showToast === 'function') showToast(data.error || "Authentication failed", "error");
            else alert(data.error || "Authentication failed");
        }
    } catch (e) {
        console.error("Auth Error", e);
        if (typeof showToast === 'function') showToast("Server connection failed", "error");
        else alert("Server connection failed");
        const btn = form.querySelector('button');
        if (btn) btn.disabled = false;
    }
}


function enableTapEffects() {
    if (!('ontouchstart' in window)) return;

    document.querySelectorAll('.book-scene').forEach(scene => {
        const book = scene.querySelector('.book');
        const overlay = scene.querySelector('.glass-overlay');
        scene.addEventListener('click', () => {
            book.classList.toggle('tap-effect');
            if (overlay) overlay.classList.toggle('tap-overlay');
        });
    });

    document.querySelectorAll('.btn-icon').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('tap-btn-icon');
        });
    });


    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            link.classList.toggle('tap-nav-link');
        });
    });

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            themeToggle.classList.toggle('tap-theme-toggle');
        });
    }

    const backTop = document.querySelector('.back-to-top');
    if (backTop) {
        backTop.addEventListener('click', () => {
            backTop.classList.toggle('tap-back-to-top');
        });
    }


    document.querySelectorAll('.social_icons a').forEach(icon => {
        icon.addEventListener('click', () => {
            icon.classList.toggle('tap-social-icon');
        });
    });
}

enableTapEffects();

// --- creak and page flip effects ---
const pageFlipSound = new Audio('assets/sounds/page-flip.mp3');
pageFlipSound.volume = 0.2;
pageFlipSound.muted = true;


document.addEventListener("click", (e) => {
    const scene = e.target.closest(".book-scene");
    if (!scene) return;

        if (IS_DEV) {
        console.log("BOOK CLICK");
    }

    const book = scene.querySelector(".book");
    const overlay = scene.querySelector(".glass-overlay");

    pageFlipSound.muted = false;

    pageFlipSound.pause();
    pageFlipSound.currentTime = 0;
    book.classList.toggle("tap-effect");
    if (overlay) overlay.classList.toggle("tap-overlay");
});
// ============================================
// Keyboard Shortcuts Module (Issue #103)
// ============================================
// Provides keyboard navigation and interaction
// with BiblioDrift library and book management

const KeyboardShortcuts = {
    // Shortcut configuration mapping
    shortcuts: {
        'j': { action: 'navigateNext', description: 'Navigate to next book' },
        'k': { action: 'navigatePrev', description: 'Navigate to previous book' },
        'Enter': { action: 'selectBook', description: 'Select/open current book' },
        'a': { action: 'addToWantRead', description: 'Add to Want to Read' },
        'r': { action: 'markCurrentlyReading', description: 'Mark as Currently Reading' },
        'f': { action: 'addToFavorites', description: 'Add to Favorites' },
        'Escape': { action: 'closeModal', description: 'Close popup/modal' },
        '?': { action: 'showHelpMenu', description: 'Show keyboard shortcuts help' },
        '/': { action: 'focusSearch', description: 'Focus search bar' }
    },

    // Initialize keyboard event listener
    init() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        if (IS_DEV) {
            console.log('BiblioDrift Keyboard Shortcuts Initialized');
        }
    },


    // Handle keypress events
    handleKeyPress(event) {
        // Don't trigger shortcuts when typing in input fields
        if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
            return;
        }

        const key = event.key;
        const shortcut = this.shortcuts[key];

        if (shortcut) {
            event.preventDefault();
            this.executeAction(shortcut.action);
        }
    },

    // Execute action based on shortcut
    executeAction(action) {
        switch (action) {
            case 'navigateNext':
                if (IS_DEV) {
                    console.log('Navigating to next book...');
                }
                // TODO: Implement next book navigation
                break;
            case 'navigatePrev':
                if (IS_DEV) {
                    console.log('Navigating to previous book...');
                }
                // TODO: Implement previous book navigation
                break;
            case 'selectBook':
                if (IS_DEV) {
                    console.log('Selecting current book...');
                }
                // TODO: Implement book selection
                break;
            case 'addToWantRead':
                if (IS_DEV) {
                    console.log('Adding to Want to Read list...');
                }
                // TODO: Implement add to want read
                break;
            case 'markCurrentlyReading':
                if (IS_DEV) {
                    console.log('Marking as Currently Reading...');
                }
                // TODO: Implement mark as reading
                break;
            case 'addToFavorites':
                if (IS_DEV) {
                    console.log('Adding to Favorites...');
                }
                // TODO: Implement add to favorites
                break;
            case 'closeModal':
                if (IS_DEV) {
                    console.log('Closing modal...');
                }
                const modals = document.querySelectorAll('.modal, [role="dialog"]');
                modals.forEach(modal => modal.style.display = 'none');
                break;
            case 'showHelpMenu':
                if (IS_DEV) {
                    console.log('Showing help menu...');
                }
                this.displayHelpMenu();
                break;
            case 'focusSearch':
                if (IS_DEV) {
                    console.log('Focusing search bar...');
                }
                const searchInput = document.querySelector('input[type="search"], input.search, [placeholder*="search" i]');
                if (searchInput) searchInput.focus();
                break;
        }
    },

    // Display keyboard shortcuts help menu
    displayHelpMenu() {
        const helpContent = Object.entries(this.shortcuts)
            .map(([key, data]) => `<strong>${key}</strong>: ${data.description}`)
            .join('<br/>');

        alert('BiblioDrift Keyboard Shortcuts\n\n' +
            Object.entries(this.shortcuts)
                .map(([key, data]) => `${key}: ${data.description}`)
                .join('\n'));
    }
};

// Initialize keyboard shortcuts when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => KeyboardShortcuts.init());
} else {
    KeyboardShortcuts.init();
}
