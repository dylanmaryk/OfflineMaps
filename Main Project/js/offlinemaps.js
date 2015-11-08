$(document).ready(function() {
	$.get("london.osm", function(data) {
    	var map = L.map("map");
    	map.setView(new L.LatLng(51.505, -0.09), 9);

		var osmUrl = "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
		var osm = new L.TileLayer(osmUrl);
		osm.addTo(map);

		var dataParsed = $.parseXML(data);
		var dataGeoJson = osmtogeojson(dataParsed);
		L.geoJson(dataGeoJson).addTo(map);
	});
});