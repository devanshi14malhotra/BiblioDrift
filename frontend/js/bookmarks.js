/**
 * Bookmark Management Module
 * Handles all bookmark-related operations in the UI
 */

class BookmarkManager {
    constructor() {
        this.bookmarks = new Map();
        this.api = '/api';
    }

    /**
     * Initialize bookmark UI on page load
     */
    async init() {
        await this.loadBookmarks();
        this.attachEventListeners();
        this.renderBookmarks();
        this.updateAllBookmarkButtons();
    }

    /**
     * Load all bookmarks for the current user
     */
    async loadBookmarks() {
        try {
            const response = await fetch(`${this.api}/bookmarks`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });

            if (!response.ok) {
                console.error('Failed to load bookmarks');
                return;
            }

            const data = await response.json();
            if (data.success) {
                data.data.bookmarks.forEach(bookmark => {
                    this.bookmarks.set(bookmark.book_id, bookmark);
                });
            }
        } catch (error) {
            console.error('Error loading bookmarks:', error);
        }
    }

    /**
     * Check if a specific book is bookmarked
     */
    async isBookmarked(bookId) {
        return this.bookmarks.has(bookId);
    }

    /**
     * Toggle bookmark for a book
     */
    async toggleBookmark(bookId, pageNumber = null, notes = '') {
        try {
            if (this.bookmarks.has(bookId)) {
                // Remove bookmark
                const bookmark = this.bookmarks.get(bookId);
                await this.deleteBookmark(bookmark.id);
            } else {
                // Add bookmark
                await this.createBookmark(bookId, pageNumber, notes);
            }
        } catch (error) {
            console.error('Error toggling bookmark:', error);
            showNotification('Error toggling bookmark', 'error');
        }
    }

    /**
     * Create a new bookmark
     */
    async createBookmark(bookId, pageNumber = null, notes = '') {
        try {
            const response = await fetch(`${this.api}/bookmarks`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify({
                    book_id: bookId,
                    page_number: pageNumber,
                    notes: notes
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create bookmark');
            }

            const data = await response.json();
            if (data.success) {
                this.bookmarks.set(bookId, data.data.bookmark);
                this.updateBookmarkButton(bookId, true);
                showNotification('Book bookmarked!', 'success');
            }
        } catch (error) {
            console.error('Error creating bookmark:', error);
            showNotification(error.message, 'error');
        }
    }

    /**
     * Update an existing bookmark
     */
    async updateBookmark(bookmarkId, pageNumber = null, notes = '') {
        try {
            const response = await fetch(`${this.api}/bookmarks/${bookmarkId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify({
                    page_number: pageNumber,
                    notes: notes
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update bookmark');
            }

            const data = await response.json();
            if (data.success) {
                const bookmark = data.data.bookmark;
                this.bookmarks.set(bookmark.book_id, bookmark);
                showNotification('Bookmark updated!', 'success');
            }
        } catch (error) {
            console.error('Error updating bookmark:', error);
            showNotification(error.message, 'error');
        }
    }

    /**
     * Delete a bookmark
     */
    async deleteBookmark(bookmarkId) {
        try {
            const response = await fetch(`${this.api}/bookmarks/${bookmarkId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete bookmark');
            }

            const data = await response.json();
            if (data.success) {
                // Find and remove the bookmark
                for (const [bookId, bookmark] of this.bookmarks.entries()) {
                    if (bookmark.id === bookmarkId) {
                        this.bookmarks.delete(bookId);
                        this.updateBookmarkButton(bookId, false);
                        showNotification('Bookmark removed!', 'success');
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('Error deleting bookmark:', error);
            showNotification(error.message, 'error');
        }
    }

    /**
     * Update bookmark button UI state with star icon
     */
    updateBookmarkButton(bookId, isBookmarked) {
        const btn = document.querySelector(`[data-book-id="${bookId}"] .bookmark-btn`);
        if (btn) {
            btn.classList.toggle('bookmarked', isBookmarked);
            btn.innerHTML = `<svg class="star-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
            btn.setAttribute('aria-label', isBookmarked ? 'Remove bookmark' : 'Add bookmark');
            btn.title = isBookmarked ? 'Remove bookmark' : 'Add bookmark';
        }
    }

    /**
     * Update all bookmark buttons on page
     */
    updateAllBookmarkButtons() {
        document.querySelectorAll('.book-card').forEach(card => {
            const bookId = parseInt(card.getAttribute('data-book-id'));
            const isBookmarked = this.bookmarks.has(bookId);
            this.updateBookmarkButton(bookId, isBookmarked);
        });
    }

    /**
     * Attach event listeners to bookmark buttons
     */
    attachEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.bookmark-btn')) {
                const btn = e.target.closest('.bookmark-btn');
                const bookId = parseInt(btn.closest('[data-book-id]').getAttribute('data-book-id'));
                this.toggleBookmark(bookId);
                e.preventDefault();
            }
        });
    }

    /**
     * Render bookmarks list
     */
    renderBookmarks() {
        const container = document.getElementById('bookmarks-list');
        if (!container) return;

        if (this.bookmarks.size === 0 class="no-bookmarks">No bookmarks yet. Start bookmarking books!</p>';
            return;
        }

        let html = '<ul class="bookmarks-ul">';
        this.bookmarks.forEach((bookmark) => {
            const bookTitle = bookmark.book?.title || 'Unknown Book';
            const pageInfo = bookmark.page_number ? `Page ${bookmark.page_number}` : '';
            const notes = bookmark.notes ? `<small class="bookmark-notes">${bookmark.notes}</small>` : '';

            html += `
                <li class="bookmark-item" data-bookmark-id="${bookmark.id}">
                    <div class="bookmark-header">
                        <strong>${bookTitle}</strong>
                        <button class="remove-bookmark" data-bookmark-id="${bookmark.id}" aria-label="Remove bookmark
                        <button class="remove-bookmark" data-bookmark-id="${bookmark.id}">✕</button>
                    </div>
                    ${pageInfo ? `<div class="bookmark-page">${pageInfo}</div>` : ''}
                    ${notes}
                </li>
            `;
        });
        html += '</ul>';

        container.innerHTML = html;

        // Attach remove listeners
        document.querySelectorAll('.remove-bookmark').forEach(btn => {
            btn.addEventListener('click', () => {
                const bookmarkId = parseInt(btn.dataset.bookmarkId);
                this.deleteBookmark(bookmarkId);
            });
        });
    }
}

// Initialize on page load
const bookmarkManager = new BookmarkManager();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bookmarkManager.init());
} else {
    bookmarkManager.init();
}

// Notification helper
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}