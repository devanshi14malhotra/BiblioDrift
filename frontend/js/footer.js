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
    <footer class="main-footer" role="contentinfo">
      <div class="footer-container">
        <!-- Brand Section -->
        <div class="footer-brand">
          <a href="${pagePath('index')}" class="logo" aria-label="BiblioDrift Home">
            <img class="footer-logo" src="../assets/images/biblioDrift_favicon.png" alt="BiblioDrift Logo"> BiblioDrift
          </a>
          <p class="footer-tagline">&#8220;There is no frigate like a book to take us lands away.&#8221;</p>
          <p class="footer-subtext">&mdash; Emily Dickinson</p>
        </div>

        <!-- Navigation Section -->
        <nav class="footer-nav" aria-label="Site navigation">
          <h3 class="footer-heading">Explore</h3>
          <ul>
            <li><a href="${pagePath('app')}">Discovery</a></li>
            <li><a href="${pagePath('vault')}">My Vault</a></li>
            <li><a href="${pagePath('library')}">My Library</a></li>
            <li><a href="${pagePath('chat')}">Literary Chat</a></li>
            <li><a href="${pagePath('auth')}">Account</a></li>
            <li><a href="${pagePath('index')}">Home Page</a></li>
          </ul>
        </nav>

        <!-- Legal Section -->
        <div class="footer-legal" role="navigation" aria-label="Legal links">
          <h3 class="footer-heading">Legal</h3>
          <ul>
            <li><a href="${pagePath('privacy-policy')}">Privacy Policy</a></li>
            <li><a href="${pagePath('terms-and-conditions')}">Terms &amp; Conditions</a></li>
          </ul>
        </div>

        <!-- Community / Social Section -->
        <div class="footer-social">
          <h3 class="footer-heading">Connect</h3>
          <div class="social-icons" role="list">
            <a href="https://www.linkedin.com/in/devanshi5malhotra/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" role="listitem"><i class="fab fa-linkedin-in" aria-hidden="true"></i></a>
            <a href="https://discord.com/users/868410133703696394" target="_blank" rel="noopener noreferrer" aria-label="Discord" role="listitem"><i class="fab fa-discord" aria-hidden="true"></i></a>
            <a href="https://github.com/devanshi14malhotra" target="_blank" rel="noopener noreferrer" aria-label="GitHub" role="listitem"><i class="fa-brands fa-github" aria-hidden="true"></i></a>
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; ${year} BiblioDrift. Curated with <i class="fa-solid fa-heart" aria-hidden="true"></i> for book lovers.</p>
      </div>
    </footer>
  `;

  if (!document.querySelector('.main-footer')) {
    document.body.insertAdjacentHTML('beforeend', footerHTML);
  }
};

createFooter();
