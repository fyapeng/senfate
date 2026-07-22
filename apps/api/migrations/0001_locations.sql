CREATE TABLE locations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  ascii_name TEXT NOT NULL,
  alternate_names TEXT NOT NULL DEFAULT '',
  country_code TEXT NOT NULL,
  admin1_code TEXT,
  admin2_code TEXT,
  feature_code TEXT NOT NULL,
  feature_level TEXT NOT NULL CHECK (feature_level IN ('country','region','county','city','town')),
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  time_zone TEXT NOT NULL,
  population INTEGER NOT NULL DEFAULT 0 CHECK (population >= 0),
  coordinate_use TEXT NOT NULL CHECK (coordinate_use IN ('administrative-centroid','settlement-centroid','source-point')),
  source TEXT NOT NULL CHECK (source = 'GeoNames'),
  source_version TEXT NOT NULL
);

CREATE INDEX locations_country_admin_idx ON locations(country_code, admin1_code, admin2_code);
CREATE INDEX locations_population_idx ON locations(population DESC);
CREATE VIRTUAL TABLE locations_fts USING fts5(name, ascii_name, alternate_names, content='locations', content_rowid='id', tokenize='unicode61 remove_diacritics 2');

CREATE TRIGGER locations_ai AFTER INSERT ON locations BEGIN
  INSERT INTO locations_fts(rowid, name, ascii_name, alternate_names) VALUES (new.id, new.name, new.ascii_name, new.alternate_names);
END;
CREATE TRIGGER locations_ad AFTER DELETE ON locations BEGIN
  INSERT INTO locations_fts(locations_fts, rowid, name, ascii_name, alternate_names) VALUES ('delete', old.id, old.name, old.ascii_name, old.alternate_names);
END;
CREATE TRIGGER locations_au AFTER UPDATE ON locations BEGIN
  INSERT INTO locations_fts(locations_fts, rowid, name, ascii_name, alternate_names) VALUES ('delete', old.id, old.name, old.ascii_name, old.alternate_names);
  INSERT INTO locations_fts(rowid, name, ascii_name, alternate_names) VALUES (new.id, new.name, new.ascii_name, new.alternate_names);
END;
