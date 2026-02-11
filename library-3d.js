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

        // Render all shelves with sample books
        this.refreshShelves();

        // Setup modal close handlers
        this.setupModalHandlers();
    }

    refreshShelves() {
        const showCurrent = this.filterCriteria === 'all' || this.filterCriteria === 'current';
        const showWant = this.filterCriteria === 'all' || this.filterCriteria === 'want';
        const showFinished = this.filterCriteria === 'all' || this.filterCriteria === 'finished';

        this.updateShelfVisibility('shelf-current-3d', showCurrent);
        this.updateShelfVisibility('shelf-want-3d', showWant);
        this.updateShelfVisibility('shelf-finished-3d', showFinished);

        if (showCurrent) this.renderShelf('current', 'shelf-current-3d');
        if (showWant) this.renderShelf('want', 'shelf-want-3d');
        if (showFinished) this.renderShelf('finished', 'shelf-finished-3d');
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

        let books = [...(SAMPLE_BOOKS[shelfType] || [])]; // Clone array

        // Sort books
        books.sort((a, b) => {
            if (this.sortCriteria === 'title') return a.title.localeCompare(b.title);
            if (this.sortCriteria === 'author') return a.author.localeCompare(b.author);
            if (this.sortCriteria === 'rating') return b.rating - a.rating;
             // Sort by 'pages'. Since SAMPLE_BOOKS doesn't have page count, we'll strip 'pages' option or just map it to something else
             // But let's assume title for now or mock it? 
             return a.title.localeCompare(b.title);
        });

        if (!books || books.length === 0) {
            container.innerHTML = '<div class="empty-shelf-3d">No books yet... Start your collection!</div>';
            return;
        }

        container.innerHTML = '';

        books.forEach((book, index) => {
            const bookSpine = this.createBookSpine(book, index);
            container.appendChild(bookSpine);
        });
    }

    createBookSpine(book, index) {
        const spine = document.createElement('div');
        spine.className = 'book-spine-3d';
        spine.dataset.bookId = book.id;

        // Vary spine width based on title length and "page count"
        // Wider spines for longer titles to fit full text
        const baseWidth = Math.min(55, 38 + book.title.length * 0.5);
        const spineWidth = baseWidth + Math.floor(Math.random() * 5);
        // MUCH taller books so full title is readable
        const baseHeight = Math.min(280, 220 + book.title.length * 2.5);
        const spineHeight = baseHeight + Math.floor(Math.random() * 10);

        spine.style.width = `${spineWidth}px`;
        spine.style.height = `${spineHeight}px`;
        spine.style.setProperty('--spine-color', book.spineColor);

        // Animation delay for staggered entrance
        spine.style.animationDelay = `${index * 0.1}s`;

        spine.innerHTML = `
            <div class="spine-face" style="background-color: ${book.spineColor}; color: ${book.textColor};">
                <span class="spine-title">${book.title}</span>
                <span class="spine-author">${book.author.split(' ').pop()}</span>
            </div>
            <div class="book-edge"></div>
            <div class="book-top" style="--spine-color: ${book.spineColor};"></div>
        `;

        // Event listeners
        spine.addEventListener('mouseenter', (e) => this.showTooltip(e, book));
        spine.addEventListener('mousemove', (e) => this.moveTooltip(e));
        spine.addEventListener('mouseleave', () => this.hideTooltip());
        spine.addEventListener('click', () => this.openModal(book));

        return spine;
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
        document.getElementById('tooltip-rating-text').textContent = book.rating.toFixed(1);
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

        // Populate modal content
        document.getElementById('modal-cover').src = book.cover;
        document.getElementById('modal-title').textContent = book.title;
        document.getElementById('modal-author').textContent = `by ${book.author}`;
        document.getElementById('modal-stars').textContent = this.getStarRating(book.rating);
        document.getElementById('modal-rating-score').textContent = book.rating.toFixed(1);
        document.getElementById('modal-rating-count').textContent = `(${book.ratingCount.toLocaleString()} ratings)`;
        document.getElementById('modal-description').textContent = book.description;

        // Categories
        const categoriesContainer = document.getElementById('modal-categories');
        categoriesContainer.innerHTML = book.categories.map(cat =>
            `<span class="category-tag">${cat}</span>`
        ).join('');

        // Reviews
        const reviewsContainer = document.getElementById('modal-reviews');
        reviewsContainer.innerHTML = book.reviews.map(review => `
            <div class="review-item">
                <div class="review-header">
                    <span class="reviewer-name">${review.name}</span>
                    <span class="review-rating">${this.getStarRating(review.rating)}</span>
                </div>
                <p class="review-text">"${review.text}"</p>
            </div>
        `).join('');

        // Show modal
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    setupModalHandlers() {
        // Close button
        document.getElementById('modal-close-btn').addEventListener('click', () => this.closeModal());

        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.closeModal();
            }
        });

        // Add to library button
        document.getElementById('modal-add-btn').addEventListener('click', () => {
            const btn = document.getElementById('modal-add-btn');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Added!';
            btn.style.background = '#4CAF50';

            // Store in localStorage (integrate with existing library system)
            this.addToLibrary(this.currentBook);

            setTimeout(() => {
                btn.innerHTML = '<i class="fa-regular fa-heart"></i> Add to Library';
                btn.style.background = '';
            }, 2000);
        });

        // Mark as read button
        document.getElementById('modal-read-btn').addEventListener('click', () => {
            const btn = document.getElementById('modal-read-btn');
            btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Marked!';
            btn.style.background = 'var(--wood-light)';
            btn.style.color = 'white';

            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Mark as Read';
                btn.style.background = '';
                btn.style.color = '';
            }, 2000);
        });
    }

    addToLibrary(book) {
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

    getStarRating(rating) {
        const fullStars = Math.floor(rating);
        const hasHalf = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

        return '★'.repeat(fullStars) + (hasHalf ? '½' : '') + '☆'.repeat(emptyStars);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on library page
    if (document.getElementById('library-shelves')) {
        new BookshelfRenderer3D();
    }
});
