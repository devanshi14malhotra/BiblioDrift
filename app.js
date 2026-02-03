/**
 * BiblioDrift Core Logic with GoodReads Mood Analysis
 * Handles 3D rendering, API fetching, mood analysis, and LocalStorage management.
 */


const API_BASE = 'https://www.googleapis.com/books/v1/volumes';
const MOOD_API_BASE = 'http://localhost:5000/api/v1';


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
            const data = await res.json();


            if (data.items) {
                container.innerHTML = '';
                for (const book of data.items) {
                    const bookElement = await this.createBookElement(book);
                    container.appendChild(bookElement);
                }
            }
        } catch (err) {
            console.error("Failed to fetch books", err);
            container.innerHTML = '<p>The shelves are dusty... (API Error)</p>';
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
    }


    addBook(book, shelf) {
        if (this.findBook(book.id)) return;

        const enrichedBook = {
            ...book,
            progress: shelf === 'current' ? 0 : null
        };

        this.library[shelf].push(enrichedBook);
        this.save();
        console.log(`Added ${book.volumeInfo.title} to ${shelf}`);
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

    removeBook(id) {
        const result = this.findBookInShelf(id);
        if (result) {
            const { shelf } = result;
            this.library[shelf] = this.library[shelf].filter(b => b.id !== id);
            this.save();
            console.log(`Removed book ${id} from ${shelf}`);
            return true;
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


// Init
document.addEventListener('DOMContentLoaded', () => {
    const libManager = new LibraryManager();
    const renderer = new BookRenderer(libManager);
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
        renderer.renderCuratedSection('subject:fiction', 'row-genre');
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