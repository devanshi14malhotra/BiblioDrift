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

    // ── Modal (plain div overlay, not <dialog>) ────────────────────────────────

    function _getOrCreateModal() {
        let el = document.getElementById('book-preview-modal');
        if (el) return el;

        el = document.createElement('div');
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
            if (e.key === 'Escape' && el.classList.contains('active')) {
                e.stopPropagation();
                _close();
            }
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
        if (modal) modal.classList.remove('active');
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
     */
    async function open(googleBooksId, title) {
        if (!_isValidId(googleBooksId)) {
            console.warn('[BookPreview] Invalid Google Books ID:', googleBooksId);
            return;
        }

        const modal = _getOrCreateModal();

        // Set title
        const titleEl = document.getElementById('preview-modal-title');
        if (titleEl) titleEl.textContent = title || 'Book Preview';

        // Show modal in loading state
        _setLoading();
        modal.classList.add('active');
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

    return { open };

})();

window.BookPreview = BookPreview;
