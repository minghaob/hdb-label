var map;
function initMap() {
	map = L.map('map', {
		minZoom: -3,
		maxZoom: 4,
		center: [0, 0],
		zoom: -2,
		maxBoundsViscosity: 1,
		crs: L.CRS.Simple
	});

	// Dimensions of the image
	var w = 6000;  // width of the image in pixels
	var h = 5000;  // height of the image

	// Calculate the edges of the image, in coordinates
	var southWest = map.unproject([-w, h], 0);
	var northEast = map.unproject([w, -h], 0);
	var bounds = new L.LatLngBounds(southWest, northEast);

	map.setMaxBounds(bounds);

	// Add the image overlay 
	// (replace 'path_to_your_large_image.jpg' with the path to your image file)
	L.imageOverlay('botw-map.jpg', bounds).addTo(map);
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
			L.marker([-data[k].Z, data[k].X], {icon: icon, zIndexOffset : zOffset}).addTo(map).bindTooltip(k);
		}
		logMessage('Loaded map elements');
	})
	.catch(error => {
		logMessage('Cannot loaded map elements');
	});
}

initMap();