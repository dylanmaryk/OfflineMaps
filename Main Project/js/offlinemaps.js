var db,
	tilePoints = [],
	tilesToLoad = [],
	downloadedTilesToStore = [];

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

		$.each(tilesToStore, function(index, value) {
			storeTileImage(value.image, value.point);
		});

		$.each(tilesToLoad, function(index, value) {
			loadStoredTileImage(value.tile, value.remoteUrl);
		});
	};
	request.onerror = function(event) {
		$.each(tilesToLoad, function(index, value) {
			value.tile.src = value.remoteUrl;
		});

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
	map.on("viewreset", function(e) {
		tilePoints = [];
	});

	var osmUrl = "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
		osmLayer = new CustomTileLayer(osmUrl);
	osmLayer.on("tileloadstart", function(event) {
		event.tile.crossOrigin = "Anonymous";
	});
	osmLayer.on("tileload", function(event) {
		var tile = event.tile,
			url = event.url,
			tileImagePoint = tile.point;

		// Check if tile's current image is from storage
		if (url.substr(0, 4) == "data") {
			// Attempt loading remote image after loading stored copy
			tile.src = this.getTileUrl(tileImagePoint);
		} else {
			var tileImageString = getBase64Image(tile);

			// If database not yet initialised, push tile to array of tiles to be added once database is initialised
			if (db) {
				storeTileImage(tileImageString, tileImagePoint);
			} else {
				tilesToStore.push({image: tileImageString, point: tileImagePoint});
			}
		}
	});
	osmLayer.addTo(map);

	$("#btnDownload").click(function() {
		downloadVisibleArea(osmLayer);
	});

	/*
	$.get("london.osm", function(data) {
		var dataParsed = $.parseXML(data);
		var dataGeoJson = osmtogeojson(dataParsed);
		L.geoJson(dataGeoJson).addTo(map);
	});
	*/
});

function loadStoredTileImage(tile, remoteUrl) {
	if (db) {
		var tileImagePointString = getPointString(tile.point),
			request = getObjectStore().get(tileImagePointString);
		request.onsuccess = function(event) {
			var tileImageString = request.result;

			if (tileImageString) {
				tile.src = tileImageString;
			} else {
				// Load remote image if failed to find stored copy
				tile.src = remoteUrl;
				// console.log("No tile image stored for point " + tileImagePointString + ".");
			}
		};
	} else {
		tilesToLoad.push({tile: tile, remoteUrl: remoteUrl});
	}
}

function storeTileImage(tileImageString, tileImagePoint) {
	var tileImagePointString = getPointString(tileImagePoint);
	getObjectStore().put(tileImageString, tileImagePointString);
}

function getObjectStore() {
	var transaction = db.transaction("tile", "readwrite");

	return transaction.objectStore("tile");
}

function getPointString(tileImagePoint) {
	var x = tileImagePoint.x,
		y = tileImagePoint.y,
		z = tileImagePoint.z;

	return x + "," + y + "," + z;
}

function getBase64Image(img) {
	var canvas = document.createElement("canvas");
	canvas.width = img.width;
	canvas.height = img.height;
	var ctx = canvas.getContext("2d");
	ctx.drawImage(img, 0, 0);
	var dataURL = canvas.toDataURL("image/png");

	return dataURL;
}

function downloadVisibleArea(layer) {
	var map = layer._map,
		zoomLevel = layer._map.getZoom();

	if (zoomLevel < map.getMaxZoom()) {
		$.each(tilePoints, function(index, tilePoint) {
			downloadPoint(tilePoint, zoomLevel + 1, zoomLevel, index == tilePoints.length - 1, layer);
		});
	} else {
		console.log("The currently visible area has already been downloaded.");
	}
}

var tilesToDownloadCount = 0;
var tilesToDownloadFinalCount = Number.MAX_VALUE;

function downloadPoint(tilePoint, zoomLevel, originalZoomLevel, isLastTile, layer) {
	var map = layer._map,
		tileLatLng = getPointToLatLng(tilePoint),
		mapTopLeftPoint = map._getNewTopLeftPoint(tileLatLng, zoomLevel),
		tileSize = layer._getTileSize(),
		mapPixelBounds = new L.Bounds(mapTopLeftPoint, mapTopLeftPoint.add(map.getSize())),
		mapPointBounds = new L.bounds(mapPixelBounds.min.divideBy(tileSize)._floor(), mapPixelBounds.max.divideBy(tileSize)._floor());

	for (var pointX = mapPointBounds.min.x; pointX <= mapPointBounds.max.x; pointX++) {
		for (var pointY = mapPointBounds.min.y; pointY <= mapPointBounds.max.y; pointY++) {
			var newTilePoint = new L.Point(pointX, pointY);
			newTilePoint.z = zoomLevel;
			var tileImageUrl = layer.getTileUrl(newTilePoint);
			var tileImage = new Image();
			tileImage.crossOrigin = "Anonymous";
			tileImage.point = newTilePoint;
			tileImage.onload = function() {
				var tileImageString = getBase64Image(this);
				downloadedTilesToStore.push({image: tileImageString, point: this.point});

				if (downloadedTilesToStore.length >= tilesToDownloadFinalCount) {
					storeDownloadedTiles();

					tilesToDownloadFinalCount = 0;
				}
			};
			tileImage.src = tileImageUrl;

			tilesToDownloadCount++;

			var newTileIsLastTile = isLastTile && pointX == mapPointBounds.max.x && pointY == mapPointBounds.max.y;

			if (zoomLevel - originalZoomLevel < 3 && zoomLevel < map.getMaxZoom()) {
				downloadPoint(newTilePoint, zoomLevel + 1, originalZoomLevel, newTileIsLastTile, layer);
			} else if (newTileIsLastTile) {
				tilesToDownloadFinalCount = tilesToDownloadCount;
				tilesToDownloadCount = 0;
			}
		}
	}
}

function storeDownloadedTiles() {
	storeDownloadedTileAtPos(0);
}

function storeDownloadedTileAtPos(downloadedTilePos) {
	if (downloadedTilePos < downloadedTilesToStore.length) {
		var tileImagePointString = getPointString(downloadedTilesToStore[downloadedTilePos].point);
		var tileImageString = downloadedTilesToStore[downloadedTilePos].image;
		var objectStore = getObjectStore();
		objectStore.transaction.tilePos = downloadedTilePos;
		objectStore.put(tileImageString, tileImagePointString).onsuccess = function(event) {
			storeDownloadedTileAtPos(this.transaction.tilePos + 1);
		};
	} else {
		downloadedTilesToStore = [];
	}
}

function getPointToLatLng(point) {
	var lng = point.x / Math.pow(2, point.z) * 360 - 180,
		n = Math.PI - 2 * Math.PI * point.y / Math.pow(2, point.z),
		lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

	return new L.LatLng(lat, lng);
}

var CustomTileLayer = L.TileLayer.extend({
	_loadTile: function(t, e) {
		// Override required to ensure we can set the tile's "crossOrigin" parameter before its "src" parameter is set
		t._layer = this, t.onload = this._tileOnLoad, this._adjustTilePoint(e), t.point = e, this.fire("tileloadstart", {
			tile: t
		});

		tilePoints.push(e);

		// Override required to attempt loading stored image before loading remote image
		loadStoredTileImage(t, this.getTileUrl(e));
	}
});