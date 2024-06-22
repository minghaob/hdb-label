let g_runDoc;			// object loaded from run.yaml
let g_videos;
let g_events;			// .begin:				overall begin frame
						// .end:				overall end frame
						// .text:				rawDoc.events[eventIdx][1],
						// .type:				EventType
						// .videoFileIdx:		rawFileIdx,
						// .seekFrameInVideo:	the frame to seek to when viewing the event in video,
						// .label:				assigned label, e.g. "Z03", "Mogg Latan Shrine", "Ridgeland Tower"
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
		let numLoadedEvents = 0;
		for (let eventIdx = 0; eventIdx < wipDoc.events.length; eventIdx++) {
			let evt = wipDoc.events[eventIdx];
			let type = EventType.fromText(evt.type);
			let assignTargetIdx = -1;
			for (let gEventIdx = 0; gEventIdx < g_events.length; gEventIdx++) {
				let gEvt = g_events[gEventIdx];
				if (type != gEvt.type)
					continue;
				if ((evt.frame[0] >= gEvt.beginFrame && evt.frame[0] <= gEvt.endFrame)
					|| (evt.frame[1] >= gEvt.beginFrame && evt.frame[1] <= gEvt.endFrame)
					|| (gEvt.beginFrame >= evt.frame[0] && gEvt.beginFrame <= evt.frame[1])
					|| (gEvt.endFrame >= evt.frame[0] && gEvt.endFrame <= evt.frame[1])
				)
				{
					if (assignTargetIdx == -1)
						assignTargetIdx = gEventIdx;
					else
						assignTargetIdx = -2;
				}
			}

			if (assignTargetIdx >= 0) {
				assignLabelToEvent(assignTargetIdx, wipDoc.events[eventIdx].label);
				numLoadedEvents++;
			}
		}

		let msg = 'Loaded ' + numLoadedEvents + ' labeling data from ' + g_runDoc.uid + '.yaml';
		if (numLoadedEvents != wipDoc.events.length)
			msg += ' (' + (wipDoc.events.length - numLoadedEvents) + ' ignored)';
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
				if (g_existingRuns.has(runDoc.uid))
					window.alert("Run's uid \"" + runDoc.uid + "\" already used by another run in HundoDB. Only proceed if it's intended.");
				if (!runDoc.videos || !Array.isArray(runDoc.videos))
					throw ('expecting video element in run.yaml as array');
			}

			const canvas = document.getElementById('video-frame');
			const canvasContext = canvas.getContext('2d');

			// load the video files to video elements
			let videos = [];
			let numLoadedVideos = 0;
			let numIgnoredEvents = 0;
			let numLoadedEvents = {};
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
							let videoBaseFrame = 0;		// overall frame index of current video's first segment's first frame
							for (let rawFileIdx = 0; rawFileIdx < runDoc.videos.length; rawFileIdx++) {
								let fileName = 'assembled_' + rawFileIdx.toString() + '.yaml';		// raw files has filename numbered from 1 instead of 0
								const fileHandle = await folderHandle.getFileHandle(fileName, { create: false });
								const content = await getFileContent(fileHandle);
								let rawDoc = jsyaml.load(content);
								if (!Array.isArray(rawDoc.events))
									throw (fileName + ' does not have valid events property');
								let videoFrameToOverallFrame = videoFrame => {
									let segmentBaseFrame = videoBaseFrame;
									for (let curSegIdx = 0; curSegIdx < runDoc.videos[rawFileIdx].segments.length; curSegIdx++) {
										let curSegRange = runDoc.videos[rawFileIdx].segments[curSegIdx];
										if (videoFrame >= curSegRange[0] && videoFrame <= curSegRange[1])
											return segmentBaseFrame + videoFrame - curSegRange[0];
										segmentBaseFrame += curSegRange[1] - curSegRange[0] + 1;
									}
									return -1;
								}
								for (let eventIdx = 0; eventIdx < rawDoc.events.length; eventIdx++) {
									let frameRange = rawDoc.events[eventIdx].frame;
									if (eventIdx > 0 && frameRange[0] <= rawDoc.events[eventIdx - 1].frame[0])
										throw (fileName + ': event frame ' + frameRange[0] + ' not larger than previous event frame');
									if (rawDoc.events[eventIdx].frame[1] < rawDoc.events[eventIdx].frame[0])
										throw (fileName + ': event frame range [' + frameRange[0] + ', ' + frameRange[1] + '] invalid');

									let overallFrameRange = [videoFrameToOverallFrame(frameRange[0]), videoFrameToOverallFrame(frameRange[1])];
									if (overallFrameRange[0] < 0)
										throw (fileName + ': event frame ' + overallFrameRange[0] + ' outside video segments');
									if (overallFrameRange[1] < 0)
										throw (fileName + ': event frame ' + overallFrameRange[1] + ' outside video segments');

									let type = EventType.fromText(rawDoc.events[eventIdx].type);
									if (type != EventType.KOROK && type != EventType.TOWERACTIVATION && type != EventType.STONETALUS && type != EventType.FROSTTALUS
										&& type != EventType.IGNEOTALUS && type != EventType.STALNOX && type != EventType.MOLDUGA && type != EventType.ZORAMONUMENT
										&& type != EventType.WARP && type != EventType.SHRINE && type != EventType.MEMORY && type != EventType.DIVINEBEAST){
										numIgnoredEvents++;
										continue;
									}
									let seekFrame = frameRange[0];
									if (type == EventType.SHRINE)
										seekFrame -= 40;		// seek a bit back to before entering the shrine to have the shrine name on screen
									let evt = {
										'beginFrame': overallFrameRange[0],
										'endFrame': overallFrameRange[1],
										'text': rawDoc.events[eventIdx].type,
										'type': type,
										'videoFileIdx': rawFileIdx,
										'seekFrameInVideo': seekFrame,
									};
									if (rawDoc.events[eventIdx].segments) {
										evt.segments = rawDoc.events[eventIdx].segments;
										if (evt.segments[evt.segments.length - 1][0] != frameRange[1])
											throw (fileName + ': last segment frame ' + evt.segments[evt.segments.length - 1][0] + ' does not align with event end frame');
										for (let segIdx = 0; segIdx < evt.segments.length; segIdx++) {
											if (evt.segments[segIdx][0] < frameRange[0] || evt.segments[segIdx][0] > frameRange[1])
												throw (fileName + ': segment frame ' + evt.segments[segIdx][0] + ' event frame range');
											evt.segments[segIdx][0] = videoFrameToOverallFrame(evt.segments[segIdx][0]);
										}
								}
									events.push(evt);
									numLoadedEvents[type] = (numLoadedEvents[type] ?? 0) + 1;
								}

								for (let curSeg = 0; curSeg < runDoc.videos[rawFileIdx].segments.length; curSeg++)
									videoBaseFrame += runDoc.videos[rawFileIdx].segments[curSeg][1] - runDoc.videos[rawFileIdx].segments[curSeg][0] + 1;

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
								newRow.insertCell(-1).innerHTML = frameIdxToTime(events[eventIdx].beginFrame);				// begin
								newRow.insertCell(-1).innerHTML = frameIdxToTime(events[eventIdx].endFrame);				// end
								newRow.insertCell(-1).innerHTML = events[eventIdx].text;									// text
								newRow.insertCell(-1);																		// label
							}
						}

						logMessage("Loaded run: " + runDoc.uid);
						logMessage("Loaded " + events.length + " events. Ignored " + numIgnoredEvents + ".");
						logMessage("Loaded events by type:");
						for (const key in numLoadedEvents) {
							logMessage(EventType.toName(key) + ": " + numLoadedEvents[key]);
						}

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

async function SaveProgress() {
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
		let gEvt = g_events[i];
		if (gEvt.label) {				// only include events that are labeled
			let evt = {
				"frame": [gEvt.beginFrame, gEvt.endFrame],
				"label": gEvt.label,
				"type": EventType.toText(gEvt.type),
			};
			if (gEvt.segments)
				evt.segments = gEvt.segments;
			saveObj.events.push(evt);
		}
	}

	let content = jsyaml.dump(saveObj, {flowLevel : 2});
	if (await writeToFile(g_folderHandle, saveObj.uid + '.yaml', content)) {
		logMessage('Saved to ' + saveObj.uid + '.yaml');
	}
}
function initSaveButton() {
	const btn = document.getElementById('btn-save');

	btn.addEventListener('click', SaveProgress);
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
	g_videos[g_activeVideoIdx].currentTime = g_events[eventIdx].seekFrameInVideo / 30;
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
		guideLabel("", g_events[g_selectedEventIdx].type);
		bounds.extend(g_guideLines.getBounds());
		if (shouldHighlightMarker)
			g_map.fitBounds(bounds, { maxZoom : g_map.getZoom() });
	}
	else if (g_selectedEventIdx > 0) {
		if (g_events[g_selectedEventIdx - 1].label) {
			guideLabel(g_events[g_selectedEventIdx - 1].label, g_events[g_selectedEventIdx].type);
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

// This function does not do any verification of type matching. Verify before calling it
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
		eventRow.childNodes[3].innerHTML = label;			// label is column 2

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

	let eventType = g_events[g_selectedEventIdx].type;
	let labelType = LabelType.fromLabel(label);
	if (!labelAndEventTypesMatch(labelType, eventType))
		return;

	// prevent assigning a marker that is already assigned, unless forceAssign is true or the event is a warp
	if (g_markerMapping[label].count == 0 || forceAssign || eventType == EventType.WARP) {
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
