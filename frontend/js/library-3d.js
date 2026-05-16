/**
 * BiblioDrift 3D Bookshelf Library
 * Handles the interactive 3D bookshelf experience with hover tooltips and detail modals
 */

// Sample books data for demonstration
const SAMPLE_BOOKS = {
    current: [
        {
            id: 'sample-1',
            title: 'The Great Gatsby',
            author: 'F. Scott Fitzgerald',
            cover: 'https://covers.openlibrary.org/b/id/7222246-M.jpg',
            rating: 4.2,
            ratingCount: 4523,
            description: 'The story of the mysteriously wealthy Jay Gatsby and his love for the beautiful Daisy Buchanan, of lavish parties on Long Island at a time when The New York Times noted "ichthyosaurus" was among the most popular dance steps. This exemplary novel of the Jazz Age has been acclaimed by generations of readers.',
            categories: ['Classic', 'Literary Fiction', 'American'],
            spineColor: '#1a472a',
            textColor: '#d4af37',
            reviews: [
                { name: 'Literature Lover', rating: 5, text: 'A masterpiece of American literature that captures the essence of the roaring twenties.' },
                { name: 'BookwormSarah', rating: 4, text: 'The prose is absolutely beautiful. Fitzgerald\'s writing is unmatched.' }
            ]
        },
        {
            id: 'sample-2',
            title: 'Pride and Prejudice',
            author: 'Jane Austen',
            cover: 'https://covers.openlibrary.org/b/id/12645114-M.jpg',
            rating: 4.5,
            ratingCount: 3892,
            description: 'Since its immediate success in 1813, Pride and Prejudice has remained one of the most popular novels in the English language. Jane Austen called this brilliant work "her own darling child" and its witty portrayal of country society and the courtship of Elizabeth Bennet and Mr. Darcy has captivated readers for centuries.',
            categories: ['Classic', 'Romance', 'British'],
            spineColor: '#8B4513',
            textColor: '#FFEFD5',
            reviews: [
                { name: 'JaneiteForever', rating: 5, text: 'The perfect blend of wit, romance, and social commentary.' },
                { name: 'ClassicReader', rating: 5, text: 'Elizabeth Bennet is one of the most beloved heroines in literature.' }
            ]
        },
        {
            id: 'sample-3',
            title: '1984',
            author: 'George Orwell',
            cover: 'https://covers.openlibrary.org/b/id/9269962-M.jpg',
            rating: 4.3,
            ratingCount: 5621,
            description: 'Winston Smith works for the Ministry of Truth in London, chief city of Airstrip One. Big Brother stares out from every poster, the Thought Police uncover each act of betrayal. When Winston finds love with Julia, he discovers life does not have to be dull and deadening.',
            categories: ['Dystopian', 'Science Fiction', 'Political'],
            spineColor: '#2F4F4F',
            textColor: '#FF6347',
            reviews: [
                { name: 'DystopiaFan', rating: 5, text: 'Frighteningly relevant even decades after it was written.' },
                { name: 'PoliticalReader', rating: 4, text: 'A chilling masterpiece that makes you question everything.' }
            ]
        }
    ],
    want: [
        {
            id: 'sample-4',
            title: 'To Kill a Mockingbird',
            author: 'Harper Lee',
            cover: 'https://covers.openlibrary.org/b/id/8314134-M.jpg',
            rating: 4.6,
            ratingCount: 4789,
            description: 'The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it. Through the young eyes of Scout and Jem Finch, Harper Lee explores with rich humor and unswerving honesty the irrationality of adult attitudes toward race and class.',
            categories: ['Classic', 'Literary Fiction', 'Southern'],
            spineColor: '#654321',
            textColor: '#FFFAF0',
            reviews: [
                { name: 'SouthernReader', rating: 5, text: 'A powerful story that stays with you forever.' },
                { name: 'BookClubMember', rating: 5, text: 'Atticus Finch is the moral compass we all need.' }
            ]
        },
        {
            id: 'sample-5',
            title: 'The Alchemist',
            author: 'Paulo Coelho',
            cover: 'https://covers.openlibrary.org/b/id/7884852-M.jpg',
            rating: 4.1,
            ratingCount: 3156,
            description: 'Paulo Coelho\'s masterpiece tells the mystical story of Santiago, an Andalusian shepherd boy who yearns to travel in search of a worldly treasure. His quest will lead him to riches far different—and far more satisfying—than he ever imagined.',
            categories: ['Philosophy', 'Fiction', 'Adventure'],
            spineColor: '#DAA520',
            textColor: '#2F1810',
            reviews: [
                { name: 'SpiritualSeeker', rating: 5, text: 'A beautiful reminder to follow your dreams.' },
                { name: 'WorldTraveler', rating: 4, text: 'Every page is filled with wisdom and magic.' }
            ]
        },
        {
            id: 'sample-6',
            title: 'The Midnight Library',
            author: 'Matt Haig',
            cover: 'https://covers.openlibrary.org/b/id/10389354-M.jpg',
            rating: 4.0,
            ratingCount: 2845,
            description: 'Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived. To see how things would be if you had made other choices.',
            categories: ['Contemporary', 'Fantasy', 'Philosophy'],
            spineColor: '#191970',
            textColor: '#E6E6FA',
            reviews: [
                { name: 'ModernReader', rating: 4, text: 'A thought-provoking exploration of regret and possibility.' },
                { name: 'FantasyLover', rating: 5, text: 'Beautifully written with an uplifting message.' }
            ]
        },
        {
            id: 'sample-7',
            title: 'Atomic Habits',
            author: 'James Clear',
            cover: 'https://covers.openlibrary.org/b/id/10958382-M.jpg',
            rating: 4.4,
            ratingCount: 6234,
            description: 'No matter your goals, Atomic Habits offers a proven framework for improving—every day. James Clear reveals practical strategies that will teach you exactly how to form good habits, break bad ones, and master the tiny behaviors that lead to remarkable results.',
            categories: ['Self-Help', 'Psychology', 'Productivity'],
            spineColor: '#FF8C00',
            textColor: '#FFFFFF',
            reviews: [
                { name: 'ProductivityGuru', rating: 5, text: 'Life-changing advice backed by science.' },
                { name: 'SelfImprover', rating: 4, text: 'Practical tips that actually work in real life.' }
            ]
        }
    ],
    finished: [
        {
            id: 'sample-8',
            title: 'The Catcher in the Rye',
            author: 'J.D. Salinger',
            cover: 'https://covers.openlibrary.org/b/id/8231994-M.jpg',
            rating: 3.8,
            ratingCount: 3421,
            description: 'The hero-narrator of The Catcher in the Rye is an ancient child of sixteen, a native New Yorker named Holden Caulfield. Through circumstances that tend to preclude adult, secondhand description, he leaves his prep school in Pennsylvania and goes underground in New York City for three days.',
            categories: ['Classic', 'Coming-of-Age', 'American'],
            spineColor: '#8B0000',
            textColor: '#FFD700',
            reviews: [
                { name: 'TeenReader', rating: 4, text: 'Holden\'s voice captures teenage angst perfectly.' },
                { name: 'LitMajor', rating: 3, text: 'An important work though divisive in reception.' }
            ]
        },
        {
            id: 'sample-9',
            title: 'Sapiens',
            author: 'Yuval Noah Harari',
            cover: 'https://covers.openlibrary.org/b/id/8406786-M.jpg',
            rating: 4.5,
            ratingCount: 5432,
            description: 'How did our species succeed in the battle for dominance? Why did our foraging ancestors come together to create cities and kingdoms? How did we come to believe in gods, nations, and human rights? Sapiens takes readers on a sweeping tour through our entire history.',
            categories: ['Non-Fiction', 'History', 'Science'],
            spineColor: '#4169E1',
            textColor: '#FFFFFF',
            reviews: [
                { name: 'HistoryBuff', rating: 5, text: 'Absolutely fascinating look at human history.' },
                { name: 'ScienceReader', rating: 5, text: 'Changes the way you see the world.' }
            ]
        },
        {
            id: 'sample-10',
            title: 'The Little Prince',
            author: 'Antoine de Saint-Exupéry',
            cover: 'https://covers.openlibrary.org/b/id/8507422-M.jpg',
            rating: 4.7,
            ratingCount: 4123,
            description: 'A young prince visits various planets in space, including Earth, and addresses themes of loneliness, friendship, love, and loss. Though marketed as a children\'s book, The Little Prince makes observations about life and human nature that are often complex.',
            categories: ['Classic', 'Philosophy', 'Children\'s'],
            spineColor: '#9370DB',
            textColor: '#FFFACD',
            reviews: [
                { name: 'DreamerReader', rating: 5, text: 'A timeless tale that speaks to all ages.' },
                { name: 'PhilosophyFan', rating: 5, text: '"What is essential is invisible to the eye."' }
            ]
        },
        {
            id: 'sample-11',
            title: 'Educated',
            author: 'Tara Westover',
            cover: 'https://covers.openlibrary.org/b/id/8479576-M.jpg',
            rating: 4.4,
            ratingCount: 3876,
            description: 'Born to survivalists in the mountains of Idaho, Tara Westover was seventeen the first time she set foot in a classroom. Her quest for knowledge transformed her, taking her over oceans and across continents, to Harvard and to Cambridge University.',
            categories: ['Memoir', 'Non-Fiction', 'Inspirational'],
            spineColor: '#2E8B57',
            textColor: '#F5F5F5',
            reviews: [
                { name: 'MemoirLover', rating: 5, text: 'An incredible story of resilience and determination.' },
                { name: 'Educator', rating: 4, text: 'Shows the transformative power of education.' }
            ]
        },
        {
            id: 'sample-12',
            title: 'The Alchemist',
            author: 'Paulo Coelho',
            cover: 'https://covers.openlibrary.org/b/id/8225261-M.jpg',
            rating: 4.3,
            ratingCount: 5124,
            description: 'Santiago, a young Andalusian shepherd, dreams of discovering a worldly treasure. His journey takes him across the deserts of Egypt, teaching him about destiny, love, and listening to his heart.',
            categories: ['Fiction', 'Adventure', 'Inspirational'],
            spineColor: '#DAA520',
            textColor: '#1C1C1C',
            reviews: [
                { name: 'DreamChaser', rating: 5, text: 'A beautiful and inspiring tale about following your dreams.' },
                { name: 'BookWorm99', rating: 4, text: 'Simple yet powerful storytelling with deep meaning.' }
            ]
        },
        {
            id: 'sample-13',
            title: 'Atomic Habits',
            author: 'James Clear',
            cover: 'https://covers.openlibrary.org/b/id/9251996-M.jpg',
            rating: 4.6,
            ratingCount: 8432,
            description: 'A practical guide to building good habits and breaking bad ones. James Clear explains how small daily improvements compound into remarkable long-term results.',
            categories: ['Self-Help', 'Productivity', 'Personal Development'],
            spineColor: '#2E8B57',
            textColor: '#FFFFFF',
            reviews: [
                { name: 'GrowthMindset', rating: 5, text: 'Life-changing insights on building sustainable habits.' },
                { name: 'FocusBuilder', rating: 4, text: 'Actionable advice backed by science and real examples.' }
            ]
        },
        {
            id: 'sample-14',
            title: 'Deep Work',
            author: 'Cal Newport',
            cover: 'https://covers.openlibrary.org/b/id/8370226-M.jpg',
            rating: 4.5,
            ratingCount: 6921,
            description: 'A powerful guide to mastering focused success in a distracted world. Cal Newport explains how cultivating deep, concentrated work can dramatically improve productivity and create meaningful results in professional and personal life.',
            categories: ['Productivity', 'Self-Improvement', 'Career Development'],
            spineColor: '#1E3A8A',
            textColor: '#FFFFFF',
            reviews: [
                { name: 'CodeMaster', rating: 5, text: 'A must-read for anyone serious about improving focus and output.' },
                { name: 'SilentAchiever', rating: 4, text: 'Great framework for eliminating distractions and building deep concentration.' }
            ]
        },
        {
            id: 'sample-15',
            title: 'The Psychology of Money',
            author: 'Morgan Housel',
            cover: 'https://covers.openlibrary.org/b/id/10521270-M.jpg',
            rating: 4.7,
            ratingCount: 11234,
            description: 'An insightful exploration of how people think about money and the behaviors that influence financial decisions. Morgan Housel shares timeless lessons on wealth, greed, and happiness through engaging real-world stories.',
            categories: ['Finance', 'Self-Development', 'Investing'],
            spineColor: '#8B4513',
            textColor: '#FFFFFF',
            reviews: [
                { name: 'SmartInvestor', rating: 5, text: 'A refreshing perspective on wealth and financial behavior.' },
                { name: 'WealthBuilder', rating: 4, text: 'Simple yet powerful lessons that change how you view money.' }
            ]
        }
    ]
};
// Action to cache or remove book from local IndexedDB
async function toggleOfflineBook(book, buttonElement) {
    try {
        // Use the global window object database reference
        const existingBook = await window.db.books.get(book.id);

        if (existingBook) {
            await window.db.books.delete(book.id);
            console.log(`"${book.title}" removed from offline shelf.`);
            updateDownloadIcon(buttonElement, false);
        } else {
            await window.db.books.add({
                id: book.id,
                title: book.title,
                author: book.author || 'Unknown Author',
                content: book.content || book.description || 'No summary available.',
                mood: book.mood || 'general',
                coverUrl: book.coverUrl || ''
            });
            console.log(`"${book.title}" downloaded for offline reading!`);
            updateDownloadIcon(buttonElement, true);
        }
    } catch (error) {
        console.error("Failed to alter local shelf cache:", error);
    }
}
class BookshelfRenderer3D {
    constructor() {
        this.tooltip = document.getElementById('book-tooltip');
        this.modal = document.getElementById('book-detail-modal');
        this.currentBook = null;
        this.tooltipTimeout = null;
        this.sortCriteria = 'title'; // Default sort
        this.filterCriteria = 'all'; // Default filter
        this.searchQuery = ''; // Default search query
        this.currentView = 'shelves'; // 'shelves' or 'constellation'
        this.constellationSimulation = null; // Store D3 simulation
        this.cleanupCallbacks = [];
        this.isDestroyed = false;
        this._modalBackdropHandler = null;
        this._escHandler = null;
        this._escListenerAttached = false;

        // Create live region for screen reader announcements
        this.liveRegion = document.createElement('div');
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.setAttribute('aria-atomic', 'true');
        this.liveRegion.className = 'sr-only';
        this.liveRegion.id = 'sr-announcements';
        document.body.appendChild(this.liveRegion);

        // Add accessibility attributes to tooltip
        if (this.tooltip) {
            this.tooltip.setAttribute('role', 'region');
            this.tooltip.setAttribute('aria-label', 'Book preview tooltip');
            this.tooltip.setAttribute('aria-live', 'polite');
        }

        // Add accessibility attributes to modal
        if (this.modal) {
            this.modal.setAttribute('role', 'dialog');
            this.modal.setAttribute('aria-modal', 'true');
            this.modal.setAttribute('aria-labelledby', 'modal-title');
        }

        this.init();
    }

    getLibraryState() {
        if (window.libManager && typeof window.libManager.getLibrarySnapshot === 'function') {
            return window.libManager.getLibrarySnapshot();
        }

        const storageKey = 'bibliodrift_library';
        return JSON.parse(localStorage.getItem(storageKey)) || {
            current: [],
            want: [],
            finished: []
        };
    }

    findBookShelf(bookId) {
        if (window.libManager && typeof window.libManager.findBookShelf === 'function') {
            return window.libManager.findBookShelf(bookId);
        }

        const library = this.getLibraryState();
        for (const shelf of ['current', 'want', 'finished']) {
            if ((library[shelf] || []).some(book => book.id === bookId)) {
                return shelf;
            }
        }

        return null;
    }

    addManagedListener(target, eventName, handler, options) {
        if (!target || typeof target.addEventListener !== 'function') {
            return;
        }

        target.addEventListener(eventName, handler, options);
        this.cleanupCallbacks.push(() => target.removeEventListener(eventName, handler, options));
    }

    init() {
        // Sort listener
        const sortSelect = document.getElementById('library-sort');
        if (sortSelect) {
            this.addManagedListener(sortSelect, 'change', (e) => {
                this.sortCriteria = e.target.value;
                this.refreshShelves();
            });
        }

        // Filter listener
        const filterSelect = document.getElementById('library-filter');
        if (filterSelect) {
            this.addManagedListener(filterSelect, 'change', (e) => {
                this.filterCriteria = e.target.value;
                this.refreshShelves();
            });
        }

        // Search listener for "Search for a feeling..."
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            this.addManagedListener(searchInput, 'input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                if (this.currentView === 'shelves') {
                    this.refreshShelves();
                } else {
                    this.renderConstellation();
                }
            });
        }

        // View Toggles
        const btnShelves = document.getElementById('view-shelves-btn');
        const btnConstellation = document.getElementById('view-constellation-btn');
        const containerShelves = document.getElementById('library-shelves');
        const containerConstellation = document.getElementById('constellation-container');

        if (btnShelves && btnConstellation) {
            this.addManagedListener(btnShelves, 'click', () => {
                this.currentView = 'shelves';
                btnShelves.classList.add('active-view');
                btnShelves.classList.replace('btn-secondary', 'btn-primary');
                btnConstellation.classList.remove('active-view');
                btnConstellation.classList.replace('btn-primary', 'btn-secondary');
                
                containerShelves.classList.remove('hidden');
                containerConstellation.classList.add('hidden');
                this.refreshShelves();
            });

            this.addManagedListener(btnConstellation, 'click', () => {
                this.currentView = 'constellation';
                btnConstellation.classList.add('active-view');
                btnConstellation.classList.replace('btn-secondary', 'btn-primary');
                btnShelves.classList.remove('active-view');
                btnShelves.classList.replace('btn-primary', 'btn-secondary');
                
                containerShelves.classList.add('hidden');
                containerConstellation.classList.remove('hidden');
                this.renderConstellation();
            });
        }

        // Render all shelves with sample books
        this.refreshShelves();

        this.addManagedListener(window, 'bibliodrift:library-manager-ready', () => {
            this.refreshShelves();
        });
        this.addManagedListener(window, 'bibliodrift:library-manager-synced', () => {
            this.refreshShelves();
        });

        // Setup modal close handlers
        this.setupModalHandlers();
    }

    refreshShelves() {
        const showCurrent = this.filterCriteria === 'all' || this.filterCriteria === 'current';
        const showWant = this.filterCriteria === 'all' || this.filterCriteria === 'want';
        const showFinished = this.filterCriteria === 'all' || this.filterCriteria === 'finished';

        // Count books first with search filter applied
        const currentCount = this.getShelfBookCount('current', this.searchQuery);
        const wantCount = this.getShelfBookCount('want', this.searchQuery);
        const finishedCount = this.getShelfBookCount('finished', this.searchQuery);

        let totalVisibleBooks = 0;
        if (showCurrent) totalVisibleBooks += currentCount;
        if (showWant) totalVisibleBooks += wantCount;
        if (showFinished) totalVisibleBooks += finishedCount;

        const isEmpty = totalVisibleBooks === 0;

        // Update shelf visibility: Show shelf only if filter includes it AND (it has books OR we are specifically searching THIS shelf)
        // Actually, if we are in 'all' view, only show shelves that have books. 
        // If we are in specific shelf view, show it even if empty (but global empty state will override if total is 0)

        const forceShowSpecific = this.filterCriteria !== 'all';

        this.updateShelfVisibility('shelf-current-3d', !isEmpty && showCurrent && (currentCount > 0 || forceShowSpecific));
        this.updateShelfVisibility('shelf-want-3d', !isEmpty && showWant && (wantCount > 0 || forceShowSpecific));
        this.updateShelfVisibility('shelf-finished-3d', !isEmpty && showFinished && (finishedCount > 0 || forceShowSpecific));

        if (!isEmpty) {
            if (showCurrent && (currentCount > 0 || forceShowSpecific)) this.renderShelf('current', 'shelf-current-3d');
            if (showWant && (wantCount > 0 || forceShowSpecific)) this.renderShelf('want', 'shelf-want-3d');
            if (showFinished && (finishedCount > 0 || forceShowSpecific)) this.renderShelf('finished', 'shelf-finished-3d');
        }

        // Show/Hide Global Empty State
        const emptyState = document.getElementById('library-empty-state');
        if (emptyState) {
            emptyState.hidden = !isEmpty;
        }
    }

    getShelfBookCount(shelfType, query = "") {
        const localLibrary = this.getLibraryState();
        const books = localLibrary[shelfType] || [];
        if (!query) return books.length;

        return books.filter(b => {
            const title = (b.title || b.volumeInfo?.title || "").toLowerCase();
            const author = (b.author || (b.volumeInfo?.authors && b.volumeInfo.authors[0]) || "").toLowerCase();
            const moods = (b.moods || []).join(" ").toLowerCase();
            return title.includes(query) || author.includes(query) || moods.includes(query);
        }).length;
    }

    updateShelfVisibility(containerId, isVisible) {
        const container = document.getElementById(containerId);
        if (container) {
            const section = container.closest('.shelf-section-3d');
            if (section) {
                section.style.display = isVisible ? 'block' : 'none';
            }
        }
    }

    renderShelf(shelfType, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Set accessibility attributes on container
        container.setAttribute('role', 'region');
        const shelfLabels = {
            'current': 'Currently Immersed - Books currently being read',
            'want': 'Anticipated Journeys - Books to read',
            'finished': 'Lifetime Favorites - Books finished'
        };
        container.setAttribute('aria-label', shelfLabels[shelfType] || `${shelfType} books shelf`);
        container.setAttribute('aria-live', 'polite');

        // Fetch real library data
        const localLibrary = this.getLibraryState();
        let books = [...(localLibrary[shelfType] || [])];

        // Map to expected format if needed (local storage format usually matches)
        // Ensure volumeInfo is flattened for 3D renderer expectations if they differ
        books = books.map(b => {
            // If it's already flat (like sample), keep it. If it's Google Books style (volumeInfo), flatten it.
            if (b.volumeInfo) {
                return {
                    id: b.id,
                    title: b.volumeInfo.title || 'Untitled',
                    author: (b.volumeInfo.authors && b.volumeInfo.authors[0]) || 'Unknown',
                    cover: b.volumeInfo.imageLinks?.thumbnail || '',
                    description: b.volumeInfo.description || '',
                    rating: b.volumeInfo.averageRating || 4.0,
                    ratingCount: b.volumeInfo.ratingsCount || 0,
                    categories: b.volumeInfo.categories || [],
                    spineColor: b.spineColor,
                    moods: b.moods || [],
                    progress: typeof b.progress === 'number' ? b.progress : 0,
                    shelfType: shelfType,
                    reviews: []
                };
            }
            return { ...b, moods: b.moods || [], progress: typeof b.progress === 'number' ? b.progress : 0, shelfType };
        });

        // Apply Search Filter
        if (this.searchQuery) {
            books = books.filter(b => {
                const title = b.title.toLowerCase();
                const author = b.author.toLowerCase();
                const moods = b.moods.join(" ").toLowerCase();
                return title.includes(this.searchQuery) || author.includes(this.searchQuery) || moods.includes(this.searchQuery);
            });
        }

        // Sort books
        books.sort((a, b) => {
            if (this.sortCriteria === 'title') return a.title.localeCompare(b.title);
            if (this.sortCriteria === 'author') return a.author.localeCompare(b.author);
            if (this.sortCriteria === 'rating') return b.rating - a.rating;
            if (this.sortCriteria === 'mood') {
                const moodA = (a.moods && a.moods[0]) || "zzz";
                const moodB = (b.moods && b.moods[0]) || "zzz";
                return moodA.localeCompare(moodB);
            }
            return a.title.localeCompare(b.title);
        });

        if (!books || books.length === 0) {
            container.innerHTML = '<div class="empty-shelf-3d" style="text-align: center; padding: 150px;">No books yet... Start your collection!</div>';
            return;
        }

        container.innerHTML = '';

        books.forEach((book, index) => {
            const bookSpine = this.createBookSpine(book, index, shelfType);
            container.appendChild(bookSpine);
        });

        // Update aria-label with book count
        container.setAttribute('aria-label', `${shelfLabels[shelfType]} - ${books.length} book${books.length !== 1 ? 's' : ''}`);

        // Add Shelf Drop Zone Logic
        // Remove old listeners? It's hard without named functions. 
        // But since we clear innerHTML, we just re-attach to the container? No, container is persistent.
        // We should be careful about duplicate listeners on the container.

        // A simple way to avoid duplicates is to set a custom property or remove and re-add.
        // Or better, just attach these once in init() if possible, but we need shelfType reference.
        // Since renderShelf is called multiple times, we should check if listeners are attached.
        container.dataset.shelf = shelfType;

        if (!container.dataset.dropListenersAttached) {
            container.addEventListener('dragover', (e) => {
                e.preventDefault(); // Essential for drop
                container.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            });

            container.addEventListener('dragleave', (e) => {
                container.style.backgroundColor = '';
                
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.style.backgroundColor = '';

                const targetShelf = e.currentTarget.dataset.shelf;
                const bookId = e.dataTransfer.getData('bookId');
                const sourceShelf = e.dataTransfer.getData('sourceShelf');

                if (bookId && sourceShelf && sourceShelf !== targetShelf) {
                    this.moveBook(bookId, sourceShelf, targetShelf);
                }
            });
            container.dataset.dropListenersAttached = 'true';
        }
    }

    createBookSpine(book, index, shelfType) {
        const spine = document.createElement('div');

        // Drag and Drop Attributes
        spine.draggable = true;
        spine.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('bookId', book.id);
            e.dataTransfer.setData('sourceShelf', shelfType);
            e.dataTransfer.effectAllowed = 'move';
            spine.style.opacity = '0.5';
            // Announce to screen readers
            this.announceToScreenReader(`Started dragging ${book.title}`);
        });

        spine.addEventListener('dragend', (e) => {
            spine.style.opacity = '1';
        });

        // Generate deterministic traits
        const traits = this.generateSpineTraits(book);

        spine.className = `book-spine-3d ${traits.texture} ${traits.pattern}`;
        spine.dataset.bookId = book.id;

        // Vary spine width based on title length and "page count"
        // Wider spines for longer titles to fit full text
        const baseWidth = Math.min(55, 38 + book.title.length * 0.5);
        const spineWidth = baseWidth + Math.floor(this._seededRandom(traits.seed + 10) * 5); // Use deterministic random

        // MUCH taller books so full title is readable
        const baseHeight = Math.min(280, 220 + book.title.length * 2.5);
        const spineHeight = baseHeight + Math.floor(this._seededRandom(traits.seed + 20) * 10);

        spine.style.width = `${spineWidth}px`;
        spine.style.height = `${spineHeight}px`;
        spine.style.setProperty('--spine-color', traits.spineColor);

        // Animation delay for staggered entrance (keep this index based for UI effect)
        spine.style.animationDelay = `${index * 0.1}s`;

        // Apply Font Class
        spine.classList.add(traits.fontClass);
        if (traits.titleModifier) spine.classList.add(traits.titleModifier);

        const face = document.createElement('div');
        face.className = 'spine-face';
        face.style.backgroundColor = traits.spineColor;
        face.style.color = traits.textColor;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'spine-title';
        titleSpan.textContent = book.title;
        face.appendChild(titleSpan);

        const authorSpan = document.createElement('span');
        authorSpan.className = 'spine-author';
        authorSpan.textContent = book.author ? book.author.split(' ').pop() : '';
        face.appendChild(authorSpan);

        if (traits.pattern.includes('ornament')) {
            const ornament = document.createElement('div');
            ornament.className = 'spine-pattern-ornament';
            face.appendChild(ornament);
        }
        if (traits.pattern.includes('bands')) {
            const bands = document.createElement('div');
            bands.className = 'spine-pattern-bands';
            face.appendChild(bands);
        }
        if (traits.pattern.includes('frame')) {
            const frame = document.createElement('div');
            frame.className = 'spine-pattern-frame';
            face.appendChild(frame);
        }

        const edge = document.createElement('div');
        edge.className = 'book-edge';

        const top = document.createElement('div');
        top.className = 'book-top';
        top.style.setProperty('--spine-color', traits.spineColor);

        spine.innerHTML = '';
        spine.appendChild(face);
        spine.appendChild(edge);
        spine.appendChild(top);

        // Event listeners
        spine.addEventListener('mouseenter', (e) => this.showTooltip(e, book));
        spine.addEventListener('mousemove', (e) => this.moveTooltip(e));
        spine.addEventListener('mouseleave', () => this.hideTooltip());
        spine.addEventListener('click', () => this.openModal(book));
       
        // Keyboard Accessibility (Issue #534)
spine.setAttribute('tabindex', '0');
spine.setAttribute('role', 'button');
spine.setAttribute('aria-label', `${book.title} by ${book.author}. Rating: ${book.rating}. Press Enter or Space to view details.`);

spine.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.openModal(book);
    }
});

spine.addEventListener('focus', () => {
    const rect = spine.getBoundingClientRect();
    this.showTooltip(
        { clientX: rect.right, clientY: rect.top + rect.height / 2 },
        book
    );
});
spine.addEventListener('blur', () => this.hideTooltip());

        // Add mood icon if primary mood exists
        if (book.moods && book.moods.length > 0) {
            const moodIcon = document.createElement('div');
            moodIcon.className = 'spine-mood-icon';
            moodIcon.style.position = 'absolute';
            moodIcon.style.top = '10px';
            moodIcon.style.width = '100%';
            moodIcon.style.textAlign = 'center';
            moodIcon.style.fontSize = '12px';
            moodIcon.style.opacity = '0.7';
            moodIcon.innerHTML = `<i class="fa-solid ${this.getMoodIcon(book.moods[0])}"></i>`;
            spine.appendChild(moodIcon);
        }

        // Add reading progress indicator on spine for currently-reading books
        const progress = typeof book.progress === 'number' ? book.progress : 0;
        if (shelfType === 'current') {
            const progressIndicator = document.createElement('div');
            progressIndicator.className = 'spine-progress-indicator';
            progressIndicator.setAttribute('aria-label', `${progress}% read`);
            progressIndicator.setAttribute('title', `${progress}% read`);

            const progressFill = document.createElement('div');
            progressFill.className = 'spine-progress-fill';
            progressFill.style.height = `${progress}%`;

            progressIndicator.appendChild(progressFill);
            spine.appendChild(progressIndicator);
        }

        // Finished badge
        if (shelfType === 'finished') {
            const finishedBadge = document.createElement('div');
            finishedBadge.className = 'spine-finished-badge';
            finishedBadge.innerHTML = '<i class="fa-solid fa-check"></i>';
            finishedBadge.setAttribute('title', 'Finished');
            spine.appendChild(finishedBadge);
        }

        return spine;
    }

    _hashString(str) {
        let hash = 0;
        if (!str) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    _seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    generateSpineTraits(book) {
        // Use title + author as seed for deterministic randomness
        const seedStr = (book.title + (book.author || '')).replace(/\s/g, '');
        const seed = this._hashString(seedStr);

        const rand = (offset) => this._seededRandom(seed + offset);

        // 1. Color (if not set or just to ensure coverage)
        let spineColor = book.spineColor;
        let textColor = book.textColor;

        // If no spine color, generate one
        if (!spineColor) {
            const hue = Math.floor(rand(1) * 360);
            const sat = 40 + Math.floor(rand(2) * 40); // 40-80%
            const lig = 25 + Math.floor(rand(3) * 35); // 25-60%
            spineColor = `hsl(${hue}, ${sat}%, ${lig}%)`;
            textColor = lig < 50 ? '#f0f0f0' : '#1a1a1a';
        }

        // 2. Texture
        // 40% leather, 30% cloth, 20% paper, 10% worn
        const rTex = rand(4);
        let texture = 'spine-texture-paper';
        if (rTex < 0.4) texture = 'spine-texture-leather';
        else if (rTex < 0.7) texture = 'spine-texture-cloth';
        else if (rTex < 0.9) texture = 'spine-texture-paper';
        else texture = 'spine-texture-worn';

        // 3. Fonts
        const rFont = rand(5);
        let fontClass = '';
        if (rFont < 0.3) fontClass = 'font-serif';
        else if (rFont < 0.6) fontClass = 'font-sans';
        else if (rFont < 0.8) fontClass = 'font-hand';
        else fontClass = ''; // Default

        // 4. Patterns
        const rPat = rand(6);
        let pattern = '';
        if (rPat < 0.2) pattern = 'spine-pattern-bands';
        else if (rPat < 0.3) pattern = 'spine-pattern-frame';
        else if (rPat < 0.4) pattern = 'spine-pattern-ornament';
        else pattern = '';

        // 5. Title Modifiers
        const rMod = rand(7);
        let titleModifier = '';
        if (book.title.length < 10 && rMod < 0.2) titleModifier = 'title-stacked';
        else if (rMod > 0.9) titleModifier = 'title-rotate-up';

        return {
            seed,
            spineColor,
            textColor,
            texture,
            fontClass,
            pattern,
            titleModifier
        };
    }


    showTooltip(e, book) {
        this.currentBook = book;

        // Clear any pending hide timeout
        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
        }

        // Update tooltip content
        document.getElementById('tooltip-cover').src = book.cover;
        document.getElementById('tooltip-cover').setAttribute('alt', `Cover of ${book.title}`);
        document.getElementById('tooltip-title').textContent = book.title;
        document.getElementById('tooltip-author').textContent = `by ${book.author}`;
        document.getElementById('tooltip-stars').textContent = this.getStarRating(book.rating);
        document.getElementById('tooltip-rating-text').textContent = (book.rating != null ? book.rating.toFixed(1) : 'N/A');
        document.getElementById('tooltip-description').textContent = book.description.substring(0, 150) + '...';

        // Show reading progress in tooltip for books in progress
        const progressEl = document.getElementById('tooltip-progress');
        const progressFill = document.getElementById('tooltip-progress-fill');
        const progressLabel = document.getElementById('tooltip-progress-label');
        const progress = typeof book.progress === 'number' ? book.progress : 0;

        if (book.shelfType === 'current' && progress > 0) {
            progressEl.style.display = 'block';
            progressFill.style.width = `${progress}%`;
            progressLabel.textContent = `${progress}% read`;
        } else if (book.shelfType === 'current') {
            progressEl.style.display = 'block';
            progressFill.style.width = '0%';
            progressLabel.textContent = 'Not started';
        } else if (book.shelfType === 'finished') {
            progressEl.style.display = 'block';
            progressFill.style.width = '100%';
            progressLabel.textContent = 'Finished ✓';
        } else {
            progressEl.style.display = 'none';
        }

        // Position tooltip
        this.moveTooltip(e);

        // Show tooltip with small delay
        setTimeout(() => {
            this.tooltip.classList.add('visible');
            // Announce to screen readers
            this.announceToScreenReader(`Book: ${book.title} by ${book.author}. ${book.rating} stars. ${book.description.substring(0, 100)}...`);
        }, 100);
    }

    moveTooltip(e) {
        const tooltip = this.tooltip;
        const padding = 20;

        let x = e.clientX + padding;
        let y = e.clientY - tooltip.offsetHeight / 2;

        // Prevent tooltip from going off-screen right
        if (x + tooltip.offsetWidth > window.innerWidth - padding) {
            x = e.clientX - tooltip.offsetWidth - padding;
        }

        // Prevent tooltip from going off-screen top/bottom
        if (y < padding) {
            y = padding;
        } else if (y + tooltip.offsetHeight > window.innerHeight - padding) {
            y = window.innerHeight - tooltip.offsetHeight - padding;
        }

        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    }

    hideTooltip() {
        this.tooltipTimeout = setTimeout(() => {
            this.tooltip.classList.remove('visible');
        }, 100);
    }

    openModal(book) {
        this.currentBook = book;

        // Hide tooltip
        this.hideTooltip();

        // 1. Reset Flip State
        const bookObject = document.getElementById('book-3d-object');
        if (bookObject) bookObject.classList.remove('flipped');

        // 2. Populate Cover
        const coverImg = document.getElementById('modal-cover');
        if (coverImg) {
            coverImg.src = book.cover;
            coverImg.setAttribute('alt', `Cover of ${book.title} by ${book.author}`);
        }

        // 3. Style the 3D Book (Spine & Back)
        const spineColor = book.spineColor || '#5d4037';
        const textColor = book.textColor || '#fff';

        // Update CSS variables for dynamic coloring if we used them, 
        // but since we use direct classes, let's query them.
        const spineFace = document.querySelector('#book-3d-object .face-spine');
        const backFace = document.querySelector('#book-3d-object .face-back');
        const backTexture = document.querySelector('#book-3d-object .back-paper-texture');

        if (spineFace) {
            spineFace.style.backgroundColor = spineColor;
            spineFace.setAttribute('aria-label', `Book spine: ${book.title}`);
            // Add title to spine if element exists
            // (We didn't add a span inside .face-spine in HTML explicitly but let's check if we want to)
        }

        if (backFace) {
            // The outer back face (binding edge)
            backFace.style.borderLeftColor = spineColor;
        }

        if (backTexture) {
            // The back cover background
            backTexture.style.backgroundColor = spineColor;
            backTexture.style.color = textColor;

            // Also update scrollbar color to match text
            // We can't easily update pseudo-elements via JS style, 
            // but we can set a CSS variable on the element
            backTexture.style.setProperty('--scrollbar-thumb', textColor);
        }

        // 4. Populate Content
        const descriptionText = document.getElementById('modal-description');
        if (descriptionText) {
            descriptionText.textContent = book.description;
            descriptionText.style.color = textColor;
            descriptionText.setAttribute('aria-label', `Description: ${book.description}`);
        }

        // Synopsis Title Color
        const synopsisTitle = document.querySelector('.synopsis-title');
        if (synopsisTitle) {
            synopsisTitle.style.color = textColor;
            synopsisTitle.style.borderColor = textColor.replace(')', ', 0.3)').replace('rgb', 'rgba');
        }

        const titleEl = document.getElementById('modal-title');
        const authorEl = document.getElementById('modal-author');
        const starsEl = document.getElementById('modal-stars');
        const scoreEl = document.getElementById('modal-rating-score');
        const countEl = document.getElementById('modal-rating-count');

        if (titleEl) titleEl.textContent = book.title;
        if (authorEl) authorEl.textContent = book.author; // Removed "by" prefix to match design
        if (starsEl) starsEl.textContent = this.getStarRating(book.rating);
        if (scoreEl) scoreEl.textContent = (book.rating != null ? book.rating.toFixed(1) : 'N/A');
        if (countEl) countEl.textContent = `(${book.ratingCount} ratings)`;

        // 5. Emotion Tagging Section
        let taggingSection = document.getElementById('modal-mood-tagging');
        if (!taggingSection) {
            taggingSection = document.createElement('div');
            taggingSection.id = 'modal-mood-tagging';
            taggingSection.className = 'mood-tagging-section';
            const infoPanel = document.querySelector('.book-info-panel');
            if (infoPanel) {
                // Insert before the action buttons
                const actions = document.querySelector('.book-actions-section');
                infoPanel.insertBefore(taggingSection, actions);
            }
        }

        taggingSection.innerHTML = `
            <h4 class="mood-tagging-title" style="margin-top: 10px; margin-bottom: 8px; color: var(--accent-gold); font-family: 'Playfair Display', serif;">How does this book make you feel?</h4>
            <div class="emotion-tags-container">
                ${['Melancholic', 'Cozy', 'Tense', 'Inspiring', 'Whimsical', 'Dark', 'Adventurous'].map(mood => {
                    const isActive = book.moods && book.moods.includes(mood);
                    return `<span class="emotion-tag ${isActive ? 'active' : ''}" data-mood="${mood}">
                        <i class="fa-solid ${this.getMoodIcon(mood)}"></i> ${mood}
                    </span>`;
                }).join('')}
            </div>
        `;
        // Categories
        const categoriesContainer = document.getElementById('modal-categories');
        if (categoriesContainer && book.categories) {
            categoriesContainer.innerHTML = '';
            book.categories.forEach(cat => {
                const span = document.createElement('span');
                span.className = 'category-tag';
                span.textContent = cat;
                categoriesContainer.appendChild(span);
            });
        }

        // Reviews
        const reviewsContainer = document.getElementById('modal-reviews');
        if (reviewsContainer && book.reviews) {
            reviewsContainer.innerHTML = '';
            book.reviews.forEach(review => {
                const item = document.createElement('div');
                item.className = 'review-item';
                
                const header = document.createElement('div');
                header.className = 'review-header';
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'reviewer-name';
                nameSpan.textContent = review.name;
                header.appendChild(nameSpan);
                
                const ratingSpan = document.createElement('span');
                ratingSpan.className = 'review-rating';
                ratingSpan.textContent = this.getStarRating(review.rating);
                header.appendChild(ratingSpan);
                
                item.appendChild(header);
                
                const textP = document.createElement('p');
                textP.className = 'review-text';
                textP.textContent = `"${review.text}"`;
                item.appendChild(textP);
                
                reviewsContainer.appendChild(item);
            });
        }

        taggingSection.querySelectorAll('.emotion-tag').forEach(tag => {
            tag.onclick = async () => {
                const mood = tag.dataset.mood;
                if (!book.moods) book.moods = [];

                const index = book.moods.indexOf(mood);
                if (index > -1) {
                    book.moods.splice(index, 1);
                    tag.style.background = 'var(--glass-bg)';
                    tag.style.color = 'inherit';
                    tag.classList.remove('active');
                } else {
                    book.moods.push(mood);
                    tag.style.background = 'var(--accent-gold)';
                    tag.style.color = '#000';
                    tag.classList.add('active');
                }

                // Update in LocalStorage
                await this.updateBookMoods(book.id, book.moods);
            };
        });

        // 6. Handle Shelf Selection
        const shelfSelect = document.getElementById('modal-shelf-select');
        // Issue #23: Element binding for the remove button
        const removeBtn = document.getElementById('modal-remove-btn');
        const actionsSection = document.querySelector('.book-actions-section');
        const reviewsSection = document.querySelector('.book-reviews-section');

        // 7. Reading Progress Tracker
        const progressSection = document.getElementById('modal-progress-section');
        const progressSlider = document.getElementById('modal-progress-slider');
        const progressBar = document.getElementById('modal-progress-bar');
        const progressValue = document.getElementById('modal-progress-value');
        const progressBadge = document.getElementById('modal-progress-badge');
        const progressSaveBtn = document.getElementById('modal-progress-save');
        const modePctBtn = document.getElementById('progress-mode-pct');
        const modePagesBtn = document.getElementById('progress-mode-pages');
        const pctGroup = document.getElementById('progress-pct-group');
        const pagesGroup = document.getElementById('progress-pages-group');
        const pagesReadInput = document.getElementById('modal-pages-read');
        const pagesTotalInput = document.getElementById('modal-pages-total');
        const pagesBar = document.getElementById('modal-pages-bar');

        // Find current shelf for this book
        const storageKey = 'bibliodrift_library';
        const localLibrary = JSON.parse(localStorage.getItem(storageKey)) || {};
        let currentShelfForProgress = 'want';
        ['current', 'want', 'finished'].forEach(shelf => {
            const found = (localLibrary[shelf] || []).find(b => b.id === book.id || (b.volumeInfo && b.id === book.id));
            if (found) currentShelfForProgress = shelf;
        });

        // Show progress tracker only for 'current' shelf books
        if (progressSection) {
            if (currentShelfForProgress === 'current') {
                progressSection.style.display = 'block';

                // Load existing progress
                const currentProgress = typeof book.progress === 'number' ? book.progress : 0;
                const totalPages = book.pageCount || book.page_count || 300;

                // Sync slider and bar
                const syncProgressUI = (pct) => {
                    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
                    if (progressSlider) progressSlider.value = clamped;
                    if (progressBar) progressBar.style.width = `${clamped}%`;
                    if (progressValue) progressValue.textContent = `${clamped}%`;
                    if (progressBadge) progressBadge.textContent = `${clamped}%`;
                    // Sync pages input
                    if (pagesReadInput && pagesTotalInput) {
                        const pages = Math.round((clamped / 100) * parseInt(pagesTotalInput.value || totalPages));
                        pagesReadInput.value = pages;
                    }
                    if (pagesBar) pagesBar.style.width = `${clamped}%`;
                };

                syncProgressUI(currentProgress);
                if (pagesTotalInput) pagesTotalInput.value = totalPages;

                // Mode toggle
                const setMode = (mode) => {
                    if (mode === 'percent') {
                        pctGroup.style.display = 'block';
                        pagesGroup.style.display = 'none';
                        modePctBtn.classList.add('active');
                        modePagesBtn.classList.remove('active');
                    } else {
                        pctGroup.style.display = 'none';
                        pagesGroup.style.display = 'block';
                        modePctBtn.classList.remove('active');
                        modePagesBtn.classList.add('active');
                    }
                };

                // Remove old listeners by cloning
                if (modePctBtn) {
                    const newPctBtn = modePctBtn.cloneNode(true);
                    modePctBtn.parentNode.replaceChild(newPctBtn, modePctBtn);
                    newPctBtn.addEventListener('click', () => setMode('percent'));
                    newPctBtn.classList.add('active');
                }
                if (modePagesBtn) {
                    const newPagesBtn = modePagesBtn.cloneNode(true);
                    modePagesBtn.parentNode.replaceChild(newPagesBtn, modePagesBtn);
                    newPagesBtn.addEventListener('click', () => setMode('pages'));
                }

                // Slider input
                if (progressSlider) {
                    const newSlider = progressSlider.cloneNode(true);
                    progressSlider.parentNode.replaceChild(newSlider, progressSlider);
                    newSlider.value = currentProgress;
                    newSlider.addEventListener('input', () => {
                        const pct = parseInt(newSlider.value);
                        if (progressBar) progressBar.style.width = `${pct}%`;
                        if (progressValue) progressValue.textContent = `${pct}%`;
                        if (progressBadge) progressBadge.textContent = `${pct}%`;
                        // Sync pages
                        const total = parseInt(document.getElementById('modal-pages-total')?.value || totalPages);
                        const pages = Math.round((pct / 100) * total);
                        const pagesReadEl = document.getElementById('modal-pages-read');
                        if (pagesReadEl) pagesReadEl.value = pages;
                        if (pagesBar) pagesBar.style.width = `${pct}%`;
                    });
                }

                // Pages inputs
                const syncPagesInputs = () => {
                    const pagesReadEl = document.getElementById('modal-pages-read');
                    const pagesTotalEl = document.getElementById('modal-pages-total');
                    const sliderEl = document.getElementById('modal-progress-slider');
                    if (!pagesReadEl || !pagesTotalEl) return;
                    const read = Math.max(0, parseInt(pagesReadEl.value) || 0);
                    const total = Math.max(1, parseInt(pagesTotalEl.value) || 1);
                    const pct = Math.min(100, Math.round((read / total) * 100));
                    if (sliderEl) sliderEl.value = pct;
                    if (progressBar) progressBar.style.width = `${pct}%`;
                    if (progressValue) progressValue.textContent = `${pct}%`;
                    if (progressBadge) progressBadge.textContent = `${pct}%`;
                    if (pagesBar) pagesBar.style.width = `${pct}%`;
                };

                if (pagesReadInput) {
                    const newPagesRead = pagesReadInput.cloneNode(true);
                    pagesReadInput.parentNode.replaceChild(newPagesRead, pagesReadInput);
                    newPagesRead.addEventListener('input', syncPagesInputs);
                }
                if (pagesTotalInput) {
                    const newPagesTotal = pagesTotalInput.cloneNode(true);
                    pagesTotalInput.parentNode.replaceChild(newPagesTotal, pagesTotalInput);
                    newPagesTotal.value = totalPages;
                    newPagesTotal.addEventListener('input', syncPagesInputs);
                }

                // Save button
                if (progressSaveBtn) {
                    const newSaveBtn = progressSaveBtn.cloneNode(true);
                    progressSaveBtn.parentNode.replaceChild(newSaveBtn, progressSaveBtn);
                    newSaveBtn.addEventListener('click', async () => {
                        const sliderEl = document.getElementById('modal-progress-slider');
                        const newProgress = sliderEl ? parseInt(sliderEl.value) : currentProgress;

                        newSaveBtn.disabled = true;
                        newSaveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

                        try {
                            // Update via LibraryManager if available (handles backend sync)
                            if (window.libManager && typeof window.libManager.updateBook === 'function') {
                                await window.libManager.updateBook(book.id, { progress: newProgress });
                            } else {
                                // Fallback: update localStorage directly
                                const lib = JSON.parse(localStorage.getItem('bibliodrift_library')) || {};
                                ['current', 'want', 'finished'].forEach(shelf => {
                                    const b = (lib[shelf] || []).find(x => x.id === book.id);
                                    if (b) b.progress = newProgress;
                                });
                                localStorage.setItem('bibliodrift_library', JSON.stringify(lib));
                            }

                            // Update the book object in memory
                            book.progress = newProgress;

                            // Refresh the shelf display
                            this.refreshShelves();

                            newSaveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
                            newSaveBtn.style.background = '#4caf50';

                            // If 100%, auto-close modal after brief delay (book moves to finished)
                            if (newProgress === 100) {
                                setTimeout(() => this.closeModal(), 1500);
                            } else {
                                setTimeout(() => {
                                    newSaveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Progress';
                                    newSaveBtn.style.background = '';
                                    newSaveBtn.disabled = false;
                                }, 2000);
                            }
                        } catch (err) {
                            console.error('Failed to save progress', err);
                            newSaveBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Failed';
                            newSaveBtn.style.background = '#e53935';
                            setTimeout(() => {
                                newSaveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Progress';
                                newSaveBtn.style.background = '';
                                newSaveBtn.disabled = false;
                            }, 2000);
                        }
                    });
                }
            } else {
                progressSection.style.display = 'none';
            }
        }

        // 6. AI Insight Section
        const aiNoteEl = document.getElementById('modal-ai-note');
        if (aiNoteEl) {
            // Reset to skeleton while fetching
            aiNoteEl.innerHTML = `
                <div class="text-skeleton skeleton"></div>
                <div class="text-skeleton skeleton" style="width: 90%"></div>
            `;
            
            // Fetch vibe note using the shared renderer method
            if (window.renderer && typeof window.renderer.fetchAIVibe === 'function') {
                window.renderer.fetchAIVibe(book.title, book.author, book.description || "").then(vibe => {
                    if (vibe) {
                        const cleanVibe = vibe.replace(/^(Bookseller's Note:|Note:|Recommendation:)\s*/i, "");
                        aiNoteEl.innerHTML = `<p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-secondary); font-style: italic;">"${cleanVibe}"</p>`;
                    } else {
                        aiNoteEl.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">AI is contemplating the deep themes of this journey...</p>`;
                    }
                });
            } else {
                // Mock vibe for offline/fallback
                setTimeout(() => {
                    aiNoteEl.innerHTML = `<p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-secondary); font-style: italic;">"A journey that resonates with the soul, perfect for quiet introspection."</p>`;
                }, 800);
            }
        }

        // Ensure action controls are always visible in the modal.
        if (actionsSection) {
            actionsSection.style.display = 'flex';
            actionsSection.style.visibility = 'visible';
            actionsSection.style.opacity = '1';
        }

        // Keep actions above reviews so Remove is visible without scrolling.
        if (actionsSection && reviewsSection && actionsSection.nextElementSibling !== reviewsSection) {
            reviewsSection.parentNode.insertBefore(actionsSection, reviewsSection);
        }

        if (shelfSelect) {
            shelfSelect.setAttribute('aria-label', 'Move book to shelf');
            let currentShelf = this.findBookShelf(book.id) || 'current';

            shelfSelect.value = currentShelf;

            // Remove old listeners to avoid duplicates by cloning
            const newSelect = shelfSelect.cloneNode(true);
            shelfSelect.parentNode.replaceChild(newSelect, shelfSelect);

            newSelect.addEventListener('change', async (e) => {
                const newShelf = e.target.value;
                await this.moveBook(book.id, currentShelf, newShelf);
                currentShelf = newShelf; // Update local tracker

                // Show/hide progress tracker based on new shelf
                const progressSectionEl = document.getElementById('modal-progress-section');
                if (progressSectionEl) {
                    progressSectionEl.style.display = newShelf === 'current' ? 'block' : 'none';
                }
            });
        }

        if (removeBtn) {
            removeBtn.setAttribute('aria-label', 'Remove book from library');
            // Remove old listeners
            const newRemoveBtn = removeBtn.cloneNode(true);
            removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);
            newRemoveBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Remove from Library';

            newRemoveBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to remove this book from your library?')) {
                    await this.removeBook(book.id);
                    this.closeModal();
                }
            });
        }

        const shareBtn = document.getElementById('modal-share-btn-lib');
        if (shareBtn) {
            shareBtn.setAttribute('aria-label', 'Share book information');
            const newShareBtn = shareBtn.cloneNode(true);
            shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);

            newShareBtn.addEventListener('click', () => {
                const title = book.title || 'Unknown Title';
                const author = book.author || 'Unknown Author';
                const shareText = `Check out this book: ${title} by ${author}`;
                navigator.clipboard.writeText(shareText).then(() => {
                    // Temporarily change button text to show success
                    const originalHTML = newShareBtn.innerHTML;
                    newShareBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                    this.announceToScreenReader('Book information copied to clipboard');
                    setTimeout(() => {
                        newShareBtn.innerHTML = originalHTML;
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    this.announceToScreenReader('Failed to copy book information');
                });
            });
        }

        // Preview Button — opens the Google Books Embedded Viewer
        const previewBtnLib = document.getElementById('modal-preview-btn-lib');
        if (previewBtnLib) {
            const newPreviewBtn = previewBtnLib.cloneNode(true);
            previewBtnLib.parentNode.replaceChild(newPreviewBtn, previewBtnLib);

            newPreviewBtn.addEventListener('click', () => {
                if (window.BookPreview && book.id) {
                    window.BookPreview.open(book.id, book.title || 'Book Preview');
                }
            });
        }

        // Show modal and manage focus
        if (this.modal) {
            this.modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Hide fixed elements (ambient leaf, scroll-to-top) to avoid overlapping description
            const fixedControls = document.querySelectorAll('.ambient-sanctuary, .back-to-top');
            fixedControls.forEach(el => el.style.opacity = '0');
            fixedControls.forEach(el => el.style.pointerEvents = 'none');

            // Setup interactive handlers (flip, close) for the current book
            this.setupModalHandlers();
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.remove('active');
            document.body.style.overflow = '';
            this.removeEscListener();

            // Reset flip after transition
            setTimeout(() => {
                const bookObject = document.getElementById('book-3d-object');
                if (bookObject) bookObject.classList.remove('flipped');
                
                // Restore fixed elements
                const fixedControls = document.querySelectorAll('.ambient-sanctuary, .back-to-top');
                fixedControls.forEach(el => el.style.opacity = '1');
                fixedControls.forEach(el => el.style.pointerEvents = 'auto');
            }, 500);
        }
    }

    removeEscListener() {
        if (this._escHandler && this._escListenerAttached) {
            document.removeEventListener('keydown', this._escHandler);
            this._escListenerAttached = false;
            this._escHandler = null;
        }
    }

    setupModalHandlers() {
        // Book flip interaction
        const bookObject = document.getElementById('book-3d-object');
        if (bookObject) {
            // Remove old listener to avoid multi-flips
            const newBook = bookObject.cloneNode(true);
            bookObject.parentNode.replaceChild(newBook, bookObject);
            
            newBook.addEventListener('click', (e) => {
                // If user is selecting text (e.g. description), don't flip
                if (window.getSelection().toString().length > 0) {
                    return;
                }
                newBook.classList.toggle('flipped');
            });
        }

        // Close button
        const closeBtn = document.getElementById('modal-close-btn');
        if (closeBtn) {
            closeBtn.setAttribute('aria-label', 'Close book details');
            // Remove lingering clones to prevent multiple listeners if re-initialized
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

            newCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeModal();
            });

            // Keyboard support
            newCloseBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.closeModal();
                }
            });
        }

        // Click outside to close (bind once to avoid listener leaks).
        if (this.modal && !this._modalBackdropHandler) {
            this._modalBackdropHandler = (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            };
            this.addManagedListener(this.modal, 'click', this._modalBackdropHandler);
        }

        // ESC key to close - attach only once, remove on close
        if (!this._escListenerAttached) {
            this._escHandler = (e) => {
                if (e.key === 'Escape' && this.modal && this.modal.classList.contains('active')) {
                    this.closeModal();
                }
            };
            document.addEventListener('keydown', this._escHandler);
            this._escListenerAttached = true;
        }

        // Add to library button logic
        const addBtn = document.getElementById('modal-add-btn');
        if (addBtn) {
            addBtn.setAttribute('aria-label', 'Add book to library');
            const newAddBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newAddBtn, addBtn);

            newAddBtn.addEventListener('click', async () => {
                newAddBtn.innerHTML = '<i class="fa-solid fa-check"></i> Added!';
                newAddBtn.style.background = '#4CAF50';
                newAddBtn.style.color = '#fff';
                newAddBtn.setAttribute('aria-label', 'Book added to library');

                // Store in localStorage (integrate with existing library system)
                if (this.currentBook) {
                    await this.addToLibrary(this.currentBook);
                }

                setTimeout(() => {
                    newAddBtn.innerHTML = '<i class="fa-regular fa-heart"></i> Add to Library';
                    newAddBtn.style.background = '';
                    newAddBtn.style.color = '';
                    newAddBtn.setAttribute('aria-label', 'Add book to library');
                }, 2000);
            });
        }

        // Mark as read button logic
        const readBtn = document.getElementById('modal-read-btn');
        if (readBtn) {
            readBtn.setAttribute('aria-label', 'Mark this book as read');
            const newReadBtn = readBtn.cloneNode(true);
            readBtn.parentNode.replaceChild(newReadBtn, readBtn);

            newReadBtn.addEventListener('click', () => {
                newReadBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Marked!';
                newReadBtn.style.background = 'var(--wood-light)';
                newReadBtn.style.color = 'white';
                newReadBtn.setAttribute('aria-label', 'Book marked as read');
                
                if (this.currentBook) {
                    this.announceToScreenReader(`${this.currentBook.title} marked as read`);
                }

                setTimeout(() => {
                    newReadBtn.innerHTML = '<i class="fa-solid fa-check"></i> Mark as Read';
                    newReadBtn.style.background = '';
                    newReadBtn.style.color = '';
                    newReadBtn.setAttribute('aria-label', 'Mark this book as read');
                }, 2000);
            });
        }
    }

    async addToLibrary(book) {
        if (window.libManager && typeof window.libManager.addBook === 'function') {
            const normalizedBook = {
                id: book.id,
                volumeInfo: {
                    title: book.title,
                    authors: [book.author],
                    imageLinks: { thumbnail: book.cover },
                    description: book.description,
                    categories: book.categories
                }
            };

            await window.libManager.addBook(normalizedBook, 'want');
            this.refreshShelves();
            return;
        }

        // Get existing library from localStorage
        const storageKey = 'bibliodrift_library';
        let library = JSON.parse(localStorage.getItem(storageKey)) || {
            current: [],
            want: [],
            finished: []
        };

        // Check if book already exists
        const exists = Object.values(library).flat().some(b => b.id === book.id);
        if (exists) {
            console.log('Book already in library');
            return;
        }

        // Add to 'want' shelf by default
        library.want.push({
            id: book.id,
            volumeInfo: {
                title: book.title,
                authors: [book.author],
                imageLinks: { thumbnail: book.cover },
                description: book.description,
                categories: book.categories
            }
        });

        localStorage.setItem(storageKey, JSON.stringify(library));
        console.log(`Added ${book.title} to library`);
    }

    async moveBook(bookId, fromShelf, toShelf) {
        if (fromShelf === toShelf) return;

        if (window.libManager && typeof window.libManager.moveBook === 'function') {
            const moved = await window.libManager.moveBook(bookId, toShelf);
            if (!moved) {
                console.error("Book not found in source shelf");
                return;
            }
            this.refreshShelves();
            return;
        }

        const storageKey = 'bibliodrift_library';
        const localLibrary = JSON.parse(localStorage.getItem(storageKey)) || {};

        // Find existing lists
        if (!localLibrary[fromShelf]) localLibrary[fromShelf] = [];
        if (!localLibrary[toShelf]) localLibrary[toShelf] = [];

        // Find the book index
        const bookIndex = localLibrary[fromShelf].findIndex(b => b.id === bookId || (b.volumeInfo && b.id === bookId));

        if (bookIndex === -1) {
            console.error("Book not found in source shelf");
            return;
        }

        const book = localLibrary[fromShelf][bookIndex];

        // Remove from old shelf
        localLibrary[fromShelf].splice(bookIndex, 1);

        // Add to new shelf
        localLibrary[toShelf].push(book);

        // Save and refresh
        localStorage.setItem(storageKey, JSON.stringify(localLibrary));
        this.refreshShelves();

        // Visual Feedback (optional)
        console.log(`Moved book ${bookId} from ${fromShelf} to ${toShelf}`);
    }

    async removeBook(bookId) {
        if (window.libManager && typeof window.libManager.removeBook === 'function') {
            await window.libManager.removeBook(bookId);
            this.refreshShelves();
            return;
        }

        const storageKey = 'bibliodrift_library';
        const localLibrary = JSON.parse(localStorage.getItem(storageKey)) || {};

        let removed = false;
        ['current', 'want', 'finished'].forEach(shelf => {
            const index = (localLibrary[shelf] || []).findIndex(b => b.id === bookId || (b.volumeInfo && b.id === bookId));
            if (index !== -1) {
                localLibrary[shelf].splice(index, 1);
                removed = true;
            }
        });

        if (removed) {
            localStorage.setItem(storageKey, JSON.stringify(localLibrary));
            this.refreshShelves();
            this.announceToScreenReader(`Book removed from library`);
            console.log(`Removed book ${bookId}`);
        }
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

    async updateBookMoods(bookId, moods) {
        if (window.libManager && window.libManager.updateBook) {
            await window.libManager.updateBook(bookId, { moods });
            this.refreshShelves();
            return;
        }

        const storageKey = 'bibliodrift_library';
        const localLibrary = this.getLibraryState();

        let found = false;
        ['current', 'want', 'finished'].forEach(shelf => {
            const book = localLibrary[shelf].find(b => b.id === bookId);
            if (book) {
                book.moods = moods;
                found = true;
            }
        });

        if (found) {
            localStorage.setItem(storageKey, JSON.stringify(localLibrary));
            this.refreshShelves();
        }
    }

    getStarRating(rating) {
        const fullStars = Math.floor(rating || 0);
        const hasHalf = (rating || 0) % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

        return '★'.repeat(Math.max(0, fullStars)) + (hasHalf ? '½' : '') + '☆'.repeat(Math.max(0, emptyStars));
    }
    // =========================================================
    // VIBE CONSTELLATION (D3 FORCE GRAPH)
    // =========================================================
    
    renderConstellation() {
        const container = document.getElementById('constellation-container');
        if (!container) return;
        
        // Stop previous simulation if exists
        if (this.constellationSimulation) {
            this.constellationSimulation.stop();
        }
        
        container.innerHTML = ''; // Clear SVG
        
        // Gather all books
        const storageKey = 'bibliodrift_library';
        const localLibrary = JSON.parse(localStorage.getItem(storageKey)) || {
            current: [],
            want: [],
            finished: []
        };
        
        let allBooks = [
            ...(localLibrary.current || []),
            ...(localLibrary.want || []),
            ...(localLibrary.finished || [])
        ];
        
        // Normalize book structure
        allBooks = allBooks.map(b => {
            if (b.volumeInfo) {
                return {
                    id: b.id,
                    title: b.volumeInfo.title || 'Untitled',
                    author: (b.volumeInfo.authors && b.volumeInfo.authors[0]) || 'Unknown',
                    cover: b.volumeInfo.imageLinks?.thumbnail || '',
                    description: b.volumeInfo.description || '',
                    rating: b.volumeInfo.averageRating || null,
                    moods: b.moods || [],
                    spineColor: b.spineColor
                };
            }
            return { ...b, moods: b.moods || [] };
        });

        // Apply Search Filter
        if (this.searchQuery) {
            allBooks = allBooks.filter(b => {
                const title = b.title.toLowerCase();
                const author = b.author.toLowerCase();
                const moods = b.moods.join(" ").toLowerCase();
                return title.includes(this.searchQuery) || author.includes(this.searchQuery) || moods.includes(this.searchQuery);
            });
        }
        
        // Empty state check
        const emptyState = document.getElementById('library-empty-state');
        if (allBooks.length === 0) {
            if (emptyState) emptyState.hidden = false;
            return;
        } else {
            if (emptyState) emptyState.hidden = true;
        }

        // Setup dimensions
        const width = container.clientWidth || 1000;
        const height = 600;

        // Colors for moods
        const moodColors = {
            'cozy': '#8d6e63',
            'dark': '#424242',
            'mysterious': '#5e35b1',
            'romantic': '#e91e63',
            'adventurous': '#ff5722',
            'melancholy': '#607d8b',
            'uplifting': '#4caf50',
            'default': '#d4af37' // accent-gold
        };

        const nodes = allBooks.map(b => {
            const primaryMood = (b.moods && b.moods[0]) ? b.moods[0].toLowerCase() : 'default';
            return {
                ...b,
                radius: 35, // Size of cover
                color: moodColors[primaryMood] || moodColors['default'],
                primaryMood: primaryMood
            };
        });

        // Create links between books that share the same primary mood
        const links = [];
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                if (nodes[i].primaryMood !== 'default' && nodes[i].primaryMood === nodes[j].primaryMood) {
                    links.push({
                        source: nodes[i].id,
                        target: nodes[j].id,
                        value: 1
                    });
                }
            }
        }

        const svg = d3.select("#constellation-container").append("svg")
            .attr("width", "100%")
            .attr("height", height)
            .style("background", "linear-gradient(to bottom, #111, #1a1a1a)")
            .style("border-radius", "8px")
            .style("box-shadow", "inset 0 0 50px rgba(0,0,0,0.5)");

        // Add defs for cover images and glow filters
        const defs = svg.append("defs");
        
        // Glow filter
        const filter = defs.append("filter").attr("id", "glow");
        filter.append("feGaussianBlur").attr("stdDeviation", "3.5").attr("result", "coloredBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "coloredBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        // Patterns for covers
        nodes.forEach(node => {
            defs.append("pattern")
                .attr("id", "cover-" + node.id)
                .attr("patternUnits", "userSpaceOnUse")
                .attr("width", node.radius * 2)
                .attr("height", node.radius * 2)
                .append("image")
                .attr("href", node.cover || '../assets/images/biblioDrift_favicon.png')
                .attr("width", node.radius * 2)
                .attr("height", node.radius * 2)
                .attr("preserveAspectRatio", "xMidYMid slice");
        });

        // Initialize forces
        this.constellationSimulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(120).strength(0.3))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(d => d.radius + 10).iterations(2));

        // Draw links
        const link = svg.append("g")
            .attr("stroke", "rgba(255, 255, 255, 0.15)")
            .attr("stroke-width", 1.5)
            .selectAll("line")
            .data(links)
            .join("line");

        // Draw nodes
        const node = svg.append("g")
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", d => d.radius)
            .attr("fill", d => `url(#cover-${d.id})`)
            .attr("stroke", d => d.color)
            .attr("stroke-width", 3)
            .style("filter", "url(#glow)")
            .style("cursor", "pointer")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        // Interaction
        node.on("mouseover", (event, d) => {
            d3.select(event.currentTarget)
                .transition().duration(200)
                .attr("r", d.radius * 1.2)
                .attr("stroke-width", 4);
            this.showTooltip(event, d);
        })
        .on("mousemove", (event) => {
            this.moveTooltip(event);
        })
        .on("mouseout", (event, d) => {
            d3.select(event.currentTarget)
                .transition().duration(200)
                .attr("r", d.radius)
                .attr("stroke-width", 3);
            this.hideTooltip();
        })
        .on("click", (event, d) => {
            this.openModal(d);
        });

        this.constellationSimulation.on("tick", () => {
            // Keep within bounds
            nodes.forEach(d => {
                d.x = Math.max(d.radius, Math.min(width - d.radius, d.x));
                d.y = Math.max(d.radius, Math.min(height - d.radius, d.y));
            });

            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });

        // Drag functions
        const self = this;
        function dragstarted(event) {
            if (!event.active) self.constellationSimulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
            self.moveTooltip(event); // keep tooltip with it
        }

        function dragended(event) {
            if (!event.active) self.constellationSimulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
    }

    // Cleanup method for SPA unmount/navigation.
    destroy() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        if (this.constellationSimulation) {
            this.constellationSimulation.stop();
            this.constellationSimulation = null;
        }

        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = null;
        }

        while (this.cleanupCallbacks.length > 0) {
            const cleanup = this.cleanupCallbacks.pop();
            try {
                cleanup();
            } catch (err) {
                console.warn('Cleanup listener failed', err);
            }
        }

        const constellationContainer = document.getElementById('constellation-container');
        if (constellationContainer) {
            constellationContainer.innerHTML = '';
        }

        if (this.modal && this.modal.classList.contains('active')) {
            this.closeModal();
        }

        if (this.liveRegion && this.liveRegion.parentNode) {
            this.liveRegion.parentNode.removeChild(this.liveRegion);
        }

        this.liveRegion = null;
        this.currentBook = null;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on library page
    if (document.getElementById('library-shelves')) {
        if (window.bookshelf3D && typeof window.bookshelf3D.destroy === 'function') {
            window.bookshelf3D.destroy();
        }

        const renderer = new BookshelfRenderer3D();
        window.bookshelf3D = renderer;
        window.bookshelfRenderer = renderer;

        window.addEventListener('pagehide', () => {
            if (window.bookshelf3D && typeof window.bookshelf3D.destroy === 'function') {
                window.bookshelf3D.destroy();
            }
        }, { once: true });
    }
});
