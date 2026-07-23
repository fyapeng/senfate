import type {
  ApiAnalysisRequest,
  ApiAnalysisResponse,
  ApiAnnualTrajectory,
  ApiModelId,
} from "@senfate/contracts";
import { baziMonthPillar,type MajorLuckPeriod } from "@senfate/core/calendar";
import { evaluateInterpretiveModel } from "@senfate/core/interpretation";
import { applyPublicModelOverrides,CLIMATE_PRIORITY_MODEL,MONTH_COMMAND_MODEL,TRANSPARENT_BASELINE_MODEL,type SenFateModelProfile } from "@senfate/core/model";
import { sexagenary,type GanZhi } from "@senfate/core/ontology";
import type { ReferenceNormalFormPhaseResult } from "@senfate/core/resolution";
import { materializeKinshipProjection,materializeSpecialStateCertificate,resolveAnnualContext } from "@senfate/core/semantic";
import type { FourPillarState } from "@senfate/core/structure";
import { SOLAR_TERM_ENTRIES } from "@senfate/ephemeris/table";
import type { CompiledReferenceRecord } from "@senfate/rules/compiler";
import { ReferenceCalculationRuntime } from "@senfate/rules/runtime";

const MODELS: Readonly<Record<ApiModelId, SenFateModelProfile>> = {
  "transparent-baseline": TRANSPARENT_BASELINE_MODEL,
  "month-command": MONTH_COMMAND_MODEL,
  "climate-priority": CLIMATE_PRIORITY_MODEL,
};
const LICHUN_BY_YEAR = new Map(
  SOLAR_TERM_ENTRIES
    .filter((term) => term.longitude === 315)
    .map((term) => [new Date(term.utcMs).getUTCFullYear(), term.utcMs]),
);
const JIE_MONTH_ORDINAL: Readonly<Record<number, number>> = {
  315: 0, 345: 1, 15: 2, 45: 3, 75: 4, 105: 5,
  135: 6, 165: 7, 195: 8, 225: 9, 255: 10, 285: 11,
};

function modelFor(request: ApiAnalysisRequest): SenFateModelProfile {
  return applyPublicModelOverrides(
    MODELS[request.modelId ?? "transparent-baseline"],
    request.modelOverrides ?? {},
  ).profile;
}

function monthOrdinals(year: number): readonly number[] {
  const start = LICHUN_BY_YEAR.get(year);
  const end = LICHUN_BY_YEAR.get(year + 1);
  if (start === undefined || end === undefined) return [];
  return SOLAR_TERM_ENTRIES
    .filter((term) => term.kind === "jie" && term.utcMs >= start && term.utcMs < end)
    .map((term) => JIE_MONTH_ORDINAL[term.longitude])
    .filter((ordinal): ordinal is number => ordinal !== undefined);
}

function apiRelations(normalForm: ReferenceNormalFormPhaseResult) {
  return normalForm.relations.map((relation) => ({
    id: relation.id,
    kind: relation.candidate.kind,
    members: relation.candidate.members,
    ...(relation.candidate.targetElement ? { targetElement: relation.candidate.targetElement } : {}),
    status: relation.status,
    score: relation.score,
    competingIds: relation.competingIds,
  }));
}

function canonicalGanZhi(value: Readonly<{ stem: string; branch: string; index: number }>): GanZhi {
  const canonical = sexagenary(value.index);
  if (canonical.stem !== value.stem || canonical.branch !== value.branch) throw new Error("invalid-api-ganzhi");
  return canonical;
}

type BrowserAnalysisBase = Readonly<{calendar:Pick<ApiAnalysisResponse["calendar"],"pillars"|"majorLuck"|"direction">}>;

function canonicalNatal(base: BrowserAnalysisBase): FourPillarState {
  return {
    year: canonicalGanZhi(base.calendar.pillars.year),
    month: canonicalGanZhi(base.calendar.pillars.month),
    day: canonicalGanZhi(base.calendar.pillars.day),
    hour: canonicalGanZhi(base.calendar.pillars.hour),
  };
}

function canonicalLuck(base: BrowserAnalysisBase): readonly MajorLuckPeriod[] {
  return base.calendar.majorLuck.map((period) => ({ ...period, pillar: canonicalGanZhi(period.pillar) }));
}

export interface BrowserAnalysisContext {
  readonly request: ApiAnalysisRequest;
  readonly base: BrowserAnalysisBase;
  readonly records: readonly CompiledReferenceRecord[];
}

function runtimeFor(context: BrowserAnalysisContext) {
  const model = modelFor(context.request);
  return {
    model,
    runtime: new ReferenceCalculationRuntime(context.records, model),
  };
}

export function calculateBrowserTrajectoryYear(
  context: BrowserAnalysisContext,
  year: number,
): ApiAnnualTrajectory["points"][number] {
  const boundaryUtcMs = LICHUN_BY_YEAR.get(year);
  if (boundaryUtcMs === undefined) {
    return { status: "unavailable", year, boundaryUtcMs: 0, failureCode: "annual-boundary-unavailable", reason: "Certified Lichun boundary is unavailable" };
  }
  const annualContext = resolveAnnualContext(year, boundaryUtcMs, canonicalLuck(context.base));
  if (!annualContext.ok) {
    return { status: "unavailable", year, boundaryUtcMs, failureCode: annualContext.code, reason: annualContext.reason };
  }
  const { runtime } = runtimeFor(context);
  const input = {
    natal: canonicalNatal(context.base),
    luck: annualContext.value.luckPeriod.pillar,
    annual: annualContext.value.annualPillar,
    luckDirection: context.base.calendar.direction,
    sex: context.request.sex,
  } as const;
  const annual = runtime.calculateTrajectorySample(input);
  if (!annual.ok) {
    return { status: "unavailable", year, boundaryUtcMs, failureCode: annual.code, reason: annual.reason };
  }
  const ordinals = monthOrdinals(year);
  if (ordinals.length !== 12) {
    return { status: "unavailable", year, boundaryUtcMs, failureCode: "monthly-boundary-unavailable", reason: "The certified twelve-month jie sequence is incomplete" };
  }
  const monthlyIndexes: number[] = [];
  const monthlyFingerprints: string[] = [];
  for (const ordinal of ordinals) {
    const monthly = runtime.calculateTrajectorySample({ ...input, month: baziMonthPillar(year, ordinal) });
    if (!monthly.ok) {
      return { status: "unavailable", year, boundaryUtcMs, failureCode: monthly.code, reason: monthly.reason };
    }
    const measure = monthly.value.contribution;
    monthlyIndexes.push(measure.totalVariation > 0 ? measure.total / measure.totalVariation : 0);
    monthlyFingerprints.push(monthly.value.normalForm.fingerprint);
  }
  const normalForm = annual.value.normalForm;
  const contribution = annual.value.contribution;
  const scale = contribution.totalVariation;
  const normalized = Object.values(contribution.atoms).map((item) => scale > 0 ? item / scale : 0);
  const specialStates = materializeSpecialStateCertificate(normalForm);
  return {
    status: "stable",
    year,
    boundaryUtcMs,
    annualPillar: annualContext.value.annualPillar,
    luckOrdinal: annualContext.value.luckPeriod.ordinal,
    luckPillar: annualContext.value.luckPeriod.pillar,
    strength: normalForm.dynamicState.strength.state,
    supportRatio: normalForm.dynamicState.strength.supportRatio,
    normalizedTopicIndex: scale > 0 ? contribution.total / scale : 0,
    domainRange: { lower: Math.min(0, ...normalized), upper: Math.max(0, ...normalized) },
    monthlyCandle: {
      status: "stable",
      samples: 12,
      open: monthlyIndexes[0]!,
      high: Math.max(...monthlyIndexes),
      low: Math.min(...monthlyIndexes),
      close: monthlyIndexes.at(-1)!,
      sampleFingerprints: monthlyFingerprints,
    },
    topicVector: contribution.atoms,
    activated: annual.value.activated,
    normalFormFingerprint: normalForm.fingerprint,
    specialStateCodes: specialStates.signals.map((signal) => signal.code),
  };
}

export function calculateBrowserAnnualDetail(
  context: BrowserAnalysisContext,
  year: number,
): Readonly<{
  annual: ApiAnalysisResponse["annual"];
  point: ApiAnnualTrajectory["points"][number];
  certificate: Readonly<Record<string, unknown>>;
}> {
  const boundaryUtcMs = LICHUN_BY_YEAR.get(year);
  if (boundaryUtcMs === undefined) throw new Error("annual-boundary-unavailable");
  const annualContext = resolveAnnualContext(year, boundaryUtcMs, canonicalLuck(context.base));
  if (!annualContext.ok) throw new Error(annualContext.code);
  const { model, runtime } = runtimeFor(context);
  const calculated = runtime.calculate({
    natal: canonicalNatal(context.base),
    luck: annualContext.value.luckPeriod.pillar,
    annual: annualContext.value.annualPillar,
    luckDirection: context.base.calendar.direction,
    sex: context.request.sex,
  });
  if (!calculated.ok) throw new Error(calculated.code);
  const normalForm = calculated.value.normalForm;
  const interpretation = evaluateInterpretiveModel(
    canonicalNatal(context.base),
    normalForm.dynamicState.strength,
    normalForm.dynamicState.elementMeasure,
    normalForm,
    model,
  );
  if (!interpretation.ok) throw new Error(interpretation.code);
  const kinship = materializeKinshipProjection(normalForm, context.request.sex, model);
  if (!kinship.ok) throw new Error(kinship.code);
  const specialStates = materializeSpecialStateCertificate(normalForm);
  const point = calculateBrowserTrajectoryYear(context, year);
  return {
    annual: {
      schema: "senfate-annual-analysis.v1",
      targetYear: year,
      convention: annualContext.value.convention,
      boundaryUtcMs,
      annualPillar: annualContext.value.annualPillar,
      luckOrdinal: annualContext.value.luckPeriod.ordinal,
      luckPillar: annualContext.value.luckPeriod.pillar,
      elementMeasure: normalForm.dynamicState.elementMeasure,
      strength: normalForm.dynamicState.strength,
      relations: apiRelations(normalForm),
      normalForm: {
        status: normalForm.status,
        iterations: normalForm.iterations,
        fingerprint: normalForm.fingerprint,
        trace: normalForm.trace,
      },
      interpretation: interpretation.value,
      specialStates: { ...specialStates, phase: "annual" },
      kinship: { ...kinship.value, phase: "annual" },
      topics: { ...calculated.value.topicCertificate, phase: "annual" },
    },
    point,
    certificate: {
      functional: "browser.annual-reference-analysis",
      execution: "web-worker",
      model: `${model.id}@${model.version}`,
      annualContext: annualContext.certificate,
      annualReference: calculated.certificate,
      annualInterpretation: interpretation.certificate,
      kinship: kinship.certificate,
      normalFormFingerprint: normalForm.fingerprint,
    },
  };
}
