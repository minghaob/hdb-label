document.addEventListener('keydown', function(event) {
    // Check if the key press is happening inside input fields or editable elements
    var ignoreKeys = ['INPUT', 'SELECT', 'TEXTAREA', 'CONTENTEDITABLE'];

    if (ignoreKeys.includes(event.target.tagName) || event.target.isContentEditable) {
        // If the key press is inside an input or similar elements, do nothing
        return;
    }

	if (event.code == 'KeyW') {											// select previous event
		if (g_selectedEventIdx > 0)
			selectEvent(g_selectedEventIdx - 1);
	}
	else if (event.code == 'KeyS') {									// select next event
		if (g_events && g_selectedEventIdx + 1 < g_events.length)
			selectEvent(g_selectedEventIdx + 1);
	}
	else if (event.code == 'KeyA') {									// seek video
		if (event.shiftKey)
			seekVideo(-0.2);
		else
			seekVideo(-1);
	}
	else if (event.code == 'KeyD') {
		if (event.shiftKey)
			seekVideo(0.2);
		else
			seekVideo(1);
	}
	else if (event.code == 'KeyQ') {
		if (event.shiftKey)
			seekVideo(-5);
		else
			seekVideo(-20);
	}
	else if (event.code == 'KeyE') {
		if (event.shiftKey)
			seekVideo(5);
		else
			seekVideo(20);
	}
	else if (event.code == 'Delete') {
		if (g_events && g_selectedEventIdx >= 0 && g_selectedEventIdx < g_events.length) {
			assignLabelToEvent(g_selectedEventIdx, null);
		}
	}
	else if (event.code == 'Backspace') {
		if (g_events && g_selectedEventIdx > 0 && g_selectedEventIdx < g_events.length) {
			assignLabelToEvent(g_selectedEventIdx - 1, null);
			selectEvent(g_selectedEventIdx - 1);
		}
	}

    // Log the key for demonstration; replace this with your actual functionality
    //console.log("Key pressed: " + event.key + " (Code: " + event.code + ")");
});