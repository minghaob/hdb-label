let g_runDoc;
let g_videos;
let g_events;
let g_selectedEventIdx = -1;

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


function initButton() {
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
				//console.log(runDoc);
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
								rawDoc = jsyaml.load(content);
								if (!Array.isArray(rawDoc.events))
									throw (fileName + ' does not have valid events property');
								let curSeg = 0;
								for (let eventIdx = 0; eventIdx < rawDoc.events.length; eventIdx++) {
									let eventFrameInFile = rawDoc.events[eventIdx][0];

									// If event frame larger then current segment, advance current segment
									while (eventFrameInFile > runDoc.videos[rawFileIdx].segments[curSeg][1]) {
										baseFrame += runDoc.videos[rawFileIdx].segments[curSeg][1] - runDoc.videos[rawFileIdx].segments[curSeg][0] + 1;
										curSeg++;
										if (curSeg >= runDoc.videos[rawFileIdx].segments.length)		// event frame larger than last segment of video
											throw ('event frame ' + eventFrameInFile + ' in ' + fileName + ' outside segments');
									}
									if (rawDoc.events[eventIdx][0] < runDoc.videos[rawFileIdx].segments[curSeg][0])		// event frame smaller than current segment, indicating that it's between the current segment and last segment
										throw ('event frame ' + eventFrameInFile + ' in ' + fileName + ' outside segments');
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

						selectEvent(0);
					}
				});

				video.addEventListener('seeked', () => {
					if (canvas.width != video.videoWidth)
						canvas.width = video.videoWidth;
					if (canvas.height != video.videoHeight)
						canvas.height = video.videoHeight;

					canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
				});

				videos.push(video);
			}
		} catch (error) {
		 	logMessage('Error loading run: ' + error);
		}
	});
}

function initTable() {
	let table = document.getElementById("event-table");

	table.addEventListener("click", function(event) {
		let target = event.target;

		// Continue only if the clicked element is a TD and its parent is not a THEAD
		if (target.tagName === "TD" && target.parentNode.parentNode.tagName !== 'THEAD') {
			const targetRow = target.parentNode; // Get the parent row (tr) of the clicked cell (td)
			selectEvent(targetRow.rowIndex - 1);
		}
	});
}

function init() {
	initButton();
	initTable();
}

function selectEvent(eventIdx) {
	if (!g_events)
		return;

	if (eventIdx >= g_events.length || eventIdx < 0) {
		logMessage('Selecting invalid event index: ' + eventIdx);
		return;
	}

	const prevSelectedRow = document.getElementsByClassName("selected-row");
	const targetRow = document.querySelector('#event-table tbody').childNodes[eventIdx];

	// Remove the 'selected' class from any previously selected row
	if (prevSelectedRow.length > 0 && prevSelectedRow[0] !== targetRow) {
		prevSelectedRow[0].classList.remove("selected-row");
	}

	// Toggle the 'selected' class on the clicked row
	targetRow.classList.toggle("selected-row");

	if (targetRow.classList.contains("selected-row")) {
		g_videos[g_events[eventIdx].videoFileIdx].currentTime = g_events[eventIdx].frameInFile / 30;
		g_selectedEventIdx = eventIdx;
	}
	else
		g_selectedEventIdx = -1;
}

function onMarkerClick(e) {
	if (!g_events)
		return;
	if (g_selectedEventIdx < 0)
		return;

	const prevSelectedRow = document.getElementsByClassName("selected-row");
	if (prevSelectedRow.length > 0) {
		prevSelectedRow[0].childNodes[2].innerHTML = e.layer.getTooltip().getContent();		// fill the marker tooltip (which is the name) in the Label column
		if (g_selectedEventIdx < g_events.length - 1)
			selectEvent(g_selectedEventIdx + 1);				// advance to the next row
		else
			selectEvent(g_selectedEventIdx);					// or unselect if it's already the last row
	}
}

init();
