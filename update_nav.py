import os
import glob
import re

files = glob.glob('frontend/pages/*.html')

vault_nav_item = """                <div class="tooltip">
                    <a href="vault.html">My Vault</a>
                    <span class="tooltip-text"><i class="fa-solid fa-vault"></i> My Vault</span>
                </div>"""

for fpath in files:
    if fpath.endswith('vault.html') or fpath.endswith('index.html'): continue
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the Discovery nav item to insert My Vault after it
    # We'll look for `<a href="index.html" ...>Discovery</a>\n            <span class="tooltip-text">...</span>\n          </div>`
    
    # Or just replace `<nav class="nav-links">` content but keeping active states
    
    # A robust way: check if "My Vault" is in content. If not, find '<a href="index.html"' and insert after its closing div
    if "vault.html" not in content and '<div class="tooltip">' in content:
        # Regex to find the div containing index.html
        pattern = re.compile(r'(<div class="tooltip">\s*<a href="index\.html"[^>]*>Discovery</a>.*?</div>)', re.DOTALL)
        content = pattern.sub(r'\1\n' + vault_nav_item, content)
        
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {fpath}")
