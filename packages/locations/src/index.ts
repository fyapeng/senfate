export const LOCATION_DATA_SCHEMA = "senfate-location.v1" as const;

export type LocationFeatureLevel = "country" | "region" | "county" | "city" | "town";
export type CoordinateUse = "administrative-centroid" | "settlement-centroid" | "source-point";

export interface CanonicalLocation {
  readonly schema: typeof LOCATION_DATA_SCHEMA;
  readonly locationId: number;
  readonly name: string;
  readonly asciiName: string;
  readonly countryCode: string;
  readonly admin1Code?: string;
  readonly admin2Code?: string;
  readonly featureCode: string;
  readonly featureLevel: LocationFeatureLevel;
  readonly latitude: number;
  readonly longitude: number;
  readonly timeZone: string;
  readonly population: number;
  readonly coordinateUse: CoordinateUse;
  readonly source: "GeoNames";
  readonly sourceVersion: string;
}

export function normalizeLocationQuery(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("und");
}

export function locationFtsQuery(value: string): string | undefined {
  const normalized = normalizeLocationQuery(value);
  if (normalized.length < 1 || normalized.length > 80) return undefined;
  const terms = normalized.split(" ").filter(Boolean).slice(0, 8);
  if (terms.length === 0) return undefined;
  return terms.map((term) => `"${term.replaceAll('"', '""')}"*`).join(" AND ");
}
