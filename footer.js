const createFooter = () => {
  const footerHTML = `
    <footer class="main-footer">
      <div class="footer-container">
        <!-- Brand Section -->
        <div class="footer-brand">
          <a href="index.html" class="logo">
            <img style="height: 40px" src="biblioDrift_favicon.png" alt="BiblioDrift Logo"> BiblioDrift
          </a>
          <p class="footer-tagline">"There is no frigate like a book to take us lands away."</p>
          <p class="footer-subtext">— Emily Dickinson</p>
        </div>

        <!-- Quick Links -->
        <div class="footer-nav">
          <h3>Explore</h3>
          <ul>
            <li><a href="index.html">Discovery</a></li>
            <li><a href="library.html">My Library</a></li>
            <li><a href="chat.html">Literary Chat</a></li>
            <li><a href="auth.html">Account</a></li>
          </ul>
        </div>

        <!-- Social Media -->
        <div class="footer-social">
          <h3>Connect</h3>
          <div class="social-icons">
            <a href="#" title="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
            <a href="#" title="Instagram"><i class="fab fa-instagram"></i></a>
            <a href="#" title="Facebook"><i class="fab fa-facebook-f"></i></a>
            <a href="https://github.com/devanshi14malhotra/BiblioDrift" target="_blank" title="GitHub">
              <i class="fa-brands fa-github"></i>
            </a>
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; 2026 BiblioDrift. Curated with <i class="fa-solid fa-heart"></i> for book lovers.</p>
      </div>
    </footer>
    `;

  document.body.insertAdjacentHTML('beforeend', footerHTML);
};

createFooter();