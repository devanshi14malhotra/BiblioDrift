/**
 * BiblioDrift Core Logic
 * Handles 3D rendering, API fetching, Persistent Auth, and Genre Browsing.
 */

const API_BASE = 'https://www.googleapis.com/books/v1/volumes';

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
            const res = await fetch(`${API_BASE}?q=${query}&maxResults=6`);
            const data = await res.json();
            if (data.items) {
                container.innerHTML = '';
                for (const book of data.items) {
                    container.appendChild(await this.createBookElement(book));
                }
            }
        } catch (err) {
            container.innerHTML = '<p>The shelves are dusty... (API Error)</p>';
        }
    }
}

class LibraryManager {
    constructor() {
        this.storageKey = 'bibliodrift_library';
        this.library = JSON.parse(localStorage.getItem(this.storageKey)) || { current: [], want: [], finished: [] };
    }

    addBook(book, shelf) {
        if (this.findBook(book.id)) return;
        this.library[shelf].push(book);
        this.save();
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

// Initialization Logic
document.addEventListener('DOMContentLoaded', () => {
    const libManager = new LibraryManager();
    const renderer = new BookRenderer(libManager);

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
        document.getElementById('close-genre-modal').onclick = () => genreModal.close();
    }
});
