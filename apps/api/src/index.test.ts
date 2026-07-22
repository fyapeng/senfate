import { describe, expect, it, vi } from "vitest";
import type { ApiCalendarResponse, ApiLocation } from "@senfate/contracts";
import { handleRequest, type LocationStore } from "./index";

const beijing: ApiLocation = {
  id: 1816670, name: "Beijing", displayName:"北京", asciiName: "Beijing", countryCode: "CN", admin1Code: "22", featureCode: "PPLC", featureLevel: "city",
  latitude: 39.9075, longitude: 116.39723, timeZone: "Asia/Shanghai", population: 21_540_000, coordinateUse: "settlement-centroid", source: "GeoNames", sourceVersion: "2026-07-22",
};
const store: LocationStore = { search: vi.fn(async () => [beijing]), get: vi.fn(async (id) => id === beijing.id ? beijing : undefined) };

describe("SenFate API", () => {
  it("reports the canonical corpus baseline", async () => {
    const response = await handleRequest(new Request("https://example.test/senfate/api/v1/meta"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ schemaVersion: "senfate-api-meta.v2", calculationStatus: "calendar-public-beta", corpus: { records: 37_231, families: 11_306, books: 7 } });
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
});
