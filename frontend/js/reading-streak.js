/**
 * BiblioDrift — Reading Streak Calendar (Issue #608)
 * Local-only daily reading tracker persisted in localStorage.
 * Premium GitHub-style Green heat-map with sticky weekdays, months headers, and legend.
 */

const ReadingStreak = (() => {
  const STORAGE_KEY = 'bibliodrift-reading-streak';
  const CELL_TYPES = { inactive: 0, active: 1, active2: 2, active3: 3, active4: 4 };
  const DAYS_TO_TRACK = 365; // Track 1 full year for a proper GitHub-like view

  // Robust helper to format Date objects as local YYYY-MM-DD, avoiding timezone shift bugs
  function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getTodayDate() {
    return formatDateLocal(new Date());
  }

  function _safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  function loadReadingData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = _safeParse(raw, {});
      return data && typeof data === 'object' ? data : {};
    } catch {
      return {};
    }
  }

  function saveReadingData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {}));
      return true;
    } catch {
      return false;
    }
  }

  function _getDateNDaysAgo(n) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return formatDateLocal(d);
  }

  function markTodayAsRead() {
    const today = getTodayDate();
    const data = loadReadingData();

    // Prevent duplicate marks (idempotent)
    if (data[today]) {
      return false;
    }

    data[today] = 1;

    // Prune anything older than our window to keep storage tidy
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (DAYS_TO_TRACK + 2));

    Object.keys(data).forEach((dateStr) => {
      if (new Date(dateStr) < cutoff) delete data[dateStr];
    });

    saveReadingData(data);
    renderUI();
    return true;
  }

  function calculateCurrentStreak(data) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStr = formatDateLocal(today);
    let startPoint = new Date(today);

    // Resilient current streak logic (check yesterday if today isn't read yet)
    if (!data[todayStr]) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDateLocal(yesterday);
      if (data[yesterdayStr]) {
        startPoint = yesterday;
      } else {
        return 0; // Streak is broken
      }
    }

    let streak = 0;
    while (true) {
      const dateStr = formatDateLocal(startPoint);
      if (!data[dateStr]) break;
      streak += 1;
      startPoint.setDate(startPoint.getDate() - 1);
    }

    return streak;
  }

  function calculateLongestStreak(data) {
    const dateKeys = Object.keys(data).filter((k) => data[k]);
    if (dateKeys.length === 0) return 0;

    // Sort ascending so we can build consecutive runs
    const dates = dateKeys.map((d) => new Date(d + 'T00:00:00'));
    dates.sort((a, b) => a - b);

    let longest = 1;
    let current = 1;

    for (let i = 1; i < dates.length; i++) {
      const diffDays = Math.round((dates[i] - dates[i - 1]) / (24 * 60 * 60 * 1000));
      if (diffDays === 1) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }

    return longest;
  }

  function _intensityClassForIndex(activeIndex /* 0..364 */) {
    // Map activity presence to intensity (1..4) so the most recent day (today)
    // always appears as green 'active4'.
    const clamped = Math.max(0, Math.min(DAYS_TO_TRACK - 1, activeIndex));
    const normalized = clamped / (DAYS_TO_TRACK - 1); // 0..1
    const bucket = Math.max(1, Math.ceil(normalized * 4)); // 1..4

    return bucket === 1
      ? 'active'
      : bucket === 2
        ? 'active2'
        : bucket === 3
          ? 'active3'
          : 'active4';
  }

  function renderCalendar() {
    const container = document.getElementById('reading-streak-calendar');
    if (!container) return;

    const data = loadReadingData();

    // Track last 365 days including today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setDate(start.getDate() - (DAYS_TO_TRACK - 1));

    // Align to week start (Sunday) for a GitHub-like look
    const startAligned = new Date(start);
    startAligned.setDate(startAligned.getDate() - startAligned.getDay());

    // Determine number of weeks to render
    const weeks = Math.ceil((DAYS_TO_TRACK + start.getDay()) / 7) + 1;

    const grid = document.createElement('div');
    grid.className = 'reading-streak-grid';

    let activeCounter = 0;
    const labeledMonths = new Set();

    for (let w = 0; w < weeks; w++) {
      const col = document.createElement('div');
      col.className = 'reading-streak-col';

      // Detect months to render floated labels above correct columns
      let monthLabelText = null;
      let weekMonths = [];

      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startAligned);
        cellDate.setDate(startAligned.getDate() + w * 7 + d);
        if (cellDate >= start && cellDate <= today) {
          const m = cellDate.toLocaleDateString('en-US', { month: 'short' });
          if (!weekMonths.includes(m)) {
            weekMonths.push(m);
          }
        }
      }

      if (w === 0 && weekMonths.length > 0) {
        monthLabelText = weekMonths[0];
        labeledMonths.add(monthLabelText);
      } else {
        for (const m of weekMonths) {
          if (!labeledMonths.has(m)) {
            // Check if this week contains the 1st day of month 'm'
            let containsFirst = false;
            for (let d = 0; d < 7; d++) {
              const cellDate = new Date(startAligned);
              cellDate.setDate(startAligned.getDate() + w * 7 + d);
              if (cellDate.getDate() === 1 && cellDate.toLocaleDateString('en-US', { month: 'short' }) === m) {
                containsFirst = true;
                break;
              }
            }
            if (containsFirst) {
              monthLabelText = m;
              labeledMonths.add(m);
              break;
            }
          }
        }
      }

      if (monthLabelText) {
        const span = document.createElement('span');
        span.className = 'reading-streak-month-label';
        span.textContent = monthLabelText;
        col.appendChild(span);
      }

      // Render 7 days per week
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startAligned);
        cellDate.setDate(startAligned.getDate() + w * 7 + d);

        // Future days: empty gridcell placeholder to maintain structure
        if (cellDate > today) {
          const cell = document.createElement('div');
          cell.className = 'reading-streak-cell reading-streak-cell-empty';
          col.appendChild(cell);
          continue;
        }

        const dateStr = formatDateLocal(cellDate);
        const inWindow = cellDate >= start;
        const isActive = !!data[dateStr];

        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'reading-streak-cell';
        cell.setAttribute('role', 'gridcell');
        cell.dataset.date = dateStr;

        const formatted = cellDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        if (!inWindow) {
          cell.classList.add('reading-streak-cell-empty');
          cell.disabled = true;
          cell.title = formatted;
          col.appendChild(cell);
          continue;
        }

        if (isActive) {
          const dayIndexFromStart = Math.round((cellDate - start) / (24 * 60 * 60 * 1000));
          const intensityClass = _intensityClassForIndex(dayIndexFromStart);
          cell.classList.add(intensityClass);
          cell.title = `${formatted} — Read`;
          activeCounter += 1;
        } else {
          cell.classList.add('inactive');
          cell.title = `${formatted} — Not read`;
        }

        // Disable direct cell clicking (tracked via action button only)
        cell.disabled = true;
        col.appendChild(cell);
      }

      grid.appendChild(col);
    }

    // Assemble new DOM structure with sticky weekdays and scrollable grid
    container.innerHTML = '';
    container.setAttribute('role', 'grid');

    const wrapper = document.createElement('div');
    wrapper.className = 'reading-streak-heatmap-container';

    // Sticky Weekdays Column
    const weekdays = document.createElement('div');
    weekdays.className = 'reading-streak-weekdays';
    weekdays.setAttribute('aria-hidden', 'true');

    const daysOfWeek = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    daysOfWeek.forEach((day) => {
      const label = document.createElement('div');
      label.className = 'weekday-label';
      label.textContent = day;
      weekdays.appendChild(label);
    });
    wrapper.appendChild(weekdays);

    // Scrollable Grid Wrapper
    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'reading-streak-grid-wrapper';
    gridWrapper.appendChild(grid);
    wrapper.appendChild(gridWrapper);

    container.appendChild(wrapper);

    // Append card footer with count stats and green intensity legend
    const footer = document.createElement('div');
    footer.className = 'reading-streak-footer';

    const info = document.createElement('div');
    info.className = 'reading-streak-info';
    info.innerHTML = `Total active days: <strong>${activeCounter}</strong>`;
    footer.appendChild(info);

    const legend = document.createElement('div');
    legend.className = 'reading-streak-legend';
    legend.innerHTML = `
      <span>Less</span>
      <div class="reading-streak-cell inactive" title="No activity"></div>
      <div class="reading-streak-cell active" title="Low activity"></div>
      <div class="reading-streak-cell active2" title="Medium activity"></div>
      <div class="reading-streak-cell active3" title="High activity"></div>
      <div class="reading-streak-cell active4" title="Peak activity"></div>
      <span>More</span>
    `;
    footer.appendChild(legend);

    container.appendChild(footer);

    // Auto-scroll so today is visible on load (cozy and subtle)
    const scrollWrap = container.closest('.reading-streak-scroll') || container;
    if (scrollWrap && scrollWrap.scrollLeft !== undefined) {
      scrollWrap.scrollLeft = scrollWrap.scrollWidth;
    }
  }

  function _updateStatsUI(currentStreak, longestStreak) {
    const currentEl = document.getElementById('reading-streak-current');
    const longestEl = document.getElementById('reading-streak-longest');
    if (currentEl) currentEl.textContent = currentStreak;
    if (longestEl) longestEl.textContent = longestStreak;
  }

  function renderUI() {
    const data = loadReadingData();
    const currentStreak = calculateCurrentStreak(data);
    const longestStreak = calculateLongestStreak(data);

    _updateStatsUI(currentStreak, longestStreak);
    renderCalendar();

    const btn = document.getElementById('reading-streak-mark-today');
    if (btn) {
      const today = getTodayDate();
      const alreadyMarked = !!data[today];
      btn.disabled = alreadyMarked;
      btn.setAttribute('aria-disabled', String(alreadyMarked));
      
      const span = btn.querySelector('span') || btn;
      const icon = btn.querySelector('i');

      if (alreadyMarked) {
        if (icon) icon.className = 'fa-solid fa-check';
        if (span !== btn) {
          span.textContent = 'Read Today!';
        } else {
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Read Today!';
        }
      } else {
        if (icon) icon.className = 'fa-solid fa-book-open';
        if (span !== btn) {
          span.textContent = 'Read Today';
        } else {
          btn.innerHTML = '<i class="fa-solid fa-book-open"></i> Read Today';
        }
      }
    }
  }

  function _wireEvents() {
    const btn = document.getElementById('reading-streak-mark-today');
    if (!btn) return;
    
    // Remove old listeners by replacing button with its clone
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
      markTodayAsRead();
    });
  }

  function init() {
    const run = () => {
      const calendar = document.getElementById('reading-streak-calendar');
      const btn = document.getElementById('reading-streak-mark-today');
      if (!calendar && !btn) return;

      _wireEvents();
      renderUI();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  }

  // Public API
  return {
    init,
    getTodayDate,
    loadReadingData,
    saveReadingData,
    markTodayAsRead,
    calculateCurrentStreak,
    calculateLongestStreak,
    renderCalendar,
  };
})();

// Ensure it actually initializes when included via <script>.
if (typeof ReadingStreak?.init === 'function') {
  ReadingStreak.init();
}

// Backward-safe global alias.
window.ReadingStreak = ReadingStreak;
