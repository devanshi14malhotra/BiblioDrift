/**
 * ==============================================================================
 * BiblioDrift Core Logic - Main Application Entry Point
 * ==============================================================================
 *
 * Overview:
 * ---------
 * This file serves as the primary orchestrator for the BiblioDrift application.
 * It ties together the DOM manipulation, state management, 3D rendering interactions,
 * and API communications (both Google Books API and our custom Python backend).
 *
 * Key Components:
 * ---------------
 * 1. SafeStorage:
 *    A robust wrapper around `localStorage` with an `IndexedDB` fallback mechanism.
 *    This component is critical for offline-first capabilities and prevents the
 *    entire app from crashing when iOS/Safari or restrictive browser quotas prevent
 *    standard `localStorage` operations.
 *    - Automatically handles QuotaExceeded exceptions.
 *    - Provides asynchronous data restoration algorithms.
 *    - Integrates closely with the LibraryManager to store thousands of books safely.
 *
 * 2. LibraryManager:
 *    The central state machine over the user's book collection.
 *    - Shelf Types: Manages three distinctive shelves: 'want', 'current', 'finished'.
 *    - Concurrency Control: Handles race conditions when syncing local states with
 *      the backend utilizing optimistic locking techniques.
 *    - Merging Strategy: In the event of a conflict between the client data and
 *      server data, it attempts a non-destructive merge, retaining the state with
 *      the highest integer version map.
 *
 * 3. BookRenderer:
 *    An interface bridge to the DOM. Handles instantiation of HTML templates for
 *    individual 3D book instances, binding their unique event listeners, and
 *    applying their generated CSS styles and thematic properties.
 *    It integrates directly with `LibraryManager` to reflect real-time progress updates.
 *
 * 4. ThemeManager:
 *    Observes User Preferences and seamlessly toggles the UI's color palette between
 *    predefined themes (e.g., dark mode and light mode, wood mode), persisting
 *    these preferences to SafeStorage for a seamless experience across reloads.
 *
 * API Architecture Details:
 * -------------------------
 * - Google Books API: Facilitates the search and retrieval of rich book metadata
 *   including volume summaries, author info, and high-quality thumbnail images.
 * - Local Proxy/Backend: Certain complex interactions such as Machine Learning
 *   sentiment analysis (fetchAIVibe) are offloaded to `MOOD_API_BASE` to bypass
 *   client-side compute limitations and securely handle secret API keys.
 *
 * Security & Data Integrity Considerations:
 * -----------------------------------------
 * - Data Sanitization: All text rendered from external APIs is strictly passed
 *   through the `escapeHTML` utility safely converting brackets to entities to
 *   prevent XSS (Cross-Site Scripting) vectors.
 * - CSRF Protection: Interacts closely with the server-supplied `csrf_access_token`
 *   to securely validate state-mutating requests (POST, PUT, DELETE) preventing
 *   Cross Site Request Forgery attacks against logged-in users.
 *
 * Coding Standards and Development Guidelines:
 * --------------------------------------------
 * 1. Offline-First Philosophy: Ensure that actions (add, remove, update) are
 *    optimistically applied to local state before waiting for server resolution.
 * 2. Safe Storage Wrapper: Always use `SafeStorage.set()` instead of native
 *    `localStorage.setItem()`.
 * 3. Centralized Styling: For broad CSS manipulations, modify standard tokens in
 *    `index.css` rather than directly overriding inline styles to maintain a
 *    dynamic and cohesive theme strategy.
 *
 * File Structure:
 * ---------------
 * - [000-100]: Initialization and Utility Wrappers
 * - [100-300]: SafeStorage Implementation
 * - [300-800]: BookRenderer Class and 3D interactions
 * - [800-1300]: LibraryManager state machine and synchronization
 * - [1300+]: UI Controllers, Events, and Application Bootstrap
 * ==============================================================================
 */

// API_BASE and MOOD_API_BASE are declared globally in config.js (loaded first).
// Do NOT re-declare them here — use the globals from config.js directly.
const IS_DEV = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

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
                    data.google_books_key_secondary,
                ]);
            }
            if (IS_DEV) {
                console.log('Config loaded');
            }
        }
    } catch (e) {
        console.warn('Failed to load backend config', e);
    }
}
import { saveBookOffline, removeOfflineBook, db } from './db.js';

// Example click handler for your custom "Save for Offline" icon
async function handleDownloadToggle(bookCard, bookData) {
    const isAlreadyDownloaded = await db.downloadedBooks.get(bookData.id);
    
    if (isAlreadyDownloaded) {
        const success = await removeOfflineBook(bookData.id);
        if (success) bookCard.classList.remove('is-downloaded');
    } else {
        const success = await saveBookOffline(bookData);
        if (success) bookCard.classList.add('is-downloaded');
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

function clearStoredAuthState() {
    SafeStorage.remove('bibliodrift_user');
    SafeStorage.remove('bibliodrift_token');
    SafeStorage.remove('isLoggedIn');
    authSessionPromise = null;
}

function parseStoredUser() {
    const userStr = SafeStorage.get('bibliodrift_user');
    if (!userStr) return null;

    try {
        return JSON.parse(userStr);
    } catch (error) {
        return null;
    }
}

function renderAuthNavigation(authLink, tooltip, isAuthenticated) {
    if (!authLink) return;

    if (isAuthenticated) {
        authLink.innerHTML = '<i class="fa-solid fa-user"></i> Profile';
        authLink.href = 'profile.html';
        authLink.classList.remove('active');
        if (tooltip) tooltip.innerHTML = '<i class="fa-solid fa-id-card"></i> View Profile';
        return;
    }

    authLink.textContent = 'Sign In';
    authLink.href = 'auth.html';
    if (tooltip) tooltip.innerHTML = '<i class="fa-solid fa-key"></i> Access account';
}

let authSessionPromise = null;

async function verifyStoredAuthSession() {
    if (authSessionPromise) {
        return authSessionPromise;
    }

    authSessionPromise = (async () => {
        const token = SafeStorage.get('bibliodrift_token');
        const storedUser = parseStoredUser();
        const thinksLoggedIn = SafeStorage.get('isLoggedIn') === 'true';

        if (token === 'demo-token-12345') {
            return storedUser;
        }

        // Real logins use HttpOnly JWT cookies (see backend JWT_TOKEN_LOCATION). Optional CSRF cookie is readable by JS.
        const shouldProbe = thinksLoggedIn || storedUser || getCookie('csrf_access_token');
        if (!shouldProbe) {
            return null;
        }

        try {
            const headers = {};
            const csrf = getCookie('csrf_access_token');
            if (csrf) {
                headers['X-CSRF-TOKEN'] = csrf;
            }

            const response = await fetch(`${MOOD_API_BASE}/auth/verify`, {
                method: 'GET',
                credentials: 'include',
                headers,
            });

            if (response.ok) {
                const data = await response.json();
                const verifiedUser = data.user || storedUser;
                if (verifiedUser) {
                    SafeStorage.set('bibliodrift_user', JSON.stringify(verifiedUser));
                }
                SafeStorage.set('isLoggedIn', 'true');
                return verifiedUser || null;
            }

            if (response.status === 401 || response.status === 422) {
                clearStoredAuthState();
            }
            return null;
        } catch (error) {
            console.warn('Auth verification failed; using cached session state if available.', error);
            return storedUser;
        }
    })();

    return authSessionPromise;
}

window.verifyStoredAuthSession = verifyStoredAuthSession;
window.renderAuthNavigation = renderAuthNavigation;

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
                console.warn('[Storage] Persist request failed', e);
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
                error instanceof DOMException &&
                (error.code === 22 ||
                    error.code === 1014 ||
                    error.name === 'QuotaExceededError' ||
                    error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

            if (isQuotaError) {
                showToast('Local storage full! Saving to secure backup.', 'info');
            } else {
                console.error('LocalStorage Error:', error);
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
            console.error('IndexedDB Backup Failed', e);
        }

        showToast('Local storage full! Please sync to cloud and clear cache.', 'error');
        return false;
    },

    /**
     * Safely retrieves data from localStorage.
     */
    get(key) {
        try {
            const value = localStorage.getItem(key);
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
                    if (IS_DEV) console.log('[Storage] Restored from IndexedDB backup');
                    // Try to restore to LocalStorage for future sync calls
                    try {
                        localStorage.setItem(key, val);
                    } catch (e) {}
                }
            } catch (e) {
                console.warn('Backup retrieval failed', e);
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
    },
};
const MOCK_BOOKS = [
    {
        id: "mock-dune",
        volumeInfo: {
            title: "Dune",
            authors: ["Frank Herbert"],
            description: "A sweeping science fiction epic set on the desert planet Arrakis. Dune explores complex themes of politics, religion, and man's relationship with nature. Paul Atreides must navigate a treacherous path to becoming the mysterious Muad'Dib.",
            imageLinks: { thumbnail: "../assets/images/dune.jpg" }
        }
    },
    {
        id: "mock-1984",
        volumeInfo: {
            title: "1984",
            authors: ["George Orwell"],
            description: "Orwell's chilling prophecy of a totalitarian future where Big Brother is always watching. A profound exploration of surveillance, truth, and the resilience of the human spirit.",
            imageLinks: { thumbnail: "../assets/images/1984.jpg" }
        }
    },
    {
        id: "mock-hobbit",
        volumeInfo: {
            title: "The Hobbit",
            authors: ["J.R.R. Tolkien"],
            description: "In a hole in the ground there lived a hobbit. Join Bilbo Baggins on an unexpected journey across Middle-earth, encountering dragons, dwarves, and a rigorous test of courage.",
            imageLinks: { thumbnail: "../assets/images/hobbit.jpg" }
        }
    },
    {
        id: "mock-pride",
        volumeInfo: {
            title: "Pride and Prejudice",
            authors: ["Jane Austen"],
            description: "A timeless romance of manners and misunderstanding. Elizabeth Bennet's wit matches Mr. Darcy's pride in this sharp social commentary that remains one of the most loved novels in English literature.",
            imageLinks: { thumbnail: "../assets/images/pride.jpg" }
        }
    },
    {
        id: "mock-gatsby",
        volumeInfo: {
            title: "The Great Gatsby",
            authors: ["F. Scott Fitzgerald"],
            description: "The quintessential novel of the Jazz Age. Jay Gatsby's obsessive love for Daisy Buchanan drives a tragic tale of wealth, illusion, and the American Dream.",
            imageLinks: { thumbnail: "../assets/images/gatsby.jpg" }
        }
    },
    {
        id: "mock-sapiens",
        volumeInfo: {
            title: "Sapiens",
            authors: ["Yuval Noah Harari"],
            description: "A groundbreaking narrative of humanity's creation and evolution. Harari explores the ways in which biology and history have defined us and enhanced our understanding of what it means to be 'human'.",
            imageLinks: { thumbnail: "../assets/images/sapiens.jpg" }
        }
    },
    {
        id: "mock-hail-mary",
        volumeInfo: {
            title: "Project Hail Mary",
            authors: ["Andy Weir"],
            description: "A lone astronaut must save the earth from disaster in this gripping tale of survival and scientific discovery. Full of humor and hard science, it is a celebration of human ingenuity.",
            imageLinks: { thumbnail: "../assets/images/hail_mary.jpg" }
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

    renderSkeletons(container, count = 5, type = 'card') {
        if (!container) return;
        let html = '';
        if (type === 'card') {
            html = Array(count).fill(0).map(() => `
                <div class="book-skeleton skeleton"></div>
            `).join('');
        } else if (type === 'spine') {
            html = Array(count).fill(0).map(() => `
                <div class="spine-skeleton skeleton"></div>
            `).join('');
        }
        container.innerHTML = html;
    }

    async createBookElement(bookData, shelf = null) {
        const { id, volumeInfo } = bookData;
        const progress = typeof bookData.progress === 'number' ? bookData.progress : 0;
        const title = volumeInfo.title || "Untitled";
        const authors = volumeInfo.authors ? volumeInfo.authors.join(", ") : "Unknown Author";
        const thumb = volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : 'https://via.placeholder.com/128x196?text=No+Cover';
        const originalDescription = volumeInfo.description ? volumeInfo.description.substring(0, 100) + "..." : "A mysterious tome waiting to be opened.";
        const categories = volumeInfo.categories || [];

        const vibe = this.generateVibe(originalDescription, categories);
        const spineColors = ['#5D4037', '#4E342E', '#3E2723', '#2C2420', '#8D6E63'];
        const randomSpine = spineColors[Math.floor(Math.random() * spineColors.length)];
        const cleanId = title.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
        const spineImagePath = `assets/images/${cleanId}_spine.jpg`;

        const scene = document.createElement('div');
        scene.className = 'book-scene';

        // Load flip sound
        const flipSound = new Audio('../assets/sounds/page-flip.mp3');
        flipSound.preload = 'auto';
        flipSound.volume = 0.5;

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
        const safeOriginalDescription = escapeHTML(originalDescription);
        const safeVibe = escapeHTML(vibe);
        const safeThumb = escapeHTML(thumb.replace('http:', 'https:'));

        scene.innerHTML = `
            <div class="book" data-id="${escapeHTML(id)}">
                <div class="book__face book__face--front">
                    <img src="${safeThumb}" alt="${safeTitle}">
                </div>
                <div class="book__face book__face--spine" style="background: ${randomSpine}"></div>
                <div class="book__face book__face--right"></div>
                <div class="book__face book__face--top"></div>
                <div class="book__face book__face--bottom"></div>
                <div class="book__face book__face--back">
                    <div style="overflow-y: auto; height: 100%; padding-right: 5px; scrollbar-width: thin;">
                        <div style="font-weight: bold; font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-main);">${safeTitle}</div>
                        <div class="handwritten-note" style="margin-bottom: 0.8rem; font-style: italic; color: var(--wood-dark);">${safeVibe}</div>
                        ${bookData.moods && bookData.moods.length > 0 ? `
                        <div class="book-mood-tags" style="margin-bottom: 0.8rem; display: flex; flex-wrap: wrap; gap: 4px;">
                            ${bookData.moods.map(m => `<span style="font-size: 0.6rem; background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 10px;"><i class="fa-solid ${this.getMoodIcon(m)}"></i> ${m}</span>`).join('')}
                        </div>
                        ` : ''}
                    </div>

                    <button class="read-details-btn" title="Read Details">
                        <i class="fa-solid fa-circle-info"></i> Read Details
                    </button>

                    ${shelf === 'current' ? `
                    <div class="reading-progress">
                        <input type="range" min="0" max="100" value="${progress}" class="progress-slider" />
                        <small>${progress}% read</small>
                    </div>` : ''}
                    <div class="book-actions">
                        <button class="btn-icon add-btn" title="Add to Library"><i class="fa-regular fa-heart"></i></button>
                        <button class="btn-icon share-btn" title="Share Book"><i class="fa-solid fa-share-nodes"></i></button>
                        <button class="btn-icon flip-back-btn" title="Flip Back"><i class="fa-solid fa-rotate-left"></i></button>
                    </div>
                </div>
            </div>
        <div class="book-pages-3d"></div>
    <div class="glass-overlay">
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
        const bookEl = scene.querySelector('.book-container-3d');
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
        scene.querySelector('.read-details-btn').addEventListener('click', (e) => {
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
                const payload = data.data || data;
                return payload?.vibe || payload?.bookseller_note || payload?.insight || payload?.note || null;
            }
        } catch (e) {
            // Silently fail to use fallback
        }
        return null;
    }

    async fetchAIBlurb(bookId, title, author, description, categories = []) {
        try {
            const res = await fetch(`${MOOD_API_BASE}/generate-note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ bookId, title, author, description, categories })
            });
            if (res.ok) {
                const data = await res.json();
                return data.data?.blurb || null;
            }
        } catch (e) {
            // Silently fail to use fallback
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
        
        const summaryEl = document.getElementById('modal-summary');
        if (summaryEl) {
            // Show skeletons while AI is "thinking"
            summaryEl.innerHTML = `
                <div class="text-skeleton skeleton"></div>
                <div class="text-skeleton skeleton" style="width: 90%"></div>
            `;

            // Fetch the AI vibe to populate the Insight box
            this.fetchAIVibe(book.volumeInfo.title, book.volumeInfo.authors?.join(", ") || "", book.volumeInfo.description || "").then(vibe => {
                if (vibe) {
                    const cleanVibe = vibe.replace(/^(Bookseller's Note:|Note:|Recommendation:)\s*/i, "");
                    summaryEl.innerHTML = `<p class="fade-in">${cleanVibe}</p>`;
                } else {
                    // Fallback to description if AI vibe fails
                    summaryEl.textContent = book.volumeInfo.description || "No description available.";
                }
            });
        }

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

        // Preview Button — opens the Google Books Embedded Viewer
        const previewBtn = document.getElementById('modal-preview-btn');
        if (previewBtn) {
            previewBtn.onclick = () => {
                if (window.BookPreview && book.id) {
                    window.BookPreview.open(book.id, book.volumeInfo.title || 'Book Preview');
                }
            };
        }

        modal.showModal();
        document.getElementById('closeModalBtn').onclick = () => modal.close();

        // Emotion Tagging UI
        const emotionContainer = document.createElement('div');
        emotionContainer.className = 'emotion-tagging-section';
        emotionContainer.innerHTML = `
            <h3 class="modal-section-title">How does this book make you feel?</h3>
            <div class="emotion-tags-container">
                ${['Melancholic', 'Cozy', 'Tense', 'Inspiring', 'Whimsical', 'Dark', 'Adventurous'].map(mood => {
            const isActive = book.moods && book.moods.includes(mood);
            return `<span class="emotion-tag ${isActive ? 'active' : ''}" data-mood="${mood}">
                        <i class="fa-solid ${this.getMoodIcon(mood)}"></i> ${mood}
                    </span>`;
        }).join('')}
            </div>
        `;
        // Insert before the buttons
        const modalBody = modal.querySelector('.modal-body') || modal.querySelector('.book-details-content');
        const actions = modal.querySelector('.modal-actions') || modal.querySelector('.book-actions-section');
        
        if (actions) {
            // Remove existing tagging section if re-opening
            const existing = actions.parentNode.querySelector('.emotion-tagging-section');
            if (existing) existing.remove();
            
            actions.parentNode.insertBefore(emotionContainer, actions);
        } else if (modalBody) {
            // Fallback
            const existing = modalBody.querySelector('.emotion-tagging-section');
            if (existing) existing.remove();
            modalBody.appendChild(emotionContainer);
        }

        // Add tag toggle listeners
        emotionContainer.querySelectorAll('.emotion-tag').forEach(tag => {
            tag.onclick = async () => {
                const mood = tag.dataset.mood;
                if (!book.moods) book.moods = [];

                const index = book.moods.indexOf(mood);
                if (index > -1) {
                    book.moods.splice(index, 1);
                    tag.classList.remove('active');
                } else {
                    book.moods.push(mood);
                    tag.classList.add('active');
                }

                if (this.libraryManager) {
                    await this.libraryManager.updateBook(book.id, { moods: book.moods });
                }
            };
        });
    }

    getMoodIcon(mood) {
        const icons = {
            'Melancholic': 'fa-cloud-showers-heavy',
            'Cozy': 'fa-mug-hot',
            'Tense': 'fa-bolt',
            'Inspiring': 'fa-lightbulb',
            'Whimsical': 'fa-wand-magic-sparkles',
            'Dark': 'fa-moon',
            'Adventurous': 'fa-compass'
        };
        return icons[mood] || 'fa-tag';
    }

    async renderCuratedSection(query, elementId, maxResults = 5) {
        const container = document.getElementById(elementId);
        if (!container) return;

        // Show skeletons while loading
        this.renderSkeletons(container, maxResults);

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

    async renderMoodCategorySection(categoryConfig, elementId, maxResults = 5) {
        const container = document.getElementById(elementId);
        if (!container) return;

        this.renderSkeletons(container, maxResults);

        try {
            const res = await fetch(`${MOOD_API_BASE}/category-books`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    category: categoryConfig.category,
                    vibe_description: categoryConfig.vibeDescription,
                    count: maxResults
                })
            });

            if (!res.ok) {
                throw new Error(`Category API Error: ${res.status}`);
            }

            const payload = await res.json();
            const categoryBooks = payload?.data?.books || [];

            if (categoryBooks.length === 0) {
                throw new Error(`No books returned for category: ${categoryConfig.category}`);
            }

            const resolvedBooks = await this.resolveCategoryBooks(categoryBooks);
            if (resolvedBooks.length > 0) {
                await this.renderBookCards(container, resolvedBooks.slice(0, maxResults));
                return;
            }

            throw new Error(`Could not resolve Google Books matches for category: ${categoryConfig.category}`);
        } catch (err) {
            console.error(`Failed to load category shelf "${categoryConfig.category}"`, err);
            await this.renderCuratedSection(categoryConfig.fallbackQuery, elementId, maxResults);
        }
    }

    async resolveCategoryBooks(categoryBooks) {
        const resolvedBooks = [];

        for (const item of categoryBooks) {
            const title = String(item?.title || '').trim();
            const author = String(item?.author || '').trim();
            if (!title) continue;

            const searchQuery = author
                ? `intitle:${title} inauthor:${author}`
                : `intitle:${title}`;

            try {
                const client = window.GoogleBooksClient;
                const data = client
                    ? await client.fetchVolumes(searchQuery, { maxResults: 1, extraParams: '&printType=books' })
                    : await (async () => {
                        const keyParam = GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : '';
                        const res = await fetch(`${API_BASE}?q=${encodeURIComponent(searchQuery)}&maxResults=1&printType=books${keyParam}`);
                        if (!res.ok) {
                            throw new Error(`Google Books API Error: ${res.status}`);
                        }
                        return await res.json();
                    })();

                const matchedBook = data?.items?.[0];
                if (matchedBook) {
                    matchedBook.categoryReason = item.reason || '';
                    resolvedBooks.push(matchedBook);
                }
            } catch (error) {
                console.warn(`Failed to resolve category book "${title}"`, error);
            }
        }

        return resolvedBooks;
    }

    async renderBookCards(container, books) {
        container.innerHTML = '';
        if (!books || books.length === 0) {
            container.innerHTML = '<p class="empty-state">No books available for this collection.</p>';
            return;
        }

        for (const book of books) {
            try {
                const bookElement = await this.createBookElement(book);
                if (bookElement) {
                    container.appendChild(bookElement);
                }
            } catch (err) {
                console.error("Failed to render individual book:", book.id, err);
                // Continue to next book instead of breaking the row
            }
        }

        // If nothing was rendered, show error
        if (container.children.length === 0) {
            container.innerHTML = '<p class="empty-state">Failed to load books. Please check your connection.</p>';
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

    async ready() {
        await this._initPromise;
        return this;
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

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                this.filterLibrary(query);
            });
        }
    }

    filterLibrary(query) {
        ['current', 'want', 'finished'].forEach(shelf => {
            const containerId = `shelf-${shelf}-3d`;
            const container = document.getElementById(containerId);
            if (!container) return;

            const books = this.library[shelf];
            const filtered = books.filter(book => {
                const title = (book.volumeInfo.title || "").toLowerCase();
                const author = (book.volumeInfo.authors || []).join(" ").toLowerCase();
                const moods = (book.moods || []).join(" ").toLowerCase();
                return title.includes(query) || author.includes(query) || moods.includes(query);
            });

            this.renderFilteredShelf(shelf, containerId, filtered);
        });
    }

    async renderFilteredShelf(shelfName, elementId, books) {
        const container = document.getElementById(elementId);
        if (!container) return;

        container.innerHTML = '';
        if (books.length === 0) {
            container.innerHTML = '<div class="empty-state">No matching books found.</div>';
            return;
        }

        try {
            const renderer = new BookRenderer(this);
            for (const book of books) {
                const el = await renderer.createBookElement(book, shelfName);
                container.appendChild(el);
            }
        } catch (error) {
            console.error(`[Library] Error rendering filtered shelf:`, error);
        }
    }

    sortLibrary(criteria) {
        const sortFn = (a, b) => {
            switch (criteria) {
                case 'date_desc':
                    return new Date(b.date_added || 0) - new Date(a.date_added || 0);
                case 'date_asc':
                    return new Date(a.date_added || 0) - new Date(b.date_added || 0);
                case 'title':
                case 'title_asc':
                    return (a.volumeInfo.title || "").localeCompare(b.volumeInfo.title || "");
                case 'title_desc':
                    return (b.volumeInfo.title || "").localeCompare(a.volumeInfo.title || "");
                case 'author':
                case 'author_asc':
                    const authorA = (a.volumeInfo.authors && a.volumeInfo.authors[0]) || "";
                    const authorB = (b.volumeInfo.authors && b.volumeInfo.authors[0]) || "";
                    return authorA.localeCompare(authorB);
                case 'mood':
                    // Sort by primary mood if available
                    const moodA = (a.moods && a.moods[0]) || "zzz"; // push untagged to bottom
                    const moodB = (b.moods && b.moods[0]) || "zzz";
                    return moodA.localeCompare(moodB);
                case 'rating':
                    return (b.volumeInfo.averageRating || 0) - (a.volumeInfo.averageRating || 0);
                default:
                    return 0;
            }
        };

        ['current', 'want', 'finished'].forEach(shelf => {
            if (this.library[shelf]) {
                this.library[shelf].sort(sortFn);
                // If we have a dedicated 3D renderer, let it handle the UI to avoid duplicate rendering
                if (window.bookshelf3D && typeof window.bookshelf3D.refreshShelves === 'function') {
                    window.bookshelf3D.refreshShelves();
                } else {
                    this.renderShelf(shelf, `shelf-${shelf}-3d`);
                }
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

    getShelfBooks(shelf) {
        return Array.isArray(this.library[shelf]) ? [...this.library[shelf]] : [];
    }

    getLibrarySnapshot() {
        return {
            current: this.getShelfBooks('current'),
            want: this.getShelfBooks('want'),
            finished: this.getShelfBooks('finished')
        };
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

    async moveBook(id, toShelf) {
        const result = this.findBookInShelf(id);
        if (!result) return false;

        const { shelf: fromShelf, book } = result;
        if (fromShelf === toShelf) return true;
        if (!this.library[toShelf]) return false;

        this.library[fromShelf] = this.library[fromShelf].filter(b => b.id !== id);

        if (toShelf === 'finished' && book.progress !== 100) {
            book.progress = 100;
        } else if (toShelf === 'current' && (book.progress == null || book.progress === 100)) {
            book.progress = 0;
        }

        this.library[toShelf].push(book);
        this.saveLocally();

        const user = this.getUser();
        if (user && book.db_id) {
            try {
                const res = await fetch(`${this.apiBase}/library/${book.db_id}`, {
                    method: 'PUT',
                    headers: this.getAuthHeaders(),
                    credentials: 'include',
                    body: JSON.stringify({
                        shelf_type: toShelf,
                        progress: book.progress,
                        version: book.version
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    book.version = data.item.version;
                    this.saveLocally();
                } else if (res.status === 409) {
                    showToast("Conflict detected! Syncing with server...", "error");
                    await this.syncWithBackend();
                    return false;
                } else {
                    const data = await res.json();
                    console.error("Move failed:", data.error);
                }
            } catch (e) {
                console.error("Failed to update backend during move", e);
                showToast("Moved locally (Sync failed)", "info");
            }
        }

        return true;
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

        try {
            for (const book of books) {
                const renderer = new BookRenderer(this);
                const el = await renderer.createBookElement(book, shelfName);
                container.appendChild(el);
            }
        } catch (error) {
            console.error(`[Library] Error rendering shelf ${shelfName}:`, error);
        }
    }
}


class ThemeManager {
    constructor() {
        this.themeKey = 'bibliodrift_theme';
        this.toggleBtn = document.getElementById('themeToggle');
        // Use SafeStorage for consistency with app's storage strategy
        const stored = SafeStorage.get(this.themeKey);
        this.currentTheme = stored === 'night' ? 'night' : 'light';
        // Named handler so we can remove & re-add cleanly (no stacking)
        this._handler = this._onClick.bind(this);
        this.init();
    }

    _onClick() {
        this.currentTheme = this.currentTheme === 'night' ? 'light' : 'night';
        this.applyTheme(this.currentTheme);
        SafeStorage.set(this.themeKey, this.currentTheme);
    }

    init() {
        if (!this.toggleBtn) return;
        this.applyTheme(this.currentTheme);
        // Remove before add to prevent duplicate listeners if init is called twice
        this.toggleBtn.removeEventListener('click', this._handler);
        this.toggleBtn.addEventListener('click', this._handler);
    }

    applyTheme(theme) {
        if (theme === 'night') {
            document.documentElement.setAttribute('data-theme', 'night');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        // Update icon — use className directly, cannot fail
        if (this.toggleBtn) {
            const icon = this.toggleBtn.querySelector('i');
            if (icon) {
                icon.className = theme === 'night'
                    ? 'fa-solid fa-sun'
                    : 'fa-solid fa-moon';
            }
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

        // Show loading skeletons
        if (window.renderer) {
            window.renderer.renderSkeletons(this.booksGrid, 10);
        } else {
            this.booksGrid.innerHTML = `
                <div class="genre-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>Finding best ${genre} books...</span>
                </div>
            `;
        }

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
// --- Application Bootstrap ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 BiblioDrift Initializing...');

    // 1. Initialize Managers
    const libManager = new LibraryManager();
    window.libManager = libManager;
    window.dispatchEvent(new CustomEvent('bibliodrift:library-manager-ready', {
        detail: { libraryManager: libManager }
    }));
    libManager.ready().then(() => {
        window.dispatchEvent(new CustomEvent('bibliodrift:library-manager-synced', {
            detail: { libraryManager: libManager }
        }));
    });

    window.renderer = new BookRenderer(libManager);
    const themeManager = new ThemeManager();

    // 2. Load Config (Non-blocking)
    loadConfig();



    // --- AUTH LOGIC ---
    const toggleLink = document.getElementById('toggleText');
    const authTitle = document.getElementById('authTitle');
    const authBtn = document.getElementById('submitBtn');
    const authForm = document.getElementById('authForm');
    const nameField = document.getElementById('nameField');

    if (toggleLink && authTitle && authBtn && authForm) {
        let isLogin = true;
        authForm.dataset.mode = 'login';

        toggleLink.addEventListener('click', () => {
            isLogin = !isLogin;
            
            if (!isLogin) {
                // Switch to Register Mode
                authForm.dataset.mode = 'register';
                authTitle.textContent = 'Create Account';
                authBtn.textContent = 'Sign Up';
                toggleLink.textContent = 'Already have an account? Sign in.';
                if (nameField) nameField.style.display = 'block';
            } else {
                // Switch to Login Mode
                authForm.dataset.mode = 'login';
                authTitle.textContent = 'Welcome Back';
                authBtn.textContent = 'Sign In';
                toggleLink.textContent = 'No account? Create one.';
                if (nameField) nameField.style.display = 'none';
            }
        });
    }

    const genreManager = new GenreManager(libManager);
    genreManager.init();
    const exportBtn = document.getElementById("export-library");
    if (exportBtn) {
        const isLibraryPage = document.getElementById("shelf-want");
        exportBtn.style.display = isLibraryPage ? "inline-flex" : "none";

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



    const verifiedUser = await verifyStoredAuthSession();
    const isLoggedIn = !!libManager.getUser() || !!verifiedUser; // Rely on user object instead of forgeable flag
    const authLink = document.getElementById('navAuthLink');
    const tooltip = document.getElementById('navAuthTooltip');
    renderAuthNavigation(authLink, tooltip, Boolean(verifiedUser));

    // Redirect if already logged in and on the sign-in page
    if (verifiedUser && window.location.pathname.endsWith('auth.html')) {
        window.location.href = 'profile.html';
        return;
    }

    if (verifiedUser) {
        await libManager.syncWithBackend();
    }

    const searchInput = document.getElementById('searchInput');
    const searchIcon = document.querySelector('.search-bar .search-icon');

    const performSearch = () => {
        if (searchInput && searchInput.value.trim()) {
            // Only redirect to discovery search if we're not already on the library page 
            // where search is handled by the local library filter.
            if (!window.location.pathname.includes('library.html')) {
                window.location.href = `index.html?q=${encodeURIComponent(searchInput.value.trim())}`;
            }
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

    if (query && document.getElementById('search-results-section')) {
        const searchSection = document.getElementById('search-results-section');
        const queryDisplay = document.getElementById('search-query-display');
        
        queryDisplay.textContent = `Results for "${query}"`;
        searchSection.removeAttribute('hidden');
        
        // Hide other main content to focus on search without destroying modals
        document.querySelectorAll('.curated-section:not(#search-results-section), .hero').forEach(el => {
            el.style.display = 'none';
        });

        renderer.renderCuratedSection(query, 'search-results-grid', 20);
    } else if (document.getElementById('row-rainy')) {
        console.log('📚 Initializing Curated Discovery Sections...');
        const discoveryShelves = [
            { type: 'query', query: 'subject:mystery atmosphere', elementId: 'row-rainy' },
            { type: 'query', query: 'authors:arundhati roy|subject:india', elementId: 'row-indian' },
            { type: 'query', query: 'subject:classic fiction', elementId: 'row-classics' },
            {
                type: 'category',
                elementId: 'row-dark-academia',
                category: 'Dark Academia',
                vibeDescription: 'gothic, intellectual, melancholic, and candlelit stories set around obsession, old libraries, secret societies, and campus unease',
                fallbackQuery: 'subject:gothic fiction subject:campus'
            },
            { type: 'query', query: 'subject:fiction', elementId: 'row-fiction' }
        ];
        (async () => {
            try {
                for (const shelf of discoveryShelves) {
                    if (shelf.type === 'category') {
                        await renderer.renderMoodCategorySection(shelf, shelf.elementId);
                    } else {
                        await renderer.renderCuratedSection(shelf.query, shelf.elementId);
                    }
                    await delay(500);
                }
                console.log('✅ Discovery shelves populated.');
            } catch (err) {
                console.error('❌ Critical error during shelf initialization:', err);
            }
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
        const user = verifiedUser;
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

        const totalBooks = currentCount + wantCount + finishedCount;

        // Vibe/Genre calculation
        const allBooks = [
            ...(libManager.library.current || []),
            ...(libManager.library.want || []),
            ...(libManager.library.finished || [])
        ];
        
        const categoryCounts = {};
        allBooks.forEach(book => {
            const categories = book.volumeInfo?.categories || [];
            categories.forEach(cat => {
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            });
        });
        
        let topVibe = 'Mystery'; // Fallback
        if (Object.keys(categoryCounts).length > 0) {
            topVibe = Object.keys(categoryCounts).reduce((a, b) => categoryCounts[a] > categoryCounts[b] ? a : b);
        } else if (totalBooks === 0) {
            topVibe = '-';
        }

        const statTotalEl = document.getElementById('stat-total');
        const statWantDashEl = document.getElementById('stat-want-dash');
        const statVibeEl = document.getElementById('stat-vibe');
        
        if (statTotalEl) statTotalEl.textContent = totalBooks;
        if (statWantDashEl) statWantDashEl.textContent = wantCount;
        if (statVibeEl) statVibeEl.textContent = topVibe;

        // Progress Bar Calculation
        const barFinished = document.getElementById('bar-finished');
        const barCurrent = document.getElementById('bar-current');
        const barWant = document.getElementById('bar-want');
        
        const countFinishedEl = document.getElementById('count-finished');
        const countCurrentEl = document.getElementById('count-current');
        const countWantEl = document.getElementById('count-want');
        
        if (countFinishedEl) countFinishedEl.textContent = finishedCount;
        if (countCurrentEl) countCurrentEl.textContent = currentCount;
        if (countWantEl) countWantEl.textContent = wantCount;
        
        if (totalBooks > 0) {
            setTimeout(() => {
                if (barFinished) barFinished.style.width = `${(finishedCount / totalBooks) * 100}%`;
                if (barCurrent) barCurrent.style.width = `${(currentCount / totalBooks) * 100}%`;
                if (barWant) barWant.style.width = `${(wantCount / totalBooks) * 100}%`;
            }, 100);
        }

        // =====================================================================
        // READING PROGRESS OVERVIEW
        // Renders a progress card for each book currently being read.
        // =====================================================================
        const progressGrid = document.getElementById('progress-overview-grid');
        if (progressGrid) {
            const currentBooks = libManager.library.current || [];
            if (currentBooks.length === 0) {
                progressGrid.innerHTML = '<div class="empty-state"><p>No books currently in progress. <a href="library.html">Visit your library</a> to start reading.</p></div>';
            } else {
                progressGrid.innerHTML = '';
                currentBooks.forEach(book => {
                    const title = book.volumeInfo?.title || book.title || 'Untitled';
                    const author = (book.volumeInfo?.authors?.[0]) || book.author || 'Unknown Author';
                    const cover = book.volumeInfo?.imageLinks?.thumbnail || book.cover || '';
                    const progress = typeof book.progress === 'number' ? book.progress : 0;

                    const card = document.createElement('div');
                    card.className = 'progress-overview-card';
                    card.innerHTML = `
                        <div class="progress-card-cover">
                            ${cover ? `<img src="${cover.replace('http:', 'https:')}" alt="${title}" loading="lazy">` : '<i class="fa-solid fa-book"></i>'}
                        </div>
                        <div class="progress-card-info">
                            <div class="progress-card-title">${title}</div>
                            <div class="progress-card-author">${author}</div>
                            <div class="progress-card-bar-wrap">
                                <div class="progress-card-bar-track">
                                    <div class="progress-card-bar-fill" style="width:${progress}%"></div>
                                </div>
                                <span class="progress-card-pct">${progress}%</span>
                            </div>
                            <div class="progress-card-quick-update">
                                <input type="range" min="0" max="100" value="${progress}"
                                    class="progress-card-slider"
                                    aria-label="Update reading progress for ${title}">
                                <button class="progress-card-save-btn" data-book-id="${book.id}">
                                    <i class="fa-solid fa-floppy-disk"></i>
                                </button>
                            </div>
                        </div>
                    `;

                    // Wire up the quick-update slider
                    const slider = card.querySelector('.progress-card-slider');
                    const barFill = card.querySelector('.progress-card-bar-fill');
                    const pctLabel = card.querySelector('.progress-card-pct');
                    const saveBtn = card.querySelector('.progress-card-save-btn');

                    slider.addEventListener('input', () => {
                        const val = parseInt(slider.value);
                        barFill.style.width = `${val}%`;
                        pctLabel.textContent = `${val}%`;
                    });

                    saveBtn.addEventListener('click', async () => {
                        const newProgress = parseInt(slider.value);
                        saveBtn.disabled = true;
                        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                        try {
                            await libManager.updateBook(book.id, { progress: newProgress });
                            book.progress = newProgress;
                            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                            saveBtn.style.background = '#4caf50';
                            setTimeout(() => {
                                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
                                saveBtn.style.background = '';
                                saveBtn.disabled = false;
                            }, 2000);
                        } catch (err) {
                            saveBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
                            saveBtn.style.background = '#e53935';
                            setTimeout(() => {
                                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
                                saveBtn.style.background = '';
                                saveBtn.disabled = false;
                            }, 2000);
                        }
                    });

                    progressGrid.appendChild(card);
                });
            }
        }

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
    }


});

/**
 * ==============================================================================
 * SECURITY FIX: CSRF PROTECTION & SESSION MANAGEMENT
 * ==============================================================================
 * 
 * Issue:
 * ------
 * The auth form has no CSRF protection — it directly POSTs credentials to the API 
 * from the browser.
 * 
 * Why it matters:
 * ---------------
 * Without a CSRF token, a malicious third-party page could trick authenticated 
 * users into making authenticated requests. Also, isLoggedIn was previously stored 
 * as a plain string 'true' in localStorage, meaning any script could forge the 
 * login state by setting this key.
 * 
 * Fix:
 * ----
 * Move the authenticated session indicator to an HttpOnly cookie managed by the 
 * backend, and validate the JWT on every protected API call (which is already 
 * done server-side — the frontend just needs to stop relying on the localStorage 
 * flag for access control decisions).
 * ==============================================================================
 */
async function handleAuth(event) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]') || document.getElementById('submitBtn');
    const originalText = btn ? btn.innerHTML : (form.dataset.mode === 'register' ? 'Sign Up' : 'Sign In');

    // 1. Immediate UI Feedback: Disable button and show loading state
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
    }

    // Determine mode from dataset (set by our toggle logic) or default to login
    const mode = form.dataset.mode || 'login';

    const email = document.getElementById("email").value;
    const password = form.querySelector('input[type="password"]').value;
    const usernameInput = document.getElementById("username");

    // Helper to reset button state on failure
    const resetBtn = () => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    };

    // Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        if (typeof showToast === 'function') showToast("Enter a valid email address", "error");
        else alert("Enter a valid email address");
        resetBtn();
        return;
    }

    // Demo bypass logic
    if (email === 'demo@bibliodrift.com') {
        const demoUser = { id: 1, username: 'Demo User', email: 'demo@bibliodrift.com' };
        SafeStorage.set('bibliodrift_user', JSON.stringify(demoUser));
        SafeStorage.set('isLoggedIn', 'true');
        SafeStorage.set('bibliodrift_token', 'demo-token-12345');
        
        if (typeof showToast === 'function')
            showToast(`Welcome, Demo User!`, "success");

        // Keep button disabled during redirect delay
        setTimeout(() => {
            window.location.href = "library.html";
        }, 1000);
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

    // =========================================================================
    // SECURITY ENHANCEMENT: CSRF TOKEN INTEGRATION
    // =========================================================================
    // We retrieve the CSRF token from the hidden input field 'csrf_token'.
    // This token is then injected into the 'X-CSRF-Token' header. 
    // The Flask-WTF backend expects this header for all state-changing
    // AJAX requests. This protects against Cross-Site Request Forgery 
    // by ensuring that the request is authenticated via the browser's 
    // Same-Origin Policy and session-bound secrets.
    // =========================================================================
    const csrfToken = document.getElementById('csrf_token')?.value;

    try {
        const fetchOptions = {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        };

        // Inject CSRF token into headers if available
        if (csrfToken) {
            fetchOptions.headers['X-CSRF-Token'] = csrfToken;
        } else if (IS_DEV) {
            console.warn('[Security] No CSRF token found in DOM. Request may be rejected by server.');
        }

        const res = await fetch(`${MOOD_API_BASE}${endpoint.replace('/api/v1', '')}`, fetchOptions);

        const data = await res.json();

        if (res.ok) {
            // Success!
            // Token is now in an HttpOnly cookie (managed by backend)
            SafeStorage.set('bibliodrift_user', JSON.stringify(data.user));
            SafeStorage.set('isLoggedIn', 'true');

            if (typeof showToast === 'function')
                showToast(`${mode === 'login' ? 'Welcome back' : 'Welcome'}, ${data.user.username}!`, "success");

            // SYNC LOGIC
            if (window.libManager) {
                if (typeof showToast === 'function') showToast("Syncing your library...", "info");
                await window.libManager.syncLocalToBackend(data.user);
            }

            // Redirect - Button remains disabled
            setTimeout(() => {
                window.location.href = "library.html";
            }, 1000);
        } else {
            // Authentication failed - re-enable button
            if (typeof showToast === 'function') showToast(data.error || "Authentication failed", "error");
            else alert(data.error || "Authentication failed");
            resetBtn();
        }
    } catch (e) {
        console.error("Auth Error", e);
        if (typeof showToast === 'function') showToast("Server connection failed", "error");
        else alert("Server connection failed");
        resetBtn();
    }
}


function enableTapEffects() {
    if (!('ontouchstart' in window)) return;

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
const pageFlipSound = new Audio('../assets/sounds/page-flip.mp3');
pageFlipSound.preload = 'auto';
pageFlipSound.volume = 0.2;
pageFlipSound.muted = true;

document.addEventListener('click', () => {
    pageFlipSound.play().catch(() => {});
}, { once: true });


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
                this.navigateToNextBook();
                break;
            case 'navigatePrev':
                if (IS_DEV) {
                    console.log('Navigating to previous book...');
                }
                this.navigateToPreviousBook();
                break;
            case 'selectBook':
                if (IS_DEV) {
                    console.log('Selecting current book...');
                }
                this.selectCurrentBook();
                break;
            case 'addToWantRead':
                if (IS_DEV) {
                    console.log('Adding to Want to Read list...');
                }
                this.moveCurrentBookToShelf('want');
                break;
            case 'markCurrentlyReading':
                if (IS_DEV) {
                    console.log('Marking as Currently Reading...');
                }
                this.moveCurrentBookToShelf('current');
                break;
            case 'addToFavorites':
                if (IS_DEV) {
                    console.log('Adding to Favorites...');
                }
                this.moveCurrentBookToShelf('finished');
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
    },

    // Helper: Get all visible book spine elements
    getVisibleBooks() {
        return Array.from(document.querySelectorAll('.book-spine-3d'));
    },

    // Helper: Get current focused book index
    getFocusedBookIndex() {
        const books = this.getVisibleBooks();
        const focused = document.querySelector('.book-spine-3d.focused');
        if (focused) {
            return books.indexOf(focused);
        }
        return -1;
    },

    // Helper: Set focus on a book spine
    setBookFocus(bookElement) {
        // Remove previous focus
        document.querySelectorAll('.book-spine-3d.focused').forEach(el => {
            el.classList.remove('focused');
        });

        if (bookElement) {
            bookElement.classList.add('focused');
            bookElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

            // Get the book data from the element
            const bookId = bookElement.dataset.bookId;
            if (window.bookshelfRenderer && bookId) {
                const storage = window.libManager?.getLibrarySnapshot?.() || { current: [], want: [], finished: [] };
                for (const shelf of ['current', 'want', 'finished']) {
                    const book = storage[shelf].find(b => b.id === bookId);
                    if (book) {
                        window.bookshelfRenderer.currentBook = book.volumeInfo ? {
                            id: book.id,
                            title: book.volumeInfo.title || 'Untitled',
                            author: (book.volumeInfo.authors && book.volumeInfo.authors[0]) || 'Unknown',
                            cover: book.volumeInfo.imageLinks?.thumbnail || '',
                            description: book.volumeInfo.description || '',
                            rating: book.volumeInfo.averageRating || 0,
                            ratingCount: book.volumeInfo.ratingsCount || 0,
                            categories: book.volumeInfo.categories || [],
                            moods: book.moods || [],
                            reviews: []
                        } : book;
                        break;
                    }
                }
            }
        }
    },

    // Navigate to next book
    navigateToNextBook() {
        const books = this.getVisibleBooks();
        if (books.length === 0) {
            showToast('No books to navigate', 'info');
            return;
        }

        let currentIndex = this.getFocusedBookIndex();
        let nextIndex = (currentIndex + 1) % books.length;

        this.setBookFocus(books[nextIndex]);
    },

    // Navigate to previous book
    navigateToPreviousBook() {
        const books = this.getVisibleBooks();
        if (books.length === 0) {
            showToast('No books to navigate', 'info');
            return;
        }

        let currentIndex = this.getFocusedBookIndex();
        let prevIndex = currentIndex <= 0 ? books.length - 1 : currentIndex - 1;

        this.setBookFocus(books[prevIndex]);
    },

    // Select/open the current book
    selectCurrentBook() {
        if (window.bookshelfRenderer && window.bookshelfRenderer.currentBook) {
            window.bookshelfRenderer.openModal(window.bookshelfRenderer.currentBook);
            showToast('Opening book details', 'info');
        } else {
            showToast('No book selected', 'info');
        }
    },

    // Move current book to a specific shelf
    moveCurrentBookToShelf(targetShelf) {
        if (!window.bookshelfRenderer || !window.bookshelfRenderer.currentBook) {
            showToast('No book selected', 'info');
            return;
        }

        const currentBook = window.bookshelfRenderer.currentBook;
        const storage = window.libManager?.getLibrarySnapshot?.() || { current: [], want: [], finished: [] };

        // Find current shelf
        let currentShelf = null;
        for (const shelf of ['current', 'want', 'finished']) {
            const found = storage[shelf].find(b => b.id === currentBook.id);
            if (found) {
                currentShelf = shelf;
                break;
            }
        }

        if (!currentShelf) {
            showToast('Book not found in library', 'error');
            return;
        }

        if (currentShelf === targetShelf) {
            showToast('Book is already on that shelf', 'info');
            return;
        }

        // Move the book
        window.bookshelfRenderer.moveBook(currentBook.id, currentShelf, targetShelf);

        // Show appropriate feedback
        const shelfNames = {
            'current': 'Currently Immersed',
            'want': 'Anticipated Journeys',
            'finished': 'Lifetime Favorites'
        };

        showToast(`Moved to ${shelfNames[targetShelf]}`, 'success');
    }
};

// Initialize keyboard shortcuts when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => KeyboardShortcuts.init());
} else {
    KeyboardShortcuts.init();
}
// Register Service Worker for offline asset caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('BiblioDrift Service Worker registered successfully!', reg))
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}
// --- Connection Management & Offline Fallback Fallback Hooks ---

// Function to automatically track network status changes
function handleConnectivityChange() {
    const offlineIndicator = document.getElementById('offline-indicator');
    
    if (!navigator.onLine) {
        console.warn("🌐 Connection dropped. Switching to local sanctuary archives...");
        
        // Show an elegant banner to let the user know they are reading offline
        if (offlineIndicator) {
            offlineIndicator.style.display = 'block';
        }
        
        // Fall back to loading cached books from IndexedDB
        triggerOfflineLibraryView();
    } else {
        console.log("🌐 Connection restored! Connected back to the live backend cloud server.");
        if (offlineIndicator) {
            offlineIndicator.style.display = 'none';
        }
        
        // Reload live API content if the user comes back online
        if (typeof loadDiscoverBooks === 'function') {
            loadDiscoverBooks();
        }
    }
}

// Fallback logic to retrieve data from Dexie when offline
async function triggerOfflineLibraryView() {
    // Look up the database instance initialized on the global window context
    if (!window.db) {
        console.error("Database layer is missing from window.db context.");
        return;
    }

    try {
        const savedBooks = await window.db.books.toArray();
        // Target your bookshelf or matching layout grid element from the page markup
        const libraryContainer = document.getElementById('search-results-grid') || document.querySelector('.bookshelf');
        
        if (!libraryContainer) return;

        if (savedBooks.length === 0) {
            // Friendly empty state UI explaining how to save books
            libraryContainer.innerHTML = `
                <div class="offline-empty-state" style="grid-column: 1/-1; text-align: center; color: #a0a0a0; padding: 3rem 1rem;">
                    <p style="font-size: 1.5rem; margin-bottom: 0.5rem;">✨ You are wandering offline</p>
                    <p style="font-size: 1rem; opacity: 0.8;">No cached books found on your shelf. Save books while online to read them anywhere.</p>
                </div>`;
        } else {
            libraryContainer.innerHTML = ""; // Wipe standard layout containers
            
            // Render cached items back onto the UI shelf
            savedBooks.forEach(book => {
                const bookCard = document.createElement('div');
                bookCard.className = 'book-card offline-card';
                bookCard.innerHTML = `
                    <div class="book-cover-wrapper">
                        <img src="${book.coverUrl || '../assets/images/default-cover.png'}" alt="${book.title}" class="book-cover-img" />
                    </div>
                    <div class="book-details">
                        <h3>${book.title}</h3>
                        <p class="author-tag">By ${book.author}</p>
                        <p class="offline-summary">${book.content}</p>
                        <span class="offline-badge" style="background: #2c3e50; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">Saved Offline</span>
                    </div>
                `;
                libraryContainer.appendChild(bookCard);
            });
        }
    } catch (error) {
        console.error("Failed to load local offline assets:", error);
    }
}

// Attach network listeners directly to the window lifecycle
window.addEventListener('online', handleConnectivityChange);
window.addEventListener('offline', handleConnectivityChange);

// Run a status check right away on startup in case the user loads the app while already disconnected
document.addEventListener('DOMContentLoaded', handleConnectivityChange);