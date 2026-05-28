/**
 * ==============================================================================
 * BiblioDrift — In-App Book Preview (Google Books Embedded Viewer)
 * ==============================================================================
 *
 * Public API:  BookPreview.open(googleBooksId, title)
 *
 * Implementation notes:
 * ---------------------
 * 1. Uses a plain <div> overlay (not <dialog>) — consistent with the rest of
 *    the app and avoids top-layer stacking issues that break the close button
 *    when nested inside another modal.
 *
 * 2. Google Books jsapi.js initialisation:
 *    The correct pattern is:
 *      google.load('books', '0', { callback: fn })
 *    NOT google.books.setOnLoadCallback() — that method only exists after
 *    google.load('books') has already been called.
 *
 * 3. viewer.load(id, notFoundCb, successCb) is the authoritative availability
 *    check — no pre-flight API call needed.
 *
 * 4. 10-second hard timeout prevents infinite loading spinner.
 * ==============================================================================
 */

const BookPreview = (() => {

    // ── State ──────────────────────────────────────────────────────────────────
    let _apiReady       = false;   // true once google.books module is loaded
    let _apiScriptAdded = false;   // true once jsapi.js tag is in the DOM
    let _pendingCbs     = [];      // { resolve, reject } queued during load

    // Google Books volume IDs are 12 chars typically, allow 8-20 to be safe
    const VALID_ID_RE = /^[a-zA-Z0-9_-]{8,20}$/;

    // ── Helpers ────────────────────────────────────────────────────────────────

    function _isValidId(id) {
        return typeof id === 'string' && VALID_ID_RE.test(id.trim());
    }

    // ── API loader ─────────────────────────────────────────────────────────────

    /**
     * Load jsapi.js and initialise the Google Books module.
     *
     * Correct pattern (from Google's own docs):
     *   <script src="https://www.google.com/books/jsapi.js"></script>
     *   google.load("books", "0", { callback: myInit });
     *   function myInit() {
     *       var viewer = new google.books.DefaultViewer(...);
     *   }
     *
     * @returns {Promise<void>}
     */
    function _loadAPI() {
        return new Promise((resolve, reject) => {
            if (_apiReady) { resolve(); return; }

            _pendingCbs.push({ resolve, reject });
            if (_apiScriptAdded) return;  // already loading, just queue
            _apiScriptAdded = true;

            const script = document.createElement('script');
            script.src   = 'https://www.google.com/books/jsapi.js';
            script.async = true;

            script.onload = () => {
                if (!window.google || typeof window.google.load !== 'function') {
                    const e = new Error('[BookPreview] google.load not available after jsapi.js');
                    _pendingCbs.forEach(cb => cb.reject(e));
                    _pendingCbs = [];
                    return;
                }

                // google.load('books', '0', {callback}) is the correct init call
                window.google.load('books', '0', {
                    callback: () => {
                        _apiReady = true;
                        _pendingCbs.forEach(cb => cb.resolve());
                        _pendingCbs = [];
                    }
                });
            };

            script.onerror = () => {
                const e = new Error('[BookPreview] Failed to load jsapi.js');
                _pendingCbs.forEach(cb => cb.reject(e));
                _pendingCbs = [];
            };

            document.head.appendChild(script);
        });
    }

    // ── Modal ──────────────────────────────────────────────────────────────────

    function _getOrCreateModal() {
        let el = document.getElementById('book-preview-modal');
        if (el) return el;

        el = document.createElement('dialog');
        el.id        = 'book-preview-modal';
        el.className = 'book-preview-modal';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', 'Book preview');

        el.innerHTML = `
            <div class="preview-modal-inner">
                <div class="preview-modal-header">
                    <div class="preview-modal-title-wrap">
                        <i class="fa-solid fa-book-open preview-header-icon" aria-hidden="true"></i>
                        <span class="preview-modal-title" id="preview-modal-title">Book Preview</span>
                        <span class="preview-powered-by">via Google Books</span>
                    </div>
                    <button class="preview-close-btn" id="preview-close-btn"
                        type="button" aria-label="Close preview" title="Close preview">
                        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                    </button>
                </div>

                <div class="preview-modal-body">
                    <!-- Loading -->
                    <div class="preview-loading" id="preview-loading">
                        <div class="preview-loading-spinner"></div>
                        <p>Opening preview...</p>
                    </div>

                    <!-- Viewer — Google injects iframe here -->
                    <div class="preview-viewer-container"
                         id="preview-viewer-container"
                         style="display:none;"></div>

                    <!-- Fallback -->
                    <div class="preview-fallback" id="preview-fallback" style="display:none;">
                        <div class="preview-fallback-icon">
                            <i class="fa-solid fa-book-open-reader" aria-hidden="true"></i>
                        </div>
                        <h3 class="preview-fallback-title">Preview Unavailable</h3>
                        <p class="preview-fallback-msg" id="preview-fallback-msg">
                            A preview isn't available for this book right now.
                        </p>
                        <a class="preview-external-link" id="preview-external-link"
                            href="#" target="_blank" rel="noopener noreferrer">
                            <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
                            View on Google Books
                        </a>
                    </div>
                </div>

                <div class="preview-modal-footer">
                    <p class="preview-disclaimer">
                        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
                        Previews show a sample (~20%) of the book. Full content requires purchase.
                    </p>
                    <button id="download-card-btn" class="btn-secondary modal-share-btn" style="margin-top: 12px;">
                        <i class="fa-solid fa-download"></i> Download Card
                    </button>
                </div>

                <!--  Book card div for image capture -->
                <div id="book-card" style="
                    position: absolute;
                    left: -9999px;
                    width: 380px;
                    padding: 32px;
                    background: #F5F0E8;
                    border-radius: 16px;
                    font-family: Georgia, 'Times New Roman', serif;
                    color: #2C1810;
                    border: 1px solid #D4C4A8;
                ">
                    <p style="font-size:11px;color:#8B6F47;margin:0 0 16px;letter-spacing:2px;text-transform:uppercase;">📚 BiblioDrift</p>
                    <h2 id="card-title" style="margin:0 0 8px;font-size:26px;font-weight:normal;font-style:italic;color:#1a0f0a;line-height:1.3;"></h2>
                    <p id="card-author" style="margin:0 0 16px;color:#6B4F35;font-size:14px;letter-spacing:0.5px;"></p>
                    <div style="width:40px;height:1px;background:#C4A882;margin-bottom:16px;"></div>
                    <p id="card-rating" style="margin:0 0 12px;font-size:22px;color:#C4902A;"></p>
                    <p id="card-genre" style="margin:0;font-size:12px;color:#8B6F47;letter-spacing:1.5px;text-transform:uppercase;"></p>
                    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #D4C4A8;">
                        <p style="margin:0;font-size:10px;color:#A89070;letter-spacing:1px;font-style:italic;">Currently Reading</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(el);

        // Close on backdrop click (clicking the outer overlay, not the inner panel)
        el.addEventListener('click', (e) => {
            if (e.target === el) _close();
        });

        // Close button — stopPropagation so it doesn't bubble to parent modals
        el.querySelector('#preview-close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            _close();
        });

        // ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && el.hasAttribute('open')) {
                e.stopPropagation();
                _close();
            }
        });
        
        el.querySelector('#download-card-btn').addEventListener('click', () => {
            const card = document.getElementById('book-card');
            html2canvas(card).then(canvas => {
                const link = document.createElement('a');
                link.download = 'book-card.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            });
        });

        return el;
    }

    // ── State helpers ──────────────────────────────────────────────────────────

    function _setLoading() {
        const loading   = document.getElementById('preview-loading');
        const container = document.getElementById('preview-viewer-container');
        const fallback  = document.getElementById('preview-fallback');
        if (loading)   loading.style.display   = 'flex';
        if (container) { container.style.display = 'none'; container.innerHTML = ''; }
        if (fallback)  fallback.style.display  = 'none';
    }

    function _showViewer() {
        const loading   = document.getElementById('preview-loading');
        const container = document.getElementById('preview-viewer-container');
        const fallback  = document.getElementById('preview-fallback');
        if (loading)   loading.style.display   = 'none';
        if (fallback)  fallback.style.display  = 'none';
        if (container) container.style.display = 'block';
    }

    function _showFallback(id, msg) {
        const loading   = document.getElementById('preview-loading');
        const container = document.getElementById('preview-viewer-container');
        const fallback  = document.getElementById('preview-fallback');
        const msgEl     = document.getElementById('preview-fallback-msg');
        const link      = document.getElementById('preview-external-link');
        if (loading)   loading.style.display   = 'none';
        if (container) container.style.display = 'none';
        if (msgEl && msg) msgEl.textContent = msg;
        if (link) link.href = `https://books.google.com/books?id=${encodeURIComponent(id)}`;
        if (fallback)  fallback.style.display  = 'flex';
    }

    function _close() {
        const modal     = document.getElementById('book-preview-modal');
        const container = document.getElementById('preview-viewer-container');
        if (container) container.innerHTML = '';  // destroy iframe
        if (modal && modal.hasAttribute('open')) modal.close();
        document.body.style.overflow = '';
    }

    // ── Viewer ─────────────────────────────────────────────────────────────────

    function _renderViewer(id) {
        const container = document.getElementById('preview-viewer-container');
        if (!container) { _showFallback(id, 'Viewer container missing.'); return; }

        if (!window.google?.books?.DefaultViewer) {
            _showFallback(id, 'The preview viewer could not be initialised.');
            return;
        }

        // Hard timeout — show fallback if callbacks never fire
        const timeout = setTimeout(() => {
            _showFallback(id, 'The preview took too long to load. You can view it on Google Books instead.');
        }, 10000);

        const viewer = new window.google.books.DefaultViewer(container);

        viewer.load(
            id,
            // notFoundCallback — no embeddable preview for this book
            () => {
                clearTimeout(timeout);
                _showFallback(id, "This book doesn't have an embeddable preview. You can view it on Google Books instead.");
            },
            // successCallback — viewer rendered successfully
            () => {
                clearTimeout(timeout);
                _showViewer();
            }
        );
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Open the in-app preview modal.
     * @param {string} googleBooksId
     * @param {string} [title]
     * @param {string} [author]   
     * @param {number} [rating]   
     * @param {string} [genre]    
     */
    
    async function open(googleBooksId, title, author, rating, genre) {
        if (!_isValidId(googleBooksId)) {
            console.warn('[BookPreview] Invalid Google Books ID:', googleBooksId);
            return;
        }

        const modal = _getOrCreateModal();

        // Set title
        const titleEl = document.getElementById('preview-modal-title');
        if (titleEl) titleEl.textContent = title || 'Book Preview';

        // populate the book card with real data after modal exists ──
        populateBookCard(title, author, rating, genre);

        _setLoading();
        modal.showModal();
        document.body.style.overflow = 'hidden';

        try {
            await _loadAPI();
            _renderViewer(googleBooksId);
        } catch (err) {
            console.error('[BookPreview] Error:', err);
            _showFallback(
                googleBooksId,
                'Something went wrong loading the preview. You can view this book on Google Books instead.'
            );
        }
    }

    //  populate hidden book card with current book's data 
    function populateBookCard(title, author, rating, genre) {
        const titleEl  = document.getElementById('card-title');
        const authorEl = document.getElementById('card-author');
        const ratingEl = document.getElementById('card-rating');
        const genreEl  = document.getElementById('card-genre');
        if (titleEl)  titleEl.textContent  = title  || '';
        if (authorEl) authorEl.textContent = author ? 'by ' + author : '';
        if (ratingEl) ratingEl.textContent = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '';
        if (genreEl)  genreEl.textContent  = genre  || '';
    }

    return { open, populateBookCard };

})();

window.BookPreview = BookPreview;
