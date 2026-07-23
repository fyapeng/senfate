import type { ClosedResult, FiniteSignedMeasure } from "./algebra";
import type { DynamicStrength } from "./lifecycle";
import type { SenFateModelProfile, PillarPosition } from "./model";
import { BRANCH_DEFINITIONS, ELEMENTS, STEM_DEFINITIONS, tenGod, type Branch, type Element, type Stem, type TenGod } from "./ontology";
import type { ReferenceNormalFormPhaseResult } from "./resolution";
import { evaluateDayMasterStrength, type FourPillarState, type StrengthEvaluation } from "./structure";
import { evaluateRuleDrivenPatterns, type PatternEvaluationContext, type PatternSourceEvidence } from "./pattern-evaluator";

export type PatternCandidateStatus = "qualified" | "contested" | "candidate";
export interface PatternCandidate {
  readonly stem: string;
  readonly tenGod: TenGod;
  readonly rank: "main" | "middle" | "residual";
  readonly exposed: boolean;
  readonly rootMass: number;
  readonly score: number;
  readonly status: PatternCandidateStatus;
}

export interface PatternProjection {
  readonly schema: "senfate-pattern-projection.v3";
  readonly status: "qualified" | "contested" | "unqualified";
  readonly commandStem?: Stem;
  readonly candidates: readonly PatternCandidate[];
  readonly primaryConclusionId?: string;
  readonly conclusions: readonly PatternConclusion[];
}

export type PatternConclusionStatus = "qualified" | "contested" | "candidate" | "broken";
export type PatternFamily = "regular" | "special" | "follow" | "transform";
export interface PatternConclusion {
  readonly id: string;
  readonly label: string;
  readonly family: PatternFamily;
  readonly status: PatternConclusionStatus;
  readonly evidence: readonly string[];
  readonly unmetConditions: readonly string[];
  readonly sourceEvidence?: readonly PatternSourceEvidence[];
}

export interface ClimateCoordinate {
  readonly schema: "senfate-climate-coordinate.v1";
  readonly temperature: number;
  readonly humidity: number;
  readonly temperatureState: "cold" | "balanced" | "hot";
  readonly humidityState: "dry" | "balanced" | "humid";
  readonly components: Readonly<{
    seasonalTemperature: number;
    seasonalHumidity: number;
    elementTemperature: number;
    elementHumidity: number;
  }>;
}

export type BalancingStatus = "supportive" | "neutral" | "avoid";
export interface BalancingCandidate {
  readonly element: Element;
  readonly score: number;
  readonly status: BalancingStatus;
  readonly strengthContribution: number;
  readonly climateContribution: number;
  readonly confidence: number;
}
export interface BalancingProjection {
  readonly schema: "senfate-balancing-projection.v1";
  readonly candidates: readonly BalancingCandidate[];
}

export interface InterpretiveModelResult {
  readonly schema: "senfate-interpretive-model.v2";
  readonly model: string;
  readonly pattern: PatternProjection;
  readonly climate: ClimateCoordinate;
  readonly balancing: BalancingProjection;
}

export type InterpretiveModelFailure = "invalid-normal-form" | "invalid-profile" | "zero-measure";
const POSITIONS: readonly PillarPosition[] = ["year", "month", "day", "hour"];
const GENERATES: Readonly<Record<Element, Element>> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CONTROLS: Readonly<Record<Element, Element>> = { 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" };
const TEMPERATURE_BASE = { 子: -1, 丑: -.8, 寅: -.45, 卯: -.15, 辰: .1, 巳: .65, 午: 1, 未: .75, 申: .3, 酉: .05, 戌: -.15, 亥: -.7 } as const;
const HUMIDITY_BASE = { 子: .75, 丑: .45, 寅: .25, 卯: .35, 辰: .55, 巳: -.15, 午: -.45, 未: -.35, 申: -.2, 酉: -.35, 戌: -.55, 亥: .65 } as const;
const PROSPERITY_BRANCH: Readonly<Record<Stem, Branch>> = { 甲:"寅",乙:"卯",丙:"巳",丁:"午",戊:"巳",己:"午",庚:"申",辛:"酉",壬:"亥",癸:"子" };
const BLADE_BRANCH: Readonly<Record<Stem, Branch>> = { 甲:"卯",乙:"辰",丙:"午",丁:"未",戊:"午",己:"未",庚:"酉",辛:"戌",壬:"子",癸:"丑" };
const REGULAR_PATTERN_LABEL: Readonly<Partial<Record<TenGod,string>>> = { 食神:"食神格",伤官:"伤官格",偏财:"偏财格",正财:"正财格",七杀:"七杀格",正官:"正官格",偏印:"偏印格",正印:"正印格" };
const SUPPORTING_TEN_GODS: ReadonlySet<TenGod> = new Set(["比肩","劫财","正印","偏印"]);

function inverse(mapping: Readonly<Record<Element, Element>>, target: Element): Element {
  return ELEMENTS.find((element) => mapping[element] === target)!;
}

function rounded(value: number): number {
  return Number(value.toFixed(6));
}

export function evaluatePatternProjection(pillars: FourPillarState, strength: StrengthEvaluation, model: SenFateModelProfile, normalForm?: ReferenceNormalFormPhaseResult, context?: PatternEvaluationContext): PatternProjection {
  const dayStem = pillars.day.stem;
  const visibleStems = POSITIONS.filter((position) => position !== "day").map((position) => pillars[position].stem);
  // 参数化候选（保留作为审计信息与兜底）
  const candidates = BRANCH_DEFINITIONS[pillars.month.branch].hiddenStems.map((hidden) => {
    const exposed = visibleStems.includes(hidden.stem);
    let rootMass = 0;
    for (const position of POSITIONS) {
      const occurrence = BRANCH_DEFINITIONS[pillars[position].branch].hiddenStems.find((item) => item.stem === hidden.stem);
      if (occurrence) rootMass += model.elementMeasure.visiblePosition[position] * model.elementMeasure.hiddenRank[occurrence.rank];
    }
    const score = model.elementMeasure.hiddenRank[hidden.rank] * model.pattern.monthCommand
      + (exposed ? model.pattern.exposure : 0)
      + rootMass * model.pattern.rootedness;
    return { stem: hidden.stem, tenGod: tenGod(dayStem, hidden.stem), rank: hidden.rank, exposed, rootMass: rounded(rootMass), score: rounded(score), status: "candidate" as PatternCandidateStatus };
  }).sort((a, b) => b.score - a.score || a.stem.localeCompare(b.stem));
  const top = candidates[0]?.score ?? 0;
  const second = candidates[1]?.score ?? Number.NEGATIVE_INFINITY;
  const monthCommandStatus: PatternProjection["status"] = top < model.pattern.qualificationThreshold
    ? "unqualified"
    : top - second <= model.pattern.conflictMargin ? "contested" : "qualified";
  const rankedCandidates = candidates.map((candidate, index) => ({
    ...candidate,
    status: index === 0 && monthCommandStatus === "qualified" ? "qualified" as const : candidate.score >= top - model.pattern.conflictMargin ? "contested" as const : "candidate" as const,
  }));

  // 规则驱动判定（子平法口径）：当 normalForm 与 context 可用时，优先使用
  let ruleConclusions: PatternConclusion[] = [];
  let ruleCommandStem: Stem | undefined;
  if (normalForm && normalForm.status === "stable" && context) {
    const ruleResult = evaluateRuleDrivenPatterns(pillars, strength, normalForm, context);
    ruleCommandStem = ruleResult.commandStem;
    ruleConclusions = ruleResult.conclusions.map((conclusion): PatternConclusion => ({
      id: conclusion.id,
      label: conclusion.label,
      family: conclusion.family,
      status: conclusion.status,
      evidence: conclusion.evidence,
      unmetConditions: conclusion.unmetConditions,
      ...(conclusion.sourceEvidence.length > 0 ? { sourceEvidence: conclusion.sourceEvidence } : {}),
    }));
  }

  // 若规则驱动无结论（兜底），回退到参数化投影
  const conclusions: PatternConclusion[] = ruleConclusions.length > 0 ? ruleConclusions : buildFallbackConclusions(pillars, rankedCandidates, dayStem, strength, model);

  const priority = (item: PatternConclusion): number => {
    const statusOrder = item.status === "qualified" ? 0 : item.status === "contested" ? 1 : item.status === "candidate" ? 2 : 3;
    const familyOrder = item.family === "follow" ? 0 : item.family === "special" ? 1 : item.family === "regular" ? 2 : 3;
    return statusOrder * 10 + familyOrder;
  };
  conclusions.sort((a,b) => priority(a) - priority(b) || a.id.localeCompare(b.id));
  const primary = conclusions[0];
  const projectionStatus: PatternProjection["status"] = primary?.status === "qualified" ? "qualified" : primary?.status === "contested" ? "contested" : "unqualified";
  return {
    schema: "senfate-pattern-projection.v3",
    status: projectionStatus,
    ...(ruleCommandStem ? { commandStem: ruleCommandStem } : {}),
    candidates: rankedCandidates,
    ...(primary ? { primaryConclusionId: primary.id } : {}),
    conclusions,
  };
}

/** 参数化兜底结论（当规则驱动引擎不可用时使用，保证向后兼容）。 */
function buildFallbackConclusions(pillars: FourPillarState, rankedCandidates: readonly PatternCandidate[], dayStem: Stem, strength: StrengthEvaluation, model: SenFateModelProfile): PatternConclusion[] {
  const conclusions: PatternConclusion[] = [];
  for (const candidate of rankedCandidates) {
    const label = REGULAR_PATTERN_LABEL[candidate.tenGod];
    if (!label) continue;
    conclusions.push({
      id: `regular.${candidate.tenGod}`,
      label,
      family: "regular",
      status: candidate.status,
      evidence: [`month.hidden.${candidate.rank}:${candidate.stem}`, candidate.exposed ? `visible:${candidate.stem}` : "not-exposed", `rootMass=${candidate.rootMass}`, `score=${candidate.score}`],
      unmetConditions: candidate.status === "candidate" ? ["月令、透干与通根综合分值尚未达到成格阈值（参数化兜底，未启用规则驱动）"] : [],
    });
  }
  const monthBranch = pillars.month.branch;
  if (monthBranch === PROSPERITY_BRANCH[dayStem]) conclusions.push({
    id: "special.established-prosperity", label: "建禄格", family: "special", status: "qualified",
    evidence: [`dayStem=${dayStem}`, `monthBranch=${monthBranch}`, "monthBranch=dayMaster.prosperity", "参数化兜底"], unmetConditions: [],
  });
  if (monthBranch === BLADE_BRANCH[dayStem]) {
    const yangDay = STEM_DEFINITIONS[dayStem].polarity === "阳";
    conclusions.push({
      id: "special.yang-blade", label: "羊刃格", family: "special", status: yangDay ? "qualified" : "contested",
      evidence: [`dayStem=${dayStem}`, `monthBranch=${monthBranch}`, "monthBranch=dayMaster.blade", "参数化兜底"],
      unmetConditions: yangDay ? [] : ["阴干羊刃的取法存在流派分歧，暂不作单一口径定论"],
    });
  }
  return conclusions;
}

export function evaluateClimateCoordinate(pillars: FourPillarState, measure: FiniteSignedMeasure<Element>, model: SenFateModelProfile): ClosedResult<ClimateCoordinate, "zero-measure"> {
  if (!(measure.total > 0)) return { ok: false, code: "zero-measure", reason: "Climate projection requires a positive finite element measure", certificate: { functional: "structure.climate" } };
  const share = (element: Element): number => measure.atoms[element] / measure.total;
  const seasonalTemperature = TEMPERATURE_BASE[pillars.month.branch] * model.climate.seasonalCommand;
  const seasonalHumidity = HUMIDITY_BASE[pillars.month.branch] * model.climate.seasonalCommand;
  const elementTemperature = (share("火") - share("水")) * model.climate.temperature;
  const elementHumidity = (share("水") + .5 * share("木") - share("金") - .25 * share("土")) * model.climate.humidity;
  const temperature = rounded(seasonalTemperature + elementTemperature);
  const humidity = rounded(seasonalHumidity + elementHumidity);
  return { ok: true, value: { schema: "senfate-climate-coordinate.v1", temperature, humidity, temperatureState: temperature < -.25 ? "cold" : temperature > .25 ? "hot" : "balanced", humidityState: humidity < -.25 ? "dry" : humidity > .25 ? "humid" : "balanced", components: { seasonalTemperature: rounded(seasonalTemperature), seasonalHumidity: rounded(seasonalHumidity), elementTemperature: rounded(elementTemperature), elementHumidity: rounded(elementHumidity) } }, certificate: { functional: "structure.climate", model: `${model.id}@${model.version}`, monthBranch: pillars.month.branch } };
}

export function evaluateBalancingProjection(pillars: FourPillarState, strength: DynamicStrength | StrengthEvaluation, climate: ClimateCoordinate, normalForm: ReferenceNormalFormPhaseResult, model: SenFateModelProfile): ClosedResult<BalancingProjection, "invalid-normal-form"> {
  if (normalForm.status !== "stable") return { ok: false, code: "invalid-normal-form", reason: "Balancing projection only accepts a stable reference normal form", certificate: { functional: "structure.balancing" } };
  const dayElement = STEM_DEFINITIONS[pillars.day.stem].element;
  const resource = inverse(GENERATES, dayElement);
  const output = GENERATES[dayElement];
  const wealth = CONTROLS[dayElement];
  const officer = inverse(CONTROLS, dayElement);
  const imbalance = .5 - strength.supportRatio;
  const strengthVector: Record<Element, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  strengthVector[dayElement] += imbalance;
  strengthVector[resource] += imbalance;
  strengthVector[output] -= imbalance;
  strengthVector[wealth] -= imbalance;
  strengthVector[officer] -= imbalance;
  const climateVector: Record<Element, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  climateVector.火 -= climate.temperature;
  climateVector.水 += climate.temperature;
  climateVector.水 -= climate.humidity * .6;
  climateVector.木 -= climate.humidity * .4;
  climateVector.土 += climate.humidity * .6;
  climateVector.金 += climate.humidity * .4;
  const contested = normalForm.relations.filter((item) => item.status === "contested").length;
  const confidence = rounded(Math.max(0, 1 - contested / Math.max(1, normalForm.relations.length) * model.balancing.relationStability));
  const candidates = ELEMENTS.map((element) => {
    const strengthContribution = strengthVector[element] * model.balancing.strength;
    const climateContribution = climateVector[element] * model.balancing.climate;
    const score = rounded((strengthContribution + climateContribution) * confidence);
    return { element, score, status: score >= model.balancing.decisionThreshold ? "supportive" as const : score <= -model.balancing.decisionThreshold ? "avoid" as const : "neutral" as const, strengthContribution: rounded(strengthContribution), climateContribution: rounded(climateContribution), confidence };
  }).sort((a, b) => b.score - a.score || a.element.localeCompare(b.element));
  return { ok: true, value: { schema: "senfate-balancing-projection.v1", candidates }, certificate: { functional: "structure.balancing", model: `${model.id}@${model.version}`, normalFormFingerprint: normalForm.fingerprint, inputs: ["strength", "climate", "stable-normal-form"] } };
}

export function evaluateInterpretiveModel(pillars: FourPillarState, strength: DynamicStrength | StrengthEvaluation, measure: FiniteSignedMeasure<Element>, normalForm: ReferenceNormalFormPhaseResult, model: SenFateModelProfile, patternContext?: PatternEvaluationContext): ClosedResult<InterpretiveModelResult, InterpretiveModelFailure> {
  if (normalForm.status !== "stable") return { ok: false, code: "invalid-normal-form", reason: "Interpretive projection only accepts a stable reference normal form", certificate: { functional: "analysis.interpretive-model" } };
  const natalStrength = evaluateDayMasterStrength(pillars,model);
  if (!natalStrength.ok) return natalStrength;
  const climate = evaluateClimateCoordinate(pillars, measure, model);
  if (!climate.ok) return climate;
  const balancing = evaluateBalancingProjection(pillars, strength, climate.value, normalForm, model);
  if (!balancing.ok) return balancing;
  return { ok: true, value: { schema: "senfate-interpretive-model.v2", model: `${model.id}@${model.version}`, pattern: evaluatePatternProjection(pillars, natalStrength.value, model, normalForm, patternContext), climate: climate.value, balancing: balancing.value }, certificate: { functional: "analysis.interpretive-model", model: `${model.id}@${model.version}`, normalFormFingerprint: normalForm.fingerprint, upstream: { patternStrength:natalStrength.certificate, climate: climate.certificate, balancing: balancing.certificate } } };
}
