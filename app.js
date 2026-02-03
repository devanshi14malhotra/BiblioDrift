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

