import type { CanonicalLocation, CoordinateUse, LocationFeatureLevel } from "./index";
import { LOCATION_DATA_SCHEMA } from "./index";

export interface GeoNamesRecord extends CanonicalLocation {
  readonly alternateNames: string;
  readonly modificationDate: string;
}

function classify(featureCode: string): { level: LocationFeatureLevel; coordinateUse: CoordinateUse } {
  if (featureCode.startsWith("PCL")) return { level: "country", coordinateUse: "administrative-centroid" };
  if (featureCode === "ADM1") return { level: "region", coordinateUse: "administrative-centroid" };
  if (featureCode === "ADM2") return { level: "county", coordinateUse: "administrative-centroid" };
  if (["PPLA2", "PPLA3"].includes(featureCode)) return { level: "county", coordinateUse: "settlement-centroid" };
  if (["PPLC", "PPLA"].includes(featureCode)) return { level: "city", coordinateUse: "settlement-centroid" };
  if(featureCode==="PPLA4")return{level:"town",coordinateUse:"settlement-centroid"};
  return { level: "town", coordinateUse: "source-point" };
}

export function parseGeoNamesLine(line: string, sourceVersion: string): GeoNamesRecord | undefined {
  const fields = line.replace(/\r$/u, "").split("\t");
  if (fields.length < 19) return undefined;
  const locationId = Number(fields[0]);
  const latitude = Number(fields[4]);
  const longitude = Number(fields[5]);
  const population = Number(fields[14]);
  const name = fields[1] ?? "";
  const asciiName = fields[2] ?? "";
  const countryCode = fields[8] ?? "";
  const featureCode = fields[7] ?? "";
  const timeZone = fields[17] ?? "";
  if (!Number.isInteger(locationId) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !name || !countryCode || !featureCode || !timeZone) return undefined;
  const classification = classify(featureCode);
  return {
    schema: LOCATION_DATA_SCHEMA,
    locationId,
    name,
    asciiName: asciiName || name,
    alternateNames: fields[3] ?? "",
    countryCode,
    ...(fields[10] ? { admin1Code: fields[10] } : {}),
    ...(fields[11] ? { admin2Code: fields[11] } : {}),
    featureCode,
    featureLevel: classification.level,
    latitude,
    longitude,
    timeZone,
    population: Number.isFinite(population) && population >= 0 ? population : 0,
    coordinateUse: classification.coordinateUse,
    source: "GeoNames",
    sourceVersion,
    modificationDate: fields[18] ?? "",
  };
}
