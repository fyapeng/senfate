import { describe, expect, it } from "vitest";
import { analyzeNatalStructure } from "./analysis";
import { evaluateInterpretiveModel } from "./interpretation";
import { CLIMATE_PRIORITY_MODEL, TRANSPARENT_BASELINE_MODEL } from "./model";
import { sexagenary } from "./ontology";

const pillars = { year: sexagenary(16), month: sexagenary(14), day: sexagenary(34), hour: sexagenary(54) };

describe("interpretive model", () => {
  it("projects pattern, climate and a finite five-element balancing vector", () => {
    const structure = analyzeNatalStructure(pillars, TRANSPARENT_BASELINE_MODEL);
    expect(structure.ok).toBe(true);
    if (!structure.ok) return;
    const result = evaluateInterpretiveModel(pillars, structure.value.strength, structure.value.strength.elementMeasure.measure, structure.value.normalForm, TRANSPARENT_BASELINE_MODEL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pattern.candidates.length).toBeGreaterThan(0);
    expect(Number.isFinite(result.value.climate.temperature)).toBe(true);
    expect(result.value.balancing.candidates.map((item) => item.element).sort()).toEqual(["土", "木", "水", "火", "金"].sort());
    expect(result.value.balancing.candidates.every((item) => Number.isFinite(item.score))).toBe(true);
  });

  it("makes the climate preset observable without changing the ontology", () => {
    const baseline = analyzeNatalStructure(pillars, TRANSPARENT_BASELINE_MODEL);
    const climate = analyzeNatalStructure(pillars, CLIMATE_PRIORITY_MODEL);
    expect(baseline.ok && climate.ok).toBe(true);
    if (!baseline.ok || !climate.ok) return;
    const a = evaluateInterpretiveModel(pillars, baseline.value.strength, baseline.value.strength.elementMeasure.measure, baseline.value.normalForm, TRANSPARENT_BASELINE_MODEL);
    const b = evaluateInterpretiveModel(pillars, climate.value.strength, climate.value.strength.elementMeasure.measure, climate.value.normalForm, CLIMATE_PRIORITY_MODEL);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.value.climate.temperature).not.toBe(a.value.climate.temperature);
  });
});
