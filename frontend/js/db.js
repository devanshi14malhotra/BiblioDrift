(function () {
    const DB_NAME = 'BiblioDriftDB';
    const BOOKS_SCHEMA = 'id, title, author, content, mood, coverUrl';
    const DOWNLOADED_BOOKS_SCHEMA = 'id, title, author, content, mood, coverUrl, downloadedAt';
    const SYNC_QUEUE_SCHEMA = '++id, userId, action, bookId, db_id, shelf, createdAt';

    function dispatchSyncQueueEvent(userId) {
        window.dispatchEvent(new CustomEvent('bibliodrift:library-sync-queued', {
            detail: { userId }
        }));
    }

    async function getPendingLibrarySyncCount(userId) {
        if (!window.db?.syncQueue) return 0;
        if (userId == null) {
            return await window.db.syncQueue.count();
        }
        return await window.db.syncQueue.where('userId').equals(userId).count();
    }

    function initDatabase() {
        if (typeof Dexie === 'undefined') {
            console.error('Dexie CDN is still loading... Retrying in 50ms.');
            setTimeout(initDatabase, 50);
            return;
        }

        if (window.db?.name === DB_NAME) {
            return;
        }

        window.db = new Dexie(DB_NAME);
        window.db.version(1).stores({
            books: BOOKS_SCHEMA,
            downloadedBooks: DOWNLOADED_BOOKS_SCHEMA
        });
        window.db.version(2).stores({
            books: BOOKS_SCHEMA,
            downloadedBooks: DOWNLOADED_BOOKS_SCHEMA,
            syncQueue: SYNC_QUEUE_SCHEMA
        });

        window.db.open().catch(async (error) => {
            console.error('Failed to open BiblioDrift IndexedDB', error);
            if (error.name === 'VersionError') {
                console.warn('Deleting old IndexedDB due to version mismatch...');
                await Dexie.delete(DB_NAME);
                window.location.reload();
            }
        });

        window.saveBookOffline = async function (book) {
            if (!window.db?.downloadedBooks || !book?.id) return false;
            await window.db.downloadedBooks.put({
                ...book,
                downloadedAt: new Date().toISOString()
            });
            return true;
        };

        window.removeOfflineBook = async function (bookId) {
            if (!window.db?.downloadedBooks || !bookId) return false;
            await window.db.downloadedBooks.delete(bookId);
            return true;
        };

        window.enqueueLibraryMutation = async function (mutation) {
            if (!window.db?.syncQueue) return null;

            const entry = {
                ...mutation,
                createdAt: mutation.createdAt || new Date().toISOString()
            };
            const id = await window.db.syncQueue.add(entry);
            dispatchSyncQueueEvent(entry.userId ?? null);
            return id;
        };

        window.getPendingLibrarySyncCount = getPendingLibrarySyncCount;

        console.log('IndexedDB configuration loaded onto window.db successfully!');
    }

    initDatabase();
})();