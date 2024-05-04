const divider = document.getElementById('divider');
const leftPanel = document.getElementById('left-panel');
const rightPanel = document.getElementById('right-panel');
const container = document.getElementById('container');
let isResizing = false;

function adjustPanels() {
    const totalWidth = container.offsetWidth;
    const currentLeftWidth = Math.min(totalWidth - 100, Math.max(100, leftPanel.offsetWidth));
    leftPanel.style.width = `${currentLeftWidth}px`;
    const rightWidth = totalWidth - currentLeftWidth - divider.offsetWidth;
    rightPanel.style.width = `${rightWidth}px`;
}

divider.addEventListener('mousedown', function(e) {
    isResizing = true;
    let startX = e.clientX;

    // Disable text selection during dragging
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    function handleMouseMove(e) {
        if (!isResizing) return;

        const dx = e.clientX - startX;
        startX = e.clientX; // Update startX to the new position for the next calculation

        // Calculate new width for the left panel within allowable bounds
        const newLeftWidth = Math.max(340, Math.min(container.offsetWidth - 340, leftPanel.offsetWidth + dx));
        leftPanel.style.width = `${newLeftWidth}px`;

        // Adjust the right panel's width
        const newRightWidth = container.offsetWidth - newLeftWidth - divider.offsetWidth;
        rightPanel.style.width = `${newRightWidth}px`;

		map.invalidateSize();		// for the leaflet map to resize accordingly
    }

    function stopResize() {
        if (isResizing) {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResize);
            isResizing = false;

            // Re-enable text selection after dragging
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
        }
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResize);
});

// Adjust panels on window resize
window.addEventListener('resize', adjustPanels);

// Initial adjustment on load
adjustPanels();
