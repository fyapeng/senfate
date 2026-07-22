import {
  API_HEALTH_SCHEMA,
  API_META_SCHEMA,
  API_PREFIX,
  CALENDAR_REQUEST_SCHEMA,
  CALENDAR_RESPONSE_SCHEMA,
  LOCATION_DETAIL_SCHEMA,
  LOCATION_SEARCH_SCHEMA,
  type ApiCalendarRequest,
  type ApiCalendarResponse,
  type ApiErrorResponse,
  type ApiHealthResponse,
  type ApiLocation,
  type ApiLocationDetailResponse,
  type ApiLocationSearchResponse,
  type ApiMetaResponse,
  type ApiModelId,
} from "@senfate/contracts";
import { CLIMATE_PRIORITY_MODEL, MONTH_COMMAND_MODEL, TRANSPARENT_BASELINE_MODEL, type SenFateModelProfile } from "@senfate/core";
import { compileCertifiedBaziCalendar, EPHEMERIS_MANIFEST, SOLAR_TERM_ENTRIES } from "@senfate/ephemeris";
import { locationFtsQuery, normalizeLocationQuery } from "@senfate/locations";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

const TZDB_PROVENANCE = "Cloudflare-Intl@compatibility-2026-07-22";
const MAX_JSON_BYTES = 8_192;
const COORDINATE_UNCERTAINTY_METERS = {
  "administrative-centroid": 200_000,
  "settlement-centroid": 50_000,
  "source-point": 10_000,
} as const;
const MODELS: Readonly<Record<ApiModelId, SenFateModelProfile>> = {
  "transparent-baseline": TRANSPARENT_BASELINE_MODEL,
  "month-command": MONTH_COMMAND_MODEL,
  "climate-priority": CLIMATE_PRIORITY_MODEL,
};
const SOLAR_TERM_BY_UTC = new Map(SOLAR_TERM_ENTRIES.map((term) => [term.utcMs, term]));

interface LocationRow {
  readonly id: number;
  readonly name: string;
  readonly ascii_name: string;
  readonly alternate_names: string;
  readonly country_code: string;
  readonly admin1_code: string | null;
  readonly admin2_code: string | null;
  readonly feature_code: string;
  readonly feature_level: ApiLocation["featureLevel"];
  readonly latitude: number;
  readonly longitude: number;
  readonly time_zone: string;
  readonly population: number;
  readonly coordinate_use: ApiLocation["coordinateUse"];
  readonly source: "GeoNames";
  readonly source_version: string;
}

export interface LocationStore {
  search(query: string, countryCode: string | undefined, limit: number): Promise<readonly ApiLocation[]>;
  get(id: number): Promise<ApiLocation | undefined>;
}

const SELECT_LOCATION = `SELECT l.id,l.name,l.ascii_name,l.alternate_names,l.country_code,l.admin1_code,l.admin2_code,l.feature_code,l.feature_level,l.latitude,l.longitude,l.time_zone,l.population,l.coordinate_use,l.source,l.source_version FROM locations l`;

function toLocation(row: LocationRow, query?:string): ApiLocation {
  const normalized=query?normalizeLocationQuery(query):"";const localized=normalized?row.alternate_names.split(",").find(name=>normalizeLocationQuery(name)===normalized)||row.alternate_names.split(",").find(name=>normalizeLocationQuery(name).startsWith(normalized)):undefined;
  return {
    id: row.id,
    name: row.name,
    displayName: localized||row.name,
    asciiName: row.ascii_name,
    countryCode: row.country_code,
    ...(row.admin1_code ? { admin1Code: row.admin1_code } : {}),
    ...(row.admin2_code ? { admin2Code: row.admin2_code } : {}),
    featureCode: row.feature_code,
    featureLevel: row.feature_level,
    latitude: row.latitude,
    longitude: row.longitude,
    timeZone: row.time_zone,
    population: row.population,
    coordinateUse: row.coordinate_use,
    source: row.source,
    sourceVersion: row.source_version,
  };
}

export function d1LocationStore(database: D1Database): LocationStore {
  return {
    async search(query, countryCode, limit) {
      const ftsQuery=locationFtsQuery(query);if(!ftsQuery)return[];
      const statement = countryCode
        ? database.prepare(`${SELECT_LOCATION} JOIN locations_fts f ON f.rowid=l.id WHERE locations_fts MATCH ?1 AND l.country_code=?2 ORDER BY (lower(l.name)=?3) DESC,l.population DESC LIMIT ?4`).bind(ftsQuery, countryCode, normalizeLocationQuery(query), limit)
        : database.prepare(`${SELECT_LOCATION} JOIN locations_fts f ON f.rowid=l.id WHERE locations_fts MATCH ?1 ORDER BY (lower(l.name)=?2) DESC,l.population DESC LIMIT ?3`).bind(ftsQuery, normalizeLocationQuery(query), limit);
      const result = await statement.all<LocationRow>();
      return (result.results ?? []).map(row=>toLocation(row,query));
    },
    async get(id) {
      const row = await database.prepare(`${SELECT_LOCATION} WHERE l.id=?1 LIMIT 1`).bind(id).first<LocationRow>();
      return row ? toLocation(row) : undefined;
    },
  };
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: JSON_HEADERS });
}

function error(requestId: string, status: number, code: string, message: string): Response {
  const body: ApiErrorResponse = { schemaVersion: "senfate-api-error.v1", requestId, error: { code, message } };
  return json(body, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integerIn(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function finiteIn(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isModelId(value: unknown): value is ApiModelId {
  return value === "transparent-baseline" || value === "month-command" || value === "climate-priority";
}

function isDisambiguation(value: unknown): value is "earlier" | "later" | "reject" {
  return value === "earlier" || value === "later" || value === "reject";
}

function parseCalendarRequest(value: unknown): ApiCalendarRequest | undefined {
  if (!isRecord(value) || value.schemaVersion !== CALENDAR_REQUEST_SCHEMA || !integerIn(value.locationId, 1, Number.MAX_SAFE_INTEGER)) return undefined;
  const local = value.localDateTime;
  if (!isRecord(local) || !integerIn(local.year, 1900, 2035) || !integerIn(local.month, 1, 12) || !integerIn(local.day, 1, 31) || !integerIn(local.hour, 0, 23) || !integerIn(local.minute, 0, 59) || (local.second !== undefined && !integerIn(local.second, 0, 59))) return undefined;
  if (value.sex !== "female" && value.sex !== "male") return undefined;
  if (value.modelId !== undefined && !isModelId(value.modelId)) return undefined;
  if (value.disambiguation !== undefined && !isDisambiguation(value.disambiguation)) return undefined;
  if (value.clockUncertaintySeconds !== undefined && !finiteIn(value.clockUncertaintySeconds, 0, 43_200)) return undefined;
  if (value.periodCount !== undefined && !integerIn(value.periodCount, 1, 12)) return undefined;
  const exact = value.exactCoordinates;
  let exactCoordinates: ApiCalendarRequest["exactCoordinates"];
  if (exact !== undefined) {
    if (!isRecord(exact) || !finiteIn(exact.latitude, -90, 90) || !finiteIn(exact.longitude, -180, 180) || !finiteIn(exact.uncertaintyMeters, 0, 1_000_000)) return undefined;
    exactCoordinates = { latitude: exact.latitude, longitude: exact.longitude, uncertaintyMeters: exact.uncertaintyMeters };
  }
  return {
    schemaVersion: CALENDAR_REQUEST_SCHEMA,
    locationId: value.locationId,
    localDateTime: { year: local.year, month: local.month, day: local.day, hour: local.hour, minute: local.minute, ...(local.second === undefined ? {} : { second: local.second }) },
    sex: value.sex,
    ...(value.modelId === undefined ? {} : { modelId: value.modelId }),
    ...(value.disambiguation === undefined ? {} : { disambiguation: value.disambiguation }),
    ...(value.clockUncertaintySeconds === undefined ? {} : { clockUncertaintySeconds: value.clockUncertaintySeconds }),
    ...(value.periodCount === undefined ? {} : { periodCount: value.periodCount }),
    ...(exactCoordinates === undefined ? {} : { exactCoordinates }),
  };
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) throw new Error("body-too-large");
  if (!request.body) throw new Error("invalid-json");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_JSON_BYTES) { await reader.cancel(); throw new Error("body-too-large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("invalid-json"); }
}

async function calculateCalendar(request: Request, requestId: string, locations?: LocationStore): Promise<Response> {
  if (!locations) return error(requestId, 503, "location-index-unavailable", "The canonical location index is unavailable");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return error(requestId, 415, "unsupported-media-type", "Use application/json");
  let raw: unknown;
  try { raw = await readBoundedJson(request); } catch (cause) {
    return error(requestId, cause instanceof Error && cause.message === "body-too-large" ? 413 : 400, cause instanceof Error ? cause.message : "invalid-json", "Request body must be valid JSON no larger than 8 KiB");
  }
  const input = parseCalendarRequest(raw);
  if (!input) return error(requestId, 400, "invalid-calendar-request", `Request must conform to ${CALENDAR_REQUEST_SCHEMA}`);
  const location = await locations.get(input.locationId);
  if (!location) return error(requestId, 404, "location-not-found", "Canonical location not found");
  const coordinate = input.exactCoordinates
    ? { source: "exact-input" as const, latitude: input.exactCoordinates.latitude, longitude: input.exactCoordinates.longitude, uncertaintyMeters: input.exactCoordinates.uncertaintyMeters }
    : { source: location.coordinateUse, latitude: location.latitude, longitude: location.longitude, uncertaintyMeters: COORDINATE_UNCERTAINTY_METERS[location.coordinateUse] };
  const modelId = input.modelId ?? "transparent-baseline";
  const model = MODELS[modelId];
  const result = compileCertifiedBaziCalendar({
    ...input.localDateTime,
    timeZone: location.timeZone,
    longitudeDegrees: coordinate.longitude,
    latitudeDegrees: coordinate.latitude,
    disambiguation: input.disambiguation ?? "reject",
    clockUncertaintySeconds: input.clockUncertaintySeconds ?? 60,
    coordinateUncertaintyMeters: coordinate.uncertaintyMeters,
  }, model, input.sex, TZDB_PROVENANCE, input.periodCount ?? 8);
  if (!result.ok) {
    const status = result.code === "ambiguous-local-time" || result.code === "nonexistent-local-time" ? 409 : 422;
    return error(requestId, status, result.code, result.reason);
  }
  const value = result.value;
  const previous = SOLAR_TERM_BY_UTC.get(value.solarTermWindow.previousJieUtcMs);
  const next = SOLAR_TERM_BY_UTC.get(value.solarTermWindow.nextJieUtcMs);
  if (!previous || !next) return error(requestId, 500, "ephemeris-integrity-error", "Certified solar-term labels are unavailable");
  const body: ApiCalendarResponse = {
    schemaVersion: CALENDAR_RESPONSE_SCHEMA,
    requestId,
    location,
    coordinateProvenance: coordinate,
    model: { id: modelId, version: model.version, label: model.label },
    time: {
      timeZone: location.timeZone,
      utcOffsetMinutes: value.zonedBirth.selected.offsetMinutes,
      civilUtcMs: value.calendar.normalizedTime.civilUtcMs,
      apparentSolarWallTimeMs: value.calendar.normalizedTime.apparentSolarWallTimeMs,
      apparentSolarCorrectionMinutes: value.calendar.normalizedTime.apparentSolarCorrectionMinutes,
      equationOfTimeMinutes: value.calendar.normalizedTime.equationOfTimeMinutes,
      uncertaintySeconds: value.calendar.normalizedTime.uncertaintySeconds,
    },
    solarTerms: {
      previous: { name: previous.name, utcMs: previous.utcMs, uncertaintySeconds: previous.uncertaintySeconds },
      next: { name: next.name, utcMs: next.utcMs, uncertaintySeconds: next.uncertaintySeconds },
      baziYear: value.solarTermWindow.baziYear,
      monthOrdinal: value.solarTermWindow.monthOrdinal,
    },
    pillars: value.calendar.pillars,
    direction: value.calendar.direction,
    luckStartAgeYears: value.calendar.luckStartAgeYears,
    luckStartAgeInterval: value.calendar.luckStartAgeInterval,
    majorLuck: value.calendar.majorLuck,
    provenance: {
      calendarSchema: value.schema,
      ephemeris: "NASA/JPL Horizons DE441",
      ephemerisDigest: EPHEMERIS_MANIFEST.sha256,
      tzdb: TZDB_PROVENANCE,
      locationDataset: `${location.source}@${location.sourceVersion}`,
    },
    certificate: result.certificate,
  };
  return json(body);
}

export async function handleRequest(request: Request, locations?: LocationStore): Promise<Response> {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const { pathname } = url;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
  const calendarPath = pathname === `${API_PREFIX}/calendar/calculate` || pathname === "/calendar/calculate";
  if (calendarPath) {
    if (request.method !== "POST") return error(requestId, 405, "method-not-allowed", "Use POST for calendar calculation");
    return calculateCalendar(request, requestId, locations);
  }
  if (request.method !== "GET") return error(requestId, 405, "method-not-allowed", "Use GET for this resource");
  if (pathname === `${API_PREFIX}/health` || pathname === "/health") {
    const body: ApiHealthResponse = { schemaVersion: API_HEALTH_SCHEMA, status: "ok", service: "senfate-api", requestId };
    return json(body);
  }
  if (pathname === `${API_PREFIX}/meta` || pathname === "/meta") {
    const body: ApiMetaResponse = {
      schemaVersion: API_META_SCHEMA, requestId, product: "SenFate", architecture: "formal-bazi-pipeline",
      corpus: { version: "4.0", records: 37_231, families: 11_306, books: 7 }, calculationStatus: "calendar-public-beta",
    };
    return json(body);
  }
  if (pathname === `${API_PREFIX}/locations/search` || pathname === "/locations/search") {
    if (!locations) return error(requestId, 503, "location-index-unavailable", "The canonical location index is unavailable");
    const rawQuery = url.searchParams.get("q") ?? "";
    const query = normalizeLocationQuery(rawQuery);
    const ftsQuery = locationFtsQuery(rawQuery);
    const country = url.searchParams.get("country")?.trim().toUpperCase();
    const requestedLimit = Number(url.searchParams.get("limit") ?? 10);
    if (!ftsQuery || (country && !/^[A-Z]{2}$/u.test(country)) || !Number.isInteger(requestedLimit)) return error(requestId, 400, "invalid-location-query", "Use a 1–80 character query, optional ISO country code and integer limit");
    const limit = Math.min(20, Math.max(1, requestedLimit));
    const results = await locations.search(query, country, limit);
    const body: ApiLocationSearchResponse = { schemaVersion: LOCATION_SEARCH_SCHEMA, requestId, query, results, attribution: "GeoNames, CC BY 4.0" };
    return json(body);
  }
  const detailMatch = pathname.match(new RegExp(`^(?:${API_PREFIX})?/locations/(\\d+)$`, "u"));
  if (detailMatch) {
    if (!locations) return error(requestId, 503, "location-index-unavailable", "The canonical location index is unavailable");
    const location = await locations.get(Number(detailMatch[1]));
    if (!location) return error(requestId, 404, "location-not-found", "Canonical location not found");
    const body: ApiLocationDetailResponse = { schemaVersion: LOCATION_DETAIL_SCHEMA, requestId, location, attribution: "GeoNames, CC BY 4.0" };
    return json(body);
  }
  return error(requestId, 404, "not-found", "API route not found");
}

export default {
  async fetch(request, env): Promise<Response> {
    try {
      return await handleRequest(request, d1LocationStore(env.LOCATIONS));
    } catch (cause) {
      const requestId = crypto.randomUUID();
      console.error(JSON.stringify({ event: "request-failed", requestId, path: new URL(request.url).pathname, cause: cause instanceof Error ? cause.message : String(cause) }));
      return error(requestId, 500, "internal-error", "Request failed closed");
    }
  },
} satisfies ExportedHandler<Env>;
