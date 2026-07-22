export const API_PREFIX = "/senfate/api/v1" as const;
export const API_HEALTH_SCHEMA = "senfate-api-health.v1" as const;
export const API_META_SCHEMA = "senfate-api-meta.v2" as const;
export const LOCATION_SEARCH_SCHEMA = "senfate-location-search.v1" as const;
export const LOCATION_DETAIL_SCHEMA = "senfate-location-detail.v1" as const;
export const CALENDAR_REQUEST_SCHEMA = "senfate-calendar-request.v1" as const;
export const CALENDAR_RESPONSE_SCHEMA = "senfate-calendar-response.v1" as const;

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
  readonly calculationStatus: "calendar-public-beta";
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

export type ApiModelId = "transparent-baseline" | "month-command" | "climate-priority";
export type ApiSex = "female" | "male";

export interface ApiCalendarRequest {
  readonly schemaVersion: typeof CALENDAR_REQUEST_SCHEMA;
  readonly locationId: number;
  readonly localDateTime: Readonly<{ year: number; month: number; day: number; hour: number; minute: number; second?: number }>;
  readonly sex: ApiSex;
  readonly modelId?: ApiModelId;
  readonly disambiguation?: "earlier" | "later" | "reject";
  readonly clockUncertaintySeconds?: number;
  readonly periodCount?: number;
  readonly exactCoordinates?: Readonly<{ latitude: number; longitude: number; uncertaintyMeters: number }>;
}

export interface ApiGanZhi { readonly stem: string; readonly branch: string; readonly index: number }
export interface ApiClosedInterval { readonly lower: number; readonly upper: number; readonly unit: string }
export interface ApiMajorLuckPeriod {
  readonly ordinal: number;
  readonly pillar: ApiGanZhi;
  readonly startAgeYears: number;
  readonly startAgeInterval: ApiClosedInterval;
  readonly startUtcMs: number;
  readonly startUtcInterval: ApiClosedInterval;
}

export interface ApiCalendarResponse {
  readonly schemaVersion: typeof CALENDAR_RESPONSE_SCHEMA;
  readonly requestId: string;
  readonly location: ApiLocation;
  readonly coordinateProvenance: Readonly<{
    source: "exact-input" | ApiLocation["coordinateUse"];
    latitude: number;
    longitude: number;
    uncertaintyMeters: number;
  }>;
  readonly model: Readonly<{ id: ApiModelId; version: string; label: string }>;
  readonly time: Readonly<{
    timeZone: string;
    utcOffsetMinutes: number;
    civilUtcMs: number;
    apparentSolarWallTimeMs: number;
    apparentSolarCorrectionMinutes: number;
    equationOfTimeMinutes: number;
    uncertaintySeconds: number;
  }>;
  readonly solarTerms: Readonly<{
    previous: Readonly<{ name: string; utcMs: number; uncertaintySeconds: number }>;
    next: Readonly<{ name: string; utcMs: number; uncertaintySeconds: number }>;
    baziYear: number;
    monthOrdinal: number;
  }>;
  readonly pillars: Readonly<{ year: ApiGanZhi; month: ApiGanZhi; day: ApiGanZhi; hour: ApiGanZhi }>;
  readonly direction: "forward" | "reverse";
  readonly luckStartAgeYears: number;
  readonly luckStartAgeInterval: ApiClosedInterval;
  readonly majorLuck: readonly ApiMajorLuckPeriod[];
  readonly provenance: Readonly<{
    calendarSchema: "senfate-certified-bazi-calendar.v1";
    ephemeris: "NASA/JPL Horizons DE441";
    ephemerisDigest: string;
    tzdb: string;
    locationDataset: string;
  }>;
  readonly certificate: Readonly<Record<string, unknown>>;
}
