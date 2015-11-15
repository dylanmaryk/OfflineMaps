var db;

$(document).ready(function() {
	window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
	window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
	window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

	if (!window.indexedDB) {
		alert("Your browser doesn't support a stable version of IndexedDB.");
	}

	var tilesToStore = [];

	var request = window.indexedDB.open("TileStorage", 3);
	request.onsuccess = function(event) {
		db = event.target.result;

		if (tilesToStore) {
			$.each(tilesToStore, function(tileImageData) {
				storeTileImage(tileImageData);
			});
		}
	};
	request.onerror = function(event) {
		console.log("Did not allow local data storage.");
	};
	request.onupgradeneeded = function(event) {
		db = event.target.result;
		// Cannot use auto-incrementing IDs as otherwise updating records with "IDBObjectStore.put()" adds new record
		db.createObjectStore("tile");
		console.log("Created new object store.");
	};

	var map = L.map("map");
	map.setView(new L.LatLng(51.505, -0.09), 12);

	var osmUrl = "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
	var osm = new CustomTileLayer(osmUrl);
	osm.on("tileloadstart", function(event) {
		event.tile.crossOrigin = "Anonymous";
	});
	osm.on("tileload", function(event) {
		var tileImageData = getBase64Image(event.tile);

		if (db) {
			storeTileImage(tileImageData);
		} else {
			tilesToStore.push(tileImageData);
		}
	});
	osm.addTo(map);

	$.get("london.osm", function(data) {
		var dataParsed = $.parseXML(data);
		var dataGeoJson = osmtogeojson(dataParsed);
		L.geoJson(dataGeoJson).addTo(map);
	});
});

function storeTileImage(tileImageData) {
	var objectStore = db.transaction("tile", "readwrite").objectStore("tile");
	objectStore.add(tileImageData, (new Date).getTime());
}

// From http://stackoverflow.com/a/19183658
function getBase64Image(img) {
	var canvas = document.createElement("canvas");
	canvas.width = img.width;
	canvas.height = img.height;

	var ctx = canvas.getContext("2d");
	ctx.drawImage(img, 0, 0);

	var dataURL = canvas.toDataURL("image/png");

	return dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
}

var CustomTileLayer = L.TileLayer.extend({
	_loadTile: function(t, e) {
		t._layer = this, t.onload = this._tileOnLoad, t.onerror = this._tileOnError, this._adjustTilePoint(e), this.fire("tileloadstart", {
			tile: t,
			url: t.src
		}), t.src = this.getTileUrl(e)
	}
});