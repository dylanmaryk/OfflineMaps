CREATE DATABASE offlinemaps;
CREATE TABLE geoname (
	geonameid INT,
	name varchar(200),
	asciiname varchar(200),
	alternatenames varchar(5000),
	latitude DECIMAL(10,7),
	longitude DECIMAL(10,7),
	featureclass char(1),
	featurecode varchar(10),
	countrycode char(2),
	cc2 char(60),
	admin1code varchar(20),
	admin2code varchar(80),
	admin3code varchar(20),
	admin4code varchar(20),
	population bigint,
	elevation INT,
	gtopo30 INT,
	timezone varchar(100),
	modificationdate date
);
SELECT AddGeometryColumn('geoname', 'coord', 4326, 'POINT', 2);
