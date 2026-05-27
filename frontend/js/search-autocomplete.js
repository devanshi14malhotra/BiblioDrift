// Utility Debounce Wrapper
function debounce(func, delay = 300) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Regex Token Highlight Engine
function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, `<mark class="autocomplete-glow">$1</mark>`);
}

class SearchAutocomplete {
    constructor(inputId, dropdownId) {
        this.input = document.getElementById(inputId);
        this.dropdown = document.getElementById(dropdownId);
        this.cacheKey = 'bibliodrift_search_cache';
        this.init();
    }

    init() {
        if (!this.input || !this.dropdown) return;
        this.input.addEventListener('input', debounce((e) => this.handleInput(e.target.value), 250));
        this.setupKeyboardNavigation();
    }

    async handleInput(query) {
        const cleanQuery = query.trim().toLowerCase();
        if (cleanQuery.length < 2) {
            this.dropdown.innerHTML = '';
            return;
        }

        // 1. Check LocalStorage Cache to prevent API strain
        const cachedResults = this.getCache(cleanQuery);
        if (cachedResults) {
            this.render(cachedResults, query);
            return;
        }

        // 2. Fetch from the isolated backend endpoint
        try {
            const response = await fetch(`/api/v1/books/autocomplete?q=${encodeURIComponent(cleanQuery)}`);
            const suggestions = await response.json();
            
            // Set Cache & Render
            this.setCache(cleanQuery, suggestions);
            this.render(suggestions, query);
        } catch (error) {
            console.error("Autocomplete failure: ", error);
        }
    }

    getCache(query) {
        const store = JSON.parse(localStorage.getItem(this.cacheKey)) || {};
        return store[query] || null;
    }

    setCache(query, data) {
        const store = JSON.parse(localStorage.getItem(this.cacheKey)) || {};
        store[query] = data;
        // Keep storage clear and performant by capping history size
        if (Object.keys(store).length > 50) delete store[Object.keys(store)[0]];
        localStorage.setItem(this.cacheKey, JSON.stringify(store));
    }

    render(items, query) {
        this.dropdown.innerHTML = '';
        if(!items.length) return;

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'suggestion-item-vibe';
            el.innerHTML = `
                <span class="title">${highlightText(item.title, query)}</span>
                <span class="author">by ${item.author}</span>
            `;
            el.addEventListener('click', () => {
                this.input.value = item.title;
                this.dropdown.innerHTML = '';
                // Execute standard form submit / call your book fetch engine here
            });
            this.dropdown.appendChild(el);
        });
    }

    setupKeyboardNavigation() {
        let activeIdx = -1;
        this.input.addEventListener('keydown', (e) => {
            const items = this.dropdown.getElementsByClassName('suggestion-item-vibe');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIdx = (activeIdx + 1) % items.length;
                this.highlightRow(items, activeIdx);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIdx = (activeIdx - 1 + items.length) % items.length;
                this.highlightRow(items, activeIdx);
            } else if (e.key === 'Enter' && activeIdx > -1) {
                e.preventDefault();
                items[activeIdx].click();
            }
        });
    }

    highlightRow(rows, idx) {
        Array.from(rows).forEach((row, i) => {
            row.classList.toggle('selected-row', i === idx);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SearchAutocomplete('searchInput', 'searchSuggestionsDropdown');
});
