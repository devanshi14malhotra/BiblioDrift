import glob
import re

html_files = glob.glob('frontend/pages/*.html')

vault_html = """                <div class="tooltip">
                    <a href="vault.html">My Vault</a>
                    <span class="tooltip-text"><i class="fa-solid fa-vault"></i> My Vault</span>
                </div>"""

for f in html_files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
        
    if "vault.html" not in content and '<div class="tooltip">' in content:
        # Insert vault nav after index.html nav
        pattern = re.compile(r'(<div class="tooltip">\s*<a href="index\.html"[^>]*>Discovery</a>.*?</div>)', re.DOTALL)
        content = pattern.sub(r'\1\n' + vault_html, content)
        
    # fix active class in vault.html
    if f.endswith('vault.html'):
        content = content.replace('<a href="chat.html" class="active">Chat</a>', '<a href="chat.html">Chat</a>')
        content = content.replace('<a href="vault.html">My Vault</a>', '<a href="vault.html" class="active">My Vault</a>')
        
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
        
print("Updated nav in all HTML files.")
