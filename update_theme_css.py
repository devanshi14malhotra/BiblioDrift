with open('frontend/css/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the block we added before with a new block using data-mood
import re
content = re.sub(r'/\* --- Mood Sync Theme System Overrides --- \*/.*', '', content, flags=re.DOTALL)

with open('frontend/css/style.css', 'w', encoding='utf-8') as f:
    f.write(content.strip() + '\n')
    f.write('''
/* --- Mood Sync Theme System Overrides --- */
[data-mood] {
    --bg-color: var(--theme-bg) !important;
    --text-main: var(--theme-text) !important;
    --text-muted: var(--theme-text-muted) !important;
    --input-border: var(--theme-border) !important;
    --book-bg: var(--theme-surface) !important;
    --header-bg: var(--theme-bg) !important;
    --accent-gold: var(--theme-accent) !important;
}
''')
print("Fixed style.css to use data-mood")
