let g_1OrderMarkovMove = {};                // label -> {           mapping from current label string
                                            //   .totalCount
                                            //   .next              array of {.label, .count}
                                            // }
let g_dbRuns = {};

function addMove(markovMove, last, cur) {
    if (!markovMove[last])
        markovMove[last] = { totalCount : 0, next : []};

    markovMove[last].totalCount++;
    let arr = markovMove[last].next;
    let targetSlot = -1;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].label == cur) {
            arr[i].count++;
            targetSlot = i;
            break;
        }
    }
    if (targetSlot == -1) {
        arr.push({ label : cur, count : 1});
        targetSlot = arr.length - 1;
    }

    while (targetSlot > 0){
        if (arr[targetSlot].count < arr[targetSlot - 1].count)
            break;
        if (arr[targetSlot].count == arr[targetSlot - 1].count && arr[targetSlot].label > arr[targetSlot - 1].label)
            break;
        [arr[targetSlot], arr[targetSlot - 1]] = [arr[targetSlot - 1], arr[targetSlot]];
    }
}

function setupGuideMoves(route, runner) {
    let numRunsWithRouteInDB = 0;
    if (route)
        for (const [uid, runDoc] of Object.entries(g_dbRuns)) {
            if (runDoc.route == route)
                numRunsWithRouteInDB++;
        }

    if (route) {
        if (numRunsWithRouteInDB > 0)
            logMessage("Guiding with " + numRunsWithRouteInDB + " runs in HundoDB using route " + route);
        else {
            logMessage("Route " + route + " not found in HundoDB. Guiding with all " + Object.keys(g_dbRuns).length + " runs in DB.");
            route = null;
        }
    }
    else
        logMessage("No route given. Guiding with all "+ Object.keys(g_dbRuns).length + " runs in HundoDB.");

    for (const [uid, runDoc] of Object.entries(g_dbRuns))
        if (!route || runDoc.route == route) {
            const events = runDoc.events;
            for (let evtIdx = 0; evtIdx < events.length; evtIdx++) {
                let last = evtIdx == 0 ? "" : events[evtIdx - 1].label;
                let cur = events[evtIdx].label;
                addMove(g_1OrderMarkovMove, last, cur);
            }
        }
}

const hdbRunsURL = 'https://minghaob.github.io/hundodb/runs/';
fetch(hdbRunsURL + 'list.txt')
    .then(response => response.text())
    .then(text => {
        const files = text.split('\n');

        let numTotalRuns = 0;
        let numProcessedRuns = 0;
        let numLoadedRuns = 0;
        files.forEach(file => {
            if (file.length > 0)
                numTotalRuns++;
        });
        if (files.length >0)
            logMessage("Loading " + numTotalRuns + " runs from HundoDB");
        files.forEach((file) => {
            if (file.length > 0) {
                fetch(hdbRunsURL + file)
                    .then(response => response.text())
                    .then(text => {
                        let runDoc = jsyaml.load(text);
                        g_dbRuns[runDoc.uid] = runDoc;
                        numProcessedRuns++;
                        numLoadedRuns++;
                        if (numProcessedRuns == numTotalRuns)
                            logMessage("Loaded " + numLoadedRuns + " runs from HundoDB");
                    })
                    .catch(error => {
                        logMessage("Cannot load " + hdbRunsURL + file + ": " + error);
                        numProcessedRuns++;
                        if (numProcessedRuns == numTotalRuns)
                            logMessage("Loaded " + numLoadedRuns + " runs from HundoDB");
                    });
            }
        });
    })
    .catch (error => {
        logMessage("Error fetching HundoDB runs: " + error);
    });
