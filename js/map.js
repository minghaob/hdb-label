let g_map;
let g_markerMapping = {};			// A mapping from marker tooltip string to {marker, count}, where marker is the handle and count is the number of events that this marker is assigned to
let g_highlightMarker;
let g_guideLines;

function initMap() {
	g_map = L.map('map', {
		minZoom: -3,
		maxZoom: 4,
		center: [0, 0],
		zoom: -3,
		maxBoundsViscosity: 1,
		crs: L.CRS.Simple
	});

	// Dimensions of the image
	var w = 6000;  // width of the image in pixels
	var h = 5000;  // height of the image

	// Calculate the edges of the image, in coordinates
	var southWest = g_map.unproject([-w, h], 0);
	var northEast = g_map.unproject([w, -h], 0);
	var bounds = new L.LatLngBounds(southWest, northEast);

	g_map.setMaxBounds(bounds);

	// Add the image overlay 
	// (replace 'path_to_your_large_image.jpg' with the path to your image file)
	L.imageOverlay('data/botw-map.jpg', bounds).addTo(g_map);

	var korokIcon = L.icon({
		iconUrl: 'icons/korok.png',
		iconSize:     [20, 20],
		iconAnchor:   [10, 10],
	});
	var orbIcon = L.icon({
		iconUrl: 'icons/orb.png',
		iconSize:     [20, 20],
		iconAnchor:   [10, 10],
	});
	var towerIcon = L.icon({
		iconUrl: 'icons/tower.png',
		iconSize:     [20, 20],
		iconAnchor:   [10, 10],
	});
	var monumentIcon = L.icon({
		iconUrl: 'icons/monument.png',
		iconSize:     [16, 16],
		iconAnchor:   [8, 8],
	});
	var memoryIcon = L.icon({
		iconUrl: 'icons/memory.png',
		iconSize:     [20, 20],
		iconAnchor:   [10, 10],
	});
	var techLabIcon = L.icon({
		iconUrl: 'icons/techlab.png',
		iconSize:     [20, 20],
		iconAnchor:   [10, 10],
	});

	fetch('data/coords.json').then(response => {
		if (response.ok)
			return response.json();
	})
	.then(data => {
		// Create a feature group for all markers
		var markers = L.featureGroup().addTo(g_map);

		for (let k in data){
			let icon;
			let zOffset = 0;
			if (k.endsWith('Tower')) {
				icon = towerIcon;
				zOffset = 10000;
			}
			else if (k.endsWith('Shrine')) {
				icon = orbIcon;
				zOffset = 5000;
			}
			else if (k.length == 3) {
				icon = korokIcon;
				zOffset = data[k].Y;
			}
			else if (k.startsWith('Vah')) {
				var name = k.split(' ').slice(0, 2).join('_').toLowerCase();
				icon = L.icon({
					iconUrl: 'icons/' + name + '.png',
					iconSize:     [20, 20],
					iconAnchor:   [10, 10],
				});
				zOffset = 5000;
			}
			else if (k.startsWith('Memory')) {
				icon = memoryIcon;
				zOffset = 5000;
			}
			else if (k == 'Shrine of Resurrection') {
				icon = L.icon({
					iconUrl: 'icons/sor.png',
					iconSize:     [20, 20],
					iconAnchor:   [10, 10],
				});
				zOffset = 5000;
			}
			else if (k.startsWith('Zora Monument')) {
				icon = monumentIcon;
				zOffset = -1000;
			}
			else if (k.endsWith('Tech Lab')) {
				icon = techLabIcon;
				zOffset = -1000;
			}
			else
				continue;
			let marker = L.marker([-data[k].Z, data[k].X], {icon: icon, zIndexOffset : zOffset, keyboard: false});
			marker.addTo(markers).bindTooltip(k, { className : 'no-background-tooltip' });
			if (g_markerMapping[k])
				throw 'multiple markers with same name \'' + k + '\'';
			g_markerMapping[k] = {marker: marker, count: 0};
		}

		markers.on('click', onMarkerClick);
		markers.on('dblclick', onMarkerDoubleClick);

		g_map.on('click', function(e) {
			if (g_highlightMarker)
				g_map.removeLayer(g_highlightMarker);
		});
		logMessage('Loaded map elements');
	})
	.catch(error => {
		logMessage('Cannot load map elements' + error);
	});

	g_guideLines = L.featureGroup().addTo(g_map);
}

function showHighlightMarker(latLng) {
	if (!latLng) {
		if (g_highlightMarker)
			g_map.removeLayer(g_highlightMarker);
		return;
	}

	if (!g_highlightMarker)
		g_highlightMarker= L.marker(latLng, {zIndexOffset : 20000, keyboard: false});
	else
		g_highlightMarker.setLatLng(latLng);
	g_highlightMarker.addTo(g_map);
}

let g_shortcutLabels = [];

function guideLabel(label, expectedNextEventType = null) {
	if (!g_guideLines)
		return;

	g_guideLines.clearLayers();
	g_shortcutLabels.length = 0;

	if (label === null)
		return;

	// if there's a runner, use runner's previous runs
	let markovMove = (g_runDoc.runner && g_runDoc.runner.length > 0) ? g_runner1OrderMarkovMove[g_runDoc.runner] : null;
	// otherwise use all community runs
	if (!markovMove)
		markovMove = g_commu1OrderMarkovMove;
	if (!markovMove)
		return;

	const entry = markovMove[label];			// label could also be an empty string which indicates that it's the first move of the run, markovMove should have a corresponding entry
	if (!entry)
		return;

	let latLngs = [[],[]];
	if (label.length == 0) {
		latLngs[0] = g_markerMapping["Shrine of Resurrection"].marker.getLatLng();		// empty label means it's the first move of the run, which is starting at SoR.
	}
	else {
		if (!g_markerMapping[label])
			return;
		latLngs[0] = g_markerMapping[label].marker.getLatLng();
	}

	for (const move of entry.next) {
		latLngs[1] = g_markerMapping[move.label].marker.getLatLng();

		let tooltip = '';
		let validCandidate = g_markerMapping[move.label].count == 0 && (RunEventType.fromLabel(move.label) & expectedNextEventType) != 0;		// label not yet used and its type matches
		let assignShortcut = validCandidate && g_shortcutLabels.length < 9;			// at most 9 shortcuts

		if (assignShortcut) {
			tooltip = '[<span style="color:gold;font-weight:bold">' + (g_shortcutLabels.length + 1)  + '</span>] ';
			g_shortcutLabels.push(move.label);
		}

		let antPath = L.polyline.antPath(latLngs, {
			"delay": 100,
			"dashArray": [
				15,
				30
			],
			"weight": 5,
			"color": "#0000FF",
			"opacity": validCandidate ? 0.5 : 0.2,
			"pulseColor": "#FFFFFF",
			"hardwareAccelerated" : true
		}).addTo(g_guideLines);

		antPath.bindTooltip(tooltip + move.label + ' (<span style="color:salmon">' + (move.count * 100 / entry.totalCount).toFixed() + "%</span>)",
			{ permanent : true, className : 'no-background-tooltip', direction: 'center', opacity : validCandidate ? 1.0 : 0.4 });
	}
}

function shortcutAssignLabel(idx) {
	if (idx < 1 || idx > g_shortcutLabels.length)
		return;

	assignLabelToSelectedEvent(g_shortcutLabels[idx - 1]);
}
initMap();
