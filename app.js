/**
 * BiblioDrift Core Logic with GoodReads Mood Analysis
 * Handles 3D rendering, API fetching, mood analysis, and LocalStorage management.
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
        // this.moodAnalyzer = new MoodAnalyzer();
    }

    async createBookElement(bookData, shelf = null) {
        const { id, volumeInfo } = bookData;
        const progress = typeof bookData.progress === 'number' ? bookData.progress : 0;
        const title = volumeInfo.title || "Untitled";
        const authors = volumeInfo.authors ? volumeInfo.authors.join(", ") : "Unknown Author";
        const thumb = volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : 'https://via.placeholder.com/128x196?text=No+Cover';
        const description = volumeInfo.description ? volumeInfo.description.substring(0, 100) + "..." : "A mysterious tome waiting to be opened.";


        // Try to get mood analysis for this book
        let vibe = this.generateVibe(description);
        let moodTags = [];


        // Randomize spine color slightly for variety
        const spineColors = ['#5D4037', '#4E342E', '#3E2723', '#2C2420', '#8D6E63'];
        const randomSpine = spineColors[Math.floor(Math.random() * spineColors.length)];


        // Create Container
        const scene = document.createElement('div');
        scene.className = 'book-scene';


        // Generate mood tags HTML
        const moodTagsHTML = moodTags.length > 0
            ? `<div class="mood-tags">${moodTags.slice(0, 2).map(tag => `<span class="mood-tag mood-${tag.mood}">${tag.mood}</span>`).join('')}</div>`
            : '';


        // Structure
        scene.innerHTML = `
            <div class="book" data-id="${id}">
                <div class="book__face book__face--front">
                    <img src="${thumb.replace('http:', 'https:')}" alt="${title}">
                    ${moodTagsHTML}
                </div>
                <div class="book__face book__face--spine" style="background: ${randomSpine}"></div>
                <div class="book__face book_face--right"></div>
                <div class="book__face book__face--back">
                    <div>
                        <div style="font-weight: bold; font-size: 0.9rem; margin-bottom: 0.5rem;">${title}</div>
                        <div class="handwritten-note">
                            Bookseller's Note: "${vibe}"
                        </div>
                        ${moodTags.length > 0 ? `
                        <div class="mood-analysis">
                            <small>Mood Analysis:</small>
                            <div class="mood-tags-back">
                                ${moodTags.slice(0, 3).map(tag => `<span class="mood-tag-small">${tag.mood}</span>`).join('')}
                            </div>
                        </div>` : ''}
                    </div>
                    ${shelf === 'current' ? `
                <div class="reading-progress">
                        <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value="${progress}" 
                        class="progress-slider"
                    />
                <small>${progress}% read</small>
                </div>
                ` : ''}

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
                ${moodTags.length > 0 ? `<div class="glass-mood-tags">${moodTags.slice(0, 2).map(tag => `<span class="glass-mood-tag">${tag.mood}</span>`).join('')}</div>` : ''}
            </div>
        `;

        // Store reference for mood analysis
        const bookScene = scene.querySelector('.book-scene');
        if (bookScene) bookScene.bookRenderer = this;

        // Progress slider logic
        const slider = scene.querySelector('.progress-slider');
        if (slider) {
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10);
                const lib = JSON.parse(localStorage.getItem('bibliodrift_library'));

                for (const shelfKey in lib) {
                    const book = lib[shelfKey].find(b => b.id === id);
                    if (book) {
                        book.progress = value;
                        break;
                    }
                }
                this.libraryManager.library = lib;

                localStorage.setItem('bibliodrift_library', JSON.stringify(lib));

                const label = slider.nextElementSibling;
                if (label) label.textContent = `${value}% read`;
            });
        }

        // Interaction: Flip
        const bookEl = scene.querySelector('.book');
        scene.addEventListener('click', (e) => {
            if (
                !e.target.closest('.btn-icon') &&
                !e.target.closest('.reading-progress')
            ) {
                bookEl.classList.toggle('flipped');
            }
        });


        // Interaction: Add to Library (Toggle)
        const addBtn = scene.querySelector('.add-btn');
        const updateButtonState = () => {
            if (this.libraryManager.findBook(bookData.id)) {
                addBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            } else {
                addBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
            }
        };

        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.libraryManager.findBook(bookData.id)) {
                // Book is in library - remove it
                this.libraryManager.removeBook(bookData.id);
                addBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';

                // If currently on a shelf (Library Page), remove the book element visually
                // Check if the parent container is a shelf
                const parentShelf = scene.closest('.shelf-row, .library-shelf, [id^="shelf-"]');
                if (parentShelf) {
                    scene.style.opacity = '0';
                    scene.style.transform = 'scale(0.8)';
                    setTimeout(() => scene.remove(), 300); // Wait for transition
                }
            } else {
                // Book not in library - add it
                this.libraryManager.addBook(bookData, 'current');
                addBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            }
        });

        // Set initial button state
        updateButtonState();

        // Interaction: Open Details Modal
        const infoBtn = scene.querySelector('.info-btn');
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openModal(bookData);
        });

        return scene;
    }


    async showMoodAnalysis(title, author) {
        try {
            const moodData = await this.moodAnalyzer.analyzeMood(title, author);
            if (moodData && moodData.success) {
                this.displayMoodModal(title, moodData.mood_analysis);
            } else {
                alert('Mood analysis not available for this book.');
            }
        } catch (error) {
            console.error('Error showing mood analysis:', error);
            alert('Error loading mood analysis.');
        }
    }


    displayMoodModal(title, moodAnalysis) {
        const modal = document.createElement('div');
        modal.className = 'mood-modal';

        // Create modal content safely using DOM methods
        const content = document.createElement('div');
        content.className = 'mood-modal-content';

        // Header
        const header = document.createElement('div');
        header.className = 'mood-modal-header';

        const headerTitle = document.createElement('h3');
        headerTitle.textContent = `Mood Analysis: ${title}`;

        const closeButton = document.createElement('button');
        closeButton.className = 'close-modal';
        closeButton.textContent = '×';

        header.appendChild(headerTitle);
        header.appendChild(closeButton);

        // Body
        const body = document.createElement('div');
        body.className = 'mood-modal-body';

        // Overall Sentiment section
        const overallSection = document.createElement('div');
        overallSection.className = 'mood-section';

        const overallHeading = document.createElement('h4');
        overallHeading.textContent = 'Overall Sentiment';

        const sentimentBar = document.createElement('div');
        sentimentBar.className = 'sentiment-bar';

        const sentimentFill = document.createElement('div');
        sentimentFill.className = 'sentiment-fill';
        const compoundScore = moodAnalysis.overall_sentiment?.compound_score || 0;
        sentimentFill.style.width = `${(compoundScore + 1) * 50}%`;

        sentimentBar.appendChild(sentimentFill);

        const moodDescription = document.createElement('p');
        moodDescription.textContent = moodAnalysis.mood_description || '';

        overallSection.appendChild(overallHeading);
        overallSection.appendChild(sentimentBar);
        overallSection.appendChild(moodDescription);

        // Primary Moods section
        const primarySection = document.createElement('div');
        primarySection.className = 'mood-section';

        const primaryHeading = document.createElement('h4');
        primaryHeading.textContent = 'Primary Moods';

        const moodTagsContainer = document.createElement('div');
        moodTagsContainer.className = 'mood-tags-large';

        const primaryMoods = Array.isArray(moodAnalysis.primary_moods) ? moodAnalysis.primary_moods : [];
        primaryMoods.forEach(mood => {
            const span = document.createElement('span');
            const moodName = String(mood.mood || '');
            span.className = `mood-tag-large mood-${moodName}`;
            span.textContent = `${moodName} (${mood.confidence || mood.frequency || 0})`;
            moodTagsContainer.appendChild(span);
        });

        primarySection.appendChild(primaryHeading);
        primarySection.appendChild(moodTagsContainer);

        // BiblioDrift Vibe section
        const vibeSection = document.createElement('div');
        vibeSection.className = 'mood-section';

        const vibeHeading = document.createElement('h4');
        vibeHeading.textContent = 'BiblioDrift Vibe';

        const vibeQuote = document.createElement('div');
        vibeQuote.className = 'vibe-quote';
        vibeQuote.textContent = `"${moodAnalysis.bibliodrift_vibe || ''}"`;

        vibeSection.appendChild(vibeHeading);
        vibeSection.appendChild(vibeQuote);

        // Reviews analyzed section
        const reviewsSection = document.createElement('div');
        reviewsSection.className = 'mood-section';

        const reviewsInfo = document.createElement('small');
        reviewsInfo.textContent = `Based on ${moodAnalysis.total_reviews_analyzed || 0} GoodReads reviews`;

        reviewsSection.appendChild(reviewsInfo);

        // Assemble everything
        body.appendChild(overallSection);
        body.appendChild(primarySection);
        body.appendChild(vibeSection);
        body.appendChild(reviewsSection);

        content.appendChild(header);
        content.appendChild(body);
        modal.appendChild(content);


        document.body.appendChild(modal);


        // Close modal functionality
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });


        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }


    generateVibe(text) {
        // Simple heuristic to mock "AI" vibes (fallback)
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


class MoodAnalyzer {
    async getBookMood(title, author) {
        try {
            const response = await fetch(`${MOOD_API_BASE}/mood-tags`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, author })
            });
            return await response.json();
        } catch (error) {
            console.error('Error fetching mood tags:', error);
            return null;
        }
    }


    async analyzeMood(title, author) {
        try {
            const response = await fetch(`${MOOD_API_BASE}/analyze-mood`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, author })
            });
            return await response.json();
        } catch (error) {
            console.error('Error analyzing mood:', error);
            return null;
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
        this.setupSorting();
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
                        date_added: item.created_at || new Date().toISOString()
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
        if (this.findBook(book.id)) return;

        const enrichedBook = {
            ...book,
            progress: shelf === 'current' ? 0 : null,
            date_added: new Date().toISOString()
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
            console.log(`Removed book ${id} from ${shelf}`);

            // 2. Update Backend
            const user = this.getUser();
            // We need the DB ID to delete from backend usually, 
            // but our remove_from_library endpoint uses item_id (DB ID).
            // Do we have it?
            if (user && book.db_id) {
                try {
                    await fetch(`${this.apiBase}/library/${book.db_id}`, { method: 'DELETE' });
                } catch (e) {
                    console.error("Failed to delete from backend", e);
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
        localStorage.setItem(this.storageKey, JSON.stringify(this.library));
    }


    save() {
        this.saveLocally();
    }


    renderShelf(shelfName, elementId) {
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
        // Initialize Genre Manager
        const genreManager = new GenreManager();
        genreManager.init();
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

