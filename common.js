function getCurrentTime() {
	const now = new Date();
	const hours = now.getHours().toString().padStart(2, '0');
	const minutes = now.getMinutes().toString().padStart(2, '0');
	const seconds = now.getSeconds().toString().padStart(2, '0');

	return `${hours}:${minutes}:${seconds}`;
}

function frameIdxToTime(frameIdx) {
	// sub-second part, use frame
	let ret = (frameIdx % 30).toString().padStart(2, '0');
	frameIdx = Math.floor(frameIdx / 30);

	// second part
	if (frameIdx < 60)		// less than 1 minute
		return frameIdx.toString() + '.' + ret;
	ret = (frameIdx % 60).toString().padStart(2, '0') + '.' + ret;
	frameIdx = Math.floor(frameIdx / 60);

	// minute part
	if (frameIdx < 60)		// less then 1 hour
		return frameIdx.toString() + ':' + ret;

	// hour and minute
	return  Math.floor(frameIdx / 60) + ':' + (frameIdx % 60).toString().padStart(2, '0') + ':' + ret;
}

const RunEventType = {
	UNKNOWN: 0,
	KOROK : 1,
	SHRINE : 2,
	TOWER : 3,
	fromLabel : label => {
		if (label.endsWith('Shrine'))
			return RunEventType.SHRINE;
		else if (label.endsWith('Tower'))
			return RunEventType.TOWER;
		else if (label.length == 3)
			return RunEventType.KOROK;
		else
			return RunEventType.UNKNOWN;
	},
	fromText : text => {
		if (text == "Spirit Orb")
			return RunEventType.SHRINE;
		else if (text == "Sheikah Tower activated.")
			return RunEventType.TOWER;
		else if (text == "Korok Seed")
			return RunEventType.KOROK;
		else
			return RunEventType.UNKNOWN;
	}
}