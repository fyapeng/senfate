import type { ClosedResult } from "./algebra";
import type { MajorLuckPeriod } from "./calendar";
import { BRANCH_DEFINITIONS, tenGod, type GanZhi, type TenGod } from "./ontology";
import type { ReferenceNormalFormPhaseResult } from "./resolution";
import { sexagenary } from "./ontology";
import type { SenFateModelProfile } from "./model";

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
  if (!Number.isInteger(targetYear) || targetYear < 1850 || targetYear > 2150||!Number.isFinite(boundaryUtcMs)) return { ok: false, code: "invalid-target-year", reason: "Target year and certified Lichun instant must be in the 1850–2150 range", certificate };
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
export type KinshipVisibility = "absent" | "latent" | "visible";
export interface KinshipEvidenceAtom {
  readonly pillarId: string;
  readonly layer: "natal" | "luck" | "annual" | "month";
  readonly position: "year" | "month" | "day" | "hour" | "period";
  readonly stem: string;
  readonly tenGod: TenGod;
  readonly source: "visible-stem" | "hidden-stem";
  readonly hiddenRank?: "main" | "middle" | "residual";
  readonly weight: number;
}
export interface KinshipLayerExposure {
  readonly observedCount: number;
  readonly weightedExposure: number;
}
export interface KinshipRole {
  readonly id: KinshipRoleId;
  readonly label: string;
  readonly primaryTenGods: readonly TenGod[];
  readonly observedCount: number;
  readonly observedTenGods: readonly TenGod[];
  readonly visibleCount: number;
  readonly hiddenCount: number;
  readonly weightedExposure: number;
  readonly visibility: KinshipVisibility;
  readonly layerExposure: Readonly<Record<"natal" | "luck" | "annual" | "month", KinshipLayerExposure>>;
  readonly evidence: readonly KinshipEvidenceAtom[];
}
export interface KinshipProjection {
  readonly schema: "senfate-kinship-projection.v2";
  readonly sex: "female" | "male";
  readonly phase: ReferenceNormalFormPhaseResult["phase"];
  readonly roles: readonly KinshipRole[];
  readonly normalFormFingerprint: string;
  readonly model: string;
}
export type KinshipProjectionFailure = "model-mismatch";

export function materializeKinshipProjection(normalForm: ReferenceNormalFormPhaseResult, sex: "female" | "male", model: SenFateModelProfile): ClosedResult<KinshipProjection, KinshipProjectionFailure> {
  const modelId = `${model.id}@${model.version}`;
  const certificate = { functional: "semantic.kinship", normalFormFingerprint: normalForm.fingerprint, phase: normalForm.phase, sex, model: modelId } as const;
  if (normalForm.model !== modelId) return { ok: false, code: "model-mismatch", reason: "Kinship projection model must match the stable normal form model", certificate };
  const dayStem = normalForm.dynamicState.natal.day.stem;
  const evidence: KinshipEvidenceAtom[] = normalForm.dynamicState.pillars.flatMap((item) => [
    { pillarId: item.id, layer: item.layer, position: item.position, stem: item.pillar.stem, tenGod: tenGod(dayStem, item.pillar.stem), source: "visible-stem" as const, weight: item.weight },
    ...BRANCH_DEFINITIONS[item.pillar.branch].hiddenStems.map((hidden) => ({ pillarId: item.id, layer: item.layer, position: item.position, stem: hidden.stem, tenGod: tenGod(dayStem, hidden.stem), source: "hidden-stem" as const, hiddenRank: hidden.rank, weight: item.weight * model.elementMeasure.hiddenRank[hidden.rank] })),
  ]);
  const definitions: readonly Readonly<{ id: KinshipRoleId; label: string; primaryTenGods: readonly TenGod[] }>[] = [
    { id: "self", label: "自身", primaryTenGods: ["比肩"] },
    { id: "peers", label: "同辈与手足", primaryTenGods: ["比肩", "劫财"] },
    { id: "mother", label: "母系照料者", primaryTenGods: ["正印", "偏印"] },
    { id: "father", label: "父系资源者", primaryTenGods: ["偏财", "正财"] },
    { id: "partner", label: "伴侣角色", primaryTenGods: sex === "male" ? ["正财", "偏财"] : ["正官", "七杀"] },
    { id: "children", label: "子女角色", primaryTenGods: sex === "male" ? ["正官", "七杀"] : ["食神", "伤官"] },
  ];
  const layers = ["natal", "luck", "annual", "month"] as const;
  const roles = definitions.map((definition): KinshipRole => {
    const observed = evidence.filter((item) => definition.primaryTenGods.includes(item.tenGod));
    const visibleCount = observed.filter((item) => item.source === "visible-stem").length;
    const hiddenCount = observed.length - visibleCount;
    const weightedExposure = observed.reduce((sum, item) => sum + item.weight, 0);
    const layerExposure = Object.fromEntries(layers.map((layer) => {
      const items = observed.filter((item) => item.layer === layer);
      return [layer, { observedCount: items.length, weightedExposure: items.reduce((sum, item) => sum + item.weight, 0) }];
    })) as Record<(typeof layers)[number], KinshipLayerExposure>;
    return { ...definition, observedCount: observed.length, observedTenGods: observed.map((item) => item.tenGod), visibleCount, hiddenCount, weightedExposure, visibility: visibleCount > 0 ? "visible" : hiddenCount > 0 ? "latent" : "absent", layerExposure, evidence: observed };
  });
  return { ok: true, value: { schema: "senfate-kinship-projection.v2", sex, phase: normalForm.phase, normalFormFingerprint: normalForm.fingerprint, model: modelId, roles }, certificate: { ...certificate, roleCount: roles.length, evidenceAtoms: evidence.length, overlappingRoles: ["self", "peers"] } };
}

export type SpecialStateCode = "luck-annual-repeat" | "phase-very-weak" | "phase-very-strong" | "natal-seven-supportive" | "natal-seven-pressuring";
export interface SpecialStateSignal {
  readonly code: SpecialStateCode;
  readonly label: string;
  readonly scope: "natal" | "luck" | "annual";
  readonly evidence: readonly string[];
}
export interface SpecialStateCertificate {
  readonly schema: "senfate-special-state-certificate.v1";
  readonly phase: ReferenceNormalFormPhaseResult["phase"];
  readonly normalFormFingerprint: string;
  readonly natalSevenSymbolConsensus: Readonly<{ status: "all-support" | "all-pressure" | "mixed"; supportCount: number; pressureCount: number; total: 7 }>;
  readonly signals: readonly SpecialStateSignal[];
}

const SUPPORTING_TEN_GODS: ReadonlySet<TenGod> = new Set(["比肩", "劫财", "正印", "偏印"]);
function samePillar(left:GanZhi,right:GanZhi):boolean{return left.stem===right.stem&&left.branch===right.branch}

export function materializeSpecialStateCertificate(normalForm:ReferenceNormalFormPhaseResult):SpecialStateCertificate{
  const state=normalForm.dynamicState;const dayStem=state.natal.day.stem;
  const representatives=[
    ["natal.year.stem",state.natal.year.stem],["natal.month.stem",state.natal.month.stem],["natal.hour.stem",state.natal.hour.stem],
    ...(["year","month","day","hour"] as const).map(position=>[`natal.${position}.branch-main`,BRANCH_DEFINITIONS[state.natal[position].branch].hiddenStems.find(hidden=>hidden.rank==="main")!.stem] as const),
  ] as const;
  const classified=representatives.map(([id,stem])=>({id,tenGod:tenGod(dayStem,stem),support:SUPPORTING_TEN_GODS.has(tenGod(dayStem,stem))}));
  const supportCount=classified.filter(item=>item.support).length;const pressureCount=classified.length-supportCount;
  const consensus:SpecialStateCertificate["natalSevenSymbolConsensus"]={status:supportCount===7?"all-support":pressureCount===7?"all-pressure":"mixed",supportCount,pressureCount,total:7};
  const signals:SpecialStateSignal[]=[];
  if(state.luck&&state.annual&&samePillar(state.luck,state.annual))signals.push({code:"luck-annual-repeat",label:"岁运并临",scope:"annual",evidence:["luck.period","annual.period"]});
  if(state.strength.state==="very-weak")signals.push({code:"phase-very-weak",label:"阶段极弱",scope:state.phase,evidence:[`supportRatio=${state.strength.supportRatio}`]});
  if(state.strength.state==="very-strong")signals.push({code:"phase-very-strong",label:"阶段极强",scope:state.phase,evidence:[`supportRatio=${state.strength.supportRatio}`]});
  if(consensus.status==="all-support")signals.push({code:"natal-seven-supportive",label:"原局七字生助同向候选",scope:"natal",evidence:classified.map(item=>`${item.id}:${item.tenGod}`)});
  if(consensus.status==="all-pressure")signals.push({code:"natal-seven-pressuring",label:"原局七字克泄耗同向候选",scope:"natal",evidence:classified.map(item=>`${item.id}:${item.tenGod}`)});
  return{schema:"senfate-special-state-certificate.v1",phase:normalForm.phase,normalFormFingerprint:normalForm.fingerprint,natalSevenSymbolConsensus:consensus,signals};
}
