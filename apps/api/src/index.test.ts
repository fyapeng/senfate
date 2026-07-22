import { describe, expect, it } from "vitest";
import { handleRequest } from "./index";

describe("SenFate API", () => {
  it("reports the canonical corpus baseline", async () => {
    const response = handleRequest(new Request("https://example.test/senfate/api/v1/meta"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: "senfate-api-meta.v1",
      corpus: { records: 37_231, families: 11_306, books: 7 },
      calculationStatus: "kernel-rebuild",
    });
  });

  it("fails closed on unavailable routes", async () => {
    const response = handleRequest(new Request("https://example.test/senfate/api/v1/calculate"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "not-found" } });
  });
});
