import { describe, expect, it } from "vitest";
import { analyzeLuckSequence, analyzeNatalStructure } from "./analysis";
import { TRANSPARENT_BASELINE_MODEL } from "./model";
import { sexagenary } from "./ontology";

describe("natal structure analysis", () => {
  it("materializes ten gods, hidden stems, strength and a stable relation normal form", () => {
    const result = analyzeNatalStructure({ year: sexagenary(16), month: sexagenary(14), day: sexagenary(34), hour: sexagenary(54) }, TRANSPARENT_BASELINE_MODEL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schema).toBe("senfate-natal-structure-analysis.v1");
    expect(result.value.dayMaster).toEqual({ stem: "戊", element: "土", polarity: "阳" });
    expect(result.value.pillars.day.tenGod).toBe("比肩");
    expect(result.value.pillars.year.hiddenStems.map((item) => item.stem)).toEqual(["戊", "乙", "癸"]);
    expect(result.value.strength.elementMeasure.measure.total).toBeGreaterThan(0);
    expect(result.value.normalForm.status).toBe("stable");
  });
  it("recomputes every major-luck period through a stable accumulated normal form", () => {
    const pillars = { year: sexagenary(16), month: sexagenary(14), day: sexagenary(34), hour: sexagenary(54) };
    const periods = [1, 2, 3].map((ordinal) => ({ ordinal, pillar: sexagenary(14 + ordinal), startAgeYears: ordinal * 10, startAgeInterval: { lower: ordinal * 10 - .01, upper: ordinal * 10 + .01, unit: "years" }, startUtcMs: ordinal, startUtcInterval: { lower: ordinal, upper: ordinal, unit: "unix-ms" } }));
    const result = analyzeLuckSequence(pillars, periods, TRANSPARENT_BASELINE_MODEL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
    expect(result.value.every((item) => item.normalForm.phase === "luck" && item.normalForm.status === "stable")).toBe(true);
    expect(result.value.every((item) => item.interpretation.balancing.candidates.length === 5)).toBe(true);
  });
});
