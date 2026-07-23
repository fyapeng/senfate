import { describe, expect, it } from "vitest";
import { sexagenary } from "@senfate/core";
import type { ApiAnalysisRequest } from "@senfate/contracts";
import { calculateBrowserAnnualDetail, calculateBrowserTrajectoryYear, type BrowserAnalysisContext } from "./browser-analysis-engine";

const yearMs = 365.2425 * 86_400_000;
const period = (ordinal: number, startYear: number) => {
  const startUtcMs = Date.UTC(startYear, 0, 1);
  return {
    ordinal,
    pillar: sexagenary(ordinal + 10),
    startAgeYears: ordinal * 10,
    startAgeInterval: { lower: ordinal * 10, upper: ordinal * 10, unit: "years" },
    startUtcMs,
    startUtcInterval: { lower: startUtcMs - 1, upper: startUtcMs + 1, unit: "ms" },
  };
};

const request: ApiAnalysisRequest = {
  schemaVersion: "senfate-analysis-request.v3",
  targetYear: 2026,
  locationId: 1,
  localDateTime: { year: 2000, month: 2, day: 10, hour: 12, minute: 0 },
  sex: "male",
};

const base: BrowserAnalysisContext["base"] = {
  calendar: {
    pillars: { year: sexagenary(16), month: sexagenary(14), day: sexagenary(12), hour: sexagenary(6) },
    direction: "forward",
    majorLuck: [
      period(0, 2000),
      period(1, 2010),
      period(2, 2020),
      { ...period(3, 2030), startUtcMs: Date.UTC(2030, 0, 1), startUtcInterval: { lower: Date.UTC(2030, 0, 1) - yearMs / 365, upper: Date.UTC(2030, 0, 1) + yearMs / 365, unit: "ms" } },
    ],
  },
};

describe("browser analysis engine", () => {
  it("computes a stable annual point and twelve monthly samples without an API call", () => {
    const point = calculateBrowserTrajectoryYear({ request, base, records: [] }, 2026);
    expect(point.status).toBe("stable");
    if (point.status === "stable") {
      expect(point.monthlyCandle).toMatchObject({ status: "stable", samples: 12 });
      expect(point.activated).toBe(0);
    }
  });

  it("computes selected-year detail with a browser execution certificate", () => {
    const detail = calculateBrowserAnnualDetail({ request, base, records: [] }, 2026);
    expect(detail.annual.targetYear).toBe(2026);
    expect(detail.annual.normalForm.status).toBe("stable");
    expect(detail.certificate).toMatchObject({ functional: "browser.annual-reference-analysis", execution: "web-worker" });
    expect(detail.point.status).toBe("stable");
  });

  it("rejects a tampered API pillar before local calculation", () => {
    const tampered = {
      calendar: {
        ...base.calendar,
        pillars: { ...base.calendar.pillars, year: { ...base.calendar.pillars.year, stem: "乙" } },
      },
    } as BrowserAnalysisContext["base"];
    expect(() => calculateBrowserTrajectoryYear({ request, base: tampered, records: [] }, 2026)).toThrow("invalid-api-ganzhi");
  });
});
