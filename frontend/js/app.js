/**
 * BiblioDrift Core Logic
 * Handles 3D rendering, API fetching, Persistent Auth, and Genre Browsing.
 */

const API_BASE = 'https://www.googleapis.com/books/v1/volumes';
const API_KEY = 'YOUR_GOOGLE_BOOKS_API_KEY';
const MOOD_API_BASE = 'http://localhost:5000/api/v1';

let GOOGLE_API_KEY = '';

async function loadConfig() {
    try {
        const res = await fetch(`${MOOD_API_BASE}/config`);
        if (res.ok) {
            const data = await res.json();
            GOOGLE_API_KEY = data.google_books_key || '';
            if (process.env.NODE_ENV === 'development') {
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
const SafeStorage = {
    metaKey: '__bibliodrift_storage_meta__',
    cachePrefixes: [
        'bibliodrift_cache_',
        'cached_books_',
        'books_cache_',
        'genre_cache_',
        'search_cache_',
        'cache_'
    ],
    protectedKeys: new Set([
        'bibliodrift_library',
        'bibliodrift_user',
        'bibliodrift_token',
        'bibliodrift_theme',
        'isLoggedIn'
    ]),

    isQuotaError(error) {
        return error instanceof DOMException && (
            error.code === 22 ||
            error.code === 1014 ||
            error.name === 'QuotaExceededError' ||
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        );
    },

    getMeta() {
        try {
            const raw = localStorage.getItem(this.metaKey);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) {
            return {};
        }
    },

    setMeta(meta) {
        try {
            localStorage.setItem(this.metaKey, JSON.stringify(meta));
        } catch (e) {
            // Ignore metadata write failures; data writes still succeed.
        }
    },

    estimateSize(value) {
        if (typeof value === 'string') return value.length;
        try {
            return JSON.stringify(value).length;
        } catch (e) {
            return 0;
        }
    },

    isCacheKey(key) {
        if (!key || key === this.metaKey) return false;
        return this.cachePrefixes.some(prefix => key.startsWith(prefix));
    },

    touchKey(key, value) {
        if (!key || key === this.metaKey) return;
        const meta = this.getMeta();
        meta[key] = {
            lastAccess: Date.now(),
            size: this.estimateSize(value)
        };
        this.setMeta(meta);
    },

    dropMetaKey(key) {
        const meta = this.getMeta();
        if (meta[key]) {
            delete meta[key];
            this.setMeta(meta);
        }
    },

    removeKeys(keys) {
        if (!Array.isArray(keys) || keys.length === 0) return 0;

        const meta = this.getMeta();
        let removed = 0;

        keys.forEach(key => {
            if (!key || key === this.metaKey) return;
            try {
                localStorage.removeItem(key);
                removed += 1;
            } catch (e) {
                // Skip keys that cannot be removed.
            }
            delete meta[key];
        });

        this.setMeta(meta);
        return removed;
    },

    getLRUCandidates({ cacheOnly = true, excludeKey = null } = {}) {
        const meta = this.getMeta();
        const candidates = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || key === this.metaKey || key === excludeKey) continue;
            if (this.protectedKeys.has(key)) continue;
            if (cacheOnly && !this.isCacheKey(key)) continue;

            const entryMeta = meta[key] || {};
            candidates.push({
                key,
                lastAccess: typeof entryMeta.lastAccess === 'number' ? entryMeta.lastAccess : 0
            });
        }

        candidates.sort((a, b) => a.lastAccess - b.lastAccess);
        return candidates;
    },

    recoverQuotaSpace(targetKey, attempt) {
        if (attempt === 1) {
            const oldestCacheKeys = this.getLRUCandidates({ cacheOnly: true, excludeKey: targetKey })
                .slice(0, 3)
                .map(item => item.key);
            return this.removeKeys(oldestCacheKeys);
        }

        if (attempt === 2) {
            const allCacheKeys = this.getLRUCandidates({ cacheOnly: true, excludeKey: targetKey })
                .map(item => item.key);
            return this.removeKeys(allCacheKeys);
        }

        const oldestNonCritical = this.getLRUCandidates({ cacheOnly: false, excludeKey: targetKey })
            .slice(0, 2)
            .map(item => item.key);
        return this.removeKeys(oldestNonCritical);
    },

    /**
     * Attempts to save data to localStorage with error handling.
     * @param {string} key 
     * @param {string} value 
     * @returns {boolean} Success status
     */
    set(key, value) {
        let recovered = 0;

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                localStorage.setItem(key, value);
                this.touchKey(key, value);
                if (recovered > 0) {
                    showToast(`Storage was full. Cleared ${recovered} old cached entr${recovered === 1 ? 'y' : 'ies'}.`, 'info');
                }
                return true;
            } catch (error) {
                if (!this.isQuotaError(error)) {
                    console.error("LocalStorage Error:", error);
                    return false;
                }

                const removed = this.recoverQuotaSpace(key, attempt + 1);
                recovered += removed;
                if (removed === 0) break;
            }
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
     * Safely removes data from localStorage.
     * @param {string} key 
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            this.dropMetaKey(key);
            return true;
        } catch (e) {
            console.error("LocalStorage Remove Error:", e);
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
            console.error("LocalStorage Clear Error:", e);
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

        scene.innerHTML = `
            <div class="book" data-id="${id}">
                <div class="book__face book__face--front">
                    <img src="${thumb.replace('http:', 'https:')}" alt="${title}">
                </div>
                <div class="book__face book__face--spine" style="background: ${randomSpine}"></div>
                <div class="book__face book__face--right"></div>
                <div class="book__face book__face--top"></div>
                <div class="book__face book__face--bottom"></div>
                <div class="book__face book__face--back">
                    <div style="overflow-y: auto; height: 100%; padding-right: 5px; scrollbar-width: thin;">
                        <div style="font-weight: bold; font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-main);">${title}</div>
                        <div class="handwritten-note" style="margin-bottom: 0.8rem; font-style: italic; color: var(--wood-dark);">${vibe}</div>
                        <div class="book-blurb" style="font-size: 0.8rem; line-height: 1.4; color: var(--text-muted); text-align: justify;">${description}</div>
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
                        <button class="btn-icon" title="Flip Back" onclick="event.stopPropagation(); this.closest('.book').classList.remove('flipped'); const s = new Audio('assets/sounds/page-flip.mp3'); s.volume=0.5; s.play();"><i class="fa-solid fa-rotate-left"></i></button>
                    </div>
                </div>
            </div>
            <div class="glass-overlay">
                <strong>${title}</strong><br><small>${authors}</small>
            </div>
        `;

        // Interaction: Flip
        const bookEl = scene.querySelector('.book');
        scene.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-icon') && !e.target.closest('.reading-progress')) {
                bookEl.classList.toggle('flipped');
                // Play sound
                flipSound.play().catch(e => {
                    if (process.env.NODE_ENV === 'development') {
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

        const shareBtn = document.getElementById('modal-share-btn');
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
            const keyParam = GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : '';
            const encodedQuery = encodeURIComponent(query);
            const res = await fetch(`${API_BASE}?q=${encodedQuery}&maxResults=${maxResults}&printType=books${keyParam}`);

            if (!res.ok) {
                throw new Error(`API Error: ${res.statusText}`);
            }

            const data = await res.json();

            if (data.items && data.items.length > 0) {
                container.innerHTML = '';
                for (const book of data.items) {
                    const bookElement = await this.createBookElement(book);
                    container.appendChild(bookElement);
                }
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-box-open"></i>
                        <p>No books found. The shelves are empty.</p>
                    </div>`;
            }
        } catch (err) {
            console.error("Failed to fetch books", err);
            showToast("Failed to load bookshelf.", "error");
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>Bookshelf Empty (API connection failed)</p>
                </div>`;
        }
    }
}

class LibraryManager {
    constructor() {
        this.storageKey = 'bibliodrift_library';
        const stored = SafeStorage.get(this.storageKey);
        this.library = stored ? JSON.parse(stored) : {
            current: [],
            want: [],
            finished: []
        };
        this.apiBase = 'http://localhost:5000/api/v1';

        // Sync API if user is logged in
        this.syncWithBackend();
        this.setupSorting();
    }

    getUser() {
        const userStr = SafeStorage.get('bibliodrift_user');
        return userStr ? JSON.parse(userStr) : null;
    }

    getAuthHeaders() {
        const token = SafeStorage.get('bibliodrift_token');
        return new Headers({
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        });
    }

    async syncWithBackend() {
        const user = this.getUser();
        if (!user) return;

        try {
            const res = await fetch(`${this.apiBase}/library/${user.id}`, {
                headers: this.getAuthHeaders()
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
                        volumeInfo: {
                            title: item.title,
                            authors: item.authors ? item.authors.split(', ') : [],
                            imageLinks: { thumbnail: item.thumbnail }
                        },
                        // Preserve local progress if exists, else default
                        progress: existing ? existing.book.progress : (item.shelf_type === 'current' ? 0 : null),
                        date_added: item.created_at || new Date().toISOString()
                    };

                    if (existing) {
                        // Check if shelf matches
                        if (existing.shelf !== item.shelf_type) {
                            // Backend wins on shelf conflict (syncing FROM server)
                            // Remove from old shelf
                            this.library[existing.shelf] = this.library[existing.shelf].filter(b => b.id !== item.google_books_id);
                            // Add to new shelf
                            this.library[item.shelf_type].push(remoteBook);
                        } else {
                            // Update details (e.g. db_id might be missing locally if added offline)
                            Object.assign(existing.book, remoteBook);
                        }
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
                    // Avoid syncing items that obviously came from backend (have db_id) 
                    // UNLESS you want to support offline updates (which is harder).
                    // The requirement is "upload anonymous local library when user signs up".
                    // Anonymous items won't have db_id.
                    if (!book.db_id) {
                        itemsToSync.push({
                            ...book,
                            shelf: shelf
                        });
                    }
                });
            }
        });

        if (itemsToSync.length === 0) return; // Nothing to sync

        try {
            if (process.env.NODE_ENV === 'development') {
                console.log(`Syncing ${itemsToSync.length} items to backend...`);
            }
            const res = await fetch(`${this.apiBase}/library/sync`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    user_id: user.id,
                    items: itemsToSync
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (process.env.NODE_ENV === 'development') {
                    console.log("Sync result:", data);
                }
                showToast(`Synced ${data.message}`, "success");

                // After upload, pull fresh state from backend to get the new DB IDs
                await this.syncWithBackend();
            } else {
                console.error("Backend refused sync");
            }
        } catch (e) {
            console.error("Sync upload failed", e);
            showToast("Failed to upload local library", "error");
        }
    }

    setupSorting() {
        const sortSelect = document.getElementById('sortLibrary');
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
        if (process.env.NODE_ENV === 'development') {
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
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const data = await res.json();
                    // Store the DB ID back to the local object
                    enrichedBook.db_id = data.item.id;
                    this.saveLocally();
                }
            } catch (e) {
                console.error("Failed to save to backend", e);
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
            if (process.env.NODE_ENV === 'development') {
                console.log(`Removed book ${id} from ${shelf}`);
            }

            // 2. Update Backend
            const user = this.getUser();
            // We need the DB ID to delete from backend usually, 
            // but our remove_from_library endpoint uses item_id (DB ID).
            // Do we have it?
            if (user && book.db_id) {
                try {
                    await fetch(`${this.apiBase}/library/${book.db_id}`, { method: 'DELETE', headers: this.getAuthHeaders() });
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
        this.currentTheme = SafeStorage.get(this.themeKey) || 'day';

        this.init();
    }


    init() {
        if (!this.toggleBtn) return;

        this.applyTheme(this.currentTheme);

        this.toggleBtn.addEventListener('click', () => {
            this.currentTheme = this.currentTheme === 'day' ? 'night' : 'day';
            this.applyTheme(this.currentTheme);
            SafeStorage.set(this.themeKey, this.currentTheme);
        });
    }


    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = this.toggleBtn.querySelector('i');
        if (theme === 'night') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
}



class GenreManager {
    constructor() {
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
            // Fetch relevant books from Google Books API
            // Using subject search and higher relevance
            const keyParam = GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : '';
            const response = await fetch(`${API_BASE}?q=subject:${genre}&maxResults=20&langRestrict=en&orderBy=relevance${keyParam}`);

            if (response.ok) {
                const data = await response.json();
                const items = data.items || [];

                if (items.length > 0) {
                    this.renderBooks(items);
                } else {
                    this.booksGrid.innerHTML = `
                        <div class="empty-state">
                            <i class="fa-solid fa-box-open"></i>
                            <p>Bookshelf Empty (No books found)</p>
                        </div>`;
                }
            } else {
                console.warn(`API Error ${response.status}`);
                this.booksGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <p>Bookshelf Empty (API Error: ${response.status})</p>
                    </div>`;
            }
        } catch (error) {
            console.error('Error fetching genre books:', error);
            this.booksGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-wifi"></i>
                    <p>Bookshelf Empty (Connection Failed)</p>
                </div>`;
        }
    }

    async renderBooks(books) {
        this.booksGrid.innerHTML = '';
        const renderer = new BookRenderer(new LibraryManager());
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
    const genreManager = new GenreManager();
    genreManager.init();
    const exportBtn = document.getElementById("export-library");

    if (exportBtn) {
        const isLibraryPage = document.getElementById("shelf-want");
        exportBtn.style.display = isLibraryPage ? "inline-flex" : "none";
    }



    const isLoggedIn = SafeStorage.get('isLoggedIn') === 'true';
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
        renderer.renderCuratedSection('subject:mystery atmosphere', 'row-rainy');
        renderer.renderCuratedSection('authors:amitav ghosh|authors:arundhati roy|subject:india', 'row-indian');
        renderer.renderCuratedSection('subject:classic fiction', 'row-classics');
        renderer.renderCuratedSection('subject:fiction', 'row-genre');
    }

    if (document.getElementById('shelf-want')) {
        libManager.renderShelf('want', 'shelf-want');
        libManager.renderShelf('current', 'shelf-current');
        libManager.renderShelf('finished', 'shelf-finished');
    }


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
        document.getElementById('logout-btn').addEventListener('click', () => {
            SafeStorage.remove('bibliodrift_user');
            SafeStorage.remove('bibliodrift_token');
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
        endpoint = '/api/v1/register';
        payload = { username, email, password };
    } else {
        endpoint = '/api/v1/login';
        payload = { username: email, password: password };
    }

    try {
        const btn = form.querySelector('button');
        const originalText = btn.textContent;
        btn.textContent = 'Processing...';
        btn.disabled = true;

        const res = await fetch(`http://localhost:5000${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        btn.textContent = originalText;
        btn.disabled = false;

        if (res.ok) {
            // Success!
            // Store Access Token and User Info
            if (data.access_token) {
                SafeStorage.set('bibliodrift_token', data.access_token);
            }
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

    if (process.env.NODE_ENV === 'development') {
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
        if (process.env.NODE_ENV === 'development') {
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
                if (process.env.NODE_ENV === 'development') {
                    console.log('Navigating to next book...');
                }
                // TODO: Implement next book navigation
                break;
            case 'navigatePrev':
                if (process.env.NODE_ENV === 'development') {
                    console.log('Navigating to previous book...');
                }
                // TODO: Implement previous book navigation
                break;
            case 'selectBook':
                if (process.env.NODE_ENV === 'development') {
                    console.log('Selecting current book...');
                }
                // TODO: Implement book selection
                break;
            case 'addToWantRead':
                if (process.env.NODE_ENV === 'development') {
                    console.log('Adding to Want to Read list...');
                }
                // TODO: Implement add to want read
                break;
            case 'markCurrentlyReading':
                if (process.env.NODE_ENV === 'development') {
                    console.log('Marking as Currently Reading...');
                }
                // TODO: Implement mark as reading
                break;
            case 'addToFavorites':
                if (process.env.NODE_ENV === 'development') {
                    console.log('Adding to Favorites...');
                }
                // TODO: Implement add to favorites
                break;
            case 'closeModal':
                if (process.env.NODE_ENV === 'development') {
                    console.log('Closing modal...');
                }
                const modals = document.querySelectorAll('.modal, [role="dialog"]');
                modals.forEach(modal => modal.style.display = 'none');
                break;
            case 'showHelpMenu':
                if (process.env.NODE_ENV === 'development') {
                    console.log('Showing help menu...');
                }
                this.displayHelpMenu();
                break;
            case 'focusSearch':
                if (process.env.NODE_ENV === 'development') {
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
