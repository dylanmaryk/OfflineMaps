COPY geoname FROM '/home/dylan/dylanmaryk.com/offlinemaps/main/cities1000.txt' NULL AS '';
UPDATE geoname SET coord = ST_PointFromText('POINT(' || latitude || ' ' || longitude || ')', 4326);
