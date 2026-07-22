import type { ClosedResult } from "./algebra";
import type { MajorLuckPeriod } from "./calendar";
import { BRANCH_DEFINITIONS, tenGod, type GanZhi, type TenGod } from "./ontology";
import type { ReferenceNormalFormPhaseResult } from "./resolution";
import { sexagenary } from "./ontology";

export interface AnnualContext {
  readonly schema: "senfate-annual-context.v1";
  readonly targetYear: number;
  readonly convention: "certified-lichun-instant";
  readonly boundaryUtcMs:number;
  readonly annualPillar: GanZhi;
  readonly luckPeriod: MajorLuckPeriod;
}
export type AnnualContextFailure = "invalid-target-year" | "target-before-major-luck" | "target-after-major-luck-range"|"luck-boundary-ambiguous";

export function resolveAnnualContext(targetYear: number, boundaryUtcMs:number,periods: readonly MajorLuckPeriod[]): ClosedResult<AnnualContext, AnnualContextFailure> {
  const certificate = { functional: "calendar.annual-context", convention: "certified-lichun-instant", targetYear,boundaryUtcMs } as const;
  if (!Number.isInteger(targetYear) || targetYear < 1900 || targetYear > 2035||!Number.isFinite(boundaryUtcMs)) return { ok: false, code: "invalid-target-year", reason: "Target year and certified Lichun instant must be in the 1900–2035 range", certificate };
  if(periods.some(period=>period.startUtcInterval.lower<=boundaryUtcMs&&boundaryUtcMs<=period.startUtcInterval.upper))return{ok:false,code:"luck-boundary-ambiguous",reason:"Major-luck start uncertainty overlaps the certified Lichun instant",certificate};
  const index = periods.findLastIndex((period) => period.startUtcMs <= boundaryUtcMs);
  if (index < 0) return { ok: false, code: "target-before-major-luck", reason: "Target year precedes the first requested major-luck period", certificate };
  const luckPeriod = periods[index];
  if (!luckPeriod) return { ok: false, code: "target-after-major-luck-range", reason: "Target year is outside the requested major-luck range", certificate };
  const next = periods[index + 1];
  if (!next && boundaryUtcMs >= luckPeriod.startUtcMs + 10 * 365.2425 * 86_400_000) return { ok: false, code: "target-after-major-luck-range", reason: "Target year is outside the requested major-luck range", certificate };
  return { ok: true, value: { schema: "senfate-annual-context.v1", targetYear, convention: "certified-lichun-instant",boundaryUtcMs, annualPillar: sexagenary(targetYear - 1984), luckPeriod }, certificate: { ...certificate, luckOrdinal: luckPeriod.ordinal, annualPillar: sexagenary(targetYear - 1984) } };
}

export type KinshipRoleId = "self" | "peers" | "mother" | "father" | "partner" | "children";
export interface KinshipRole {
  readonly id: KinshipRoleId;
  readonly label: string;
  readonly primaryTenGods: readonly TenGod[];
  readonly observedCount: number;
  readonly observedTenGods: readonly TenGod[];
}
export interface KinshipProjection {
  readonly schema: "senfate-kinship-projection.v1";
  readonly sex: "female" | "male";
  readonly phase: ReferenceNormalFormPhaseResult["phase"];
  readonly roles: readonly KinshipRole[];
  readonly normalFormFingerprint: string;
}

export function materializeKinshipProjection(normalForm: ReferenceNormalFormPhaseResult, sex: "female" | "male"): KinshipProjection {
  const dayStem = normalForm.dynamicState.natal.day.stem;
  const observed = normalForm.dynamicState.pillars.flatMap((item) => [tenGod(dayStem, item.pillar.stem), ...BRANCH_DEFINITIONS[item.pillar.branch].hiddenStems.map((hidden) => tenGod(dayStem, hidden.stem))]);
  const definitions: readonly Readonly<{ id: KinshipRoleId; label: string; primaryTenGods: readonly TenGod[] }>[] = [
    { id: "self", label: "自身", primaryTenGods: ["比肩"] },
    { id: "peers", label: "同辈与手足", primaryTenGods: ["比肩", "劫财"] },
    { id: "mother", label: "母系照料者", primaryTenGods: ["正印", "偏印"] },
    { id: "father", label: "父系资源者", primaryTenGods: ["偏财", "正财"] },
    { id: "partner", label: "伴侣角色", primaryTenGods: sex === "male" ? ["正财", "偏财"] : ["正官", "七杀"] },
    { id: "children", label: "子女角色", primaryTenGods: sex === "male" ? ["正官", "七杀"] : ["食神", "伤官"] },
  ];
  return { schema: "senfate-kinship-projection.v1", sex, phase: normalForm.phase, normalFormFingerprint: normalForm.fingerprint, roles: definitions.map((definition) => { const observedTenGods = observed.filter((item) => definition.primaryTenGods.includes(item)); return { ...definition, observedCount: observedTenGods.length, observedTenGods }; }) };
}
