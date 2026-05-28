/**
 * Contributors Loader Script
 * Fetches and displays contributors from GitHub data in a grid
 */

(function () {
  const status = document.getElementById('contributors-status');
  const grid = document.getElementById('contributors-grid');
  const dataPaths = [
    '../data/contributors.json',
    '/data/contributors.json',
    'frontend/data/contributors.json'
  ];

  /**
   * Creates a contributor card element
   * @param {Object} user - User object from GitHub API
   * @returns {HTMLElement} Contributor card anchor element
   */
  function cardFor(user) {
    const anchor = document.createElement('a');
    anchor.className = 'contributor-card';
    anchor.href = user.html_url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';

    const avatar = document.createElement('img');
    avatar.className = 'contributor-avatar';
    avatar.loading = 'lazy';
    avatar.alt = user.login;
    avatar.src = `${user.avatar_url}?s=160`;

    const name = document.createElement('p');
    name.className = 'contributor-name';
    name.textContent = user.login;

    const count = document.createElement('p');
    count.className = 'contributor-count';
    count.textContent = user.contributions ? `${user.contributions} contributions` : 'GitHub contributor';

    anchor.appendChild(avatar);
    anchor.appendChild(name);
    anchor.appendChild(count);
    return anchor;
  }

  /**
   * Loads contributors from JSON data and populates the grid
   * Tries multiple data paths and sorts by contribution count
   */
  async function loadContributors() {
    for (const path of dataPaths) {
      try {
        const response = await fetch(path);
        if (!response.ok) continue;
        const data = await response.json();
        if (!Array.isArray(data) || !data.length) continue;

        const sorted = data.slice().sort((a, b) => (b.contributions || 0) - (a.contributions || 0));
        grid.innerHTML = '';
        sorted.forEach((user) => grid.appendChild(cardFor(user)));
        status.hidden = true;
        grid.hidden = false;
        return;
      } catch (error) {
        continue;
      }
    }

    status.textContent = 'Contributors not available right now.';
  }

  // Load contributors when DOM is ready
  loadContributors();
})();
