import { describe, expect, it } from "vitest";
import { materializeDynamicChartState } from "./lifecycle";
import { TRANSPARENT_BASELINE_MODEL } from "./model";
import { resolveReferenceNormalForm } from "./resolution";
import { materializeKinshipProjection, materializeSpecialStateCertificate, resolveAnnualContext } from "./semantic";
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
    const female = materializeKinshipProjection(normal.value, "female", TRANSPARENT_BASELINE_MODEL);
    const male = materializeKinshipProjection(normal.value, "male", TRANSPARENT_BASELINE_MODEL);
    expect(female.ok).toBe(true);
    expect(male.ok).toBe(true);
    if (!female.ok || !male.ok) return;
    expect(female.value.roles.find((role) => role.id === "partner")?.primaryTenGods).toEqual(["正官", "七杀"]);
    expect(male.value.roles.find((role) => role.id === "partner")?.primaryTenGods).toEqual(["正财", "偏财"]);
    const peer = female.value.roles.find((role) => role.id === "peers")!;
    expect(peer.observedCount).toBe(peer.visibleCount + peer.hiddenCount);
    expect(peer.weightedExposure).toBeCloseTo(Object.values(peer.layerExposure).reduce((sum, layer) => sum + layer.weightedExposure, 0));
    expect(peer.evidence.every((item) => item.layer === "natal" || item.layer === "luck" || item.layer === "annual")).toBe(true);
    expect(female.value.normalFormFingerprint).toBe(normal.value.fingerprint);
  });

  it("fails closed when kinship weights do not match the normal-form model", () => {
    const natal = { year: sexagenary(0), month: sexagenary(2), day: sexagenary(4), hour: sexagenary(6) };
    const dynamic = materializeDynamicChartState({ natal, luck: sexagenary(10), annual: sexagenary(20) }, TRANSPARENT_BASELINE_MODEL);
    expect(dynamic.ok).toBe(true);
    if (!dynamic.ok) return;
    const normal = resolveReferenceNormalForm(dynamic.value, TRANSPARENT_BASELINE_MODEL);
    expect(normal.ok).toBe(true);
    if (!normal.ok) return;
    const mismatched = { ...TRANSPARENT_BASELINE_MODEL, id: "mismatched" };
    expect(materializeKinshipProjection(normal.value, "female", mismatched)).toMatchObject({ ok: false, code: "model-mismatch" });
  });

  it("certifies same luck-year and seven-symbol support consensus without naming a final pattern",()=>{
    const natal={year:sexagenary(0),month:sexagenary(11),day:sexagenary(50),hour:sexagenary(39)};
    const repeated=sexagenary(42);
    const dynamic=materializeDynamicChartState({natal,luck:repeated,annual:repeated},TRANSPARENT_BASELINE_MODEL);expect(dynamic.ok).toBe(true);if(!dynamic.ok)return;
    const normal=resolveReferenceNormalForm(dynamic.value,TRANSPARENT_BASELINE_MODEL);expect(normal.ok).toBe(true);if(!normal.ok)return;
    const certificate=materializeSpecialStateCertificate(normal.value);
    expect(certificate.natalSevenSymbolConsensus).toEqual({status:"all-support",supportCount:7,pressureCount:0,total:7});
    expect(certificate.signals.map(signal=>signal.code)).toEqual(expect.arrayContaining(["luck-annual-repeat","natal-seven-supportive"]));
    expect(certificate.signals.every(signal=>!signal.label.includes("从"))).toBe(true);
  });
});
