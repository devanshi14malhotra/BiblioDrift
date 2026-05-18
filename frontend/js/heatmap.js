/**
 * Heatmap Activity Logger and Renderer
 */

const HeatmapConfig = {
    storageKey: 'bibliodrift_activity_log',
    daysToTrack: 365,
    levels: 5 // 0-4
};

window.logReadingActivity = function (action, description) {
    try {
        let log = JSON.parse(localStorage.getItem(HeatmapConfig.storageKey)) || {};
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        if (!log[today]) {
            log[today] = [];
        }
        
        log[today].push({
            action,
            description,
            timestamp: new Date().toISOString()
        });

        // Prune old days (optional, keeps size small)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - HeatmapConfig.daysToTrack);
        
        Object.keys(log).forEach(date => {
            if (new Date(date) < cutoffDate) {
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

    let log = {};
    try {
        log = JSON.parse(localStorage.getItem(HeatmapConfig.storageKey)) || {};
    } catch (e) {
        console.error("Failed to parse activity log:", e);
    }

    const today = new Date();
    // Move to Sunday to align weeks
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - HeatmapConfig.daysToTrack);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const numWeeks = 53;
    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';

    for (let w = 0; w < numWeeks; w++) {
        const col = document.createElement('div');
        col.className = 'heatmap-col';

        for (let d = 0; d < 7; d++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + (w * 7) + d);

            // Don't render cells for future days in the last week
            if (cellDate > today) break;

            const dateStr = cellDate.toISOString().split('T')[0];
            const activities = log[dateStr] || [];
            const count = activities.length;

            let intensity = 0;
            if (count > 0) intensity = 1;
            if (count > 2) intensity = 2;
            if (count > 5) intensity = 3;
            if (count > 9) intensity = 4;

            const cell = document.createElement('div');
            cell.className = `heatmap-cell intensity-${intensity}`;
            
            // Build tooltip
            const formattedDate = cellDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            let tooltipContent = `<strong>${formattedDate}</strong>`;
            if (count === 0) {
                tooltipContent += `<br/>No activity`;
            } else {
                tooltipContent += `<br/>${count} interaction${count > 1 ? 's' : ''}`;
                // Optional: show last 3 actions
                const recent = activities.slice(-3);
                recent.forEach(act => {
                    tooltipContent += `<br/><span style="opacity:0.8; font-size: 0.8em;">- ${act.description}</span>`;
                });
                if (count > 3) tooltipContent += `<br/><span style="opacity:0.8; font-size: 0.8em;">...and ${count - 3} more</span>`;
            }

            cell.innerHTML = `
                <div class="heatmap-tooltip">
                    ${tooltipContent}
                </div>
            `;

            col.appendChild(cell);
        }
        grid.appendChild(col);
    }

    container.appendChild(grid);
    
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
