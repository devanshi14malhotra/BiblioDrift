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

class BookshelfRenderer3D {
    constructor() {
        this.tooltip = document.getElementById('book-tooltip');
        this.modal = document.getElementById('book-detail-modal');
        this.currentBook = null;
        this.tooltipTimeout = null;
        this.sortCriteria = 'title'; // Default sort
        this.filterCriteria = 'all'; // Default filter
        this.searchQuery = ''; // Default search query

        this.init();
    }

    init() {
        // Sort listener
        const sortSelect = document.getElementById('library-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortCriteria = e.target.value;
                this.refreshShelves();
            });
        }

        // Filter listener
        const filterSelect = document.getElementById('library-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterCriteria = e.target.value;
                this.refreshShelves();
            });
        }

        // Search listener for "Search for a feeling..."
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.refreshShelves();
            });
        }

        // Render all shelves with sample books
        this.refreshShelves();

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
        const storageKey = 'bibliodrift_library';
        const localLibrary = JSON.parse(localStorage.getItem(storageKey)) || {
            current: [],
            want: [],
            finished: []
        };
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

        // Fetch real library data
        const storageKey = 'bibliodrift_library';
        const localLibrary = JSON.parse(localStorage.getItem(storageKey)) || {
            current: [],
            want: [],
            finished: []
        };
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
                    reviews: []
                };
            }
            return { ...b, moods: b.moods || [] };
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

        // Add Shelf Drop Zone Logic
        // Remove old listeners? It's hard without named functions. 
        // But since we clear innerHTML, we just re-attach to the container? No, container is persistent.
        // We should be careful about duplicate listeners on the container.

        // A simple way to avoid duplicates is to set a custom property or remove and re-add.
        // Or better, just attach these once in init() if possible, but we need shelfType reference.
        // Since renderShelf is called multiple times, we should check if listeners are attached.

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
                const bookId = e.dataTransfer.getData('bookId');
                const sourceShelf = e.dataTransfer.getData('sourceShelf');

                if (bookId && sourceShelf && sourceShelf !== shelfType) {
                    this.moveBook(bookId, sourceShelf, shelfType);
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
        document.getElementById('tooltip-title').textContent = book.title;
        document.getElementById('tooltip-author').textContent = `by ${book.author}`;
        document.getElementById('tooltip-stars').textContent = this.getStarRating(book.rating);
        document.getElementById('tooltip-rating-text').textContent = (book.rating != null ? book.rating.toFixed(1) : 'N/A');
        document.getElementById('tooltip-description').textContent = book.description.substring(0, 150) + '...';

        // Position tooltip
        this.moveTooltip(e);

        // Show tooltip with small delay
        setTimeout(() => {
            this.tooltip.classList.add('visible');
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
        if (coverImg) coverImg.src = book.cover;

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
            // Find current shelf
            const storageKey = 'bibliodrift_library';
            const localLibrary = JSON.parse(localStorage.getItem(storageKey)) || {};
            let currentShelf = 'current'; // Default

            ['current', 'want', 'finished'].forEach(shelf => {
                const found = (localLibrary[shelf] || []).find(b => b.id === book.id || (b.volumeInfo && b.id === book.id));
                if (found) currentShelf = shelf;
            });

            shelfSelect.value = currentShelf;

            // Remove old listeners to avoid duplicates by cloning
            const newSelect = shelfSelect.cloneNode(true);
            shelfSelect.parentNode.replaceChild(newSelect, shelfSelect);

            newSelect.addEventListener('change', async (e) => {
                const newShelf = e.target.value;
                await this.moveBook(book.id, currentShelf, newShelf);
                currentShelf = newShelf; // Update local tracker

                // Close modal after move? Optional. Let's keep it open but maybe show feedback.
                // For now, shelf re-render happens in background.
            });
        }

        if (removeBtn) {
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
                    setTimeout(() => {
                        newShareBtn.innerHTML = originalHTML;
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                });
            });
        }

        // Show modal
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
            // Remove lingering clones to prevent multiple listeners if re-initialized
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

            newCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeModal();
            });
        }

        // Click outside to close (backdrop)
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                // If clicking the backdrop (modal container itself)
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal && this.modal.classList.contains('active')) {
                this.closeModal();
            }
        });

        // Add to library button logic
        const addBtn = document.getElementById('modal-add-btn');
        if (addBtn) {
            const newAddBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newAddBtn, addBtn);

            newAddBtn.addEventListener('click', async () => {
                newAddBtn.innerHTML = '<i class="fa-solid fa-check"></i> Added!';
                newAddBtn.style.background = '#4CAF50';
                newAddBtn.style.color = '#fff';

                // Store in localStorage (integrate with existing library system)
                if (this.currentBook) {
                    await this.addToLibrary(this.currentBook);
                }

                setTimeout(() => {
                    newAddBtn.innerHTML = '<i class="fa-regular fa-heart"></i> Add to Library';
                    newAddBtn.style.background = '';
                    newAddBtn.style.color = '';
                }, 2000);
            });
        }

        // Mark as read button logic
        const readBtn = document.getElementById('modal-read-btn');
        if (readBtn) {
            const newReadBtn = readBtn.cloneNode(true);
            readBtn.parentNode.replaceChild(newReadBtn, readBtn);

            newReadBtn.addEventListener('click', () => {
                newReadBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Marked!';
                newReadBtn.style.background = 'var(--wood-light)';
                newReadBtn.style.color = 'white';

                setTimeout(() => {
                    newReadBtn.innerHTML = '<i class="fa-solid fa-check"></i> Mark as Read';
                    newReadBtn.style.background = '';
                    newReadBtn.style.color = '';
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

        if (window.libManager && typeof window.libManager.findBookInShelf === 'function') {
            const found = window.libManager.findBookInShelf(bookId);
            if (!found || !found.book) {
                console.error("Book not found in source shelf");
                return;
            }

            await window.libManager.removeBook(bookId);
            await window.libManager.addBook(found.book, toShelf);
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
        const storageKey = 'bibliodrift_library';
        const localLibrary = JSON.parse(localStorage.getItem(storageKey)) || {
            current: [],
            want: [],
            finished: []
        };

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
            // Notify global libManager to sync with backend if available
            if (window.libManager && window.libManager.updateBook) {
                await window.libManager.updateBook(bookId, { moods });
            }
            // Sort by current criteria after update
            this.refreshShelves();
        }
    }

    getStarRating(rating) {
        const fullStars = Math.floor(rating || 0);
        const hasHalf = (rating || 0) % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

        return '★'.repeat(Math.max(0, fullStars)) + (hasHalf ? '½' : '') + '☆'.repeat(Math.max(0, emptyStars));
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on library page
    if (document.getElementById('library-shelves')) {
        const renderer = new BookshelfRenderer3D();
        window.bookshelf3D = renderer;
        window.bookshelfRenderer = renderer;
    }
});
