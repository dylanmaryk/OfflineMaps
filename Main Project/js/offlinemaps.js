var db, // IndexedDB database
	tilePoints = [], // Points of tiles currently visible on map
	tilesToLoad = [], // Tiles to load from DB once DB is available
	downloadedTilesToStore = []; // Download tiles to store in DB

$(document).ready(function() {
	window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
	window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
	window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

	if (!window.indexedDB) {
		alert("Your browser doesn't support a stable version of IndexedDB.");
	}

	// Tiles to store in DB once DB is available
	var tilesToStore = [];

	var request = window.indexedDB.open("TileStorage", 3);
	// On successfully opening DB
	request.onsuccess = function(event) {
		db = event.target.result;

		// Store each tile to store in DB
		$.each(tilesToStore, function(index, value) {
			storeTileImage(value.image, value.point);
		});

		// Load each tile to load from DB
		$.each(tilesToLoad, function(index, value) {
			loadStoredTileImage(value.tile, value.remoteUrl);
		});
	};
	// On failing to load DB
	request.onerror = function(event) {
		// Set image source of each tile to remote URL
		$.each(tilesToLoad, function(index, value) {
			value.tile.src = value.remoteUrl;
		});

		console.log("Did not allow local data storage.");
	};
	// On requiring new or upgraded DB
	request.onupgradeneeded = function(event) {
		db = event.target.result;
		// Create new object store
		// Cannot use auto-incrementing IDs as otherwise updating records with "IDBObjectStore.put()" adds new record
		db.createObjectStore("tile");
		console.log("Created new object store.");
	};

	// Create new map
	var map = L.map("map", {attributionControl: false});
	map.setView(new L.LatLng(51.505, -0.09), 12);
	// On map first loading
	map.on("load", function(event) {
		displayLocation(map);
	});
	// On end of user panning/zooming map
	map.on("moveend", function(event) {
		displayLocation(map);
	});
	// On user zooming map
	map.on("viewreset", function(event) {
		tilePoints = [];

		// Hide download button if at maximum zoom level
		if (map.getZoom() < map.getMaxZoom()) {
			$("#downloadButton").css("visibility", "visible");
		} else {
			$("#downloadButton").css("visibility", "hidden");
		}
	});

	// Add new layer of tiles to map
	var osmUrl = "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
		osmLayer = new CustomTileLayer(osmUrl);
	// On start of a tile loading
	osmLayer.on("tileloadstart", function(event) {
		event.tile.crossOrigin = "Anonymous";
	});
	// On a tile successfully loading
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

			if (db) {
				storeTileImage(tileImageString, tileImagePoint);
			} else {
				// If DB not yet initialised, push tile to array of tiles to be added once DB is initialised
				tilesToStore.push({image: tileImageString, point: tileImagePoint});
			}
		}
	});
	// On tile layer loading
	osmLayer.on("load", function(event) {
		displayLocation(map);
	});
	osmLayer.addTo(map);

	$("#downloadButton").click(function() {
		$("#disableBox").css("visibility", "visible");
		$("#sliderButtonContainer").css("visibility", "visible");

		var currentMaxZoomDiff = map.getMaxZoom() - map.getZoom();

		// If only one deeper zoom level, download tiles at that level without querying user
		if (currentMaxZoomDiff >= 2) {
			$("#zoomSlider").attr("max", currentMaxZoomDiff);
		} else {
			downloadVisibleArea($("#zoomSlider").attr("value"), osmLayer);
		}
	});

	$("#confirmDownloadButton").click(function() {
		downloadVisibleArea($("#zoomSlider").attr("value"), osmLayer);
	});
});

// Get image for tile from DB
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
			}
		};
	} else {
		// If DB not yet initialised, push tile to array of tiles to load once DB is initialised
		tilesToLoad.push({tile: tile, remoteUrl: remoteUrl});
	}
}

// Store image of tile in DB
function storeTileImage(tileImageString, tileImagePoint) {
	var tileImagePointString = getPointString(tileImagePoint);
	getObjectStore().put(tileImageString, tileImagePointString);
}

// Get object store for tiles
function getObjectStore() {
	var transaction = db.transaction("tile", "readwrite");

	return transaction.objectStore("tile");
}

// Get tile point as a string
function getPointString(tileImagePoint) {
	var x = tileImagePoint.x,
		y = tileImagePoint.y,
		z = tileImagePoint.z;

	return x + "," + y + "," + z;
}

// Get image as a Base64 string
function getBase64Image(img) {
	var canvas = document.createElement("canvas");
	canvas.width = img.width;
	canvas.height = img.height;
	var ctx = canvas.getContext("2d");
	ctx.drawImage(img, 0, 0);
	var dataURL = canvas.toDataURL("image/png");

	return dataURL;
}

// Download tiles within currently visible area of map for certain number of zoom levels
function downloadVisibleArea(zoomLevelsToDownload, layer) {
	$("#sliderButtonContainer").css("visibility", "hidden");
	$("#progressLabelContainer").css("visibility", "visible");
	$("#downloadProgressLabel").text("Downloading...");

	var zoomLevel = layer._map.getZoom();

	// Download points within each currently visible tile
	$.each(tilePoints, function(index, tilePoint) {
		downloadPoint(tilePoint, zoomLevel + 1, zoomLevel, zoomLevelsToDownload, index == tilePoints.length - 1, layer);
	});
}

var tilesToDownloadCount = 0;
var tilesToDownloadFinalCount = Number.MAX_VALUE;
var tilesDownloaded = 0;

// Download points within a certain tile
function downloadPoint(tilePoint, zoomLevel, originalZoomLevel, zoomLevelsToDownload, isLastTile, layer) {
	var map = layer._map,
		tileLatLng = getPointToLatLng(tilePoint),
		mapTopLeftPoint = map._getNewTopLeftPoint(tileLatLng, zoomLevel),
		tileSize = layer._getTileSize(),
		mapPixelBounds = new L.Bounds(mapTopLeftPoint, mapTopLeftPoint.add(map.getSize())),
		mapPointBounds = new L.bounds(mapPixelBounds.min.divideBy(tileSize)._floor(), mapPixelBounds.max.divideBy(tileSize)._floor());

	// Iterate through all points within tile's bounds
	for (var pointX = mapPointBounds.min.x; pointX <= mapPointBounds.max.x; pointX++) {
		for (var pointY = mapPointBounds.min.y; pointY <= mapPointBounds.max.y; pointY++) {
			// Create new point based on X, Y and zoom level
			var newTilePoint = new L.Point(pointX, pointY);
			newTilePoint.z = zoomLevel;
			// Get image URL for point
			var tileImageUrl = layer.getTileUrl(newTilePoint);
			// Create new image object with point and image source
			var tileImage = new Image();
			tileImage.crossOrigin = "Anonymous";
			tileImage.point = newTilePoint;
			// On successful load of image from image source
			tileImage.onload = function() {
				// Push image and point to array of tiles to store once all images are downloaded
				var tileImageString = getBase64Image(this);
				downloadedTilesToStore.push({image: tileImageString, point: this.point});

				$("#downloadProgress").attr("value", tilesDownloaded++);

				// If all images downloaded, store all new tiles
				if (downloadedTilesToStore.length >= tilesToDownloadFinalCount) {
					storeDownloadedTiles();

					tilesToDownloadFinalCount = Number.MAX_VALUE;
					tilesDownloaded = 0;
				}
			};
			tileImage.src = tileImageUrl;

			tilesToDownloadCount++;

			var newTileIsLastTile = isLastTile && pointX == mapPointBounds.max.x && pointY == mapPointBounds.max.y;

			// If remaining zoom levels to download tiles for, download point at next zoom level
			if (zoomLevel - originalZoomLevel < zoomLevelsToDownload && zoomLevel < map.getMaxZoom()) {
				downloadPoint(newTilePoint, zoomLevel + 1, originalZoomLevel, zoomLevelsToDownload, newTileIsLastTile, layer);
			} else if (newTileIsLastTile) {
				tilesToDownloadFinalCount = tilesToDownloadCount;
				tilesToDownloadCount = 0;

				$("#downloadProgress").attr("max", tilesToDownloadFinalCount);
			}
		}
	}
}

// Store all new tiles in DB
function storeDownloadedTiles() {
	$("#downloadProgressLabel").text("Storing...");

	storeDownloadedTileAtPos(0);
}

// Store tile, at position in array of download tiles to store, to DB
function storeDownloadedTileAtPos(downloadedTilePos) {
	if (downloadedTilePos < downloadedTilesToStore.length) {
		var tileImageString = downloadedTilesToStore[downloadedTilePos].image;
		var tileImagePointString = getPointString(downloadedTilesToStore[downloadedTilePos].point);
		var objectStore = getObjectStore();
		objectStore.transaction.tilePos = downloadedTilePos;
		objectStore.put(tileImageString, tileImagePointString).onsuccess = function(event) {
			storeDownloadedTileAtPos(this.transaction.tilePos + 1);
		};
	} else {
		downloadedTilesToStore = [];

		$("#downloadProgress").attr("value", 0);
		$("#progressLabelContainer").css("visibility", "hidden");
		$("#disableBox").css("visibility", "hidden");
	}
}

// Get X/Y point as latitude/longitude
function getPointToLatLng(point) {
	var lng = point.x / Math.pow(2, point.z) * 360 - 180,
		n = Math.PI - 2 * Math.PI * point.y / Math.pow(2, point.z),
		lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

	return new L.LatLng(lat, lng);
}

// Display name of location with coordinates nearest centre coordinates of map
function displayLocation(map) {
	var mapCenter = map.getCenter();
	var mapLat = mapCenter.lat;
	var mapLng = mapCenter.lng;

	$.get("http://dylanmaryk.com:8110/name?lat=" + mapLat + "&long=" + mapLng, function(data) {
		$("#locationLabel").text(data);
	});
}

var CustomTileLayer = L.TileLayer.extend({
	_loadTile: function(t, e) {
		// Override required to ensure we can set the tile's "crossOrigin" parameter before its "src" parameter is set
		t._layer = this, t.onload = this._tileOnLoad, this._adjustTilePoint(e), t.point = e, this.fire("tileloadstart", {
			tile: t
		});

		// Push point to array of points of tiles currently visible on map
		tilePoints.push(e);

		// Override required to attempt loading stored image before loading remote image
		loadStoredTileImage(t, this.getTileUrl(e));
	}
});