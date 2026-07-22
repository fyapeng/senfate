export const API_PREFIX = "/senfate/api/v1" as const;
export const API_HEALTH_SCHEMA = "senfate-api-health.v1" as const;
export const API_META_SCHEMA = "senfate-api-meta.v1" as const;
export const LOCATION_SEARCH_SCHEMA = "senfate-location-search.v1" as const;
export const LOCATION_DETAIL_SCHEMA = "senfate-location-detail.v1" as const;

export interface ApiHealthResponse {
  readonly schemaVersion: typeof API_HEALTH_SCHEMA;
  readonly status: "ok";
  readonly service: "senfate-api";
  readonly requestId: string;
}

export interface ApiMetaResponse {
  readonly schemaVersion: typeof API_META_SCHEMA;
  readonly requestId: string;
  readonly product: "SenFate";
  readonly architecture: "formal-bazi-pipeline";
  readonly corpus: Readonly<{
    version: "4.0";
    records: 37_231;
    families: 11_306;
    books: 7;
  }>;
  readonly calculationStatus: "kernel-rebuild";
}

export interface ApiErrorResponse {
  readonly schemaVersion: "senfate-api-error.v1";
  readonly requestId: string;
  readonly error: Readonly<{ code: string; message: string }>;
}

export interface ApiLocation {
  readonly id: number;
  readonly name: string;
  readonly displayName: string;
  readonly asciiName: string;
  readonly countryCode: string;
  readonly admin1Code?: string;
  readonly admin2Code?: string;
  readonly featureCode: string;
  readonly featureLevel: "country" | "region" | "county" | "city" | "town";
  readonly latitude: number;
  readonly longitude: number;
  readonly timeZone: string;
  readonly population: number;
  readonly coordinateUse: "administrative-centroid" | "settlement-centroid" | "source-point";
  readonly source: "GeoNames";
  readonly sourceVersion: string;
}

export interface ApiLocationSearchResponse {
  readonly schemaVersion: typeof LOCATION_SEARCH_SCHEMA;
  readonly requestId: string;
  readonly query: string;
  readonly results: readonly ApiLocation[];
  readonly attribution: "GeoNames, CC BY 4.0";
}

export interface ApiLocationDetailResponse {
  readonly schemaVersion: typeof LOCATION_DETAIL_SCHEMA;
  readonly requestId: string;
  readonly location: ApiLocation;
  readonly attribution: "GeoNames, CC BY 4.0";
}
