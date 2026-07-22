import { describe, expect, it } from "vitest";
import { analyzeNatalStructure } from "./analysis";
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
});
