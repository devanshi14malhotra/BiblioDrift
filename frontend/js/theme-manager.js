/**
 * BiblioDrift Mood-Based UI Theming
 * Provides color palettes for different reading moods.
 */

const THEMES = {
    "rainy": {
        light: {
            "--theme-bg": "#eef2f5",
            "--theme-surface": "#ffffff",
            "--theme-accent": "#5a7d9a",
            "--theme-accent-light": "#a5b8c8",
            "--theme-text": "#2c3e50",
            "--theme-text-muted": "#7f8c8d",
            "--theme-border": "#d1d9e0",
            "--theme-pill-bg": "#f0f4f7"
        },
        dark: {
            "--theme-bg": "#101820",
            "--theme-surface": "#1a252f",
            "--theme-accent": "#7393B3",
            "--theme-accent-light": "#89a5c1",
            "--theme-text": "#d5e1ec",
            "--theme-text-muted": "#8da1b5",
            "--theme-border": "#283b4e",
            "--theme-pill-bg": "#213243"
        }
    },
    "stormy": {
        light: {
            "--theme-bg": "#cfd8dc",
            "--theme-surface": "#b0bec5",
            "--theme-accent": "#455a64",
            "--theme-accent-light": "#78909c",
            "--theme-text": "#263238",
            "--theme-text-muted": "#546e7a",
            "--theme-border": "#90a4ae",
            "--theme-pill-bg": "#eceff1"
        },
        dark: {
            "--theme-bg": "#0a1014",
            "--theme-surface": "#121b22",
            "--theme-accent": "#546e7a",
            "--theme-accent-light": "#78909c",
            "--theme-text": "#b0bec5",
            "--theme-text-muted": "#78909c",
            "--theme-border": "#263238",
            "--theme-pill-bg": "#1c2730"
        }
    },
    "ocean": {
        light: {
            "--theme-bg": "#e0f2f1",
            "--theme-surface": "#ffffff",
            "--theme-accent": "#00796b",
            "--theme-accent-light": "#4db6ac",
            "--theme-text": "#004d40",
            "--theme-text-muted": "#00695c",
            "--theme-border": "#b2dfdb",
            "--theme-pill-bg": "#e8f5e9"
        },
        dark: {
            "--theme-bg": "#001a14",
            "--theme-surface": "#002820",
            "--theme-accent": "#26a69a",
            "--theme-accent-light": "#4db6ac",
            "--theme-text": "#b2dfdb",
            "--theme-text-muted": "#80cbc4",
            "--theme-border": "#004d40",
            "--theme-pill-bg": "#003b30"
        }
    },
    "cozy": {
        light: {
            "--theme-bg": "#fdf5f3",
            "--theme-surface": "#ffffff",
            "--theme-accent": "#c24b22",
            "--theme-accent-light": "#e07a5f",
            "--theme-text": "#4a2e28",
            "--theme-text-muted": "#8b5a50",
            "--theme-border": "#e9d9d5",
            "--theme-pill-bg": "#f7ebe8"
        },
        dark: {
            "--theme-bg": "#1c0f0a",
            "--theme-surface": "#2d1812",
            "--theme-accent": "#e07a5f",
            "--theme-accent-light": "#f4a261",
            "--theme-text": "#fdf5f3",
            "--theme-text-muted": "#c89f95",
            "--theme-border": "#4a2e28",
            "--theme-pill-bg": "#3e2018"
        }
    },
    "dark-academia": {
        light: {
            "--theme-bg": "#d7ccc8",
            "--theme-surface": "#a1887f",
            "--theme-accent": "#5d4037",
            "--theme-accent-light": "#795548",
            "--theme-text": "#3e2723",
            "--theme-text-muted": "#4e342e",
            "--theme-border": "#8d6e63",
            "--theme-pill-bg": "#efebe9"
        },
        dark: {
            "--theme-bg": "#120f0e",
            "--theme-surface": "#1e1816",
            "--theme-accent": "#a0522d",
            "--theme-accent-light": "#cd853f",
            "--theme-text": "#d7ccc8",
            "--theme-text-muted": "#a1887f",
            "--theme-border": "#3e2723",
            "--theme-pill-bg": "#2b221f"
        }
    },
    "indian-authors": {
        light: {
            "--theme-bg": "#fffbf0",
            "--theme-surface": "#ffffff",
            "--theme-accent": "#e67e22",
            "--theme-accent-light": "#f39c12",
            "--theme-text": "#1b5e20",
            "--theme-text-muted": "#4e342e",
            "--theme-border": "#ffe0b2",
            "--theme-pill-bg": "#fff3e0"
        },
        dark: {
            "--theme-bg": "#1a120b",
            "--theme-surface": "#2d1e12",
            "--theme-accent": "#d84315",
            "--theme-accent-light": "#ff5722",
            "--theme-text": "#ffecb3",
            "--theme-text-muted": "#ffcc80",
            "--theme-border": "#4e342e",
            "--theme-pill-bg": "#3e2723"
        }
    },
    "space": {
        light: {
            "--theme-bg": "#f3e8ff",
            "--theme-surface": "#ffffff",
            "--theme-accent": "#7b2cbf",
            "--theme-accent-light": "#9d4edd",
            "--theme-text": "#240046",
            "--theme-text-muted": "#5a189a",
            "--theme-border": "#e0aaff",
            "--theme-pill-bg": "#faf5ff"
        },
        dark: {
            "--theme-bg": "#10002b",
            "--theme-surface": "#240046",
            "--theme-accent": "#9d4edd",
            "--theme-accent-light": "#c77dff",
            "--theme-text": "#e0aaff",
            "--theme-text-muted": "#9d4edd",
            "--theme-border": "#3c096c",
            "--theme-pill-bg": "#240046"
        }
    },
    "anime": {
        light: {
            "--theme-bg": "#fdf4ff",
            "--theme-surface": "#ffffff",
            "--theme-accent": "#d946ef",
            "--theme-accent-light": "#e879f9",
            "--theme-text": "#4a044e",
            "--theme-text-muted": "#86198f",
            "--theme-border": "#f5d0fe",
            "--theme-pill-bg": "#faf5ff"
        },
        dark: {
            "--theme-bg": "#2e1026",
            "--theme-surface": "#4a044e",
            "--theme-accent": "#e879f9",
            "--theme-accent-light": "#f0abfc",
            "--theme-text": "#fae8ff",
            "--theme-text-muted": "#f5d0fe",
            "--theme-border": "#701a75",
            "--theme-pill-bg": "#4a044e"
        }
    },
    "train": {
        light: {
            "--theme-bg": "#e0e7ff",
            "--theme-surface": "#ffffff",
            "--theme-accent": "#4f46e5",
            "--theme-accent-light": "#6366f1",
            "--theme-text": "#1e1b4b",
            "--theme-text-muted": "#3730a3",
            "--theme-border": "#c7d2fe",
            "--theme-pill-bg": "#eef2ff"
        },
        dark: {
            "--theme-bg": "#0f172a",
            "--theme-surface": "#1e293b",
            "--theme-accent": "#fbbf24",
            "--theme-accent-light": "#fcd34d",
            "--theme-text": "#f8fafc",
            "--theme-text-muted": "#94a3b8",
            "--theme-border": "#334155",
            "--theme-pill-bg": "#1e293b"
        }
    },
    "forest": {
        light: {
            "--theme-bg": "#ecfdf5",
            "--theme-surface": "#ffffff",
            "--theme-accent": "#059669",
            "--theme-accent-light": "#10b981",
            "--theme-text": "#022c22",
            "--theme-text-muted": "#065f46",
            "--theme-border": "#a7f3d0",
            "--theme-pill-bg": "#f0fdf4"
        },
        dark: {
            "--theme-bg": "#022c22",
            "--theme-surface": "#064e3b",
            "--theme-accent": "#34d399",
            "--theme-accent-light": "#6ee7b7",
            "--theme-text": "#ecfdf5",
            "--theme-text-muted": "#a7f3d0",
            "--theme-border": "#065f46",
            "--theme-pill-bg": "#064e3b"
        }
    },
    "magic": {
        light: {
            "--theme-bg": "#fcf5f5",
            "--theme-surface": "#ffffff",
            "--theme-accent": "#740001",
            "--theme-accent-light": "#eeba30",
            "--theme-text": "#1a0f0f",
            "--theme-text-muted": "#5a4a4a",
            "--theme-border": "#e8d8d8",
            "--theme-pill-bg": "#f5e8e8"
        },
        dark: {
            "--theme-bg": "#0a0f14",
            "--theme-surface": "#121a22",
            "--theme-accent": "#1a472a",
            "--theme-accent-light": "#eeba30",
            "--theme-text": "#f0f4f8",
            "--theme-text-muted": "#8a9ba8",
            "--theme-border": "#1c2a38",
            "--theme-pill-bg": "#121a22"
        }
    }
};
/**
 * Applies a specific theme to the UI by setting CSS variables on the root element.
 * @param {string} themeName - The key of the theme to apply.
 */
function setTheme(themeName) {
    const baseTheme = THEMES[themeName];
    if (!baseTheme) {
        console.warn("Unknown theme:", themeName);
        return;
    }

    const currentCoreTheme = localStorage.getItem('bibliodrift_theme');
    const isDark = (currentCoreTheme === 'night' || currentCoreTheme === 'dark');
    const theme = isDark ? baseTheme.dark : baseTheme.light;

    // Apply all CSS variables defined in the theme
    Object.keys(theme).forEach(key => {
        document.documentElement.style.setProperty(key, theme[key]);
    });

    // Set data attribute on html for theme-specific CSS selectors
    document.documentElement.setAttribute('data-mood', themeName);
    
    // Store mood theme separately so we don't break the light/dark mode preference!
    localStorage.setItem("bibliodrift_mood", themeName);
    if (window.appStore) window.appStore.setState({ currentTheme: themeName });
}

/**
 * Clears the mood theme and restores the original Light/Night mode.
 */
function clearTheme() {
    // Remove mood theme variables (using rainy.light as a map of keys)
    const sampleTheme = THEMES["rainy"].light;
    Object.keys(sampleTheme).forEach(key => {
        document.documentElement.style.removeProperty(key);
    });

    document.documentElement.removeAttribute('data-mood');
    localStorage.removeItem("bibliodrift_mood");
}

/**
 * Restores the theme from localStorage.
 */
function restoreTheme() {
    const savedMood = localStorage.getItem("bibliodrift_mood");
    if (savedMood) {
        setTheme(savedMood);
    } else {
        clearTheme();
    }
}

// Ensure functions are globally accessible
window.THEMES = THEMES;
window.setTheme = setTheme;
window.clearTheme = clearTheme;
window.restoreTheme = restoreTheme;
