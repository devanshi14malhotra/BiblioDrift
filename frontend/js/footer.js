const createFooter = () => {
  const year = new Date().getFullYear();
  const pagePath = (page) => {
    const isLocalPreview = window.location.protocol === 'file:' ||
      ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
    const cleanPath = page === 'index' ? '/' : `/${page}`;
    const htmlPath = `${page}.html`;

    return isLocalPreview ? htmlPath : cleanPath;
  };

  const footerHTML = `
    <footer class="main-footer">
      <div class="footer-container">
        <!-- Brand Section -->
        <div class="footer-brand">
          <a href="${pagePath('index')}" class="logo" aria-label="BiblioDrift Home">
            <img class="footer-logo" src="../assets/images/biblioDrift_favicon.png" alt="BiblioDrift Logo"> BiblioDrift
          </a>
          <p class="footer-tagline">"There is no frigate like a book to take us lands away."</p>
          <p class="footer-subtext">&mdash; Emily Dickinson</p>
        </div>

        <!-- Quick Links -->
        <nav class="footer-nav" aria-label="Footer Navigation">
          <h3>Explore</h3>
          <ul>
            <li><a href="${pagePath('app')}">Discovery</a></li>
            <li><a href="${pagePath('vault')}">My Vault</a></li>
            <li><a href="${pagePath('library')}">My Library</a></li>
            <li><a href="${pagePath('chat')}">Literary Chat</a></li>
            <li><a href="${pagePath('auth')}">Account</a></li>
            <li>
              <a href="${pagePath('index')}">
                Home Page
              </a>
            </li>
          </ul>
        </nav>

        <div class="footer-legal">
          <h3>Legal</h3>
          <ul>
            <li><a href="${pagePath('privacy-policy')}">Privacy Policy</a></li>
            <li><a href="${pagePath('terms-and-conditions')}">Terms & Conditions</a></li>
          </ul>
        </div>

        <!-- Social Media -->
        <div class="footer-social">
          <h3>Connect</h3>
          <div class="social-icons">
            <a href="https://www.linkedin.com/in/devanshi5malhotra/" target="_blank" rel="noopener noreferrer" title="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
            <a href="https://discord.com/users/868410133703696394" target="_blank" rel="noopener noreferrer" aria-label="Discord">
              <i class="fab fa-discord"></i>
            </a>
            <a href="https://github.com/devanshi14malhotra" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <i class="fa-brands fa-github"></i>
            </a>
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; ${year} BiblioDrift. Curated with <i class="fa-solid fa-heart"></i> for book lovers.</p>
      </div>
    </footer>
  `;

  if (!document.querySelector('.main-footer')) {
    document.body.insertAdjacentHTML('beforeend', footerHTML);
  }
};

createFooter();
