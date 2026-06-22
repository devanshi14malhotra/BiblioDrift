/**
 * Heatmap Activity Logger and Renderer
 */

const HeatmapConfig = {
    storageKey: 'bibliodrift_activity_log',
    daysToTrack: 365,
    weeksToShow: 52,
    levels: 5 // 0-4
};

function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

window.logReadingActivity = function (action, description) {
    try {
        let log = JSON.parse(localStorage.getItem(HeatmapConfig.storageKey)) || {};
        
        const today = formatDateLocal(new Date());
        
        if (!log[today]) {
            log[today] = [];
        }
        
        log[today].push({
            action,
            description,
            timestamp: new Date().toISOString()
        });

        const cutoffDate = new Date();
        cutoffDate.setHours(0, 0, 0, 0);
        cutoffDate.setDate(cutoffDate.getDate() - HeatmapConfig.daysToTrack);
        
        Object.keys(log).forEach(date => {
            if (new Date(`${date}T00:00:00`) < cutoffDate) {
                delete log[date];
            }
        });

        localStorage.setItem(HeatmapConfig.storageKey, JSON.stringify(log));

        // Re-render if on profile page
        if (document.getElementById('reading-heatmap')) {
            window.renderHeatmap();
        }
    } catch (e) {
        console.error("Failed to log reading activity:", e);
    }
};

window.renderHeatmap = function () {
    const container = document.getElementById('reading-heatmap');
    if (!container) return;

    container.innerHTML = ''; // Clear previous

    const section = container.closest('.reading-heatmap-section');
    let tooltipLayer = section ? section.querySelector('.heatmap-tooltip-layer') : null;
    if (tooltipLayer) {
        tooltipLayer.remove();
    }
    if (section) {
        tooltipLayer = document.createElement('div');
        tooltipLayer.className = 'heatmap-tooltip-layer';
        tooltipLayer.setAttribute('aria-hidden', 'true');
        section.appendChild(tooltipLayer);
    }

    const showTooltip = (cell, tooltipContent) => {
        if (!tooltipLayer || !section) return;
        tooltipLayer.innerHTML = tooltipContent;
        tooltipLayer.classList.add('is-visible');

        const sectionRect = section.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const cellCenterX = cellRect.left - sectionRect.left + (cellRect.width / 2);
        const preferredLeft = cellCenterX - 120;
        const clampedLeft = Math.max(12, Math.min(preferredLeft, sectionRect.width - 252));
        const belowTop = cellRect.bottom - sectionRect.top + 10;
        const aboveTop = cellRect.top - sectionRect.top - 78;
        const fitsBelow = belowTop + 86 < sectionRect.height;

        tooltipLayer.style.left = `${clampedLeft}px`;
        tooltipLayer.style.top = `${Math.max(12, fitsBelow ? belowTop : Math.max(12, aboveTop))}px`;
    };

    const hideTooltip = () => {
        if (!tooltipLayer) return;
        tooltipLayer.classList.remove('is-visible');
    };

    let log = {};
    try {
        log = JSON.parse(localStorage.getItem(HeatmapConfig.storageKey)) || {};
    } catch (e) {
        console.error("Failed to parse activity log:", e);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 52-week window: Sunday of the current week back through Saturday of this week.
    const startOfCurrentWeek = new Date(today);
    startOfCurrentWeek.setDate(today.getDate() - today.getDay());

    const startDate = new Date(startOfCurrentWeek);
    startDate.setDate(startOfCurrentWeek.getDate() - ((HeatmapConfig.weeksToShow - 1) * 7));
    startDate.setHours(0, 0, 0, 0);

    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', 'Reading activity contribution graph');

    const board = document.createElement('div');
    board.className = 'heatmap-board';

    const monthLabels = document.createElement('div');
    monthLabels.className = 'heatmap-months';

    const weekdayLabels = document.createElement('div');
    weekdayLabels.className = 'heatmap-weekdays';

    ['', 'Mon', '', 'Wed', '', 'Fri', ''].forEach((label) => {
        const weekday = document.createElement('div');
        weekday.className = 'heatmap-weekday';
        weekday.textContent = label;
        weekdayLabels.appendChild(weekday);
    });

    const monthMarkers = [];
    let lastMonth = null;
    for (let w = 0; w < HeatmapConfig.weeksToShow; w++) {
        const weekDate = new Date(startDate);
        weekDate.setDate(startDate.getDate() + (w * 7));
        const month = weekDate.toLocaleDateString('en-US', { month: 'short' });
        if (lastMonth !== month) {
            monthMarkers.push({ month, weekIndex: w });
            lastMonth = month;
        }
    }

    monthMarkers.forEach((marker, index) => {
        const nextWeekIndex = monthMarkers[index + 1]?.weekIndex ?? HeatmapConfig.weeksToShow;
        const spanWeeks = Math.max(1, nextWeekIndex - marker.weekIndex);
        const monthLabel = document.createElement('span');
        monthLabel.className = 'heatmap-month';
        monthLabel.textContent = marker.month;
        monthLabel.style.width = `calc(${spanWeeks} * (var(--heatmap-cell-size) + var(--heatmap-cell-gap)))`;
        monthLabels.appendChild(monthLabel);
    });

    for (let w = 0; w < HeatmapConfig.weeksToShow; w++) {
        for (let d = 0; d < 7; d++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + (w * 7) + d);
            cellDate.setHours(0, 0, 0, 0);

            const dateStr = formatDateLocal(cellDate);
            const isFuture = cellDate > today;
            const activities = isFuture ? [] : (log[dateStr] || []);
            const count = activities.length;

            let intensity = 0;
            if (!isFuture && count > 0) intensity = 1;
            if (!isFuture && count > 2) intensity = 2;
            if (!isFuture && count > 5) intensity = 3;
            if (!isFuture && count > 9) intensity = 4;

            const formattedDate = cellDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const cell = document.createElement('div');
            cell.className = `heatmap-cell intensity-${intensity}${isFuture ? ' heatmap-future' : ''}`;
            cell.setAttribute('role', 'gridcell');
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('aria-label', `${formattedDate}: ${isFuture ? 'Future date' : count === 0 ? 'No activity' : `${count} interaction${count > 1 ? 's' : ''}`}`);

            let tooltipContent = `<strong>${formattedDate}</strong>`;
            if (isFuture) {
                tooltipContent += `<br/>Future date`;
            } else if (count === 0) {
                tooltipContent += `<br/>No activity`;
            } else {
                tooltipContent += `<br/>${count} interaction${count > 1 ? 's' : ''}`;
                const recent = activities.slice(-3);
                recent.forEach(act => {
                    tooltipContent += `<br/><span style="opacity:0.8; font-size: 0.8em;">- ${act.description}</span>`;
                });
                if (count > 3) tooltipContent += `<br/><span style="opacity:0.8; font-size: 0.8em;">...and ${count - 3} more</span>`;
            }

            cell.addEventListener('mouseenter', () => showTooltip(cell, tooltipContent));
            cell.addEventListener('mousemove', () => showTooltip(cell, tooltipContent));
            cell.addEventListener('mouseleave', hideTooltip);
            cell.addEventListener('focus', () => showTooltip(cell, tooltipContent));
            cell.addEventListener('blur', hideTooltip);

            grid.appendChild(cell);
        }
    }

    board.appendChild(monthLabels);
    board.appendChild(weekdayLabels);
    board.appendChild(grid);

    container.appendChild(board);
    
    // Scroll heatmap to the right (latest activity)
    const scrollContainer = document.querySelector('.heatmap-scroll-container');
    if (scrollContainer) {
        scrollContainer.scrollLeft = scrollContainer.scrollWidth;
    }
};

// Auto-render on load
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('reading-heatmap')) {
        window.renderHeatmap();
    }
});
