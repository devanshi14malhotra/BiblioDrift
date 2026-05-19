/*
 * BiblioDrift - Core Logic
 * Repaired build: stabilized runtime + fixed genre click + fixed library rendering integration.
 *
 * NOTE:
 * - The previous app.js in this repo appears corrupted/duplicated.
 * - This replacement restores the intended feature wiring using the existing
 *   implementations of LibraryManager, BookRenderer, GenreManager, and ThemeManager
 *   (from the non-corrupted portion of the file).
 */

// API_BASE and MOOD_API_BASE are declared globally in config.js (loaded first).
const IS_DEV = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const moodAnalysisCache = new Map();

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

let GOOGLE_API_KEY = '';

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

async function loadConfig() {
  try {
    const res = await fetch(`${MOOD_API_BASE}/config`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      GOOGLE_API_KEY = data.google_books_key || '';
      if (window.GoogleBooksClient && typeof window.GoogleBooksClient.setKeys === 'function') {
        window.GoogleBooksClient.setKeys([
          data.google_books_key,
          data.google_books_key_secondary,
        ]);
      }
      if (IS_DEV) console.log('Config loaded');
    }
  } catch (e) {
    console.warn('Failed to load backend config', e);
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast-notification ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ------------------- SafeStorage (simplified; keep repo behavior) -------------------
const SafeStorage = window.SafeStorage || {
  _dbName: 'BiblioDriftDB',
  _storeName: 'library_backup',

  async requestPersistence() {
    if (navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        if (IS_DEV) console.log(`[Storage] Persistent status: ${isPersisted}`);
      } catch (e) {
        console.warn('[Storage] Persist request failed', e);
      }
    }
  },

  async _openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this._dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this._storeName)) db.createObjectStore(this._storeName);
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      const isQuotaError =
        error instanceof DOMException &&
        (error.code === 22 ||
          error.code === 1014 ||
          error.name === 'QuotaExceededError' ||
          error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      if (isQuotaError) showToast('Local storage full! Saving to secure backup.', 'info');
      else console.error('LocalStorage Error:', error);
    }

    if (key === 'bibliodrift_library') {
      this._saveToDB(key, value);
    }
    return true;
  },

  async _saveToDB(key, value) {
    try {
      const db = await this._openDB();
      const transaction = db.transaction(this._storeName, 'readwrite');
      const store = transaction.objectStore(this._storeName);
      store.put(value, key);
    } catch (e) {
      console.error('IndexedDB Backup Failed', e);
    }
  },

  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },

  async getAsync(key) {
    let val = this.get(key);
    if (!val && key === 'bibliodrift_library') {
      try {
        const db = await this._openDB();
        const transaction = db.transaction(this._storeName, 'readonly');
        const store = transaction.objectStore(this._storeName);
        val = await new Promise((resolve) => {
          const request = store.get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        });
        if (val) {
          try {
            localStorage.setItem(key, val);
          } catch (_) {}
        }
      } catch (e) {
        console.warn('Backup retrieval failed', e);
      }
    }
    return val;
  },
};

// ------------------- Offline helpers -------------------
async function saveBookOffline(bookData) {
  try {
    if (!window.db) return false;
    await window.db.books.put({
      id: bookData.id,
      title: bookData.volumeInfo?.title || '',
      author: (bookData.volumeInfo?.authors || []).join(', '),
      content: bookData.volumeInfo?.description || '',
      coverUrl: bookData.volumeInfo?.imageLinks?.thumbnail || '',
      mood: '',
    });
    return true;
  } catch (e) {
    console.error('saveBookOffline failed', e);
    return false;
  }
}

async function removeOfflineBook(bookId) {
  try {
    if (!window.db) return false;
    await window.db.books.delete(bookId);
    return true;
  } catch (e) {
    console.error('removeOfflineBook failed', e);
    return false;
  }
}

async function handleDownloadToggle(bookCard, bookData) {
  const isAlreadyDownloaded = window.db ? await window.db.books.get(bookData.id) : null;
  if (isAlreadyDownloaded) {
    const success = await removeOfflineBook(bookData.id);
    if (success) bookCard.classList.remove('is-downloaded');
  } else {
    const success = await saveBookOffline(bookData);
    if (success) bookCard.classList.add('is-downloaded');
  }
}

// ------------------- BookRenderer -------------------
const MOCK_BOOKS = [
  {
    id: 'mock-dune',
    volumeInfo: {
      title: 'Dune',
      authors: ['Frank Herbert'],
      description: 'A sweeping science fiction epic set on the desert planet Arrakis.',
      imageLinks: { thumbnail: '../assets/images/dune.jpg' },
    },
  },
  {
    id: 'mock-1984',
    volumeInfo: {
      title: '1984',
      authors: ['George Orwell'],
      description: 'Orwell\'s chilling prophecy of a totalitarian future.',
      imageLinks: { thumbnail: '../assets/images/1984.jpg' },
    },
  },
  {
    id: 'mock-hobbit',
    volumeInfo: {
      title: 'The Hobbit',
      authors: ['J.R.R. Tolkien'],
      description: 'An unexpected journey across Middle-earth.',
      imageLinks: { thumbnail: '../assets/images/hobbit.jpg' },
    },
  },
  {
    id: 'mock-pride',
    volumeInfo: {
      title: 'Pride and Prejudice',
      authors: ['Jane Austen'],
      description: 'A timeless romance of manners and misunderstanding.',
      imageLinks: { thumbnail: '../assets/images/pride.jpg' },
    },
  },
];

const PREDEFINED_BOOKS = {
  'rainy': [
    { title: 'Norwegian Wood', author: 'Haruki Murakami' },
    { title: 'The Shadow of the Wind', author: 'Carlos Ruiz Zafón' },
    { title: 'The Night Circus', author: 'Erin Morgenstern' },
    { title: 'A Man Called Ove', author: 'Fredrik Backman' },
    { title: 'Kafka on the Shore', author: 'Haruki Murakami' }
  ],
  'indian': [
    { title: 'The God of Small Things', author: 'Arundhati Roy' },
    { title: 'Train to Pakistan', author: 'Khushwant Singh' },
    { title: 'The Palace of Illusions', author: 'Chitra Banerjee Divakaruni' },
    { title: 'Malgudi Days', author: 'R.K. Narayan' },
    { title: 'A Fine Balance', author: 'Rohinton Mistry' },
    { title: 'The White Tiger', author: 'Aravind Adiga' }
  ],
  'classics': [
    { title: 'Rebecca', author: 'Daphne du Maurier' },
    { title: 'Stoner', author: 'John Williams' },
    { title: 'The Moonstone', author: 'Wilkie Collins' },
    { title: 'A Tree Grows in Brooklyn', author: 'Betty Smith' },
    { title: 'The Woman in White', author: 'Wilkie Collins' }
  ],
  'dark_academia': [
    { title: 'The Secret History', author: 'Donna Tartt' },
    { title: 'If We Were Villains', author: 'M.L. Rio' },
    { title: 'Babel', author: 'R.F. Kuang' },
    { title: 'Ninth House', author: 'Leigh Bardugo' },
    { title: 'A Deadly Education', author: 'Naomi Novik' }
  ],
  'fiction': [
    { title: 'The Kite Runner', author: 'Khaled Hosseini' },
    { title: 'Eleanor Oliphant Is Completely Fine', author: 'Gail Honeyman' },
    { title: 'Little Fires Everywhere', author: 'Celeste Ng' },
    { title: 'Tomorrow, and Tomorrow, and Tomorrow', author: 'Gabrielle Zevin' },
    { title: 'The Book Thief', author: 'Markus Zusak' }
  ],
  'romance': [
    { title: 'Pride and Prejudice', author: 'Jane Austen' },
    { title: 'Beach Read', author: 'Emily Henry' },
    { title: 'The Love Hypothesis', author: 'Ali Hazelwood' },
    { title: 'It Ends with Us', author: 'Colleen Hoover' },
    { title: 'Book Lovers', author: 'Emily Henry' }
  ],
  'mystery': [
    { title: 'And Then There Were None', author: 'Agatha Christie' },
    { title: 'The Silent Patient', author: 'Alex Michaelides' },
    { title: 'Big Little Lies', author: 'Liane Moriarty' },
    { title: 'Gone Girl', author: 'Gillian Flynn' },
    { title: 'The Thursday Murder Club', author: 'Richard Osman' }
  ],
  'fiction_genre': [
    { title: 'Circe', author: 'Madeline Miller' },
    { title: 'The Midnight Library', author: 'Matt Haig' },
    { title: 'Project Hail Mary', author: 'Andy Weir' },
    { title: 'Normal People', author: 'Sally Rooney' },
    { title: 'The Alchemist', author: 'Paulo Coelho' }
  ],
  'crime': [
    { title: 'The Girl with the Dragon Tattoo', author: 'Stieg Larsson' },
    { title: 'In Cold Blood', author: 'Truman Capote' },
    { title: 'The Godfather', author: 'Mario Puzo' },
    { title: 'Sharp Objects', author: 'Gillian Flynn' },
    { title: 'The Snowman', author: 'Jo Nesbø' }
  ],
  'fantasy': [
    { title: 'The Name of the Wind', author: 'Patrick Rothfuss' },
    { title: 'Mistborn', author: 'Brandon Sanderson' },
    { title: 'The Hobbit', author: 'J.R.R. Tolkien' },
    { title: 'Six of Crows', author: 'Leigh Bardugo' },
    { title: 'The Priory of the Orange Tree', author: 'Samantha Shannon' }
  ],
  'thriller': [
    { title: 'The Girl on the Train', author: 'Paula Hawkins' },
    { title: 'Verity', author: 'Colleen Hoover' },
    { title: 'The Housemaid', author: 'Freida McFadden' },
    { title: 'Behind Closed Doors', author: 'B.A. Paris' },
    { title: 'Shutter Island', author: 'Dennis Lehane' }
  ],
  'biography': [
    { title: 'Steve Jobs', author: 'Walter Isaacson' },
    { title: 'Long Walk to Freedom', author: 'Nelson Mandela' },
    { title: 'The Diary of a Young Girl', author: 'Anne Frank' },
    { title: 'Wings of Fire', author: 'A.P.J. Abdul Kalam' },
    { title: 'Becoming', author: 'Michelle Obama' }
  ],
  'self-help': [
    { title: 'Atomic Habits', author: 'James Clear' },
    { title: 'Deep Work', author: 'Cal Newport' },
    { title: 'The Psychology of Money', author: 'Morgan Housel' },
    { title: 'The Mountain Is You', author: 'Brianna Wiest' },
    { title: 'Ikigai', author: 'Héctor García' }
  ],
  'science': [
    { title: 'A Brief History of Time', author: 'Stephen Hawking' },
    { title: 'Cosmos', author: 'Carl Sagan' },
    { title: 'The Gene', author: 'Siddhartha Mukherjee' },
    { title: 'Astrophysics for People in a Hurry', author: 'Neil deGrasse Tyson' },
    { title: 'Sapiens', author: 'Yuval Noah Harari' }
  ],
  'history': [
    { title: 'The Silk Roads', author: 'Peter Frankopan' },
    { title: 'India After Gandhi', author: 'Ramachandra Guha' },
    { title: 'Guns, Germs, and Steel', author: 'Jared Diamond' },
    { title: 'The Wright Brothers', author: 'David McCullough' },
    { title: 'SPQR', author: 'Mary Beard' }
  ]
};

function getFallbackBooks(query, maxResults = 5) {
  // Keep simple: return deterministic slice (so UI doesn\'t go empty)
  return MOCK_BOOKS.slice(0, Math.min(maxResults, MOCK_BOOKS.length));
}

class BookRenderer {
  constructor(libraryManager = null) {
    this.libraryManager = libraryManager;
  }

  renderSkeletons(container, count = 5) {
    if (!container) return;
    container.innerHTML = Array(count)
      .fill(0)
      .map(() => `<div class="book-skeleton skeleton"></div>`)
      .join('');
  }

  generateVibe(text, categories = []) {
    const lowerText = (text || '').toLowerCase();
    const lowerCats = (categories || []).join(' ').toLowerCase();
    if (lowerCats.includes('classic') || lowerText.includes('classic')) return 'A timeless tale that defined a genre.';
    if (lowerCats.includes('romance') || lowerText.includes('love')) return 'A heartwarming story of connection.';
    if (lowerCats.includes('mystery') || lowerText.includes('detective') || lowerText.includes('murder')) return 'Full of twists that keep you guessing.';
    if (lowerCats.includes('fantasy') || lowerText.includes('magic')) return 'A magical escape to another world.';
    return 'A quiet companion for coffee.';
  }

  getMoodIcon(mood) {
    const icons = {
      Melancholic: 'fa-cloud-showers-heavy',
      Cozy: 'fa-mug-hot',
      Tense: 'fa-bolt',
      Inspiring: 'fa-lightbulb',
      Whimsical: 'fa-wand-magic-sparkles',
      Dark: 'fa-moon',
      Adventurous: 'fa-compass',
    };
    return icons[mood] || 'fa-tag';
  }

  async createBookElement(bookData, shelf = null) {
    const { id, volumeInfo } = bookData;
    const title = volumeInfo?.title || 'Untitled';
    const authorsArr = volumeInfo?.authors || [];
    const authors = Array.isArray(authorsArr) ? authorsArr.join(', ') : 'Unknown Author';
    const thumb = volumeInfo?.imageLinks?.thumbnail || 'https://via.placeholder.com/128x196?text=No+Cover';
    const description = volumeInfo?.description || '';
    const categories = volumeInfo?.categories || [];

    const vibe = this.generateVibe(description.slice(0, 100), categories);

    const scene = document.createElement('div');
    scene.className = 'book-scene';

    const escapeHTML = (str) => {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#39;');
    };

    const safeTitle = escapeHTML(title);
    const safeAuthors = escapeHTML(authors);
    const safeThumb = escapeHTML(thumb.replace('http:', 'https:'));
    const safeVibe = escapeHTML(vibe);

    const spineColors = ['#5D4037', '#4E342E', '#3E2723', '#2C2420', '#8D6E63'];
    const randomSpine = spineColors[Math.floor(Math.random() * spineColors.length)];

    scene.innerHTML = `
      <div class="book" data-id="${escapeHTML(id)}">
        <div class="book__face book__face--front">
          <img src="${safeThumb}" alt="${safeTitle}">
        </div>
        <div class="book__face book__face--spine" style="background: ${randomSpine}"></div>
        <div class="book__face book__face--right"></div>
        <div class="book__face book__face--top"></div>
        <div class="book__face book__face--bottom"></div>
        <div class="book__face book__face--back">
          <div style="overflow-y: auto; height: 100%; padding-right: 5px; scrollbar-width: thin;">
            <div style="font-weight: bold; font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-main);">${safeTitle}</div>
            <div class="handwritten-note" style="margin-bottom: 0.8rem; font-style: italic; color: var(--wood-dark);">${safeVibe}</div>
            ${bookData.moods && bookData.moods.length ? `
              <div class="book-mood-tags" style="margin-bottom: 0.8rem; display: flex; flex-wrap: wrap; gap: 4px;">
                ${bookData.moods.map(m => `<span style="font-size: 0.6rem; background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 10px;"><i class="fa-solid ${this.getMoodIcon(m)}"></i> ${m}</span>`).join('')}
              </div>` : ''}
          </div>

          <button class="read-details-btn" title="Read Details">
            <i class="fa-solid fa-circle-info"></i> Read Details
          </button>

          ${shelf === 'current' ? `
            <div class="reading-progress">
              <input type="range" min="0" max="100" value="${typeof bookData.progress === 'number' ? bookData.progress : 0}" class="progress-slider" />
              <small>${typeof bookData.progress === 'number' ? bookData.progress : 0}% read</small>
            </div>` : ''}

          <div class="book-actions">
            <button class="btn-icon add-btn" title="Add to Library"><i class="fa-regular fa-heart"></i></button>
            <button class="btn-icon share-btn" title="Share Book"><i class="fa-solid fa-share-nodes"></i></button>
            <button class="btn-icon flip-back-btn" title="Flip Back"><i class="fa-solid fa-rotate-left"></i></button>
          </div>
        </div>
      </div>

      <div class="book-pages-3d"></div>
      <div class="glass-overlay">
        <strong>${safeTitle}</strong><br><small>${safeAuthors}</small>
      </div>
    `;

    // Add-to-library button
    const addBtn = scene.querySelector('.add-btn');
    if (addBtn && this.libraryManager) {
      const updateBtn = () => {
        const isIn = typeof this.libraryManager.findBook === 'function' && this.libraryManager.findBook(id);
        addBtn.innerHTML = isIn
          ? '<i class="fa-solid fa-check"></i>'
          : '<i class="fa-regular fa-heart"></i>';
      };
      updateBtn();

      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isIn = this.libraryManager.findBook(id);
        if (isIn) this.libraryManager.removeBook(id);
        else this.libraryManager.addBook(bookData, shelf || 'want');
        updateBtn();
      });
    }

    // Open details modal
    const detailsBtn = scene.querySelector('.read-details-btn');
    if (detailsBtn) {
      detailsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openModal(bookData);
      });
    }

    // Share
    const shareBtn = scene.querySelector('.share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const shareText = `Check out this book: ${title} by ${authors}`;
        navigator.clipboard
          .writeText(shareText)
          .then(() => showToast('Book details copied to clipboard!', 'success'))
          .catch(() => showToast('Failed to copy book details.', 'error'));
      });
    }

    // AI vibe hydrate (non-blocking)
    this.fetchAIVibe(title, authors, description).then((aiVibe) => {
      if (!aiVibe) return;
      const noteEl = scene.querySelector('.handwritten-note');
      if (noteEl) noteEl.textContent = aiVibe;
    });

    return scene;
  }

  async fetchAIVibe(title, author, description) {
    try {
      const res = await fetch(`${MOOD_API_BASE}/generate-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, author, description }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const payload = data.data || data;
      return payload?.vibe || payload?.bookseller_note || payload?.insight || payload?.note || null;
    } catch (_) {
      return null;
    }
  }

  openModal(book) {
    const modal = document.getElementById('book-details-modal');
    if (!modal) return;

    const modalImg = document.getElementById('modal-img');
    const modalTitle = document.getElementById('modal-title');
    const modalAuthor = document.getElementById('modal-author');
    const modalSummary = document.getElementById('modal-summary');

    const img = book.volumeInfo?.imageLinks?.thumbnail?.replace('http:', 'https:') || '';
    if (modalImg) modalImg.src = img;
    if (modalTitle) modalTitle.textContent = book.volumeInfo?.title || '';
    if (modalAuthor) modalAuthor.textContent = (book.volumeInfo?.authors || []).join(', ') || 'Unknown Author';

    if (modalSummary) {
      modalSummary.innerHTML = `<div class="text-skeleton skeleton"></div>`;
      this.fetchAIVibe(book.volumeInfo?.title || '', (book.volumeInfo?.authors || []).join(', '), book.volumeInfo?.description || '').then((vibe) => {
        if (vibe) modalSummary.innerHTML = `<p class="fade-in">${vibe}</p>`;
        else modalSummary.textContent = book.volumeInfo?.description || 'No description available.';
      });
    }

    const addBtn = document.getElementById('modal-add-btn');
    if (addBtn && this.libraryManager) {
      const isIn = typeof this.libraryManager.findBook === 'function' && this.libraryManager.findBook(book.id);
      addBtn.innerHTML = isIn ? '<i class="fa-solid fa-trash"></i> Remove from Library' : '<i class="fa-regular fa-heart"></i> Add to Library';
      addBtn.onclick = async () => {
        if (isIn) {
          await this.libraryManager.removeBook(book.id);
          modal.close();
        } else {
          await this.libraryManager.addBook(book, 'want');
        }
      };
    }

    const previewBtn = document.getElementById('modal-preview-btn');
    if (previewBtn) {
      previewBtn.onclick = () => {
        if (window.BookPreview && book.id) window.BookPreview.open(book.id, book.volumeInfo?.title || 'Book Preview');
      };
    }

    const shareBtn = document.getElementById('modal-share-btn');
    if (shareBtn) {
      shareBtn.onclick = () => {
        const shareText = `Check out this book: ${book.volumeInfo?.title} by ${(book.volumeInfo?.authors || []).join(', ') || 'Unknown Author'}`;
        navigator.clipboard
          .writeText(shareText)
          .then(() => showToast('Book title and author copied!', 'success'))
          .catch(() => showToast('Failed to copy book details.', 'error'));
      };
    }

    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn) closeBtn.onclick = () => modal.close();

    modal.showModal();
  }

  async renderCuratedSection(query, elementId, maxResults = 5) {
    const container = document.getElementById(elementId);
    if (!container) return;
    this.renderSkeletons(container, maxResults);

    try {
      const client = window.GoogleBooksClient;
      const data = client
        ? await client.fetchVolumes(query, { maxResults, extraParams: '&printType=books' })
        : await (async () => {
            const keyParam = GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : '';
            const encodedQuery = encodeURIComponent(query);
            const res = await fetch(`${API_BASE}?q=${encodedQuery}&maxResults=${maxResults}&printType=books${keyParam}`);
            if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
            return await res.json();
          })();

      const items = data?.items || [];
      if (items.length) return this.renderBookCards(container, items.slice(0, maxResults));
      const fallbackBooks = getFallbackBooks(query, maxResults);
      return this.renderBookCards(container, fallbackBooks);
    } catch (err) {
      console.error('Failed to fetch books', err);
      const fallbackBooks = getFallbackBooks(query, maxResults);
      return this.renderBookCards(container, fallbackBooks);
    }
  }

  async renderMoodCategorySection(categoryConfig, elementId, maxResults = 5) {
    const container = document.getElementById(elementId);
    if (!container) return;
    this.renderSkeletons(container, maxResults);

    try {
      const res = await fetch(`${MOOD_API_BASE}/category-books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category: categoryConfig.category,
          vibe_description: categoryConfig.vibeDescription,
          count: maxResults,
        }),
      });

      if (!res.ok) throw new Error(`Category API Error: ${res.status}`);

      const payload = await res.json();
      const categoryBooks = payload?.data?.books || [];

      if (!categoryBooks.length) throw new Error(`No books returned for category: ${categoryConfig.category}`);

      const resolvedBooks = await this.resolveCategoryBooks(categoryBooks);
      if (!resolvedBooks.length) throw new Error(`Could not resolve Google Books matches for category: ${categoryConfig.category}`);

      return this.renderBookCards(container, resolvedBooks.slice(0, maxResults));
    } catch (err) {
      console.error(`Failed to load category shelf "${categoryConfig.category}"`, err);
      if (categoryConfig.fallbackQuery) {
        return this.renderCuratedSection(categoryConfig.fallbackQuery, elementId, maxResults);
      }
      const fallbackBooks = getFallbackBooks(categoryConfig.category, maxResults);
      return this.renderBookCards(container, fallbackBooks);
    }
  }

  async resolveCategoryBooks(categoryBooks) {
    const resolvedBooks = [];

    for (const item of categoryBooks) {
      const title = String(item?.title || '').trim();
      const author = String(item?.author || '').trim();
      if (!title) continue;

      const searchQuery = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`;

      try {
        const client = window.GoogleBooksClient;
        const data = client
          ? await client.fetchVolumes(searchQuery, { maxResults: 1, extraParams: '&printType=books' })
          : await (async () => {
              const keyParam = GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : '';
              const res = await fetch(`${API_BASE}?q=${encodeURIComponent(searchQuery)}&maxResults=1&printType=books${keyParam}`);
              if (!res.ok) throw new Error(`Google Books API Error: ${res.status}`);
              return await res.json();
            })();

        const matchedBook = data?.items?.[0];
        if (matchedBook) {
          matchedBook.categoryReason = item.reason || '';
          resolvedBooks.push(matchedBook);
        } else {
          throw new Error('No match found');
        }
      } catch (e) {
        console.warn(`Failed to resolve category book "${title}"`, e);
        // Fallback to offline display
        resolvedBooks.push({
           id: `fallback-${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
           volumeInfo: {
             title: title,
             authors: author ? [author] : [],
             description: 'A wonderful book waiting to be explored.',
             imageLinks: { thumbnail: 'https://via.placeholder.com/128x196/2C2420/F0E6D2?text=' + encodeURIComponent(title) }
           }
        });
      }
    }

    return resolvedBooks;
  }

  async renderBookCards(container, books) {
    container.innerHTML = '';
    if (!books?.length) {
      container.innerHTML = '<p class="empty-state">No books available for this collection.</p>';
      return;
    }

    for (const book of books) {
      try {
        const el = await this.createBookElement(book);
        if (el) container.appendChild(el);
      } catch (e) {
        console.error('Failed to render book', e);
      }
    }

    if (!container.children.length) {
      container.innerHTML = '<p class="empty-state">Failed to load books. Please check your connection.</p>';
    }
  }
}

// ------------------- LibraryManager (only sync + storage; bookshelf UI handled by library-3d.js) -------------------
class LibraryManager {
  constructor() {
    this.storageKey = 'bibliodrift_library';
    this.library = { current: [], want: [], finished: [] };
    this.apiBase = MOOD_API_BASE;
    this._initPromise = this.init();
  }

  async ready() {
    await this._initPromise;
    return this;
  }

  async init() {
    await SafeStorage.requestPersistence();
    const stored = await SafeStorage.getAsync(this.storageKey);
    if (stored) {
      try {
        this.library = JSON.parse(stored);
      } catch (e) {
        console.error('[Library] Failed to parse stored library, resetting to empty.', e);
      }
    }

    this.setupSorting();

    // Initial render is handled by library-3d.js. We only sync.
    await this.syncWithBackend();
  }

  getUser() {
    const userStr = SafeStorage.get('bibliodrift_user');
    return userStr ? JSON.parse(userStr) : null;
  }

  getAuthHeaders() {
    const csrfToken = getCookie('csrf_access_token');
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken;
    return new Headers(headers);
  }

  async syncWithBackend() {
    const user = this.getUser();
    if (!user) return;

    try {
      const res = await fetch(`${this.apiBase}/library/${user.id}`, {
        headers: this.getAuthHeaders(),
        credentials: 'include',
      });

      if (!res.ok) return;
      const data = await res.json();

      const localBooksMap = new Map();
      ['current', 'want', 'finished'].forEach((shelf) => {
        this.library[shelf].forEach((book) => localBooksMap.set(book.id, { book, shelf }));
      });

      data.library.forEach((item) => {
        const existing = localBooksMap.get(item.google_books_id);
        const remoteBook = {
          id: item.google_books_id,
          db_id: item.id,
          version: item.version,
          volumeInfo: {
            title: item.title,
            authors: item.authors ? item.authors.split(', ') : [],
            imageLinks: { thumbnail: item.thumbnail },
          },
          progress: item.progress,
          date_added: item.created_at || new Date().toISOString(),
        };

        if (existing) {
          const localBook = existing.book;
          if (item.version > (localBook.version || 0)) {
            if (existing.shelf !== item.shelf_type) {
              this.library[existing.shelf] = this.library[existing.shelf].filter((b) => b.id !== item.google_books_id);
              this.library[item.shelf_type].push(remoteBook);
            } else {
              Object.assign(localBook, remoteBook);
            }
          } else if (item.version === (localBook.version || 0)) {
            localBook.db_id = item.id;
          }
          localBooksMap.delete(item.google_books_id);
        } else {
          if (this.library[item.shelf_type]) this.library[item.shelf_type].push(remoteBook);
        }
      });

      this.saveLocally();

      // Trigger 3D UI refresh
      if (window.bookshelf3D && typeof window.bookshelf3D.refreshShelves === 'function') {
        window.bookshelf3D.refreshShelves();
      } else {
        window.dispatchEvent(new CustomEvent('bibliodrift:library-manager-synced', { detail: { libraryManager: this } }));
      }
    } catch (e) {
      console.error('Sync failed', e);
    }
  }

  async syncLocalToBackend(user) {
    if (!user) return;

    const itemsToSync = [];
    ['current', 'want', 'finished'].forEach((shelf) => {
      if (this.library[shelf]) {
        this.library[shelf].forEach((book) => {
          itemsToSync.push({
            ...book,
            shelf,
            version: book.version || 0,
          });
        });
      }
    });

    if (!itemsToSync.length) return;

    const res = await fetch(`${this.apiBase}/library/sync`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ user_id: user.id, items: itemsToSync }),
    });

    if (res.ok) {
      await this.syncWithBackend();
    }
  }

  setupSorting() {
    const sortSelect = document.getElementById('library-sort');
    const searchInput = document.getElementById('searchInput');

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const crit = e.target.value;
        if (window.bookshelf3D && typeof window.bookshelf3D.refreshShelves === 'function') {
          window.bookshelf3D.sortCriteria = crit;
          window.bookshelf3D.refreshShelves();
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        if (window.bookshelf3D && typeof window.bookshelf3D.refreshShelves === 'function') {
          window.bookshelf3D.searchQuery = e.target.value.toLowerCase();
          window.bookshelf3D.refreshShelves();
        }
      });
    }
  }

  findBook(id) {
    for (const shelf in this.library) if (this.library[shelf].some((b) => b.id === id)) return true;
    return false;
  }

  findBookInShelf(id) {
    for (const shelf in this.library) {
      const book = this.library[shelf].find((b) => b.id === id);
      if (book) return { shelf, book };
    }
    return null;
  }

  async addBook(book, shelf) {
    if (this.findBook(book.id)) return;

    const enrichedBook = {
      ...book,
      progress: shelf === 'current' ? 0 : null,
      date_added: new Date().toISOString(),
    };

    this.library[shelf].push(enrichedBook);
    this.saveLocally();

    // Backend sync (best effort)
    const user = this.getUser();
    if (user) {
      try {
        const payload = {
          user_id: user.id,
          google_books_id: book.id,
          title: book.volumeInfo?.title,
          authors: book.volumeInfo?.authors ? book.volumeInfo.authors.join(', ') : '',
          thumbnail: book.volumeInfo?.imageLinks ? book.volumeInfo.imageLinks.thumbnail : '',
          shelf_type: shelf,
        };

        const res = await fetch(`${this.apiBase}/library`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          enrichedBook.db_id = data.item.id;
          enrichedBook.version = data.item.version;
          this.saveLocally();
        }
      } catch (_) {
        // ignore
      }
    }

    if (window.bookshelf3D && typeof window.bookshelf3D.refreshShelves === 'function') window.bookshelf3D.refreshShelves();
  }

  async updateBook(id, updates) {
    const result = this.findBookInShelf(id);
    if (!result) return;
    const { shelf, book } = result;

    Object.assign(book, updates);

    if (updates.progress === 100 && shelf !== 'finished') {
      this.library[shelf] = this.library[shelf].filter((b) => b.id !== id);
      this.library.finished.push(book);
    }

    this.saveLocally();
    if (window.bookshelf3D && typeof window.bookshelf3D.refreshShelves === 'function') window.bookshelf3D.refreshShelves();
  }

  async removeBook(id) {
    const result = this.findBookInShelf(id);
    if (!result) return;
    const { shelf } = result;
    this.library[shelf] = this.library[shelf].filter((b) => b.id !== id);
    this.saveLocally();
    if (window.bookshelf3D && typeof window.bookshelf3D.refreshShelves === 'function') window.bookshelf3D.refreshShelves();
  }

  async moveBook(id, toShelf) {
    const result = this.findBookInShelf(id);
    if (!result) return false;

    const { shelf: fromShelf, book } = result;
    if (fromShelf === toShelf) return true;

    this.library[fromShelf] = this.library[fromShelf].filter((b) => b.id !== id);

    if (toShelf === 'finished') book.progress = 100;
    if (toShelf === 'current') book.progress = 0;

    this.library[toShelf].push(book);
    this.saveLocally();
    if (window.bookshelf3D && typeof window.bookshelf3D.refreshShelves === 'function') window.bookshelf3D.refreshShelves();
    return true;
  }

  saveLocally() {
    SafeStorage.set(this.storageKey, JSON.stringify(this.library));
  }

  getLibrarySnapshot() {
    return {
      current: [...this.library.current],
      want: [...this.library.want],
      finished: [...this.library.finished],
    };
  }

  getUser() {
    const userStr = SafeStorage.get('bibliodrift_user');
    return userStr ? JSON.parse(userStr) : null;
  }
}

// ------------------- ThemeManager -------------------
class ThemeManager {
  constructor() {
    this.themeKey = 'bibliodrift_theme';
    this.toggleBtn = document.getElementById('themeToggle');

    const stored = SafeStorage.get(this.themeKey);
    this.currentTheme = stored === 'night' ? 'night' : 'light';

    this._handler = this._onClick.bind(this);
    this.init();
  }

  _onClick() {
    this.currentTheme = this.currentTheme === 'night' ? 'light' : 'night';
    this.applyTheme(this.currentTheme);
    SafeStorage.set(this.themeKey, this.currentTheme);
  }

  init() {
    if (!this.toggleBtn) return;
    this.applyTheme(this.currentTheme);
    this.toggleBtn.removeEventListener('click', this._handler);
    this.toggleBtn.addEventListener('click', this._handler);
  }

  applyTheme(theme) {
    if (theme === 'night') document.documentElement.setAttribute('data-theme', 'night');
    else document.documentElement.removeAttribute('data-theme');

    if (this.toggleBtn) {
      const icon = this.toggleBtn.querySelector('i');
      if (icon) icon.className = theme === 'night' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }
}

// ------------------- GenreManager -------------------
class GenreManager {
  constructor(libraryManager = null) {
    this.libraryManager = libraryManager;
    this.genreGrid = document.getElementById('genre-grid');
    this.modal = document.getElementById('genre-modal');
    this.closeBtn = document.getElementById('close-genre-modal');
    this.modalTitle = document.getElementById('genre-modal-title');
    this.booksGrid = document.getElementById('genre-books-grid');
  }

  init() {
    if (!this.genreGrid) return;

    const cards = this.genreGrid.querySelectorAll('.genre-card');
    cards.forEach((card) => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const genre = card.dataset.genre;
        if (genre) this.openGenre(genre);
      });
    });

    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.closeModal());

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.closeModal();
      });
    }
  }

  openGenre(genre) {
    if (!this.modal) return;
    this.modalTitle.textContent = `${genre.charAt(0).toUpperCase() + genre.slice(1)} Books`;
    this.modal.showModal();
    document.body.style.overflow = 'hidden';
    this.fetchBooks(genre);
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.close();
    document.body.style.overflow = '';
  }

  async fetchBooks(genre) {
    if (!this.booksGrid) return;

    const renderer = window.renderer;
    if (renderer && typeof renderer.renderSkeletons === 'function') {
      renderer.renderSkeletons(this.booksGrid, 10);
    }

    try {
      const predefinedKey = genre === 'fiction' ? 'fiction_genre' : genre;
      if (PREDEFINED_BOOKS[predefinedKey]) {
        const resolved = await renderer.resolveCategoryBooks(PREDEFINED_BOOKS[predefinedKey]);
        if (resolved && resolved.length) {
          return renderer.renderBookCards(this.booksGrid, resolved);
        }
      }

      // Fallback: direct Google Books subject fetch
      const client = window.GoogleBooksClient;
      const data = client
        ? await client.fetchVolumes(`subject:${genre}`, { maxResults: 20, extraParams: '&langRestrict=en&orderBy=relevance' })
        : await (async () => {
            const keyParam = GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : '';
            const response = await fetch(`${API_BASE}?q=subject:${genre}&maxResults=20&langRestrict=en&orderBy=relevance${keyParam}`);
            if (!response.ok) throw new Error('Google Books request failed');
            return await response.json();
          })();

      const items = data?.items || [];
      if (items.length) return renderer.renderBookCards(this.booksGrid, items);

      return renderer.renderBookCards(this.booksGrid, getFallbackBooks(genre, 10));
    } catch (error) {
      console.error('Error fetching genre books:', error);
      if (window.renderer) window.renderer.renderBookCards(this.booksGrid, getFallbackBooks(genre, 10));
    }
  }
}

// ------------------- Bootstrap -------------------
document.addEventListener('DOMContentLoaded', async () => {
  const libManager = new LibraryManager();
  window.libManager = libManager;
  window.renderer = new BookRenderer(libManager);

  libManager.ready().then(() => {
    window.dispatchEvent(new CustomEvent('bibliodrift:library-manager-ready', { detail: { libraryManager: libManager } }));
  });

  loadConfig();

  new ThemeManager();
  new GenreManager(libManager).init();

  // Populate discovery shelves on index.html only
  const renderer = window.renderer;
  if (document.getElementById('row-rainy')) {
    const discoveryShelves = [
      { id: 'rainy', elementId: 'row-rainy' },
      { id: 'indian', elementId: 'row-indian' },
      { id: 'classics', elementId: 'row-classics' },
      { id: 'dark_academia', elementId: 'row-dark-academia' },
      { id: 'fiction', elementId: 'row-fiction' },
    ];

    (async () => {
      try {
        for (const shelf of discoveryShelves) {
          const container = document.getElementById(shelf.elementId);
          if (!container) continue;

          if (renderer && typeof renderer.renderSkeletons === 'function') {
            renderer.renderSkeletons(container, 5);
          }

          if (PREDEFINED_BOOKS[shelf.id]) {
            const resolved = await renderer.resolveCategoryBooks(PREDEFINED_BOOKS[shelf.id]);
            await renderer.renderBookCards(container, resolved.slice(0, 5));
          }
          await delay(300);
        }
      } catch (e) {
        console.error('Shelf initialization failed', e);
      }
    })();
  }
});

