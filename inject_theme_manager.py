import glob
import os

html_files = glob.glob('frontend/pages/*.html')

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Make sure we don't duplicate it
    if 'theme-manager.js' not in content:
        # Find a good place to insert it. Before ambient.js is good, or just before </body>
        # Since it affects the UI, it's best placed near ambient.js
        if '<script src="../js/ambient.js"></script>' in content:
            content = content.replace('<script src="../js/ambient.js"></script>', 
                                      '<script src="../js/theme-manager.js"></script>\n  <script src="../js/ambient.js"></script>')
        elif '</body>' in content:
            content = content.replace('</body>', '<script src="../js/theme-manager.js"></script>\n</body>')

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
print("Injected theme-manager.js into HTML files")
