document.addEventListener('DOMContentLoaded', () => {
  const createFooter = () => {
    const footerContainer = document.createElement('div');
    footerContainer.innerHTML = `
      <footer class="site-footer">
        <div class="footer-main">
          <div class="footer-container">
            <!-- Column 1: Brand -->
            <div class="footer-column footer-brand">
              <div class="logo">
                <img style="height: 40px" src="../assets/images/biblioDrift_favicon.png" alt="BiblioDrift Logo">
                <span class="logo-text">BiblioDrift</span>
              </div>
              <p class="footer-quote">"There is no frigate like a book to take us lands away."</p>
              <p class="footer-author">&mdash; Emily Dickinson</p>
            </div>

            <!-- Column 2: Explore -->
            <div class="footer-column footer-links">
              <h3 class="footer-heading">
                <i class="fa-solid fa-compass"></i>
                <span>Explore</span>
              </h3>
              <ul>
                <li><a href="index.html">Explore</a></li>
                <li><a href="library.html">Library</a></li>
                <li><a href="chat.html">Chat</a></li>
              </ul>
            </div>

            <!-- Column 3: Legal -->
            <div class="footer-column footer-links">
              <h3 class="footer-heading">
                <i class="fa-solid fa-shield-halved"></i>
                <span>Legal</span>
              </h3>
              <ul>
                <li><a href="privacy-policy.html">Privacy Policy</a></li>
                <li><a href="terms-and-conditions.html">Terms & Conditions</a></li>
              </ul>
            </div>

            <!-- Column 4: Connect -->
            <div class="footer-column footer-connect">
              <h3 class="footer-heading">
                <i class="fa-solid fa-users"></i>
                <span>Connect</span>
              </h3>
              <div class="social-icons">
                <a href="#" title="LinkedIn" class="social-icon"><i class="fab fa-linkedin-in"></i></a>
                <a href="#" title="Instagram" class="social-icon"><i class="fab fa-instagram"></i></a>
                <a href="https://github.com/devanshi14malhotra/BiblioDrift" target="_blank" rel="noopener noreferrer" title="GitHub" class="social-icon"><i class="fab fa-github"></i></a>
              </div>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <p>&copy; 2026 BiblioDrift. Curated with <i class="fa-solid fa-heart"></i> for book lovers.</p>
        </div>
      </footer>
    `;
    document.body.appendChild(footerContainer);
  };

  createFooter();
});
  `;

  document.body.insertAdjacentHTML('beforeend', footerHTML);
};

createFooter();