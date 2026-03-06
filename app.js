/**
 * Library Application Core Logic
 * - Implements SafeStorage for QuotaExceededError handling
 * - Implements ThemeManager with persistence
 * - Implements DiscoveryManager for Infinite Scroll
 */

// --- UTILITIES ---
function showToast(message, type = "info") {
    console.log(`[Toast ${type.toUpperCase()}]: ${message}`);
    // In a full implementation, this would trigger a UI notification component
}

const SafeStorage = {
    set(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            const isQuotaError = 
                error instanceof DOMException && (
                error.code === 22 || 
                error.code === 1014 || 
                error.name === 'QuotaExceededError' || 
                error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

            if (isQuotaError) {
                showToast("Local storage full! Please sync to cloud and clear cache.", "error");
            }
            return false;
        }
    },
    get(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }
};

// --- THEME MANAGER ---
class ThemeManager {
    constructor() {
        this.theme = SafeStorage.get('ui_theme') || 'light';
        this.toggleBtn = document.getElementById('themeToggle');
        this.init();
    }

    init() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggleTheme());
        }
        this.applyTheme();
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        if (SafeStorage.set('ui_theme', this.theme)) {
            this.applyTheme();
        }
    }

    applyTheme() {
        // Toggle class on body for CSS targeting
        document.body.classList.remove('light', 'dark');
        document.body.classList.add(this.theme);
        
        // Update Icon
        if (this.toggleBtn) {
            const icon = this.toggleBtn.querySelector('i');
            if (this.theme === 'dark') {
                icon.className = 'fa-solid fa-sun';
            } else {
                icon.className = 'fa-solid fa-moon';
            }
        }
        console.log(`Theme switched to: ${this.theme}`);
    }
}

// --- DISCOVERY & INFINITE SCROLL ---
class DiscoveryManager {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.resultsGrid = document.getElementById('search-results-grid');
        this.resultsSection = document.getElementById('search-results-section');
        this.landingContent = document.getElementById('landing-content');
        this.sentinel = document.getElementById('infinite-scroll-sentinel');
        this.queryDisplay = document.getElementById('search-query-display');

        this.currentQuery = "";
        this.startIndex = 0;
        this.isLoading = false;
        this.hasMore = true;

        this.init();
    }

    init() {
        if (this.searchInput) {
            this.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.startNewSearch(e.target.value);
            });
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !this.isLoading && this.hasMore && this.currentQuery) {
                this.fetchBooks();
            }
        }, { threshold: 0.1, rootMargin: '100px' });

        if (this.sentinel) observer.observe(this.sentinel);
    }

    startNewSearch(query) {
        if (!query.trim()) return;
        this.currentQuery = query;
        this.startIndex = 0;
        this.hasMore = true;
        this.resultsGrid.innerHTML = "";
        
        // UI State Switch
        this.landingContent.style.display = 'none';
        this.resultsSection.style.display = 'block';
        this.queryDisplay.innerText = `Search Results for "${query}"`;
        
        this.fetchBooks();
    }

    async fetchBooks() {
        if (this.isLoading) return;
        this.isLoading = true;
        this.sentinel.classList.add('active');

        try {
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(this.currentQuery)}&startIndex=${this.startIndex}&maxResults=20`);
            const data = await res.json();

            if (data.items && data.items.length > 0) {
                this.renderBooks(data.items);
                this.startIndex += 20;
            } else {
                this.hasMore = false;
            }
        } catch (err) {
            showToast("Error fetching books", "error");
        } finally {
            this.isLoading = false;
            this.sentinel.classList.remove('active');
        }
    }

    renderBooks(books) {
        books.forEach(book => {
            const volume = book.volumeInfo;
            const img = volume.imageLinks?.thumbnail || 'https://via.placeholder.com/128x192?text=No+Cover';
            
            // Simplified 3D book structure based on index.html design
            const card = document.createElement('div');
            card.className = 'book-scene';
            card.innerHTML = `
                <div class="book">
                    <div class="book__face book__face--front">
                        <img src="${img}" alt="Cover">
                    </div>
                    <div class="book__face book__face--spine"></div>
                    <div class="book__face book__face--back">
                        <div class="handwritten-note">${volume.title}</div>
                    </div>
                </div>
            `;
            this.resultsGrid.appendChild(card);
        });
    }
}

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    new ThemeManager();
    new DiscoveryManager();
});
