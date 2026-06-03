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

    el = document.createElement("div");

    el.id = "book-preview-modal";
    el.className = "book-preview-modal";

    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Book preview");

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

    const msgEl = document.getElementById("preview-fallback-msg");

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

    if (modal) {
      modal.classList.remove("active");
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

  return { open };
})();

window.BookPreview = BookPreview;
