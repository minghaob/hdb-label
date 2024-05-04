let g_runDoc;
let g_videos;
let g_events;

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


function init() {
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
										curSeg++;
										baseFrame += runDoc.videos[rawFileIdx].segments[curSeg][1] - runDoc.videos[rawFileIdx].segments[curSeg][0] + 1;
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
								newRow.insertCell(-1).innerHTML = events[eventIdx].overallFrame;	// frame
								newRow.insertCell(-1).innerHTML = events[eventIdx].text;			// text
								newRow.insertCell(-1);												// label
								newRow.insertCell(-1);												// flags
								newRow.insertCell(-1);												// comment
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

function selectEvent(eventIdx) {
	if (eventIdx >= g_events.length || eventIdx < 0) {
		logMessage('Selecting invalid event index: ' + eventIdx);
		return;
	}

	g_videos[g_events[eventIdx].videoFileIdx].currentTime = g_events[eventIdx].frameInFile / 30;
}

init();
