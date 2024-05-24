let g_runDoc;			// object loaded from run.yaml
let g_videos;
let g_events;			// .overallFrame:	baseFrame + eventFrameInFile - runDoc.videos[rawFileIdx].segments[curSeg][0],
						// .text:			rawDoc.events[eventIdx][1],
						// .videoFileIdx:	rawFileIdx,
						// .frameInFile:	eventFrameInFile,
						// .label:			assigned label, e.g. "Z03", "Mogg Latan Shrine", "Ridgeland Tower"
						// .sublabel:		[NOT YET IMPLEMENTED] assigned sublabel, e.g. "Enter Shrine"
						// .flag:			[NOT YET IMPLEMENTED] e.g. "KilledTalus", "GotLocation"
						// .comment:		[NOT YET IMPLEMENTED]
let g_selectedEventIdx = -1;
let g_activeVideoIdx = -1;
let g_folderHandle;
let g_playing = false;

function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        // Event handler executed when the load event is fired
        reader.onload = () => resolve(reader.result);

        // Event handler executed if an error occurs during the read operation
        reader.onerror = () => reject(reader.error);

        // Read the file content as text
        reader.readAsText(file);
    });
}

async function getFileContent(fileHandle) {
    // Check if permission to read the file is granted
    if ((await fileHandle.queryPermission({ mode: 'read' })) !== 'granted' &&
        (await fileHandle.requestPermission({ mode: 'read' })) !== 'granted') {
        alert('Need permission to read the file');
        return;
    }

    try {
        // Get the File object from the file handle
        const file = await fileHandle.getFile();
        return readFileContent(file);
    } catch (error) {
        console.error('Error accessing file', error);
    }
}

async function getFileHandle(directoryHandle, filename) {
    try {
        // Get a file handle with read/write permission
        const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
        return fileHandle;
    } catch (error) {
        console.error('Error getting file handle:', error);
        return null;
    }
}
async function writeFile(fileHandle, contents) {
    try {
        // Create a writable stream
        const writable = await fileHandle.createWritable();
        // Write the contents to the file
        await writable.write(contents);
        // Close the writable stream
        await writable.close();
        return true;
    } catch (error) {
        return false;
    }
}

async function writeToFile(folderHandle, filename, contents) {
	if (!folderHandle)
		return false;

	try {
		const fileHandle = await getFileHandle(folderHandle, filename);
		if (fileHandle) {
			const result = await writeFile(fileHandle, contents);
			return result;
		}
		return false;
	} catch (error) {
		return false;
	}
}

async function loadSavedFile() {
	let fileHandle;
	try {
		fileHandle = await g_folderHandle.getFileHandle(g_runDoc.uid + '.yaml', { create: false });
	}
	catch (error) {
		return;
	}

	try {
		const content = await getFileContent(fileHandle);
		let wipDoc = jsyaml.load(content);
		if (!Array.isArray(wipDoc.events))
			throw (g_runDoc.uid + '.yaml' + ' does not have valid events property');
		let gEventIdx = 0;
		let numLoadedEvents = 0;
		for (let eventIdx = 0; eventIdx < wipDoc.events.length; eventIdx++) {
			while (gEventIdx < g_events.length && g_events[gEventIdx].overallFrame < wipDoc.events[eventIdx].frame)
				gEventIdx++;
			if (gEventIdx >= g_events.length)
				break;
			if (g_events[gEventIdx].overallFrame == wipDoc.events[eventIdx].frame) {
				assignLabelToEvent(gEventIdx, wipDoc.events[eventIdx].label);
				numLoadedEvents++;
			}
		}

		let msg = 'Loaded ' + numLoadedEvents + ' event data from ' + g_runDoc.uid + '.yaml';
		if (numLoadedEvents != wipDoc.events.length)
			msg += ' (' + wipDoc.events.length - numLoadedEvents + ' ignored)';
		logMessage(msg);

	} catch (error) {
		logMessage(error);
	}
}

function initLoadButton() {
	const btn = document.getElementById('btn-load');

	btn.addEventListener('click', async () => {
		try {
			let runDoc;
			const folderHandle = await window.showDirectoryPicker();

			// parse run.yaml
			{
				const fileHandle = await folderHandle.getFileHandle('run.yaml', { create: false });
				const content = await getFileContent(fileHandle);
				runDoc = jsyaml.load(content);
				if (!runDoc.uid)
					throw ('Missing uid in run.yaml');
				if (!runDoc.videos || !Array.isArray(runDoc.videos))
					throw ('expecting video element in run.yaml as array');
			}

			const canvas = document.getElementById('video-frame');
			const canvasContext = canvas.getContext('2d');

			// load the video files to video elements
			let videos = [];
			let numLoadedVideos = 0;
			for (let vidIdx = 0; vidIdx < runDoc.videos.length; vidIdx++) {
				if (typeof runDoc.videos[vidIdx].local !== 'string')
					throw 'video['+ vidIdx + '] missing \'local\' property of type string';

				const fileHandle = await folderHandle.getFileHandle(runDoc.videos[vidIdx].local, { create: false });
				const file = await fileHandle.getFile();
				const url = URL.createObjectURL(file);
				const video = document.createElement('video');
				video.src = url;
				video.addEventListener('loadedmetadata', async () => {
					logMessage('videos[' + vidIdx +'] \'' + runDoc.videos[vidIdx].local + '\' loaded.');
					// verify segments format
					try {
						let segments = runDoc.videos[vidIdx].segments;
						if (!Array.isArray(segments) || segments.length == 0)
							throw 'videos['+ vidIdx + '].segments format error';
						for (let segIdx = 0; segIdx < segments.length; segIdx++) {
							if (!Array.isArray(segments[segIdx]) || segments[segIdx].length != 2)
								throw 'videos['+ vidIdx + '].segments format error';
							if (!Number.isInteger(segments[segIdx][0]) || !Number.isInteger(segments[segIdx][1]))
								throw 'videos['+ vidIdx + '].segments format error';
							if (segments[segIdx][0] > segments[segIdx][1])
								throw 'videos['+ vidIdx + '].segments format error';
							if (segIdx > 0 && segments[segIdx][0] <= segments[segIdx - 1][1])
								throw 'videos['+ vidIdx + '].segments format error';
							if (segIdx > 0 && segments[segIdx][0] <= segments[segIdx - 1][1])
								throw 'videos['+ vidIdx + '].segments format error';
						}
						if (segments[segments.length - 1][1] > video.duration * 30)
							throw 'videos['+ vidIdx + '].segments last value larger then video length';
					}
					catch (error) {
						logMessage('Error loading run: ' + error);
						return;
					}

					numLoadedVideos++;

					// after all videos loaded, load the raw files
					if (numLoadedVideos == runDoc.videos.length) {
						let events = [];

						// collect events from all raw files
						try {
							let baseFrame = 0;		// overall frame index of current segment's first frame
							for (let rawFileIdx = 0; rawFileIdx < runDoc.videos.length; rawFileIdx++) {
								let fileName = 'raw_' + (rawFileIdx + 1).toString().padStart(2, '0') + '.yaml';		// raw files has filename numbered from 1 instead of 0
								const fileHandle = await folderHandle.getFileHandle(fileName, { create: false });
								const content = await getFileContent(fileHandle);
								let rawDoc = jsyaml.load(content);
								if (!Array.isArray(rawDoc.events))
									throw (fileName + ' does not have valid events property');
								let curSeg = 0;
								for (let eventIdx = 0; eventIdx < rawDoc.events.length; eventIdx++) {
									let eventFrameInFile = rawDoc.events[eventIdx][0];
									if (eventIdx > 0 && eventFrameInFile <= rawDoc.events[eventIdx - 1][0])
										throw (fileName + ': event frame ' + eventFrameInFile + ' not larger than previous event frame');
									// If event frame larger then current segment, advance current segment
									while (eventFrameInFile > runDoc.videos[rawFileIdx].segments[curSeg][1]) {
										baseFrame += runDoc.videos[rawFileIdx].segments[curSeg][1] - runDoc.videos[rawFileIdx].segments[curSeg][0] + 1;
										curSeg++;
										if (curSeg >= runDoc.videos[rawFileIdx].segments.length)		// event frame larger than last segment of video
											throw (fileName + ': event frame ' + eventFrameInFile + ' in ' + fileName + ' outside segments');
									}
									if (rawDoc.events[eventIdx][0] < runDoc.videos[rawFileIdx].segments[curSeg][0])		// event frame smaller than current segment, indicating that it's between the current segment and last segment
										throw (fileName + ': event frame ' + eventFrameInFile + ' in ' + fileName + ' outside segments');
									events.push({
										'overallFrame': baseFrame + eventFrameInFile - runDoc.videos[rawFileIdx].segments[curSeg][0],
										'text': rawDoc.events[eventIdx][1],
										'videoFileIdx': rawFileIdx,
										'frameInFile' : eventFrameInFile,
									})
								}

								for (; curSeg < runDoc.videos[rawFileIdx].segments.length; curSeg++)
									baseFrame += runDoc.videos[rawFileIdx].segments[curSeg][1] - runDoc.videos[rawFileIdx].segments[curSeg][0] + 1;

								logMessage('Loaded raw file \''+ fileName + '\'');
							}
						} catch (error) {
							logMessage('Error loading run: ' + error);
							return;
						}

						// feed collected events to event table
						{
							// first clear existing table content
							const tbodyEle = document.querySelector('#event-table tbody');
							while (tbodyEle.firstChild) {
								tbodyEle.removeChild(tbodyEle.firstChild);
							}

							// insert one row for each event
							for (let eventIdx = 0; eventIdx < events.length; eventIdx++) {
								const newRow = tbodyEle.insertRow(-1);
								newRow.insertCell(-1).innerHTML = frameIdxToTime(events[eventIdx].overallFrame);	// frame
								newRow.insertCell(-1).innerHTML = events[eventIdx].text;							// text
								newRow.insertCell(-1);																// label
								newRow.insertCell(-1);																// flags
								newRow.insertCell(-1);																// comment
							}
						}

						logMessage("Loaded run: " + runDoc.uid);

						// assign loaded data to global instances, 
						g_videos = videos;
						g_runDoc = runDoc;
						g_events = events;
						g_folderHandle = folderHandle;

						loadSavedFile();

						selectEvent(0);
					}
				});

				video.muted = true;			// mute videos by default
				video.addEventListener('seeked', () => {
					if (canvas.width != video.videoWidth)
						canvas.width = video.videoWidth;
					if (canvas.height != video.videoHeight)
						canvas.height = video.videoHeight;

					canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
				});
				video.addEventListener('play', () => {
					if (video == g_videos[g_activeVideoIdx]) {
						document.getElementById('btn-play').innerHTML = '⏸️';
						g_playing = true;
					}
				});
				video.addEventListener('pause', () => {
					if (video == g_videos[g_activeVideoIdx]) {
						document.getElementById('btn-play').innerHTML = '▶️';
						g_playing = false;
					}
				});

				videos.push(video);
			}
		} catch (error) {
		 	logMessage('Error loading run: ' + error);
		}
	});
}

function drawVideo() {
	if (g_videos && g_activeVideoIdx >= 0) {
		const video = g_videos[g_activeVideoIdx];
		if (video.paused === false) {
			const canvas = document.getElementById('video-frame');
			const canvasContext = canvas.getContext('2d');
			if (canvas.width != video.videoWidth)
				canvas.width = video.videoWidth;
			if (canvas.height != video.videoHeight)
				canvas.height = video.videoHeight;

			canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
		}
	}
	requestAnimationFrame(() => drawVideo());
}

function initSaveButton() {
	const btn = document.getElementById('btn-save');

	btn.addEventListener('click', async () => {
		if (!g_folderHandle || !g_runDoc || !g_events)
			return;

		let saveObj = {};		// object to be written to output file

		// metadata from loaded run.yaml
		saveObj.uid = g_runDoc.uid;
		if (g_runDoc.runner)
			saveObj.runner = g_runDoc.runner;
		if (g_runDoc.src_id)
			saveObj.src_id = g_runDoc.src_id;
		saveObj.videos = [];
		for (let i = 0; i < g_runDoc.videos.length; i++) {
			let curVideo = {};
			if (g_runDoc.videos[i].remote)
				curVideo.remote = g_runDoc.videos[i].remote;
			curVideo.segments = g_runDoc.videos[i].segments;
			saveObj.videos.push(curVideo);
		}

		// in-memory event data
		saveObj.events = [];
		for (let i = 0; i < g_events.length; i++) {
			if (g_events[i].label) {				// only included events that already have label assigned
				let curEvent = {};
				curEvent.frame = g_events[i].overallFrame;
				curEvent.label = g_events[i].label;
				if (g_events[i].sublabel)
					curEvent.sublabel = g_events[i].sublabel;
				if (g_events[i].flag)
					curEvent.flag = g_events[i].flag;
				if (g_events[i].comment)
					curEvent.comment = g_events[i].comment;
				saveObj.events.push(curEvent);
			}
		}
		let content = jsyaml.dump(saveObj);
		if (await writeToFile(g_folderHandle, saveObj.uid + '.yaml', content)) {
			logMessage('Saved to ' + saveObj.uid + '.yaml');
		}
	});
}

async function clickMute(event) {
	if (g_events && g_videos) {
		for (let i = 0; i < g_videos.length; i++)
			g_videos[i].muted = !g_videos[i].muted;
		document.getElementById('btn-mute').innerHTML = g_videos[g_activeVideoIdx].muted ? '🔇':'🔊';
	}
}

async function clickPlay(event) {
	if (g_events && g_videos) {
		if (g_playing) {
			g_videos[g_activeVideoIdx].pause();
		}
		else {
			g_videos[g_activeVideoIdx].play();
		}
	}
}

function initButtons() {
	initLoadButton();
	initSaveButton();

	document.getElementById('rewind_20s').addEventListener('click', async () => {
		seekVideo(-20);
	});
	document.getElementById('rewind_5s').addEventListener('click', async () => {
		seekVideo(-5);
	});
	document.getElementById('rewind_1s').addEventListener('click', async () => {
		seekVideo(-1);
	});
	document.getElementById('rewind_0.2s').addEventListener('click', async () => {
		seekVideo(-0.2);
	});
	document.getElementById('forward_0.2s').addEventListener('click', async () => {
		seekVideo(0.2);
	});
	document.getElementById('forward_1s').addEventListener('click', async () => {
		seekVideo(1);
	});
	document.getElementById('forward_5s').addEventListener('click', async () => {
		seekVideo(5);
	});
	document.getElementById('forward_20s').addEventListener('click', async () => {
		seekVideo(20);
	});

	document.getElementById('btn-mute').addEventListener('click', clickMute);

	document.getElementById('btn-play').addEventListener('click', clickPlay);
}

function initTable() {
	let table = document.getElementById("event-table");

	table.addEventListener("click", function(event) {
		let target = event.target;

		// Continue only if the clicked element is a TD and its parent is not a THEAD
		if (target.tagName === "TD" && target.parentNode.parentNode.tagName !== 'THEAD') {
			const targetRow = target.parentNode; // Get the parent row (tr) of the clicked cell (td)
			const targetEventIdx = targetRow.rowIndex - 1;
			if (targetEventIdx != g_selectedEventIdx)
				selectEvent(targetEventIdx);	// select event if not already 
			else
				unselectEvent();				// otherwise unselect it
		}
	});
}

function seekVideo(offset) {
	if (g_videos && g_activeVideoIdx >= 0 && g_activeVideoIdx < g_videos.length)
		g_videos[g_activeVideoIdx].currentTime += offset;
}

function init() {
	initButtons();
	initTable();
	drawVideo();
}

// select a certain event
function selectEvent(eventIdx, shouldHighlightMarker = true) {
	if (!g_events)
		return;

	if (eventIdx >= g_events.length || eventIdx < 0) {
		logMessage('Selecting invalid event index: ' + eventIdx);
		return;
	}

	unselectEvent();

	const targetRow = document.querySelector('#event-table tbody').childNodes[eventIdx];

	// Toggle the 'selected' class on the clicked row
	targetRow.classList.add("selected-row");

	let oldVideoIdx = g_activeVideoIdx;
	g_activeVideoIdx = g_events[eventIdx].videoFileIdx;
	g_videos[g_activeVideoIdx].currentTime = g_events[eventIdx].frameInFile / 30;
	if (oldVideoIdx != g_activeVideoIdx && oldVideoIdx >= 0) {
		g_videos[oldVideoIdx].pause();
		if (g_playing)
			g_videos[g_activeVideoIdx].play();
	}

	g_selectedEventIdx = eventIdx;
	targetRow.scrollIntoView({behavior: 'auto', block : 'nearest'});

	var bounds = new L.LatLngBounds();

	if (shouldHighlightMarker) {
		showHighlightMarker(null);
		if (g_events[eventIdx].label) {
			const marker = g_markerMapping[g_events[eventIdx].label].marker;
			if (marker) {
				g_map.setView(marker.getLatLng(), g_map.getZoom());
				bounds.extend(marker.getLatLng());
				showHighlightMarker(marker.getLatLng());
			}
		}
	}

	if (g_selectedEventIdx == 0) {
		guideLabel("", RunEventType.fromText(g_events[g_selectedEventIdx].text));
		bounds.extend(g_guideLines.getBounds());
		if (shouldHighlightMarker)
			g_map.fitBounds(bounds, { maxZoom : g_map.getZoom() });
	}
	else if (g_selectedEventIdx > 0) {
		if (g_events[g_selectedEventIdx - 1].label) {
			guideLabel(g_events[g_selectedEventIdx - 1].label, RunEventType.fromText(g_events[g_selectedEventIdx].text));
			bounds.extend(g_guideLines.getBounds());
			if (shouldHighlightMarker)
				g_map.fitBounds(bounds, { maxZoom : g_map.getZoom() });
		}
		else
			guideLabel(null);
	}
}

// unselect the currently selected event
function unselectEvent() {
	if (!g_events || g_selectedEventIdx < 0)
		return;

	const prevSelectedRow = document.querySelector('#event-table tbody').childNodes[g_selectedEventIdx];

	prevSelectedRow.classList.remove("selected-row");
	g_selectedEventIdx = -1;

	showHighlightMarker(null);
	guideLabel(null);
}

function assignLabelToEvent(eventIdx, label) {
	// clean-up the old label
	if (g_events[eventIdx].label) {
		let oldLabel = g_events[eventIdx].label;
		if (g_markerMapping.hasOwnProperty(oldLabel)) {
			g_markerMapping[oldLabel].count--;
			if (g_markerMapping[oldLabel].count == 0)
				g_markerMapping[oldLabel].marker.setOpacity(1);		// fade in marker of the old label if it is no longer assigned to any event
		}
	}

	// assign the new label
	g_events[eventIdx].label = label;
	if (g_markerMapping.hasOwnProperty(label)) {
		g_markerMapping[label].count++;
		g_markerMapping[label].marker.setOpacity(0.4);		// fade out marker
	}

	// put in the label column
	const eventRow = document.querySelector('#event-table tbody').childNodes[eventIdx];
	if (eventRow)
		eventRow.childNodes[2].innerHTML = label;			// label is column 2

	// hide highlight marker if needed
	if (eventIdx == g_selectedEventIdx && label == null)
		showHighlightMarker(null);
}

function onMarkerClick(e) {
	if (!g_events)
		return;

	// alt + click functions as finding the event(s) that uses this marker as label
	if (e.originalEvent.altKey) {
		let label = e.layer.getTooltip().getContent();
		let start = g_selectedEventIdx + 1;	 // start from next row, or row 0 if nothing is selected
		for (let offset = 0; offset < g_events.length; offset++) {
			let eventIdx = (start + offset) % g_events.length;
			if (g_events[eventIdx].label == label) {
				selectEvent(eventIdx, false);		// no need to highlight marker since user is already clicking on it to select the event
				return;
			}
		}
		return;
	}

	let label = e.layer.getTooltip().getContent();

	// regular clicking assigns the marker to the currently selected event
	assignLabelToSelectedEvent(label, e.originalEvent.ctrlKey);			// force assign when ctrl is pressed
}

function assignLabelToSelectedEvent(label, forceAssign = false) {
	if (g_selectedEventIdx < 0)
		return;

	// prevent assigning a marker that is already assigned, unless forceAssign is true
	if (g_markerMapping[label].count == 0 || forceAssign) {
		// assign label
		assignLabelToEvent(g_selectedEventIdx, label);

		// advance to next row
		if (g_selectedEventIdx < g_events.length - 1)
			selectEvent(g_selectedEventIdx + 1);
		else
			unselectEvent();
	}
}

function onMarkerDoubleClick(e) {
	// do nothing, overriden just to prevent map zooming when double clicking
}

init();
