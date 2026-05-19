import glob
import re

html_files = glob.glob('frontend/pages/*.html')

standard_header_template = """  <header>
    <a href="index.html" class="logo">
      <img style="height: 40px" src="../assets/images/biblioDrift_favicon.png" alt="BiblioDrift Logo"> BiblioDrift
    </a>
    <div class="header-controls">
      <div class="search-bar">
        <input type="text" id="searchInput" class="search-input" placeholder="Search for a feeling...">
        <i class="fa-solid fa-search search-icon" id="searchIcon"></i>
      </div>
      <nav class="nav-links">
        <div class="tooltip">
          <a href="index.html" {index_active}>Discovery</a>
          <span class="tooltip-text"><i class="fa-solid fa-wand-magic-sparkles"></i> Explore books</span>
        </div>
        <div class="tooltip">
          <a href="vault.html" {vault_active}>My Vault</a>
          <span class="tooltip-text"><i class="fa-solid fa-vault"></i> My Vault</span>
        </div>
        <div class="tooltip">
          <a href="library.html" {library_active}>My Library</a>
          <span class="tooltip-text"><i class="fa-solid fa-book"></i> My Library</span>
        </div>
        <div class="tooltip">
          <a href="chat.html" {chat_active}>Chat</a>
          <span class="tooltip-text"><i class="fa-solid fa-comments"></i> Chat</span>
        </div>
        <!-- DYNAMIC AUTH LINK -->
        <div class="tooltip">
          <a href="auth.html" id="navAuthLink" {auth_active}>Sign In</a>
          <span class="tooltip-text" id="navAuthTooltip"><i class="fa-solid fa-key"></i> Access account</span>
        </div>
      </nav>
      <button id="themeToggle" class="btn-icon" title="Toggle Theme">
        <i class="fa-solid fa-moon"></i>
      </button>
    </div>
  </header>"""

for fpath in html_files:
    filename = fpath.split('\\')[-1].split('/')[-1]
    
    # define active classes
    actives = {
        'index_active': 'class="active"' if filename == 'index.html' else '',
        'vault_active': 'class="active"' if filename == 'vault.html' else '',
        'library_active': 'class="active"' if filename == 'library.html' else '',
        'chat_active': 'class="active"' if filename == 'chat.html' else '',
        'auth_active': 'class="active"' if filename == 'auth.html' else ''
    }
    
    header_html = standard_header_template.format(**actives)
    
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace everything from <header> to </header>
    pattern = re.compile(r'<header>.*?</header>', re.DOTALL)
    new_content = pattern.sub(header_html, content)
    
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(new_content)

print("Unified headers!")
