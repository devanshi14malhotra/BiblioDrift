/**
 * BiblioDrift Core Logic
 * Handles 3D rendering, API fetching, and LocalStorage management.
 */

const API_BASE = 'https://www.googleapis.com/books/v1/volumes';

class BookRenderer {
    constructor() {
        this.libraryManager = new LibraryManager();
    }


    createBookElement(bookData) {
        const { id, volumeInfo } = bookData;
        const title = volumeInfo.title || "Untitled";
        const authors = volumeInfo.authors ? volumeInfo.authors.join(", ") : "Unknown Author";
        const thumb = volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : 'https://via.placeholder.com/128x196?text=No+Cover';
        const description = volumeInfo.description ? volumeInfo.description.substring(0, 100) + "..." : "A mysterious tome waiting to be opened.";

        // Randomize spine color slightly for variety
        const spineColors = ['#5D4037', '#4E342E', '#3E2723', '#2C2420', '#8D6E63'];
        const randomSpine = spineColors[Math.floor(Math.random() * spineColors.length)];

        // Create Container
        const scene = document.createElement('div');
        scene.className = 'book-scene';

        // Structure
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
                        <div class="handwritten-note">
                            Bookseller's Note: "${this.generateVibe(description)}"
                        </div>
                    </div>
                    <div class="book-actions">
                        <button class="btn-icon add-btn" title="Add to Library"><i class="fa-regular fa-heart"></i></button>
                        <button class="btn-icon info-btn" title="Read Details"><i class="fa-solid fa-info"></i></button>
                        <button class="btn-icon" title="Flip Back" onclick="event.stopPropagation(); this.closest('.book').classList.remove('flipped')"><i class="fa-solid fa-rotate-left"></i></button>
                    </div>
                </div>
            </div>
            <div class="glass-overlay">
                <strong>${title}</strong><br>
                <small>${authors}</small>
            </div>
        `;

        // Interaction: Flip
        const bookEl = scene.querySelector('.book');
        scene.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-icon')) {
                bookEl.classList.toggle('flipped');
            }
        });

        // Interaction: Add to Library
        const addBtn = scene.querySelector('.add-btn');
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.libraryManager.addBook(bookData, 'want'); // Default to "Want to Read"
            addBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => addBtn.innerHTML = '<i class="fa-solid fa-heart"></i>', 2000);
        });

        // Interaction: Open Details Modal
        const infoBtn = scene.querySelector('.info-btn');
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openModal(bookData);
        });

        return scene;
    }

    generateVibe(text) {
        // Simple heuristic to mock "AI" vibes
        const vibes = [
            "Perfect for a rainy afternoon.",
            "Smells like old paper and adventure.",
            "A quiet companion for coffee.",
            "Heartwarming and gentle.",
            "Will make you travel without moving."
        ];
        return vibes[Math.floor(Math.random() * vibes.length)];
    }

    generateMockAISummary(book) {
        const title = book.volumeInfo.title;
        const genres = book.volumeInfo.categories || ["General Fiction"];
        const mainGenre = genres[0];
        
        // Templates for "AI" generation
        const templates = [
            `This story explores the nuances of human connection through the lens of ${mainGenre}. Readers often find themselves reflecting on their own journeys after finishing "${title}".Expect a narrative that is both grounding and transcendent.`,
            `A defining work in ${mainGenre} that asks difficult questions without providing easy answers. "${title}" is best enjoyed in a single sitting, preferably with a hot beverage. The pacing is deliberate, allowing the atmosphere to settle around you.`,
            `If you appreciate lyrical prose and character-driven plots, this is a must-read. The themes of "${title}" resonate long after the final page is turned. A beautiful examination of what it means to be alive.`,
            `An intellectual puzzle wrapped in an emotional narrative. "${title}" challenges conventions of ${mainGenre} while paying homage to its roots. Prepare for a twist that recontextualizes the entire opening chapter.`
        ];

        return templates[Math.floor(Math.random() * templates.length)];
    }

    openModal(book) {
        const modal = document.getElementById('book-details-modal');
        const img = document.getElementById('modal-img');
        const title = document.getElementById('modal-title');
        const author = document.getElementById('modal-author');
        const summary = document.getElementById('modal-summary');
        const addBtn = document.getElementById('modal-add-btn');
        const closeBtn = document.getElementById('closeModalBtn');

        if (!modal) return;

        // Populate Data
        const volume = book.volumeInfo;
        title.textContent = volume.title;
        author.textContent = volume.authors ? volume.authors.join(", ") : "Unknown Author";
        img.src = volume.imageLinks ? volume.imageLinks.thumbnail.replace('http:', 'https:') : 'https://via.placeholder.com/300x450?text=No+Cover';
        
        // Mock AI Generation Effect
        summary.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing narrative structure...';
        
        setTimeout(() => {
            summary.textContent = this.generateMockAISummary(book);
        }, 800);

        // Handle Add Button inside Modal
        // Clone to remove old listeners
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
        
        newAddBtn.addEventListener('click', () => {
            this.libraryManager.addBook(book, 'want');
            newAddBtn.innerHTML = '<i class="fa-solid fa-check"></i> Added';
            setTimeout(() => newAddBtn.innerHTML = '<i class="fa-regular fa-heart"></i> Add to Library', 2000);
        });

        // Show Modal
        modal.showModal();

        // Close Handlers
        const closeHandler = () => modal.close();
        closeBtn.onclick = closeHandler;
        
        // Close on backdrop click
        modal.onclick = (e) => {
            if (e.target === modal) modal.close();
        };
    }

    async renderCuratedSection(query, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return; // Not on page

        try {
            const res = await fetch(`${API_BASE}?q=${query}&maxResults=5&printType=books`);
            const data = await res.json();

            if (data.items) {
                container.innerHTML = '';
                data.items.forEach(book => {
                    container.appendChild(this.createBookElement(book));
                });
            }
        } catch (err) {
            console.error("Failed to fetch books", err);
            container.innerHTML = '<p>The shelves are dusty... (API Error)</p>';
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
    }

    addBook(book, shelf) {
        // Check duplicates
        if (this.findBook(book.id)) return;

        this.library[shelf].push(book);
        this.save();
        console.log(`Added ${book.volumeInfo.title} to ${shelf}`);
    }

    findBook(id) {
        for (const shelf in this.library) {
            if (this.library[shelf].some(b => b.id === id)) return true;
        }
        return false;
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.library));
    }

    renderShelf(shelfName, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;

        const books = this.library[shelfName];
        if (books.length === 0) return; // Keep empty state if empty

        // Clear empty state text if we have books
        // But keep the shelf label which is typically a sibling or parent logic, 
        // In my HTML: span.shelf-label is sibling. container contains books.

        // Remove "empty state" div if exists
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        books.forEach(book => {
            const renderer = new BookRenderer();
            const el = renderer.createBookElement(book);
            // On shelves, we might want interaction to be "Move" or "Remove", 
            // but for MVP reuse the same card.
            container.appendChild(el);
        });
    }
}

class ThemeManager {
    constructor() {
        this.themeKey = 'bibliodrift_theme';
        this.toggleBtn = document.getElementById('themeToggle');
        this.currentTheme = localStorage.getItem(this.themeKey) || 'day';
        
        this.init();
    }

    init() {
        if (!this.toggleBtn) return;
        
        this.applyTheme(this.currentTheme);
        
        this.toggleBtn.addEventListener('click', () => {
            this.currentTheme = this.currentTheme === 'day' ? 'night' : 'day';
            this.applyTheme(this.currentTheme);
            localStorage.setItem(this.themeKey, this.currentTheme);
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

// Init
document.addEventListener('DOMContentLoaded', () => {
    const renderer = new BookRenderer();
    const libManager = new LibraryManager();
    const themeManager = new ThemeManager();

    // Search Handler
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    window.location.href = `index.html?q=${encodeURIComponent(query)}`;
                }
            }
        });
    }

    // Check URL Params for Search
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');

    if (searchQuery && document.getElementById('row-rainy')) {
        // We are on Discovery page and have a query
        document.querySelector('main').innerHTML = `
            <section class="hero" style="padding: 2rem 0;">
                <h1>Results for "${searchQuery}"</h1>
            </section>
            <section class="curated-section">
                <div class="curated-row" id="search-results" style="flex-wrap: wrap;"></div>
            </section>
        `;
        renderer.renderCuratedSection(searchQuery, 'search-results');
        if (searchInput) searchInput.value = searchQuery;
        return; // Stop default rendering
    }

    // Check if Home (Default)
    if (document.getElementById('row-rainy')) {
        renderer.renderCuratedSection('subject:mystery+atmosphere', 'row-rainy');
        renderer.renderCuratedSection('authors:amitav+ghosh|authors:arundhati+roy|subject:india', 'row-indian');
        renderer.renderCuratedSection('subject:classic+fiction', 'row-classics');
    }

    // Check if Library
    if (document.getElementById('shelf-want')) {
        libManager.renderShelf('want', 'shelf-want');
        libManager.renderShelf('current', 'shelf-current');
        libManager.renderShelf('finished', 'shelf-finished');
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
