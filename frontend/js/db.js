// Initialize Dexie Database globally
window.db = new Dexie("BiblioDriftDB");

// Define schema
window.db.version(1).stores({
    books: 'id, title, author, content, mood, coverUrl'
});

window.db.version(2).stores({
    books: 'id, title, author, content, mood, coverUrl',
    vault_books: 'id, title, author, visibility, mood, addedAt'
});

console.log("IndexedDB configuration loaded onto window.db!");
// A safe initialization wrapper
function initDatabase() {
    if (typeof Dexie === 'undefined') {
        console.error("Dexie CDN is still loading... Retrying in 50ms.");
        setTimeout(initDatabase, 50);
        return;
    }

    // Initialize Dexie Database globally on the window object
    window.db = new Dexie("BiblioDriftDB");

    // Define schema: Store books by 'id'
    window.db.version(1).stores({
        books: 'id, title, author, content, mood, coverUrl'
    });

    window.db.version(2).stores({
        books: 'id, title, author, content, mood, coverUrl',
        vault_books: 'id, title, author, visibility, mood, addedAt'
    });

    console.log("IndexedDB configuration loaded onto window.db successfully!");
}

// Execute the safe initializer
initDatabase();