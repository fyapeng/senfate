import { describe, expect, it, vi } from "vitest";
import type { ApiAnalysisResponse, ApiCalendarResponse, ApiLocation } from "@senfate/contracts";
import type { CompiledReferenceRecord } from "@senfate/rules/compiler";
import { handleRequest, type LocationStore } from "./index";
import type { ReferenceProgramStore } from "./reference-program";

const beijing: ApiLocation = {
  id: 1816670, name: "Beijing", displayName:"北京", asciiName: "Beijing", countryCode: "CN", admin1Code: "22", featureCode: "PPLC", featureLevel: "city",
  latitude: 39.9075, longitude: 116.39723, timeZone: "Asia/Shanghai", population: 21_540_000, coordinateUse: "settlement-centroid", source: "GeoNames", sourceVersion: "2026-07-22",
};
const store: LocationStore = { search: vi.fn(async () => [beijing]), get: vi.fn(async (id) => id === beijing.id ? beijing : undefined) };
function topicRecord(id:string,scope:string):CompiledReferenceRecord{return{recordId:id,bookId:"test-book",lineStart:1,lineEnd:1,familyId:id,ruleType:"prediction",sourceRole:"general_rule",scopes:[scope],conditions:[{kind:"day-stem",operator:"dayStem.equals",value:"戊"}],effects:[{operator:"support",domains:["career"],polarity:"support"}],terms:{},extractionConfidence:1,disposition:"executable",reason:"complete-canonical-rule"}}
const program:ReferenceProgramStore={load:async()=>[topicRecord("n","natal"),topicRecord("l","luck"),topicRecord("a","annual")]};

describe("SenFate API", () => {
  it("reports the canonical corpus baseline", async () => {
    const response = await handleRequest(new Request("https://example.test/senfate/api/v1/meta"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ schemaVersion: "senfate-api-meta.v5", calculationStatus: "annual-topic-public-beta", corpus: { records: 37_231, families: 11_306, books: 7 } });
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
      provenance: { calendarSchema: "senfate-certified-bazi-calendar.v1", ephemeris: "NASA/JPL Horizons DE441" },
    });
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
      body: JSON.stringify({ schemaVersion: "senfate-analysis-request.v1", targetYear:2026,locationId: beijing.id, localDateTime: { year: 2000, month: 2, day: 10, hour: 12, minute: 0 }, sex: "male" }),
    }), store,program);
    expect(response.status).toBe(200);
    const body = await response.json() as ApiAnalysisResponse;
    expect(body).toMatchObject({
      schemaVersion: "senfate-analysis-response.v3",
      calendar: { schemaVersion: "senfate-calendar-response.v1", pillars: { day: { stem: "戊", branch: "戌" } } },
      structure: {
        schema: "senfate-natal-structure-analysis.v1",
        dayMaster: { stem: "戊", element: "土", polarity: "阳" },
        pillars: { day: { tenGod: "比肩" } },
        normalForm: { status: "stable" },
      },
      interpretation: { schema: "senfate-interpretive-model.v1", climate: { schema: "senfate-climate-coordinate.v1" } },
      annual:{schema:"senfate-annual-analysis.v1",targetYear:2026,normalForm:{status:"stable"},topics:{schema:"senfate-topic-contribution-certificate.v2",evaluated:3,activated:3,contribution:{atoms:{career:3}}}},
    });
    expect(body.structure.elementMeasure.total).toBeGreaterThan(0);
    expect(body.interpretation.balancing.candidates).toHaveLength(5);
    expect(body.luckDynamics).toHaveLength(8);
    expect(body.luckDynamics.every((item) => item.normalForm.status === "stable")).toBe(true);
    expect(body.annual.kinship.roles).toHaveLength(6);
    expect(body.annual.topics.activatedSources).toHaveLength(3);
  });
});
