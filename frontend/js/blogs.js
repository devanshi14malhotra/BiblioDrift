document.addEventListener('DOMContentLoaded', () => {
  const filterBtns = document.querySelectorAll('.filter-btn:not(.filter-icon-btn)');
  const blogCards = document.querySelectorAll('.blog-card');
  const featuredArticle = document.querySelector('.featured-article');

  // Category Filtering
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons
      filterBtns.forEach(b => b.classList.remove('active'));
      
      // Add active class to clicked button
      btn.classList.add('active');
      
      const filterValue = btn.getAttribute('data-filter');
      
      // Filter the grid cards
      blogCards.forEach(card => {
        if (filterValue === 'all' || card.getAttribute('data-category') === filterValue) {
          card.style.display = 'flex';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 50);
        } else {
          card.style.opacity = '0';
          card.style.transform = 'translateY(10px)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 300);
        }
      });
      
      // Filter featured article if applicable, otherwise always show it
      if (featuredArticle) {
        if (filterValue === 'all' || featuredArticle.getAttribute('data-category') === filterValue) {
          featuredArticle.style.display = 'flex';
        } else {
          featuredArticle.style.display = 'none';
        }
      }
    });
  });

  // Search Functionality
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      
      blogCards.forEach(card => {
        const title = card.querySelector('h4').textContent.toLowerCase();
        const desc = card.querySelector('p').textContent.toLowerCase();
        const tag = card.querySelector('.category-tag').textContent.toLowerCase();
        
        if (title.includes(query) || desc.includes(query) || tag.includes(query)) {
          card.style.display = 'flex';
          card.style.opacity = '1';
        } else {
          card.style.display = 'none';
        }
      });
      
      if (featuredArticle) {
        const fTitle = featuredArticle.querySelector('h2').textContent.toLowerCase();
        const fDesc = featuredArticle.querySelector('p').textContent.toLowerCase();
        
        if (fTitle.includes(query) || fDesc.includes(query)) {
          featuredArticle.style.display = 'flex';
        } else {
          featuredArticle.style.display = 'none';
        }
      }
    });
  }

  // Bookmark Toggle
  const bookmarkBtns = document.querySelectorAll('.bookmark-btn');
  bookmarkBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent navigating if wrapped in an anchor
      e.stopPropagation();
      const icon = btn.querySelector('i');
      if (icon.classList.contains('fa-regular')) {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid');
        icon.style.color = 'var(--text-main)';
        
        // Quick visual toast feedback
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-main);">Saved!</span>';
        setTimeout(() => {
          btn.innerHTML = '<i class="fa-solid fa-bookmark" style="color: var(--text-main);"></i>';
        }, 1000);
        
      } else {
        icon.classList.remove('fa-solid');
        icon.classList.add('fa-regular');
        icon.style.color = '';
      }
    });
  });

  // Newsletter Subscribe
  const newsletterBtn = document.getElementById('newsletter-btn');
  const newsletterInput = document.getElementById('newsletter-input');
  const newsletterMsg = document.getElementById('newsletter-msg');
  
  if (newsletterBtn && newsletterInput && newsletterMsg) {
    newsletterBtn.addEventListener('click', () => {
      const email = newsletterInput.value.trim();
      if (email && email.includes('@')) {
        newsletterInput.value = '';
        newsletterMsg.style.display = 'block';
        newsletterMsg.style.color = '#5cb85c'; // Success green
        newsletterMsg.textContent = 'Subscribed successfully! Welcome to the cozy corner.';
        setTimeout(() => {
          newsletterMsg.style.display = 'none';
        }, 3000);
      } else {
        newsletterMsg.style.display = 'block';
        newsletterMsg.style.color = '#d9534f'; // Error red
        newsletterMsg.textContent = 'Please enter a valid email address.';
      }
    });
  }
});
