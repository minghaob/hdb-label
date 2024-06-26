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
	GATEREGISTERED:		16,
	SLATEAUTHENTICATED:	17,
	REVALIGALE:			18,
	URBOSAFURY:			19,
	MIPHAGRACE:			20,
	DARUKPROTECTION:	21,
	LOAD:				22,
	WARP:				23,
	SHRINE:				24,
	MEMORY: 			25,
	MEDOH:				26,
	NABORIS:			27,
	RUTA:				28,
	RUDANIA:			29,

	init : () => {
		EventType.valueToName = {};
		for (const key in EventType) {
			if (key == key.toUpperCase())
				EventType.valueToName[EventType[key]] = key;
		}
		EventType.toName = value => {
			if (value in EventType.valueToName)
				return EventType.valueToName[value];
			else
				return null;
		};

		EventType.textToType = {
			// should match the text used in event-detector
			"Korok Seed":			EventType.KOROK,
			"Spirit Orb":			EventType.SPIRITORB,
			"Tower Activation":		EventType.TOWERACTIVATION,
			"Travel Button":		EventType.TRAVELBUTTON,
			"Loading Screen":		EventType.LOADINGSCREEN,
			"Black Screen":			EventType.BLACKSCREEN,
			"White Screen":			EventType.WHITESCREEN,
			"Album Page":			EventType.ALBUMPAGE,
			"Stone Talus":			EventType.STONETALUS,
			"Frost Talus":			EventType.FROSTTALUS,
			"Igneo Talus":			EventType.IGNEOTALUS,
			"Stalnox":				EventType.STALNOX,
			"Molduga":				EventType.MOLDUGA,
			"Zora Monument":		EventType.ZORAMONUMENT,
			"Dialog":				EventType.DIALOG,
			"Gate Registered":  	EventType.GATEREGISTERED,
			"Slate Authenticated":	EventType.SLATEAUTHENTICATED,
			"Revali Gale":			EventType.REVALIGALE,
			"Urbosa Fury":			EventType.URBOSAFURY,
			"Mipha Grace":			EventType.MIPHAGRACE,
			"Daruk Protection":		EventType.DARUKPROTECTION,
			"Load":					EventType.LOAD,
			"Warp":					EventType.WARP,
			"Shrine":				EventType.SHRINE,
			"Memory":				EventType.MEMORY,
			"Medoh":				EventType.MEDOH,
			"Naboris":				EventType.NABORIS,
			"Ruta":					EventType.RUTA,
			"Rudania":				EventType.RUDANIA,
		};
		EventType.fromText = text => {
			if (text in EventType.textToType)
				return EventType.textToType[text];
			else
				return EventType.UNKNOWN;
		};

		EventType.typeToText = {};
		for (const key in EventType.textToType) {
			EventType.typeToText[EventType.textToType[key]] = key;
		}
		EventType.toText = type => {
			if (type in EventType.typeToText)
				return EventType.typeToText[type];
			else
				return null;
		};
	}
}

EventType.init();

const LabelType = {
	UNKNOWN:			0,
	SHRINE:				1,
	TOWER:				2,
	KOROK:				3,
	MEMORY:				4,
	MEDOH:				5,
	NABORIS:			6,
	RUTA:				7,
	RUDANIA:			8,
	ZORAMONUMENT:		9,
	TECHLAB:			10,
	SOR:				11,
	DIVINEBEASTTAMED:	12,
	STONETALUS:			13,
	IGNEOTALUS:			14,
	FROSTTALUS:			15,
	STALNOX:			16,
	MOLDUGA:			17,
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
				if (label == "Vah Medoh")
					return LabelType.MEDOH;
				else if (label == "Vah Naboris")
					return LabelType.NABORIS;
				else if (label == "Vah Ruta")
					return LabelType.RUTA;
				else if (label == "Vah Rudania")
					return LabelType.RUDANIA;
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

function labelAndEventTypesMatch(labelType, eventType) {
	if (eventType == EventType.KOROK)
		return labelType == LabelType.KOROK;
	else if (eventType == EventType.TOWERACTIVATION)
		return labelType == LabelType.TOWER;
	else if (eventType == EventType.STONETALUS)
		return labelType == LabelType.STONETALUS;
	else if (eventType == EventType.IGNEOTALUS)
		return labelType == LabelType.IGNEOTALUS;
	else if (eventType == EventType.FROSTTALUS)
		return labelType == LabelType.FROSTTALUS;
	else if (eventType == EventType.STALNOX)
		return labelType == LabelType.STALNOX;
	else if (eventType == EventType.MOLDUGA)
		return labelType == LabelType.MOLDUGA;
	else if (eventType == EventType.ZORAMONUMENT)
		return labelType == LabelType.ZORAMONUMENT;
	else if (eventType == EventType.WARP)
		return labelType == LabelType.SHRINE || labelType == LabelType.TOWER || labelType == LabelType.SOR || labelType == LabelType.TECHLAB || labelType == LabelType.DIVINEBEASTTAMED;
	else if (eventType == EventType.SHRINE)
		return labelType == LabelType.SHRINE;
	else if (eventType == EventType.MEMORY)
		return labelType == LabelType.MEMORY;
	else if (eventType == EventType.MEDOH)
		return labelType == LabelType.MEDOH;
	else if (eventType == EventType.NABORIS)
		return labelType == LabelType.NABORIS;
	else if (eventType == EventType.RUTA)
		return labelType == LabelType.RUTA;
	else if (eventType == EventType.RUDANIA)
		return labelType == LabelType.RUDANIA;
}