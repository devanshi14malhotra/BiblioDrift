import glob
import re

html_files = glob.glob('frontend/pages/*.html')

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to find where bibliodrift_theme is set in localStorage
    # and insert a call to restoreTheme() to reapply the mood theme if active.
    
    # Pattern to match: localStorage.setItem('bibliodrift_theme', <var>); or similar
    # We will match the literal strings and append the if statement.
    if "localStorage.setItem('bibliodrift_theme'" in content or 'localStorage.setItem(STORAGE_KEY, theme)' in content:
        # For vault.html: localStorage.setItem('bibliodrift_theme', nextTheme);
        content = content.replace("localStorage.setItem('bibliodrift_theme', nextTheme);",
                                  "localStorage.setItem('bibliodrift_theme', nextTheme);\n        if (typeof restoreTheme === 'function') restoreTheme();")
        
        # For index.html and others: localStorage.setItem(STORAGE_KEY, theme);
        content = content.replace("localStorage.setItem(STORAGE_KEY, theme);",
                                  "localStorage.setItem(STORAGE_KEY, theme);\n        if (typeof restoreTheme === 'function') restoreTheme();")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

print("Injected restoreTheme sync into HTML files.")
