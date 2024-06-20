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

const EventType = {
	UNKNOWN:			0,
	KOROK:				1,
	SPIRITORB:			2,
	TOWERACTIVATION:	3,
	TRAVELBUTTON:		4,
	LOADINGSCREEN:		5,
	BLACKSCREEN:		6,
	WHITESCREEN:		7,
	ALBUMPAGE:			8,
	STONETALUS:			9,
	FROSTTALUS:			10,
	IGNEOTALUS:			11,
	STALNOX:			12,
	MOLDUGA:			13,
	ZORAMONUMENT:   	14,
	DIALOG:				15,
	LOAD:				16,
	WARP:				17,
	SHRINE:				18,
	MEMORY: 			19,
	DIVINEBEAST:		20,

	init : () => {
		EventType.textToType = {
			// should match the text used in event-detector
			"Korok Seed":		EventType.KOROK,
			"Spirit Orb":		EventType.SPIRITORB,
			"Tower Activation":	EventType.TOWERACTIVATION,
			"Travel Button":	EventType.TRAVELBUTTON,
			"Loading Screen":	EventType.LOADINGSCREEN,
			"Black Screen":		EventType.BLACKSCREEN,
			"White Screen":		EventType.WHITESCREEN,
			"Album Page":		EventType.ALBUMPAGE,
			"Stone Talus":		EventType.STONETALUS,
			"Frost Talus":		EventType.FROSTTALUS,
			"Igneo Talus":		EventType.IGNEOTALUS,
			"Stalnox":			EventType.STALNOX,
			"Molduga":			EventType.MOLDUGA,
			"Zora Monument":	EventType.ZORAMONUMENT,
			"Dialog":			EventType.DIALOG,
			"Load":				EventType.LOAD,
			"Warp":				EventType.WARP,
			"Shrine":			EventType.SHRINE,
			"Memory":			EventType.MEMORY,
			"Divine Beast":		EventType.DIVINEBEAST,
		};
		EventType.fromText = text => {
			if (text in EventType.textToType)
				return EventType.textToType[text];
			else
				return EventType.UNKNOWN;
		};
		EventType.toName = value => {
			if (value in EventType.valueToName)
				return EventType.valueToName[value];
			else
				return null;
		};
	
		EventType.valueToName = {};
		for (const key in EventType) {
			if (key == key.toUpperCase())
				EventType.valueToName[EventType[key]] = key;
		}
	}
}

EventType.init();

const LabelType = {
	UNKNOWN:			0,
	SHRINE:				1,
	TOWER:				2,
	KOROK:				3,
	MEMORY:				4,
	DIVINEBEAST:		5,
	ZORAMONUMENT:		6,
	TECHLAB:			7,
	SOR:				8,
	DIVINEBEASTTAMED:	9,
	STONETALUS:			10,
	IGNEOTALUS:			11,
	FROSTTALUS:			12,
	STALNOX:			13,
	MOLDUGA:			14,
	fromLabel : label => {
		if (label.endsWith('Shrine'))
			return LabelType.SHRINE;
		else if (label.endsWith('Tower'))
			return LabelType.TOWER;
		else if (label.length == 3)
			return LabelType.KOROK;
		else if (label.startsWith('Memory'))
			return LabelType.MEMORY;
		else if (label.startsWith('Vah'))
			if (label.endsWith('(Tamed)'))
				return LabelType.DIVINEBEASTTAMED;
			else
				return LabelType.DIVINEBEAST;
		else if (label.startsWith('Zora Monument'))
			return LabelType.ZORAMONUMENT;
		else if (label.endsWith('Tech Lab'))
			return LabelType.TECHLAB;
		else if (label == 'Shrine of Resurrection')
			return LabelType.SOR;
		else
			return LabelType.UNKNOWN;
	}
}

function labelAndEventTypesMatch(label, event) {
	if (event == EventType.KOROK)
		return label == LabelType.KOROK;
	else if (event == EventType.TOWERACTIVATION)
		return label == LabelType.TOWER;
	else if (event == EventType.STONETALUS)
		return label == LabelType.STONETALUS;
	else if (event == EventType.IGNEOTALUS)
		return label == LabelType.IGNEOTALUS;
	else if (event == EventType.FROSTTALUS)
		return label == LabelType.FROSTTALUS;
	else if (event == EventType.STALNOX)
		return label == LabelType.STALNOX;
	else if (event == EventType.MOLDUGA)
		return label == LabelType.MOLDUGA;
	else if (event == EventType.ZORAMONUMENT)
		return label == LabelType.ZORAMONUMENT;
	else if (event == EventType.WARP)
		return label == LabelType.SHRINE || label == LabelType.TOWER || label == LabelType.SOR || label == LabelType.TECHLAB || label == LabelType.DIVINEBEASTTAMED;
	else if (event == EventType.SHRINE)
		return label == LabelType.SHRINE;
	else if (event == EventType.MEMORY)
		return label == LabelType.MEMORY;
	else if (event == EventType.DIVINEBEAST)
		return label == LabelType.DIVINEBEAST;
}