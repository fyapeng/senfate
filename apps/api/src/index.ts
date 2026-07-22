import {
  API_HEALTH_SCHEMA,
  API_META_SCHEMA,
  API_PREFIX,
  ANALYSIS_REQUEST_SCHEMA,
  ANALYSIS_RESPONSE_SCHEMA,
  CALENDAR_REQUEST_SCHEMA,
  CALENDAR_RESPONSE_SCHEMA,
  LOCATION_DETAIL_SCHEMA,
  LOCATION_SEARCH_SCHEMA,
  MODEL_CATALOG_SCHEMA,
  type ApiAnalysisResponse,
  type ApiAnnualTrajectory,
  type ApiCalendarRequest,
  type ApiCalendarResponse,
  type ApiErrorResponse,
  type ApiHealthResponse,
  type ApiLocation,
  type ApiLocationDetailResponse,
  type ApiLocationSearchResponse,
  type ApiMetaResponse,
  type ApiModelCatalogResponse,
  type ApiModelId,
  type ApiModelOverrides,
} from "@senfate/contracts";
import { analyzeLuckSequence, analyzeNatalStructure, applyPublicModelOverrides, baziMonthPillar, CLIMATE_PRIORITY_MODEL, evaluateInterpretiveModel, materializeKinshipProjection, materializeSpecialStateCertificate, MONTH_COMMAND_MODEL, PUBLIC_MODEL_PARAMETER_METADATA, publicModelParameterValues, resolveAnnualContext, TIME_ZONE_PROVIDER, TRANSPARENT_BASELINE_MODEL, TZDB_VERSION, type ReferenceNormalFormPhaseResult, type SenFateModelProfile } from "@senfate/core";
import { compileCertifiedBaziCalendar, EPHEMERIS_MANIFEST, SOLAR_TERM_ENTRIES } from "@senfate/ephemeris";
import { locationFtsQuery, normalizeLocationQuery } from "@senfate/locations";
import { ReferenceCalculationRuntime } from "@senfate/rules/runtime";
import { bundledReferenceProgram, type ReferenceProgramStore } from "./reference-program";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

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
const LICHUN_BY_YEAR = new Map(SOLAR_TERM_ENTRIES.filter(term=>term.longitude===315).map(term=>[new Date(term.utcMs).getUTCFullYear(),term.utcMs]));
const PUBLIC_START_YEAR=1850;const PUBLIC_END_YEAR=2100;
const JIE_MONTH_ORDINAL:Readonly<Record<number,number>>={315:0,345:1,15:2,45:3,75:4,105:5,135:6,165:7,195:8,225:9,255:10,285:11};
function monthBoundaries(year:number):readonly Readonly<{boundaryUtcMs:number;monthOrdinal:number}>[]{const start=LICHUN_BY_YEAR.get(year),end=LICHUN_BY_YEAR.get(year+1);if(start===undefined||end===undefined)return[];return SOLAR_TERM_ENTRIES.filter(term=>term.kind==="jie"&&term.utcMs>=start&&term.utcMs<end).map(term=>({boundaryUtcMs:term.utcMs,monthOrdinal:JIE_MONTH_ORDINAL[term.longitude]!})).filter(item=>item.monthOrdinal!==undefined)}

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

function apiRelations(normalForm: ReferenceNormalFormPhaseResult) {
  return normalForm.relations.map((relation) => ({
    id: relation.id,
    kind: relation.candidate.kind,
    members: relation.candidate.members,
    ...(relation.candidate.targetElement ? { targetElement: relation.candidate.targetElement } : {}),
    status: relation.status,
    score: relation.score,
    competingIds: relation.competingIds,
  }));
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

const TOPIC_DOMAINS=["career","family","general","health","mobility","personality","relationship","risk","study","wealth"] as const;
function hasOnlyKeys(value:Record<string,unknown>,keys:readonly string[]):boolean{return Object.keys(value).every(key=>keys.includes(key))}
function numberMap(value:unknown,keys:readonly string[]):Record<string,number>|undefined{
  if(!isRecord(value)||!hasOnlyKeys(value,keys))return undefined;const result:Record<string,number>={};for(const[key,item]of Object.entries(value)){if(!finiteIn(item,0,4))return undefined;result[key]=item}return result;
}
function parseModelOverrides(value:unknown):ApiModelOverrides|undefined{
  if(!isRecord(value)||!hasOnlyKeys(value,["temporalLayers","pattern","climate","balancing","topics"]))return undefined;
  let temporalLayers:Record<string,number>|undefined;let pattern:Record<string,number>|undefined;let climate:Record<string,number>|undefined;let balancing:Record<string,number>|undefined;let domainWeights:Record<string,number>|undefined;
  if(value.temporalLayers!==undefined){temporalLayers=numberMap(value.temporalLayers,["natal","luck","annual"]);if(!temporalLayers)return undefined}
  if(value.pattern!==undefined){pattern=numberMap(value.pattern,["monthCommand"]);if(!pattern)return undefined}
  if(value.climate!==undefined){climate=numberMap(value.climate,["temperature","humidity"]);if(!climate)return undefined}
  if(value.balancing!==undefined){balancing=numberMap(value.balancing,["strength","climate"]);if(!balancing)return undefined}
  if(value.topics!==undefined){if(!isRecord(value.topics)||!hasOnlyKeys(value.topics,["domainWeights"]))return undefined;domainWeights=numberMap(value.topics.domainWeights??{},TOPIC_DOMAINS);if(!domainWeights)return undefined}
  return{...(temporalLayers?{temporalLayers}:{}),...(pattern?{pattern}:{}),...(climate?{climate}:{}),...(balancing?{balancing}:{}),...(domainWeights?{topics:{domainWeights}}:{})};
}

function parseCalendarRequest(value: unknown): ApiCalendarRequest | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value,["schemaVersion","locationId","localDateTime","sex","modelId","disambiguation","clockUncertaintySeconds","periodCount","exactCoordinates"])||value.schemaVersion !== CALENDAR_REQUEST_SCHEMA || !integerIn(value.locationId, 1, Number.MAX_SAFE_INTEGER)) return undefined;
  const local = value.localDateTime;
  if (!isRecord(local) || !hasOnlyKeys(local,["year","month","day","hour","minute","second"])||!integerIn(local.year, PUBLIC_START_YEAR, PUBLIC_END_YEAR) || !integerIn(local.month, 1, 12) || !integerIn(local.day, 1, 31) || !integerIn(local.hour, 0, 23) || !integerIn(local.minute, 0, 59) || (local.second !== undefined && !integerIn(local.second, 0, 59))) return undefined;
  if (value.sex !== "female" && value.sex !== "male") return undefined;
  if (value.modelId !== undefined && !isModelId(value.modelId)) return undefined;
  if (value.disambiguation !== undefined && !isDisambiguation(value.disambiguation)) return undefined;
  if (value.clockUncertaintySeconds !== undefined && !finiteIn(value.clockUncertaintySeconds, 0, 43_200)) return undefined;
  if (value.periodCount !== undefined && !integerIn(value.periodCount, 1, 12)) return undefined;
  const exact = value.exactCoordinates;
  let exactCoordinates: ApiCalendarRequest["exactCoordinates"];
  if (exact !== undefined) {
    if (!isRecord(exact)||!hasOnlyKeys(exact,["latitude","longitude","uncertaintyMeters"]) || !finiteIn(exact.latitude, -90, 90) || !finiteIn(exact.longitude, -180, 180) || !finiteIn(exact.uncertaintyMeters, 0, 1_000_000)) return undefined;
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

function parseAnalysisRequest(value:unknown):Readonly<{calendar:ApiCalendarRequest;targetYear:number;modelOverrides:ApiModelOverrides}>|undefined{
  if(!isRecord(value)||!hasOnlyKeys(value,["schemaVersion","targetYear","locationId","localDateTime","sex","modelId","modelOverrides","disambiguation","clockUncertaintySeconds","periodCount","exactCoordinates"])||value.schemaVersion!==ANALYSIS_REQUEST_SCHEMA||!integerIn(value.targetYear,PUBLIC_START_YEAR,PUBLIC_END_YEAR))return undefined;
  const modelOverrides=value.modelOverrides===undefined?{}:parseModelOverrides(value.modelOverrides);if(!modelOverrides)return undefined;
  const calendar=parseCalendarRequest({schemaVersion:CALENDAR_REQUEST_SCHEMA,locationId:value.locationId,localDateTime:value.localDateTime,sex:value.sex,modelId:value.modelId,disambiguation:value.disambiguation,clockUncertaintySeconds:value.clockUncertaintySeconds,periodCount:value.periodCount,exactCoordinates:value.exactCoordinates});
  return calendar?{calendar,targetYear:value.targetYear,modelOverrides}:undefined;
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

async function calculate(request: Request, requestId: string, locations: LocationStore | undefined, includeStructure: boolean,program:ReferenceProgramStore,monthlyRange?:Readonly<{startYear:number;endYear:number}>): Promise<Response> {
  if (!locations) return error(requestId, 503, "location-index-unavailable", "The canonical location index is unavailable");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return error(requestId, 415, "unsupported-media-type", "Use application/json");
  let raw: unknown;
  try { raw = await readBoundedJson(request); } catch (cause) {
    return error(requestId, cause instanceof Error && cause.message === "body-too-large" ? 413 : 400, cause instanceof Error ? cause.message : "invalid-json", "Request body must be valid JSON no larger than 8 KiB");
  }
  const analysisInput=includeStructure?parseAnalysisRequest(raw):undefined;
  const input=includeStructure?analysisInput?.calendar:parseCalendarRequest(raw);
  if (!input) return error(requestId, 400, includeStructure?"invalid-analysis-request":"invalid-calendar-request", `Request must conform to ${includeStructure?ANALYSIS_REQUEST_SCHEMA:CALENDAR_REQUEST_SCHEMA}`);
  const location = await locations.get(input.locationId);
  if (!location) return error(requestId, 404, "location-not-found", "Canonical location not found");
  const coordinate = input.exactCoordinates
    ? { source: "exact-input" as const, latitude: input.exactCoordinates.latitude, longitude: input.exactCoordinates.longitude, uncertaintyMeters: input.exactCoordinates.uncertaintyMeters }
    : { source: location.coordinateUse, latitude: location.latitude, longitude: location.longitude, uncertaintyMeters: COORDINATE_UNCERTAINTY_METERS[location.coordinateUse] };
  const modelId = input.modelId ?? "transparent-baseline";
  const appliedModel=applyPublicModelOverrides(MODELS[modelId],analysisInput?.modelOverrides??{});
  const model = appliedModel.profile;
  const result = compileCertifiedBaziCalendar({
    ...input.localDateTime,
    timeZone: location.timeZone,
    longitudeDegrees: coordinate.longitude,
    latitudeDegrees: coordinate.latitude,
    disambiguation: input.disambiguation ?? "reject",
    clockUncertaintySeconds: input.clockUncertaintySeconds ?? 60,
    coordinateUncertaintyMeters: coordinate.uncertaintyMeters,
  }, model, input.sex, input.periodCount ?? 8);
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
      tzdb: `${TIME_ZONE_PROVIDER}/${TZDB_VERSION}`,
      locationDataset: `${location.source}@${location.sourceVersion}`,
    },
    certificate: result.certificate,
  };
  if (includeStructure) {
    const structureResult = analyzeNatalStructure(value.calendar.pillars, model);
    if (!structureResult.ok) return error(requestId, 422, structureResult.code, structureResult.reason);
    const structure = structureResult.value;
    const interpretationResult = evaluateInterpretiveModel(value.calendar.pillars, structure.strength, structure.strength.elementMeasure.measure, structure.normalForm, model);
    if (!interpretationResult.ok) return error(requestId, 422, interpretationResult.code, interpretationResult.reason);
    const luckResult = analyzeLuckSequence(value.calendar.pillars, value.calendar.majorLuck, model);
    if (!luckResult.ok) return error(requestId, 422, luckResult.code, luckResult.reason);
    const annualBoundary=SOLAR_TERM_ENTRIES.find(entry=>entry.longitude===315&&new Date(entry.utcMs).getUTCFullYear()===analysisInput!.targetYear);
    if(!annualBoundary)return error(requestId,500,"annual-boundary-unavailable","Certified Lichun boundary is unavailable");
    const annualContext=resolveAnnualContext(analysisInput!.targetYear,annualBoundary.utcMs,value.calendar.majorLuck);
    if(!annualContext.ok)return error(requestId,422,annualContext.code,annualContext.reason);
    const records=await program.load();
    const referenceRuntime=new ReferenceCalculationRuntime(records,model);
    const annualResult=referenceRuntime.calculate({natal:value.calendar.pillars,luck:annualContext.value.luckPeriod.pillar,annual:annualContext.value.annualPillar,luckDirection:value.calendar.direction,sex:input.sex});
    if(!annualResult.ok)return error(requestId,422,annualResult.code,annualResult.reason);
    const annualInterpretation=evaluateInterpretiveModel(value.calendar.pillars,annualResult.value.normalForm.dynamicState.strength,annualResult.value.normalForm.dynamicState.elementMeasure,annualResult.value.normalForm,model);
    if(!annualInterpretation.ok)return error(requestId,422,annualInterpretation.code,annualInterpretation.reason);
    const kinshipResult=materializeKinshipProjection(annualResult.value.normalForm,input.sex,model);
    if(!kinshipResult.ok)return error(requestId,422,kinshipResult.code,kinshipResult.reason);
    const kinship=kinshipResult.value;
    const specialStates=materializeSpecialStateCertificate(annualResult.value.normalForm);
    const trajectoryPoints:ApiAnnualTrajectory["points"][number][]=[];
    for(const[year,boundaryUtcMs]of LICHUN_BY_YEAR){
      if(year<input.localDateTime.year||year>PUBLIC_END_YEAR)continue;
      if(monthlyRange&&(year<monthlyRange.startYear||year>monthlyRange.endYear))continue;
      const context=year===analysisInput!.targetYear?annualContext:resolveAnnualContext(year,boundaryUtcMs,value.calendar.majorLuck);
      if(!context.ok){if(context.code==="target-before-major-luck"||context.code==="target-after-major-luck-range")continue;trajectoryPoints.push({status:"unavailable",year,boundaryUtcMs,failureCode:context.code,reason:context.reason});continue}
      const calculation=year===analysisInput!.targetYear?annualResult:referenceRuntime.calculateTrajectorySample({natal:value.calendar.pillars,luck:context.value.luckPeriod.pillar,annual:context.value.annualPillar,luckDirection:value.calendar.direction,sex:input.sex});
      if(!calculation.ok){trajectoryPoints.push({status:"unavailable",year,boundaryUtcMs,failureCode:calculation.code,reason:calculation.reason});continue}
      const normalForm=calculation.value.normalForm;const contribution="topicCertificate" in calculation.value?calculation.value.topicCertificate.contribution:calculation.value.contribution;const activated="topicCertificate" in calculation.value?calculation.value.topicCertificate.activated:calculation.value.activated;const scale=contribution.totalVariation;const topicVector=contribution.atoms;const normalized=Object.values(topicVector).map(item=>scale>0?item/scale:0);const pointSpecialStates=year===analysisInput!.targetYear?specialStates:materializeSpecialStateCertificate(normalForm);
      const boundaries=monthBoundaries(year);const monthlyIndexes:number[]=[];const monthlyFingerprints:string[]=[];let monthlyFailure:Readonly<{code:string;reason:string}>|undefined;
      if(!monthlyRange)monthlyFailure={code:"monthly-candle-not-loaded",reason:"Flow-month candle is loaded through bounded trajectory batches"};
      else if(boundaries.length!==12)monthlyFailure={code:"monthly-boundary-unavailable",reason:"The certified twelve-month jie sequence is incomplete"};
      else for(const month of boundaries){const monthly=referenceRuntime.calculateTrajectorySample({natal:value.calendar.pillars,luck:context.value.luckPeriod.pillar,annual:context.value.annualPillar,month:baziMonthPillar(year,month.monthOrdinal),luckDirection:value.calendar.direction,sex:input.sex});if(!monthly.ok){monthlyFailure={code:monthly.code,reason:monthly.reason};break}const monthlyContribution=monthly.value.contribution;monthlyIndexes.push(monthlyContribution.totalVariation>0?monthlyContribution.total/monthlyContribution.totalVariation:0);monthlyFingerprints.push(monthly.value.normalForm.fingerprint)}
      const monthlyCandle:Extract<ApiAnnualTrajectory["points"][number],{status:"stable"}>["monthlyCandle"]=monthlyFailure?{status:"unavailable",samples:monthlyIndexes.length,failureCode:monthlyFailure.code,reason:monthlyFailure.reason}:{status:"stable",samples:12,open:monthlyIndexes[0]!,high:Math.max(...monthlyIndexes),low:Math.min(...monthlyIndexes),close:monthlyIndexes.at(-1)!,sampleFingerprints:monthlyFingerprints};
      trajectoryPoints.push({status:"stable",year,boundaryUtcMs,annualPillar:context.value.annualPillar,luckOrdinal:context.value.luckPeriod.ordinal,luckPillar:context.value.luckPeriod.pillar,strength:normalForm.dynamicState.strength.state,supportRatio:normalForm.dynamicState.strength.supportRatio,normalizedTopicIndex:scale>0?contribution.total/scale:0,domainRange:{lower:Math.min(0,...normalized),upper:Math.max(0,...normalized)},monthlyCandle,topicVector,activated,normalFormFingerprint:normalForm.fingerprint,specialStateCodes:pointSpecialStates.signals.map(signal=>signal.code)});
    }
    const trajectory:ApiAnnualTrajectory={schema:"senfate-annual-trajectory.v2",startYear:trajectoryPoints[0]?.year??analysisInput!.targetYear,endYear:trajectoryPoints.at(-1)?.year??analysisInput!.targetYear,indexDefinition:"topic-total-divided-by-total-variation",points:trajectoryPoints};
    const analysis: ApiAnalysisResponse = {
      schemaVersion: ANALYSIS_RESPONSE_SCHEMA,
      requestId,
      calendar: body,
      modelConfiguration:{schema:"senfate-public-model-configuration.v1",baseModelId:modelId,effectiveVersion:model.version,customized:appliedModel.count>0,overrideFingerprint:appliedModel.fingerprint,overrideCount:appliedModel.count,overrides:analysisInput!.modelOverrides},
      structure: {
        schema: structure.schema,
        dayMaster: structure.dayMaster,
        pillars: structure.pillars,
        elementMeasure: structure.strength.elementMeasure.measure,
        strength: {
          state: structure.strength.state,
          supportRatio: structure.strength.supportRatio,
          support: structure.strength.support,
          pressure: structure.strength.pressure,
          decomposition: structure.strength.decomposition,
        },
        rootExposure: structure.strength.rootExposure,
        relations: apiRelations(structure.normalForm),
        normalForm: {
          status: structure.normalForm.status,
          iterations: structure.normalForm.iterations,
          fingerprint: structure.normalForm.fingerprint,
          trace: structure.normalForm.trace,
        },
      },
      interpretation: interpretationResult.value,
      luckDynamics: luckResult.value.map((item) => ({
        ordinal: item.ordinal,
        pillar: item.pillar,
        startAgeYears: item.startAgeYears,
        startAgeInterval: item.startAgeInterval,
        elementMeasure: item.elementMeasure,
        strength: item.strength,
        interpretation: item.interpretation,
        relations: apiRelations(item.normalForm),
        normalForm: { status: item.normalForm.status, iterations: item.normalForm.iterations, fingerprint: item.normalForm.fingerprint, trace: item.normalForm.trace },
      })),
      annualTrajectory:trajectory,
      annual:{schema:"senfate-annual-analysis.v1",targetYear:annualContext.value.targetYear,convention:annualContext.value.convention,boundaryUtcMs:annualContext.value.boundaryUtcMs,annualPillar:annualContext.value.annualPillar,luckOrdinal:annualContext.value.luckPeriod.ordinal,luckPillar:annualContext.value.luckPeriod.pillar,elementMeasure:annualResult.value.normalForm.dynamicState.elementMeasure,strength:annualResult.value.normalForm.dynamicState.strength,relations:apiRelations(annualResult.value.normalForm),normalForm:{status:annualResult.value.normalForm.status,iterations:annualResult.value.normalForm.iterations,fingerprint:annualResult.value.normalForm.fingerprint,trace:annualResult.value.normalForm.trace},interpretation:annualInterpretation.value,specialStates:{...specialStates,phase:"annual"},kinship:{...kinship,phase:"annual"},topics:{...annualResult.value.topicCertificate,phase:"annual"}},
      certificate: { functional: "api.annual-reference-analysis", modelConfiguration:{baseModelId:modelId,effectiveVersion:model.version,overrideFingerprint:appliedModel.fingerprint,overrideCount:appliedModel.count,overrides:analysisInput!.modelOverrides},calendar: result.certificate, structure: structureResult.certificate, interpretation: interpretationResult.certificate, luckSequence: luckResult.certificate,annualContext:annualContext.certificate,annualReference:annualResult.certificate,annualInterpretation:annualInterpretation.certificate,kinship:kinshipResult.certificate,specialStates:{schema:specialStates.schema,normalFormFingerprint:specialStates.normalFormFingerprint,signalCount:specialStates.signals.length},annualTrajectory:{schema:trajectory.schema,startYear:trajectory.startYear,endYear:trajectory.endYear,stable:trajectory.points.filter(point=>point.status==="stable").length,unavailable:trajectory.points.filter(point=>point.status==="unavailable").length,indexDefinition:trajectory.indexDefinition} },
    };
    return json(analysis);
  }
  return json(body);
}

export async function handleRequest(request: Request, locations?: LocationStore,program:ReferenceProgramStore=bundledReferenceProgram): Promise<Response> {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const { pathname } = url;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
  const calendarPath = pathname === `${API_PREFIX}/calendar/calculate` || pathname === "/calendar/calculate";
  const analysisPath = pathname === `${API_PREFIX}/analysis/calculate` || pathname === "/analysis/calculate";
  const trajectoryPath = pathname === `${API_PREFIX}/analysis/trajectory` || pathname === "/analysis/trajectory";
  if(trajectoryPath){if(request.method!=="POST")return error(requestId,405,"method-not-allowed","Use POST for trajectory batches");const startYear=Number(url.searchParams.get("startYear")),endYear=Number(url.searchParams.get("endYear"));if(!Number.isInteger(startYear)||!Number.isInteger(endYear)||startYear<PUBLIC_START_YEAR||endYear>PUBLIC_END_YEAR||endYear<startYear||endYear-startYear>3)return error(requestId,400,"invalid-trajectory-range","Trajectory batches must cover one to four consecutive years");return calculate(request,requestId,locations,true,program,{startYear,endYear})}
  if (analysisPath) {
    if (request.method !== "POST") return error(requestId, 405, "method-not-allowed", "Use POST for natal structure analysis");
    return calculate(request, requestId, locations, true,program);
  }
  if (calendarPath) {
    if (request.method !== "POST") return error(requestId, 405, "method-not-allowed", "Use POST for calendar calculation");
    return calculate(request, requestId, locations, false,program);
  }
  if (request.method !== "GET") return error(requestId, 405, "method-not-allowed", "Use GET for this resource");
  if (pathname === `${API_PREFIX}/health` || pathname === "/health") {
    const body: ApiHealthResponse = { schemaVersion: API_HEALTH_SCHEMA, status: "ok", service: "senfate-api", requestId };
    return json(body);
  }
  if (pathname === `${API_PREFIX}/meta` || pathname === "/meta") {
    const body: ApiMetaResponse = {
      schemaVersion: API_META_SCHEMA, requestId, product: "SenFate", architecture: "formal-bazi-pipeline",
      corpus: { version: "4.0", records: 37_231, families: 11_306, books: 7 }, calculationStatus: "temporal-source-evidence-public-beta",
    };
    return json(body);
  }
  if(pathname===`${API_PREFIX}/models`||pathname==="/models"){
    const body:ApiModelCatalogResponse={schemaVersion:MODEL_CATALOG_SCHEMA,requestId,parameters:PUBLIC_MODEL_PARAMETER_METADATA,presets:Object.entries(MODELS).map(([id,profile])=>({id:id as ApiModelId,label:profile.label,version:profile.version,values:publicModelParameterValues(profile)}))};return json(body);
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
