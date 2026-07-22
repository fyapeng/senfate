# Location system

## Contract boundary

Birth input never relies on a free-form place string. The client searches the canonical index, the user selects one record, and calculation receives its numeric location ID, longitude, latitude and IANA time-zone identifier. The selected record also states whether its coordinate is an administrative centroid, settlement centroid or source point.

```text
search text → canonical GeoNames record → coordinates + IANA zone
            → historical UTC offset resolution → civil-time interval
            → apparent-solar-time correction → calendar engine
```

The index is public geographical reference data only. Birth records, names and calculation histories are not stored in the location database.

## Coverage and provenance

The initial production index is generated from GeoNames `cities500`, which covers settlements with population above 500 and administrative seats down to PPLA4. Alternate names support Chinese names, romanization and common historical spellings when supplied by GeoNames. The source is UTF-8, versioned by import date and distributed under CC BY 4.0.

GeoNames points are suitable for place search and default longitude correction. They are not asserted to be a hospital or household coordinate. A future exact-location control may replace the centroid while preserving the selected IANA zone and place provenance.

## API

- `GET /senfate/api/v1/locations/search?q=北京&country=CN&limit=10`
- `GET /senfate/api/v1/locations/{geonameId}`

Search input is normalized and compiled to a bounded FTS query. Country is an optional two-letter ISO code and results are capped at 20. SQL uses bound parameters. Missing database bindings and malformed requests fail closed.

## Reproduction

Raw archives, expanded text and generated SQL stay in `local-data/geonames/`. The tracked migration owns the D1 schema; the package importer transforms the official 19-column GeoNames file without changing source names, coordinates or zones.

```text
pnpm --filter @senfate/locations import:geonames -- \
  local-data/geonames/cities500.txt \
  local-data/geonames/cities500-bulk.sql \
  cities500-YYYY-MM-DD 25000 50
```

The importer emits numbered, bounded files (`cities500-bulk.0001.sql`, etc.). Each idempotent, atomic SQL statement writes at most 50 rows and each file contains at most 25,000 rows. The files do not issue SQL transaction-control statements, which remote D1 rejects. This keeps statements below D1 limits while bounding Wrangler memory use and allowing a failed import to resume safely.
