let g_commu1OrderMarkovMove = {};           // label -> {           mapping from current label string
                                            //   .totalCount
                                            //   .next              array of {.label, .count}
                                            // }
let g_runner1OrderMarkovMove = {};          // similar to g_commu1OrderMarkovMove but one for each runner (runner name as first level key)
let g_existingRuns = new Set();

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
                        let runnerMove;
                        if (runDoc.runner) {
                            if (!g_runner1OrderMarkovMove[runDoc.runner])
                                g_runner1OrderMarkovMove[runDoc.runner] = {};
                            runnerMove = g_runner1OrderMarkovMove[runDoc.runner];
                        }
                        const events = runDoc.events;
                        for (let evtIdx = 0; evtIdx < events.length; evtIdx++) {
                            let last = evtIdx == 0 ? "" : events[evtIdx - 1].label;
                            let cur = events[evtIdx].label;
                            addMove(g_commu1OrderMarkovMove, last, cur);
                            if (runnerMove)
                                addMove(runnerMove, last, cur);
                        }
                        g_existingRuns.add(runDoc.uid);
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
