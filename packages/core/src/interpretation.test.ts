import { describe, expect, it } from "vitest";
import { analyzeNatalStructure } from "./analysis";
import { evaluateInterpretiveModel, evaluatePatternProjection } from "./interpretation";
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

  it("names 建禄格 only when the month branch is the day master's prosperity branch", () => {
    const jiaProsperity = { year: sexagenary(0), month: sexagenary(2), day: sexagenary(50), hour: sexagenary(3) };
    const structure = analyzeNatalStructure(jiaProsperity, TRANSPARENT_BASELINE_MODEL);
    expect(structure.ok).toBe(true);
    if (!structure.ok) return;
    const result = evaluatePatternProjection(jiaProsperity, structure.value.strength, TRANSPARENT_BASELINE_MODEL, structure.value.normalForm, { daysFromJie: 20 });
    expect(result.conclusions).toContainEqual(expect.objectContaining({ id:"special.established-prosperity",label:"建禄格",status:"qualified" }));
    expect(result.schema).toBe("senfate-pattern-projection.v3");
  });

  it("keeps extreme structures as candidates until the strict following conditions are satisfied", () => {
    const structure = analyzeNatalStructure(pillars, TRANSPARENT_BASELINE_MODEL);
    expect(structure.ok).toBe(true);
    if (!structure.ok) return;
    const forcedStrength = {...structure.value.strength,state:"very-weak",supportRatio:.1,support:1,pressure:9} as const;
    const result = evaluatePatternProjection(pillars, forcedStrength, TRANSPARENT_BASELINE_MODEL, structure.value.normalForm, { daysFromJie: 20 });
    expect(result.conclusions).toContainEqual(expect.objectContaining({id:"follow.follow-weak",label:"从弱格",status:"candidate"}));
  });

  it("uses command-day segmentation to pick the command stem and attaches source evidence", () => {
    const structure = analyzeNatalStructure(pillars, TRANSPARENT_BASELINE_MODEL);
    expect(structure.ok).toBe(true);
    if (!structure.ok) return;
    // 月支为戌（index 14 → branch 戌）；距节气 20 日 → 司令戊土（戌月 15 日后戊土本气）
    const result = evaluatePatternProjection(pillars, structure.value.strength, TRANSPARENT_BASELINE_MODEL, structure.value.normalForm, { daysFromJie: 20 });
    expect(result.schema).toBe("senfate-pattern-projection.v3");
    expect(result.commandStem).toBeDefined();
    // 规则驱动结论应携带古籍来源
    const withSources = result.conclusions.filter((c) => c.sourceEvidence && c.sourceEvidence.length > 0);
    expect(withSources.length).toBeGreaterThan(0);
  });

  it("falls back to parameterized projection when no normal form or context is supplied", () => {
    const structure = analyzeNatalStructure(pillars, TRANSPARENT_BASELINE_MODEL);
    expect(structure.ok).toBe(true);
    if (!structure.ok) return;
    const result = evaluatePatternProjection(pillars, structure.value.strength, TRANSPARENT_BASELINE_MODEL);
    // 兜底路径：结论不含 sourceEvidence
    expect(result.conclusions.every((c) => !c.sourceEvidence || c.sourceEvidence.length === 0)).toBe(true);
  });
});
