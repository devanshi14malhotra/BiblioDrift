/**
 * BiblioDrift Core Logic
 * Handles 3D rendering, API fetching, Persistent Auth, and Genre Browsing.
 */

const API_BASE = 'https://www.googleapis.com/books/v1/volumes';
const MOOD_API_BASE = 'http://localhost:5000/api/v1';

const MOCK_BOOKS = [
    {
        id: "mock1",
        volumeInfo: {
            title: "The Midnight Library",
            authors: ["Matt Haig"],
            description: "Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived.",
            imageLinks: { thumbnail: "https://books.google.com/books/content?id=4OVQAQAAMAAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api" }
        }
    },
    {
        id: "mock2",
        volumeInfo: {
            title: "The Night Circus",
            authors: ["Erin Morgenstern"],
            description: "The circus arrives without warning. No announcements precede it. It is simply there, when yesterday it was not.",
            imageLinks: { thumbnail: "https://books.google.com/books/content?id=4nEOXAOMwDAC&printsec=frontcover&img=1&zoom=1&source=gbs_api" }
        }
    },
    {
        id: "mock3",
        volumeInfo: {
            title: "Piranesi",
            authors: ["Susanna Clarke"],
            description: "Piranesi's house is no ordinary building: its rooms are infinite, its corridors endless, its walls are lined with thousands upon thousands of statues.",
            imageLinks: { thumbnail: "https://books.google.com/books/content?id=h3fdDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api" }
        }
    },
    {
        id: "mock4",
        volumeInfo: {
            title: "The Starless Sea",
            authors: ["Erin Morgenstern"],
            description: "Zachary Ezra Rawlins is a graduate student in Vermont when he discovers a mysterious book hidden in the stacks.",
            imageLinks: { thumbnail: "https://books.google.com/books/content?id=1aWPDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api" }
        }
    },
    {
        id: "mock5",
        volumeInfo: {
            title: "Kafka on the Shore",
            authors: ["Haruki Murakami"],
            description: "Kafka on the Shore is powered by two remarkable characters: a teenage boy, Kafka Tamura, who runs away from home...",
            imageLinks: { thumbnail: "https://books.google.com/books/content?id=d_wPAQAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api" }
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

        const vibe = this.generateVibe(description);
        const spineColors = ['#5D4037', '#4E342E', '#3E2723', '#2C2420', '#8D6E63'];
        const randomSpine = spineColors[Math.floor(Math.random() * spineColors.length)];

        const scene = document.createElement('div');
        scene.className = 'book-scene';

        scene.innerHTML = `
            <div class="book" data-id="${id}">
                <div class="book__face book__face--front">
                    <img src="${thumb.replace('http:', 'https:')}" alt="${title}">
                </div>
                <div class="book__face book__face--spine" style="background: ${randomSpine}"></div>
                <div class="book__face book_face--right"></div>
                <div class="book__face book__face--back">
                    <div>
                        <div style="font-weight: bold; font-size: 0.9rem; margin-bottom: 0.5rem;">${title}</div>
                        <div class="handwritten-note">Bookseller's Note: "${vibe}"</div>
                    </div>
                    ${shelf === 'current' ? `
                    <div class="reading-progress">
                        <input type="range" min="0" max="100" value="${progress}" class="progress-slider" />
                        <small>${progress}% read</small>
                    </div>` : ''}
                    <div class="book-actions">
                        <button class="btn-icon add-btn" title="Add to Library"><i class="fa-regular fa-heart"></i></button>
                        <button class="btn-icon info-btn" title="Read Details"><i class="fa-solid fa-info"></i></button>
                        <button class="btn-icon" title="Flip Back" onclick="event.stopPropagation(); this.closest('.book').classList.remove('flipped')"><i class="fa-solid fa-rotate-left"></i></button>
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

        return scene;
    }

    generateVibe(text) {
        const vibes = ["Perfect for a rainy afternoon.", "A quiet companion for coffee.", "Heartwarming and gentle.", "Intense and thought-provoking."];
        return vibes[Math.floor(Math.random() * vibes.length)];
    }

    openModal(book) {
        const modal = document.getElementById('book-details-modal');
        if (!modal) return;
        
        document.getElementById('modal-img').src = book.volumeInfo.imageLinks?.thumbnail.replace('http:', 'https:') || '';
        document.getElementById('modal-title').textContent = book.volumeInfo.title;
        document.getElementById('modal-author').textContent = book.volumeInfo.authors?.join(", ") || "Unknown Author";
        document.getElementById('modal-summary').textContent = book.volumeInfo.description || "No description available.";
        
        modal.showModal();
        document.getElementById('closeModalBtn').onclick = () => modal.close();
    }

    async renderCuratedSection(query, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;
        try {
            const res = await fetch(`${API_BASE}?q=${query}&maxResults=5&printType=books`);

            let items = [];
            if (res.ok) {
                const data = await res.json();
                items = data.items || [];
            } else {
                console.warn(`API Error ${res.status}: Using mock data`);
                items = MOCK_BOOKS;
            }

            // Fallback if items is empty (e.g. 429 quota or no results)
            if (!items || items.length === 0) {
                items = MOCK_BOOKS;
            }

            container.innerHTML = '';
            for (const book of items) {
                const bookElement = await this.createBookElement(book);
                container.appendChild(bookElement);
            }

        } catch (err) {
            console.error("Failed to fetch books, using mock data", err);
            container.innerHTML = '';
            for (const book of MOCK_BOOKS) {
                const bookElement = await this.createBookElement(book);
                container.appendChild(bookElement);
            }
        }
    }
}

class LibraryManager {
    constructor() {
        this.storageKey = 'bibliodrift_library';
        this.library = JSON.parse(localStorage.getItem(this.storageKey)) || {
            current: [],
            want: [],
            finished: []
        };
        this.apiBase = 'http://localhost:5000/api/v1';

        // Sync API if user is logged in
        this.syncWithBackend();
    }

    getUser() {
        const userStr = localStorage.getItem('bibliodrift_user');
        return userStr ? JSON.parse(userStr) : null;
    }

    async syncWithBackend() {
        const user = this.getUser();
        if (!user) return;

        try {
            const res = await fetch(`${this.apiBase}/library/${user.id}`);
            if (res.ok) {
                const data = await res.json();
                // Merge backend data into local structures for rendering
                // Note: To be robust, this should handle duplicates, but for MVP we'll just parse
                // the backend items into shelves
                const backendLibrary = { current: [], want: [], finished: [] };

                data.library.forEach(item => {
                    // Reconstruct book object structure expected by renderer
                    const book = {
                        id: item.google_books_id,
                        db_id: item.id, // Database ID for updates/deletes
                        volumeInfo: {
                            title: item.title,
                            authors: item.authors ? item.authors.split(', ') : [],
                            imageLinks: { thumbnail: item.thumbnail }
                        },
                        // Default progress if not stored in DB yet, or add column later
                    };

                    if (backendLibrary[item.shelf_type]) {
                        backendLibrary[item.shelf_type].push(book);
                    }
                });

                // Update local library state (simple override for now to ensure consistency)
                // In a real app we might merge local+remote
                if (data.library.length > 0) {
                    this.library = backendLibrary;
                    this.saveLocally();
                    // If we are on library page, trigger re-render
                    if (document.getElementById('shelf-want')) {
                        // Prevent infinite reload loop by only reloading once per session
                        const hasSyncedOnce = sessionStorage.getItem('bibliodrift_synced_once');
                        if (!hasSyncedOnce) {
                            sessionStorage.setItem('bibliodrift_synced_once', 'true');
                            window.location.reload();
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Sync failed", e);
        }
    }

    async addBook(book, shelf) {
        if (this.findBook(book.id)) return;

        const enrichedBook = {
            ...book,
            progress: shelf === 'current' ? 0 : null
        };

        // 1. Update Local State
        this.library[shelf].push(enrichedBook);
        this.saveLocally();
        console.log(`Added ${book.volumeInfo.title} to ${shelf}`);

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
                    headers: { 'Content-Type': 'application/json' },
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
            }
        }
    }


    findBook(id) {
        for (const shelf in this.library) {
            if (this.library[shelf].some(b => b.id === id)) return true;
        }
        return false;
    }

    removeBook(id) {
        for (const shelf in this.library) {
            this.library[shelf] = this.library[shelf].filter(b => b.id !== id);
        }
        this.save();
    }

    findBook(id) {
        return Object.values(this.library).some(shelf => shelf.some(b => b.id === id));
    }

    saveLocally() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.library));
    }

    async renderShelf(shelfName, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;
        const books = this.library[shelfName];
        if (books.length > 0) container.innerHTML = '';
        const renderer = new BookRenderer(this);
        for (const book of books) {
            container.appendChild(await renderer.createBookElement(book, shelfName));
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
            const response = await fetch(`${API_BASE}?q=subject:${genre}&maxResults=20&langRestrict=en&orderBy=relevance`);

            let items = [];
            if (response.ok) {
                const data = await response.json();
                items = data.items || [];
            } else {
                console.warn(`API Error ${response.status}: Using mock data`);
                items = MOCK_BOOKS;
            }

            if (items && items.length > 0) {
                this.renderBooks(items);
            } else {
                // Fallback to mock if no items
                this.renderBooks(MOCK_BOOKS);
            }
        } catch (error) {
            console.error('Error fetching genre books, using mock:', error);
            this.renderBooks(MOCK_BOOKS);
        }
    }

    renderBooks(books) {
        this.booksGrid.innerHTML = '';

        books.forEach(book => {
            const info = book.volumeInfo;
            const title = info.title || 'Untitled';
            const author = info.authors ? info.authors[0] : 'Unknown';
            const thumbnail = info.imageLinks ?
                (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail) :
                'https://via.placeholder.com/128x196?text=No+Cover';

            const card = document.createElement('div');
            card.className = 'genre-book-card';
            card.innerHTML = `
                <img src="${thumbnail}" alt="${title}" loading="lazy">
                <div class="genre-book-info">
                    <h4>${title}</h4>
                    <p>${author}</p>
                </div>
            `;

            // Add click listener to open detailed view (using existing renderer logic if possible, or just mock it)
            // For now, let's just use the existing BookRenderer's modal if accessible, 
            // or just simple log. The user asked for "modal should open up with some books". 
            // The books themselves inside the modal don't necessarily need to open *another* modal, 
            // but it would be nice.

            this.booksGrid.appendChild(card);
        });
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    const libManager = new LibraryManager();
    const renderer = new BookRenderer(libManager);
    const themeManager = new ThemeManager();
    const exportBtn = document.getElementById("export-library");

    if (exportBtn) {
        const isLibraryPage = document.getElementById("shelf-want");
        exportBtn.style.display = isLibraryPage ? "inline-flex" : "none";
    }



    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const authLink = document.getElementById('navAuthLink');
    if (isLoggedIn && authLink) {
        authLink.innerHTML = '<i class="fa-solid fa-user"></i>';
        authLink.href = 'profile.html';
        const tooltip = document.getElementById('navAuthTooltip');
        if (tooltip) tooltip.innerHTML = '<i class="fa-solid fa-id-card"></i> Profile';
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchInput.value.trim()) {
                window.location.href = `index.html?q=${encodeURIComponent(searchInput.value.trim())}`;
            }
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');

    if (query && document.getElementById('row-rainy')) {
        document.querySelector('main').innerHTML = `
            <section class="hero"><h1>Results for "${query}"</h1></section>
            <section class="curated-section"><div class="curated-row" id="search-results"></div></section>`;
        renderer.renderCuratedSection(query, 'search-results');
    } else if (document.getElementById('row-rainy')) {
        renderer.renderCuratedSection('subject:mystery+atmosphere', 'row-rainy');
        renderer.renderCuratedSection('subject:india+fiction', 'row-indian');
        renderer.renderCuratedSection('subject:classic', 'row-classics');
    }

    if (document.getElementById('shelf-want')) {
        libManager.renderShelf('want', 'shelf-want');
        libManager.renderShelf('current', 'shelf-current');
        libManager.renderShelf('finished', 'shelf-finished');
    }

    const genreGrid = document.getElementById('genre-grid');
    const genreModal = document.getElementById('genre-modal');
    if (genreGrid && genreModal) {
        genreGrid.addEventListener('click', async (e) => {
            const card = e.target.closest('.genre-card');
            if (card) {
                const genre = card.dataset.genre;
                document.getElementById('genre-modal-title').textContent = genre.charAt(0).toUpperCase() + genre.slice(1);
                genreModal.showModal();
                const grid = document.getElementById('genre-books-grid');
                grid.innerHTML = '<p>Loading stories...</p>';
                
                // Fetch books for genre
                const res = await fetch(`${API_BASE}?q=subject:${genre}&maxResults=8`);
                const data = await res.json();
                grid.innerHTML = '';
                if (data.items) {
                    for (const book of data.items) {
                        grid.appendChild(await renderer.createBookElement(book));
                    }
                }
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

// Export Library as JSON
const exportBtn = document.getElementById("export-library");

if (exportBtn) {
    exportBtn.addEventListener("click", () => {
        const library = localStorage.getItem("bibliodrift_library");
        if (!library) {
            alert("Your library is empty!");
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
        alert("Library exported successfully!");
    });
}

function handleAuth(event) {
    event.preventDefault();

    const email = document.getElementById("email").value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        alert("Enter a valid email address");
        return;
    }

    window.location.href = "library.html";
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

    console.log("BOOK CLICK");

    const book = scene.querySelector(".book");
    const overlay = scene.querySelector(".glass-overlay");

    pageFlipSound.muted = false;

    pageFlipSound.pause();
    pageFlipSound.currentTime = 0;
    pageFlipSound.play().catch(err => console.log("PLAY ERROR", err));

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
    console.log('Keyboard shortcuts module initialized');
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
        console.log('Navigating to next book...');
        // TODO: Implement next book navigation
        break;
      case 'navigatePrev':
        console.log('Navigating to previous book...');
        // TODO: Implement previous book navigation
        break;
      case 'selectBook':
        console.log('Selecting current book...');
        // TODO: Implement book selection
        break;
      case 'addToWantRead':
        console.log('Adding to Want to Read list...');
        // TODO: Implement add to want read
        break;
      case 'markCurrentlyReading':
        console.log('Marking as Currently Reading...');
        // TODO: Implement mark as reading
        break;
      case 'addToFavorites':
        console.log('Adding to Favorites...');
        // TODO: Implement add to favorites
        break;
      case 'closeModal':
        console.log('Closing modal...');
        const modals = document.querySelectorAll('.modal, [role="dialog"]');
        modals.forEach(modal => modal.style.display = 'none');
        break;
      case 'showHelpMenu':
        console.log('Showing help menu...');
        this.displayHelpMenu();
        break;
      case 'focusSearch':
        console.log('Focusing search bar...');
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

