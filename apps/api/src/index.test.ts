import { describe, expect, it, vi } from "vitest";
import type { ApiLocation } from "@senfate/contracts";
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
    await expect(response.json()).resolves.toMatchObject({ schemaVersion: "senfate-api-meta.v1", corpus: { records: 37_231, families: 11_306, books: 7 } });
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
});
