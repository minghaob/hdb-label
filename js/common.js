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
	UNKNOWN:		1 << 0,
	KOROK :			1 << 1,
	SHRINE :		1 << 2,
	TOWER :			1 << 3,
	MEMORY : 		1 << 4,
	DIVINEBEAST:	1 << 5,
	SOR :			1 << 6,
	ZORAMONUMENT:   1 << 7,
	TECHLAB:		1 << 8,
	fromLabel : label => {
		if (label.endsWith('Shrine'))
			return RunEventType.SHRINE;
		else if (label.endsWith('Tower'))
			return RunEventType.TOWER;
		else if (label.length == 3)
			return RunEventType.KOROK;
		else if (label.startsWith('Memory'))
			return RunEventType.MEMORY;
		else if (label.startsWith('Vah'))
			return RunEventType.DIVINEBEAST;
		else if (label.startsWith('Zora Monument'))
			return RunEventType.ZORAMONUMENT;
		else if (label.endsWith('Tech Lab'))
			return RunEventType.TECHLAB;
		else if (label == 'Shrine of Resurrection')
			return RunEventType.SOR;
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
		else if (text == "Memory")
			return RunEventType.MEMORY;
		else if (text == "Travel")
			return RunEventType.TOWER | RunEventType.SHRINE | RunEventType.SOR | RunEventType.TECHLAB;
		else
			return RunEventType.UNKNOWN;
	}
}