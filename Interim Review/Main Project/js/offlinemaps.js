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
			$.each(tilesToStore, function(index, value) {
				storeTileImage(value.image, value.point);
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
	var osmLayer = new CustomTileLayer(osmUrl);
	osmLayer.on("tileloadstart", function(event) {
		event.tile.crossOrigin = "Anonymous";
	});
	osmLayer.on("tileload", function(event) {
		var tileImageString = getBase64Image(event.tile);
		var tileImagePoint = event.tile.point;

		// If database not yet initialised, push tile to array of tiles to be added once database is initialised
		if (db) {
			storeTileImage(tileImageString, tileImagePoint);
		} else {
			tilesToStore.push({image: tileImageString, point: tileImagePoint});
		}
	});
	osmLayer.on("tileerror", function(event) {
		if (db) {
			var tile = event.tile;
			var tileImagePointString = getPointString(tile.point);
			var request = getObjectStore().get(tileImagePointString);
			request.onsuccess = function(event) {
				var tileImageString = request.result;

				if (tileImageString) {
					tile.src = tileImageString;
				} else {
					console.log("No tile image stored for point " + tileImagePointString + ".");
				}
			};
		}
	});
	osmLayer.addTo(map);

	$.get("london.osm", function(data) {
		var dataParsed = $.parseXML(data);
		var dataGeoJson = osmtogeojson(dataParsed);
		L.geoJson(dataGeoJson).addTo(map);
	});
});

function storeTileImage(tileImageString, tileImagePoint) {
	getObjectStore().add(tileImageString, getPointString(tileImagePoint));
}

function getObjectStore() {
	return db.transaction("tile", "readwrite").objectStore("tile");
}

function getPointString(tileImagePoint) {
	var x = tileImagePoint.x;
	var y = tileImagePoint.y;
	var z = tileImagePoint.z;

	return x + "," + y + "," + z;
}

// From http://stackoverflow.com/a/19183658
function getBase64Image(img) {
	var canvas = document.createElement("canvas");
	canvas.width = img.width;
	canvas.height = img.height;
	var ctx = canvas.getContext("2d");
	ctx.drawImage(img, 0, 0);
	var dataURL = canvas.toDataURL("image/png");

	return dataURL;
}

var tilesToCheck = [];
var tilesToCheckCounter = 0;

var CustomTileLayer = L.TileLayer.extend({
	// Override required to ensure we can set the tile's "crossOrigin" parameter before its "src" parameter is set
	_loadTile: function(t, e) {
		t._layer = this, t.onload = this._tileOnLoad, this._adjustTilePoint(e), t.point = e, this.fire("tileloadstart", {
			tile: t
		}), t.src = this.getTileUrl(e);

		// Timeout after 5 seconds, so if no image loaded from OpenStreetMap, load cached image
		tilesToCheck.push(t);
		setTimeout(checkImageLoaded, 5000, this);
	}
});

function checkImageLoaded(layer) {
	var tile = tilesToCheck[tilesToCheckCounter];

	if (!tile.complete) {
		layer.fire("tileerror", {
			tile: tile
		});
	}

	tilesToCheckCounter++;
}