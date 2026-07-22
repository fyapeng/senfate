import { describe, expect, it } from "vitest";
import { materializeDynamicChartState } from "./lifecycle";
import { TRANSPARENT_BASELINE_MODEL } from "./model";
import { resolveReferenceNormalForm } from "./resolution";
import { materializeKinshipProjection, resolveAnnualContext } from "./semantic";
import { sexagenary } from "./ontology";

describe("annual and kinship semantics", () => {
  it("selects the enclosing luck period and derives the post-Lichun year pillar", () => {
    const periods = [1, 2].map((ordinal) => ({ ordinal, pillar: sexagenary(ordinal), startAgeYears: ordinal, startAgeInterval: { lower: ordinal, upper: ordinal, unit: "years" }, startUtcMs: Date.UTC(2000 + (ordinal - 1) * 10, 0, 1), startUtcInterval: { lower: 0, upper: 0, unit: "unix-ms" } }));
    const result = resolveAnnualContext(2005,Date.UTC(2005,1,4), periods);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.luckPeriod.ordinal).toBe(1);
    expect(result.value.annualPillar).toEqual(sexagenary(21));
  });

  it("projects sex-specific partner and children roles only from a stable phase", () => {
    const natal = { year: sexagenary(0), month: sexagenary(2), day: sexagenary(4), hour: sexagenary(6) };
    const dynamic = materializeDynamicChartState({ natal, luck: sexagenary(10), annual: sexagenary(20) }, TRANSPARENT_BASELINE_MODEL);
    expect(dynamic.ok).toBe(true);
    if (!dynamic.ok) return;
    const normal = resolveReferenceNormalForm(dynamic.value, TRANSPARENT_BASELINE_MODEL);
    expect(normal.ok).toBe(true);
    if (!normal.ok) return;
    const female = materializeKinshipProjection(normal.value, "female");
    const male = materializeKinshipProjection(normal.value, "male");
    expect(female.roles.find((role) => role.id === "partner")?.primaryTenGods).toEqual(["正官", "七杀"]);
    expect(male.roles.find((role) => role.id === "partner")?.primaryTenGods).toEqual(["正财", "偏财"]);
  });
});
