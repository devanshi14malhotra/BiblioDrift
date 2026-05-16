const createFooter = () => {
  const year = new Date().getFullYear();

  const footerHTML = `
    <footer class="main-footer">
      <div class="footer-container">
        <!-- Brand Section -->
        <div class="footer-brand">
          <a href="/index.html" class="logo" aria-label="BiblioDrift Home">
            <img class="footer-logo" src="/assets/images/biblioDrift_favicon.png" alt="BiblioDrift Logo"> BiblioDrift
          </a>
          <p class="footer-tagline">"There is no frigate like a book to take us lands away."</p>
          <p class="footer-subtext">&mdash; Emily Dickinson</p>
        </div>

        <!-- Quick Links -->
        <nav class="footer-nav" aria-label="Footer Navigation">
          <h3>Explore</h3>
          <ul>
            <li><a href="/index.html">Discovery</a></li>
            <li><a href="/library.html">My Library</a></li>
            <li><a href="/chat.html">Literary Chat</a></li>
            <li><a href="/auth.html">Account</a></li>
          </ul>
        </nav>

        <div class="footer-legal">
          <h3>Legal</h3>
          <ul>
            <li><a href="privacy-policy.html">Privacy Policy</a></li>
            <li><a href="terms-and-conditions.html">Terms & Conditions</a></li>
          </ul>
        </div>

        <!-- Social Media -->
        <div class="footer-social">
          <h3>Connect</h3>
          <div class="social-icons">
            <a href="https://www.linkedin.com/in/devanshi5malhotra/" target="_blank" rel="noopener noreferrer" title="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
            <a href="#" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
            <a href="#" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
            <a href="https://github.com/devanshi14malhotra/BiblioDrift" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
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