/// <reference types="node" />
import { describe, expect, it, vi } from "vitest";
import type { ApiAnalysisResponse, ApiCalendarResponse, ApiLocation } from "@senfate/contracts";
import type { CompiledReferenceRecord } from "@senfate/rules/compiler";
import { compileReferenceCorpus } from "@senfate/rules/node";
import { fileURLToPath } from "node:url";
import { handleRequest, type LocationStore } from "./index";
import type { ReferenceProgramStore } from "./reference-program";

const beijing: ApiLocation = {
  id: 1816670, name: "Beijing", displayName:"北京", asciiName: "Beijing", countryCode: "CN", admin1Code: "22", featureCode: "PPLC", featureLevel: "city",
  latitude: 39.9075, longitude: 116.39723, timeZone: "Asia/Shanghai", population: 21_540_000, coordinateUse: "settlement-centroid", source: "GeoNames", sourceVersion: "2026-07-22",
};
const store: LocationStore = { search: vi.fn(async () => [beijing]), get: vi.fn(async (id) => id === beijing.id ? beijing : undefined) };
function topicRecord(id:string,scope:string):CompiledReferenceRecord{return{recordId:id,bookId:"test-book",lineStart:1,lineEnd:1,familyId:id,ruleType:"prediction",sourceRole:"general_rule",scopes:[scope],conditions:[{kind:"day-stem",operator:"dayStem.equals",value:"戊"}],effects:[{operator:"support",domains:["career"],polarity:"support"}],terms:{},extractionConfidence:1,disposition:"executable",reason:"complete-canonical-rule"}}
const program:ReferenceProgramStore={load:async()=>[topicRecord("n","natal"),topicRecord("l","luck"),topicRecord("a","annual")]};
const fullProgram:ReferenceProgramStore={load:async()=>compileReferenceCorpus(fileURLToPath(new URL("../../../data/classical-rules/classical-source-corpus.v4.0.json.gz",import.meta.url))).records};

describe("SenFate API", () => {
  it("reports the canonical corpus baseline", async () => {
    const response = await handleRequest(new Request("https://example.test/senfate/api/v1/meta"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ schemaVersion: "senfate-api-meta.v8", calculationStatus: "temporal-source-evidence-public-beta", corpus: { records: 37_231, families: 11_306, books: 7 } });
  });

  it("returns selected canonical locations with time zone and coordinates", async () => {
    const response = await handleRequest(new Request("https://example.test/senfate/api/v1/locations/search?q=北京&country=cn&limit=50"), store);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ schemaVersion: "senfate-location-search.v1", query: "北京", results: [{ id: 1816670, timeZone: "Asia/Shanghai" }] });
    expect(store.search).toHaveBeenCalledWith("北京", "CN", 20);
    expect((await handleRequest(new Request("https://example.test/locations/search?q=北京"),store)).status).toBe(200);
  });

  it("fails closed for malformed or unavailable location queries", async () => {
    expect((await handleRequest(new Request("https://example.test/senfate/api/v1/locations/search?q="), store)).status).toBe(400);
    expect((await handleRequest(new Request("https://example.test/senfate/api/v1/locations/search?q=北京"))).status).toBe(503);
    expect((await handleRequest(new Request("https://example.test/senfate/api/v1/locations/1"), store)).status).toBe(404);
  });

  it("fails closed on unavailable routes", async () => {
    const response = await handleRequest(new Request("https://example.test/senfate/api/v1/calculate"));
    expect(response.status).toBe(404);
  });

  it("calculates a certified chart and major-luck sequence from a canonical location", async () => {
    const response = await handleRequest(new Request("https://example.test/senfate/api/v1/calendar/calculate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schemaVersion: "senfate-calendar-request.v1",
        locationId: beijing.id,
        localDateTime: { year: 2000, month: 2, day: 10, hour: 12, minute: 0 },
        sex: "male",
        clockUncertaintySeconds: 60,
        periodCount: 8,
      }),
    }), store);
    expect(response.status).toBe(200);
    const body = await response.json() as ApiCalendarResponse;
    expect(body).toMatchObject({
      schemaVersion: "senfate-calendar-response.v1",
      location: { id: beijing.id, timeZone: "Asia/Shanghai" },
      coordinateProvenance: { source: "settlement-centroid", uncertaintyMeters: 50_000 },
      pillars: { year: { stem: "庚", branch: "辰" } },
      direction: "forward",
      provenance: { calendarSchema: "senfate-certified-bazi-calendar.v1", ephemeris: "NASA/JPL Horizons DE441", tzdb: "moment-timezone@0.6.3/IANA-2026c" },
    });
    expect(body.certificate).toMatchObject({tzdbVersion:"IANA-2026c",upstream:{timeZone:{provider:"moment-timezone@0.6.3",tzdbVersion:"IANA-2026c"}}});
    expect(body.majorLuck).toHaveLength(8);
    expect(body.majorLuck[0]).toMatchObject({ ordinal: 1, pillar: { stem: "己", branch: "卯" } });
  });

  it("fails closed for malformed calculation requests", async () => {
    const malformed = await handleRequest(new Request("https://example.test/calendar/calculate", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), store);
    expect(malformed.status).toBe(400);
    const wrongMethod = await handleRequest(new Request("https://example.test/calendar/calculate"), store);
    expect(wrongMethod.status).toBe(405);
  });

  it("returns a stable natal structure analysis without changing the calendar contract", async () => {
    const response = await handleRequest(new Request("https://example.test/senfate/api/v1/analysis/calculate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schemaVersion: "senfate-analysis-request.v2", targetYear:2026,locationId: beijing.id, localDateTime: { year: 2000, month: 2, day: 10, hour: 12, minute: 0 }, sex: "male" }),
    }), store,program);
    expect(response.status).toBe(200);
    const body = await response.json() as ApiAnalysisResponse;
    expect(body).toMatchObject({
      schemaVersion: "senfate-analysis-response.v8",
      calendar: { schemaVersion: "senfate-calendar-response.v1", pillars: { day: { stem: "戊", branch: "戌" } } },
      modelConfiguration:{schema:"senfate-public-model-configuration.v1",customized:false,overrideCount:0,overrideFingerprint:"none"},
      structure: {
        schema: "senfate-natal-structure-analysis.v1",
        dayMaster: { stem: "戊", element: "土", polarity: "阳" },
        pillars: { day: { tenGod: "比肩" } },
        normalForm: { status: "stable" },
      },
      interpretation: { schema: "senfate-interpretive-model.v1", climate: { schema: "senfate-climate-coordinate.v1" } },
      annualTrajectory:{schema:"senfate-annual-trajectory.v2",indexDefinition:"topic-total-divided-by-total-variation",points:expect.any(Array)},
      annual:{schema:"senfate-annual-analysis.v1",targetYear:2026,normalForm:{status:"stable"},specialStates:{schema:"senfate-special-state-certificate.v1",phase:"annual",natalSevenSymbolConsensus:{total:7}},kinship:{schema:"senfate-kinship-projection.v2",phase:"annual",roles:expect.any(Array)},topics:{schema:"senfate-topic-contribution-certificate.v4",evaluated:3,activated:3,contribution:{atoms:{career:3}},eventHypotheses:[{schema:"senfate-topic-event-hypothesis.v3",predicateId:"annual:career:support",scopeEvidence:{natalSources:1,luckSources:1,annualSources:1,unscopedSources:0}}]}},
    });
    expect(body.structure.elementMeasure.total).toBeGreaterThan(0);
    expect(body.interpretation.balancing.candidates).toHaveLength(5);
    expect(body.luckDynamics).toHaveLength(8);
    expect(body.luckDynamics.every((item) => item.normalForm.status === "stable")).toBe(true);
    expect(body.annualTrajectory.points.length).toBeGreaterThan(20);
    const trajectoryTarget=body.annualTrajectory.points.find(point=>point.year===2026)!;
    expect(trajectoryTarget).toMatchObject({status:"stable",luckOrdinal:body.annual.luckOrdinal,normalFormFingerprint:body.annual.normalForm.fingerprint});
    if(trajectoryTarget.status==="stable"){expect(trajectoryTarget.normalizedTopicIndex).toBeGreaterThanOrEqual(-1);expect(trajectoryTarget.monthlyCandle).toMatchObject({status:"stable",samples:12});}
    expect(body.annual.kinship.roles).toHaveLength(6);
    const partner=body.annual.kinship.roles.find(role=>role.id==="partner")!;
    expect(partner.observedCount).toBe(partner.visibleCount+partner.hiddenCount);
    expect(partner.weightedExposure).toBeCloseTo(Object.values(partner.layerExposure).reduce((sum,layer)=>sum+layer.weightedExposure,0));
    expect(body.certificate).toMatchObject({kinship:{functional:"semantic.kinship",normalFormFingerprint:body.annual.normalForm.fingerprint}});
    expect(body.annual.topics.activatedSources).toHaveLength(3);
  });

  it("publishes the bounded public model catalog",async()=>{const response=await handleRequest(new Request("https://example.test/senfate/api/v1/models"));expect(response.status).toBe(200);const body=await response.json() as {schemaVersion:string;parameters:readonly {path:string;minimum:number;maximum:number}[];presets:readonly {id:string;values:Record<string,number>}[]};expect(body.schemaVersion).toBe("senfate-model-catalog.v1");expect(body.parameters).toHaveLength(19);expect(body.parameters[0]).toMatchObject({path:"temporalLayers.natal",minimum:0,maximum:4});expect(body.presets).toHaveLength(3);expect(body.presets[0]).toMatchObject({id:"transparent-baseline",values:{"temporalLayers.natal":1}})});

  it("applies only bounded public model overrides and certifies the effective configuration",async()=>{
    const request=(modelOverrides:unknown)=>new Request("https://example.test/senfate/api/v1/analysis/calculate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({schemaVersion:"senfate-analysis-request.v2",targetYear:2026,locationId:beijing.id,localDateTime:{year:2000,month:2,day:10,hour:12,minute:0},sex:"male",modelOverrides})});
    const response=await handleRequest(request({temporalLayers:{annual:1.5},topics:{domainWeights:{career:2}}}),store,program);expect(response.status).toBe(200);const body=await response.json() as ApiAnalysisResponse;expect(body.modelConfiguration).toMatchObject({customized:true,overrideCount:2,overrides:{temporalLayers:{annual:1.5},topics:{domainWeights:{career:2}}}});expect(body.modelConfiguration.overrideFingerprint).toMatch(/^[0-9a-f]{8}$/u);expect(body.calendar.model.version).toContain(body.modelConfiguration.overrideFingerprint);expect(body.annual.topics.contribution.atoms.career).toBe(6);
    expect((await handleRequest(request({topics:{domainWeights:{career:4.1}}}),store,program)).status).toBe(400);expect((await handleRequest(request({rawGraphQuery:"day.branch"}),store,program)).status).toBe(400);const raw=JSON.parse(await request({}).text()) as Record<string,unknown>;raw.rawGraphQuery="day.branch";expect((await handleRequest(new Request("https://example.test/analysis/calculate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(raw)}),store,program)).status).toBe(400);
  });

  it("recomputes every covered year against the bundled 37,231-record program",async()=>{
    const response=await handleRequest(new Request("https://example.test/senfate/api/v1/analysis/calculate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({schemaVersion:"senfate-analysis-request.v2",targetYear:2026,locationId:beijing.id,localDateTime:{year:2000,month:2,day:10,hour:12,minute:0},sex:"male",periodCount:12})}),store,fullProgram);
    expect(response.status).toBe(200);const body=await response.json() as ApiAnalysisResponse;
    expect(body.annual.topics.program.total).toBe(37_231);
    expect(body.annualTrajectory.points.length).toBeGreaterThan(20);
    expect(body.annualTrajectory.points.every(point=>point.status==="stable"||Boolean(point.failureCode))).toBe(true);
    expect(body.annualTrajectory.points.find(point=>point.year===2026)).toMatchObject({status:"stable",normalFormFingerprint:body.annual.normalForm.fingerprint});
  });
});
