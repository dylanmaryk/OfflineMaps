$(document).ready(function() {
	$.get("london.osm", function(data) {
		dataParsed = $.parseXML(data);
		console.log(osmtogeojson(dataParsed));
	});
});