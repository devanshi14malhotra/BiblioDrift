/**
 * BiblioDrift — Mood Wheel Analytics
 * Analyzes library books and renders an interactive mood pie chart
 */

const GENRE_MOOD_MAP = {
    // Suspense / Tension
    'thriller': 'Suspense',
    'horror': 'Suspense',
    'crime': 'Suspense',
    'mystery': 'Mystery/Melancholy',

    // Melancholy / Dark
    'drama': 'Mystery/Melancholy',
    'literary fiction': 'Mystery/Melancholy',
    'classic': 'Mystery/Melancholy',
    'dystopian': 'Mystery/Melancholy',
    'coming-of-age': 'Mystery/Melancholy',

    // Cozy / Romance
    'romance': 'Cozy Romance',
    'contemporary': 'Cozy Romance',
    'cozy': 'Cozy Romance',
    'chick lit': 'Cozy Romance',

    // Adventure / Escape
    'fantasy': 'Adventure/Escape',
    'science fiction': 'Adventure/Escape',
    'adventure': 'Adventure/Escape',
    'action': 'Adventure/Escape',

    // Inspiring / Uplifting
    'self-help': 'Inspiring',
    'memoir': 'Inspiring',
    'biography': 'Inspiring',
    'inspirational': 'Inspiring',
    'personal development': 'Inspiring',
    'productivity': 'Inspiring',

    // Curious / Reflective
    'non-fiction': 'Curious/Reflective',
    'history': 'Curious/Reflective',
    'science': 'Curious/Reflective',
    'philosophy': 'Curious/Reflective',
    'psychology': 'Curious/Reflective',
    'finance': 'Curious/Reflective',

    // Whimsical
    'children\'s': 'Whimsical',
    'young adult': 'Whimsical',
    'magical realism': 'Whimsical',
    'fairy tale': 'Whimsical',
};

const MOOD_COLORS = {
    'Suspense':           '#c0392b',
    'Mystery/Melancholy': '#607d8b',
    'Cozy Romance':       '#d4a0a0',
    'Adventure/Escape':   '#e67e22',
    'Inspiring':          '#27ae60',
    'Curious/Reflective': '#8e44ad',
    'Whimsical':          '#f39c12',
    'Other':              '#95a5a6',
};

const MOOD_SUMMARIES = {
    'Suspense':           'Your soul craved tension and hidden truths — you read on the edge of your seat.',
    'Mystery/Melancholy': 'This month, you sought quiet mysteries and rainy-day contemplation.',
    'Cozy Romance':       'Your heart found warmth in tender pages and cozy afternoons.',
    'Adventure/Escape':   'You wandered far beyond these walls, chasing worlds of wonder.',
    'Inspiring':          'You lit a candle of growth — your spirit sought stories of resilience and hope.',
    'Curious/Reflective': 'A philosopher at heart, you turned every page into a quiet revelation.',
    'Whimsical':          'You danced between wonder and imagination, letting magic lead the way.',
    'Other':              'Your reading journey is beautifully eclectic — impossible to define.',
};

let moodChartInstance = null;

function getLibraryBooks() {
    try {
        const raw = localStorage.getItem('bibliodrift_library');
        const lib = raw ? JSON.parse(raw) : { current: [], want: [], finished: [] };
        return [
            ...(lib.current || []),
            ...(lib.want || []),
            ...(lib.finished || []),
        ];
    } catch {
        return [];
    }
}

function normalizeBook(b) {
    if (b.volumeInfo) {
        return {
            categories: b.volumeInfo.categories || [],
            moods: b.moods || [],
            addedAt: b.addedAt || b.date_added || null,
        };
    }
    return {
        categories: b.categories || [],
        moods: b.moods || [],
        addedAt: b.addedAt || b.date_added || null,
    };
}

// Map BiblioDrift emotion tags to mood wheel moods
const EMOTION_TAG_MAP = {
    'Melancholic':  'Mystery/Melancholy',
    'Cozy':         'Cozy Romance',
    'Tense':        'Suspense',
    'Inspiring':    'Inspiring',
    'Whimsical':    'Whimsical',
    'Dark':         'Mystery/Melancholy',
    'Adventurous':  'Adventure/Escape',
};

function categoriesToMoods(categories, emotionTags) {
    const moods = new Set();

    // 1. Try genre/category mapping
    categories.forEach(cat => {
        const key = cat.toLowerCase().trim();
        if (GENRE_MOOD_MAP[key]) {
            moods.add(GENRE_MOOD_MAP[key]);
        } else {
            for (const [genre, mood] of Object.entries(GENRE_MOOD_MAP)) {
                if (key.includes(genre) || genre.includes(key)) {
                    moods.add(mood);
                    break;
                }
            }
        }
    });

    // 2. Fall back to emotion tags the user manually applied
    if (moods.size === 0 && emotionTags && emotionTags.length > 0) {
        emotionTags.forEach(tag => {
            if (EMOTION_TAG_MAP[tag]) moods.add(EMOTION_TAG_MAP[tag]);
        });
    }

    return moods.size > 0 ? [...moods] : ['Other'];
}

function filterBooksByPeriod(books, period) {
    if (period === 'all') return books;
    const now = new Date();
    return books.filter(b => {
        if (!b.addedAt) return true; // include undated books
        const added = new Date(b.addedAt);
        if (period === 'month') {
            return added.getFullYear() === now.getFullYear() && added.getMonth() === now.getMonth();
        }
        if (period === 'year') {
            return added.getFullYear() === now.getFullYear();
        }
        return true;
    });
}

function computeMoodData(period) {
    const allBooks = getLibraryBooks().map(normalizeBook);
    const filtered = filterBooksByPeriod(allBooks, period);
    const tally = {};

    filtered.forEach(book => {
        const moods = categoriesToMoods(book.categories, book.moods);
        moods.forEach(mood => {
            tally[mood] = (tally[mood] || 0) + 1;
        });
    });

    return tally;
}

function buildSummaryText(tally) {
    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return 'Your shelves are waiting for stories. Begin your journey.';
    const dominantMood = entries[0][0];
    return MOOD_SUMMARIES[dominantMood] || MOOD_SUMMARIES['Other'];
}

function renderMoodWheel(period = 'month') {
    const canvas = document.getElementById('mood-wheel-canvas');
    const summaryEl = document.getElementById('mood-wheel-summary');
    const emptyEl = document.getElementById('mood-wheel-empty');
    if (!canvas) return;

    const tally = computeMoodData(period);
    const hasData = Object.keys(tally).length > 0;

    if (emptyEl) emptyEl.hidden = hasData;
    canvas.style.display = hasData ? 'block' : 'none';
    if (summaryEl) summaryEl.textContent = buildSummaryText(tally);

    if (!hasData) return;

    const labels = Object.keys(tally);
    const data = Object.values(tally);
    const colors = labels.map(l => MOOD_COLORS[l] || MOOD_COLORS['Other']);

    if (moodChartInstance) {
        moodChartInstance.destroy();
        moodChartInstance = null;
    }

    moodChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderColor: '#2c2420',
                borderWidth: 2,
                hoverOffset: 12,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '52%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#e0d5cb',
                        font: { family: 'Georgia, serif', size: 13 },
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 12,
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((ctx.parsed / total) * 100).toFixed(0);
                            return ` ${ctx.label}: ${pct}%`;
                        }
                    },
                    bodyFont: { family: 'Georgia, serif' },
                    backgroundColor: 'rgba(30, 26, 24, 0.95)',
                    titleColor: '#fccb4e',
                    bodyColor: '#e0d5cb',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                }
            },
            animation: { animateRotate: true, duration: 800 },
        }
    });
}

function initMoodWheel() {
    const container = document.getElementById('mood-wheel-container');
    if (!container) return;

    // Period filter buttons
    container.querySelectorAll('.mood-period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.mood-period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMoodWheel(btn.dataset.period);
        });
    });

    // Default render
    renderMoodWheel('month');
}

document.addEventListener('DOMContentLoaded', () => {
    // Lazy init: only run when the mood wheel section is visible
    const moodBtn = document.getElementById('view-mood-btn');
    const moodContainer = document.getElementById('mood-wheel-container');
    const shelvesContainer = document.getElementById('library-shelves');
    const constellationContainer = document.getElementById('constellation-container');

    if (!moodBtn || !moodContainer) return;

    moodBtn.addEventListener('click', () => {
        // Deactivate other views
        document.getElementById('view-shelves-btn')?.classList.replace('btn-primary', 'btn-secondary');
        document.getElementById('view-shelves-btn')?.classList.remove('active-view');
        document.getElementById('view-constellation-btn')?.classList.replace('btn-primary', 'btn-secondary');
        document.getElementById('view-constellation-btn')?.classList.remove('active-view');

        moodBtn.classList.add('active-view');
        moodBtn.classList.replace('btn-secondary', 'btn-primary');

        shelvesContainer?.classList.add('hidden');
        constellationContainer?.classList.add('hidden');
        moodContainer.classList.remove('hidden');

        initMoodWheel();
    });
});
