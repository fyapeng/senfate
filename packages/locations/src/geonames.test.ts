import { describe, expect, it } from "vitest";
import { parseGeoNamesLine } from "./geonames";
import { locationFtsQuery, normalizeLocationQuery } from "./index";

describe("location normalization", () => {
  it("normalizes full-width and repeated whitespace", () => {
    expect(normalizeLocationQuery("  北 京　市 ")).toBe("北 京 市");
    expect(locationFtsQuery('北京 "海淀"')).toBe('"北京"* AND """海淀"""*');
  });

  it("parses the canonical GeoNames columns", () => {
    const fields = ["1816670", "北京", "Beijing", "Peking,北京市", "39.9075", "116.39723", "P", "PPLC", "CN", "", "22", "", "", "", "21540000", "", "", "Asia/Shanghai", "2025-01-01"];
    expect(parseGeoNamesLine(fields.join("\t"), "cities500-2026-07-22")).toMatchObject({
      locationId: 1816670,
      name: "北京",
      countryCode: "CN",
      featureLevel: "city",
      coordinateUse: "settlement-centroid",
      timeZone: "Asia/Shanghai",
    });
  });
});
