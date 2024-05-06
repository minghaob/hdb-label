let g_map;
let g_markerMapping = {};			// A mapping from marker tooltip string to {marker, count}, where marker is the handle and count is the number of events that this marker is assigned to
let g_highlightMarker;

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
	L.imageOverlay('botw-map.jpg', bounds).addTo(g_map);
	logMessage('Loaded map');

	// Set the view to the center of the image
	// map.fitBounds(bounds);

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

	fetch('coords.json').then(response => {
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
			else
				continue;
			let marker = L.marker([-data[k].Z, data[k].X], {icon: icon, zIndexOffset : zOffset, keyboard: false});
			marker.addTo(markers).bindTooltip(k);
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
		logMessage('Cannot loaded map elements' + error);
	});
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

initMap();
