with open('frontend/css/style.css', 'a', encoding='utf-8') as f:
    f.write('''
/* --- Mood Sync Theme System Overrides --- */
[data-theme="rainy"],
[data-theme="cozy"],
[data-theme="dark-academia"],
[data-theme="ocean"],
[data-theme="indian-authors"] {
    --bg-color: var(--theme-bg) !important;
    --text-main: var(--theme-text) !important;
    --text-muted: var(--theme-text-muted) !important;
    --input-border: var(--theme-border) !important;
    --book-bg: var(--theme-surface) !important;
    --header-bg: var(--theme-bg) !important;
}

[data-theme="rainy"] {
    --accent-gold: var(--theme-accent) !important;
}

[data-theme="cozy"] {
    --accent-gold: var(--theme-accent) !important;
}

[data-theme="dark-academia"] {
    --accent-gold: var(--theme-accent) !important;
}

[data-theme="ocean"] {
    --accent-gold: var(--theme-accent) !important;
}

[data-theme="indian-authors"] {
    --accent-gold: var(--theme-accent) !important;
}
''')
print("Appended mood theme overrides to style.css")
