ALTER TABLE geoname DROP COLUMN IF EXISTS coord;
\COPY geoname FROM 'cities1000.txt' NULL AS '';
SELECT AddGeometryColumn('geoname', 'coord', 4326, 'POINT', 2);
UPDATE geoname SET coord = ST_PointFromText('POINT(' || latitude || ' ' || longitude || ')', 4326);
