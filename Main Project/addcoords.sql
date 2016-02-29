SELECT AddGeometryColumn('geoname', 'coord', 4326, 'POINT', 2);
UPDATE geoname SET coord = ST_PointFromText('POINT(' || latitude || ' ' || longitude || ')', 4326);
