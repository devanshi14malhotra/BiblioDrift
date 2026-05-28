/**
 * ==============================================================================
 * BiblioDrift — In-App Book Preview
 * ==============================================================================
 * Uses Google Books embed iframe instead of deprecated jsapi viewer.
 * More stable and works better in modern browsers.
 * ==============================================================================
 */

const BookPreview = (() => {
  // ──────────────────────────────────────────────────────────────────────────
  // Validation
  // ──────────────────────────────────────────────────────────────────────────

  const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;

  function _isValidId(id) {
    return typeof id === "string" && VALID_ID_RE.test(id.trim());
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Modal Creation
  // ──────────────────────────────────────────────────────────────────────────

  function _getOrCreateModal() {
    let el = document.getElementById("book-preview-modal");

    if (el) return el;

<<<<<<< main
    el = document.createElement("div");
=======
    // ── Modal ──────────────────────────────────────────────────────────────────
>>>>>>> main

    el.id = "book-preview-modal";
    el.className = "book-preview-modal";

<<<<<<< main
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Book preview");
=======
        el = document.createElement('dialog');
        el.id        = 'book-preview-modal';
        el.className = 'book-preview-modal';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', 'Book preview');
>>>>>>> main

    el.innerHTML = `
            <div class="preview-modal-inner">

                <div class="preview-modal-header">

                    <div class="preview-modal-title-wrap">
                        <i class="fa-solid fa-book-open preview-header-icon"></i>

                        <span class="preview-modal-title"
                              id="preview-modal-title">
                              Book Preview
                        </span>

                        <span class="preview-powered-by">
                            via Google Books
                        </span>
                    </div>

                    <button
                        class="preview-close-btn"
                        id="preview-close-btn"
                        type="button"
                        aria-label="Close preview">

                        <i class="fa-solid fa-xmark"></i>

                    </button>

                </div>

                <div class="preview-modal-body">

                    <div
                        class="preview-viewer-container"
                        id="preview-viewer-container">
                    </div>

                    <div
                        class="preview-fallback"
                        id="preview-fallback"
                        style="display:none;">

                        <div class="preview-fallback-icon">
                            <i class="fa-solid fa-book-open-reader"></i>
                        </div>

                        <h3 class="preview-fallback-title">
                            Preview Unavailable
                        </h3>

                        <p
                            class="preview-fallback-msg"
                            id="preview-fallback-msg">

                            This preview is unavailable right now.

                        </p>

                        <a
                            class="preview-external-link"
                            id="preview-external-link"
                            href="#"
                            target="_blank"
                            rel="noopener noreferrer">

                            <i class="fa-solid fa-arrow-up-right-from-square"></i>

                            View on Google Books

                        </a>

                    </div>

                </div>

                <div class="preview-modal-footer">

                    <p class="preview-disclaimer">

                        <i class="fa-solid fa-circle-info"></i>

                        Previews show limited pages provided by Google Books.

                    </p>
<<<<<<< main

=======
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
>>>>>>> main
                </div>

            </div>
        `;

    document.body.appendChild(el);

    // Backdrop close
    el.addEventListener("click", (e) => {
      if (e.target === el) {
        _close();
      }
    });

    // Close button
    const closeBtn = el.querySelector("#preview-close-btn");

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      _close();
    });

    // ESC close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && el.classList.contains("active")) {
        _close();
      }
    });

    return el;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Fallback
  // ──────────────────────────────────────────────────────────────────────────

  function _showFallback(id, msg) {
    const container = document.getElementById("preview-viewer-container");

    const fallback = document.getElementById("preview-fallback");

<<<<<<< main
    const msgEl = document.getElementById("preview-fallback-msg");
=======
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
>>>>>>> main

    const link = document.getElementById("preview-external-link");

    if (container) {
      container.style.display = "none";
    }

    if (msgEl) {
      msgEl.textContent = msg;
    }

    if (link) {
      link.href=`https://books.google.com/books?id=${encodeURIComponent(id)}`;
    }

    if (fallback) {
      fallback.style.display = "flex";
    }
  }
  // ──────────────────────────────────────────────────────────────────────────
  // Close Modal
  // ──────────────────────────────────────────────────────────────────────────

  function _close() {
    const modal = document.getElementById("book-preview-modal");

    const container = document.getElementById("preview-viewer-container");

    if (container) {
      container.innerHTML = "";
    }

<<<<<<< main
    if (modal) {
      modal.classList.remove("active");
=======
    function _close() {
        const modal     = document.getElementById('book-preview-modal');
        const container = document.getElementById('preview-viewer-container');
        if (container) container.innerHTML = '';  // destroy iframe
        if (modal && modal.hasAttribute('open')) modal.close();
        document.body.style.overflow = '';
>>>>>>> main
    }

    document.body.style.overflow = "";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render Viewer
  // ──────────────────────────────────────────────────────────────────────────

function _renderViewer(id) {
    const container = document.getElementById("preview-viewer-container");
    if (!container || !id) return;

    const bookUrl = `https://books.google.co.in/books?id=${encodeURIComponent(id)}`;

    container.innerHTML = `
    <a 
        href="${bookUrl}"
        target="_blank"
        rel="noopener noreferrer"
        style="
            display:inline-block;
            padding:5px 10px;
            background:#1a73e8;
            color:white;
            text-decoration:none;
            border-radius:8px;
            font-size:14px;
        "
    >
        📖 Open in Google Books
    </a>
`;
}
  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  async function open(googleBooksId, title) {
    console.log("Received Book ID:", googleBooksId);

    if (!_isValidId(googleBooksId)) {
      console.warn("[BookPreview] Invalid Google Books ID:", googleBooksId);

      return;
    }

<<<<<<< main
    const modal = _getOrCreateModal();

    const titleEl = document.getElementById("preview-modal-title");

    if (titleEl) {
      titleEl.textContent = title || "Book Preview";
    }

    modal.classList.add("active");

    document.body.style.overflow = "hidden";

    try {
      _renderViewer(googleBooksId);
    } catch (err) {
      console.error("[BookPreview] Error:", err);

      _showFallback(googleBooksId, "Something went wrong loading the preview.");
    }
  }
=======
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
>>>>>>> main

  return { open };
})();

window.BookPreview = BookPreview;
