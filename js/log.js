const log_element = document.getElementById('log');

function logMessage(message) {
	const message_element = document.createElement('div');
	message_element.innerHTML = getCurrentTime() + ': ' + message;
	if (log_element.childNodes.length % 2 == 1)
		message_element.style.backgroundColor = 'rgb(237,237,238)';
	log_element.appendChild(message_element);

	// Scroll to the bottom of the log element
	log_element.scrollTop = log_element.scrollHeight;

	return message_element;
}
