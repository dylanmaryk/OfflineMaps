wget -O css/leaflet.css "http://cdn.leafletjs.com/leaflet/v0.7.7/leaflet.css"
wget -O js/leaflet.js "http://cdn.leafletjs.com/leaflet/v0.7.7/leaflet.js"
wget -O js/images/marker-icon.png "http://cdn.leafletjs.com/leaflet/v0.7.7/images/marker-icon.png"
wget -O js/images/marker-shadow.png "http://cdn.leafletjs.com/leaflet/v0.7.7/images/marker-shadow.png"

wget -O js/osmtogeojson.js "https://raw.githubusercontent.com/tyrasd/osmtogeojson/gh-pages/osmtogeojson.js"

# wget -O london.osm "http://api06.dev.openstreetmap.org/api/0.6/map?bbox=-0.221272,51.4801,-0.071754,51.533309"

wget -O img/download.png "https://raw.githubusercontent.com/google/material-design-icons/master/navigation/2x_web/ic_arrow_downward_black_18dp.png"

wget -O cities1000.zip "http://download.geonames.org/export/dump/cities1000.zip"
unzip cities1000.zip
rm cities1000.zip
sudo -u postgres psql offlinemaps -f /home/dylan/dylanmaryk.com/offlinemaps/main/scripts/updategeonames.sql
rm cities1000.txt
