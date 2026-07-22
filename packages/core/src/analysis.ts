import type { ClosedResult } from "./algebra";
import { materializeDynamicChartState, type DynamicStateFailure } from "./lifecycle";
import type { SenFateModelProfile, PillarPosition } from "./model";
import { BRANCH_DEFINITIONS, STEM_DEFINITIONS, tenGod, type Element, type GanZhi, type TenGod, type YinYang } from "./ontology";
import { resolveReferenceNormalForm, type ReferenceNormalFormPhaseResult } from "./resolution";
import { evaluateDayMasterStrength, type FourPillarState, type StrengthEvaluation } from "./structure";
import type { NormalFormFailure } from "./normal-form";

export interface HiddenStemAnalysis {
  readonly stem: string;
  readonly rank: "main" | "middle" | "residual";
  readonly element: Element;
  readonly polarity: YinYang;
  readonly tenGod: TenGod;
}

export interface PillarAnalysis {
  readonly position: PillarPosition;
  readonly pillar: GanZhi;
  readonly visibleElement: Element;
  readonly visiblePolarity: YinYang;
  readonly tenGod: TenGod;
  readonly hiddenStems: readonly HiddenStemAnalysis[];
}

export interface NatalStructureAnalysis {
  readonly schema: "senfate-natal-structure-analysis.v1";
  readonly model: string;
  readonly dayMaster: Readonly<{ stem: string; element: Element; polarity: YinYang }>;
  readonly pillars: Readonly<Record<PillarPosition, PillarAnalysis>>;
  readonly strength: StrengthEvaluation;
  readonly normalForm: ReferenceNormalFormPhaseResult;
}

export type NatalStructureFailure = DynamicStateFailure | NormalFormFailure | "invalid-profile" | "zero-measure";
const POSITIONS: readonly PillarPosition[] = ["year", "month", "day", "hour"];

export function analyzeNatalStructure(pillars: FourPillarState, model: SenFateModelProfile): ClosedResult<NatalStructureAnalysis, NatalStructureFailure> {
  const strength = evaluateDayMasterStrength(pillars, model);
  if (!strength.ok) return strength;
  const dynamic = materializeDynamicChartState({ natal: pillars }, model);
  if (!dynamic.ok) return dynamic;
  const normalForm = resolveReferenceNormalForm(dynamic.value, model);
  if (!normalForm.ok) return normalForm;
  const dayStem = pillars.day.stem;
  const dayMasterDefinition = STEM_DEFINITIONS[dayStem];
  const entries = POSITIONS.map((position) => {
    const pillar = pillars[position];
    const visible = STEM_DEFINITIONS[pillar.stem];
    const detail: PillarAnalysis = {
      position,
      pillar,
      visibleElement: visible.element,
      visiblePolarity: visible.polarity,
      tenGod: tenGod(dayStem, pillar.stem),
      hiddenStems: BRANCH_DEFINITIONS[pillar.branch].hiddenStems.map((hidden) => {
        const definition = STEM_DEFINITIONS[hidden.stem];
        return { stem: hidden.stem, rank: hidden.rank, element: definition.element, polarity: definition.polarity, tenGod: tenGod(dayStem, hidden.stem) };
      }),
    };
    return [position, detail] as const;
  });
  return {
    ok: true,
    value: {
      schema: "senfate-natal-structure-analysis.v1",
      model: `${model.id}@${model.version}`,
      dayMaster: { stem: dayStem, element: dayMasterDefinition.element, polarity: dayMasterDefinition.polarity },
      pillars: Object.fromEntries(entries) as Record<PillarPosition, PillarAnalysis>,
      strength: strength.value,
      normalForm: normalForm.value,
    },
    certificate: {
      functional: "analysis.natal-structure",
      model: `${model.id}@${model.version}`,
      normalFormFingerprint: normalForm.value.fingerprint,
      upstream: { strength: strength.certificate, dynamic: dynamic.certificate, normalForm: normalForm.certificate },
    },
  };
}
