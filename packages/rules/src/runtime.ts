import {
  materializeDynamicChartState,
  resolveReferenceNormalForm,
  type ClosedResult,
  type DynamicStateFailure,
  type FourPillarState,
  type GanZhi,
  type NormalFormFailure,
  type ReferenceNormalFormPhaseResult,
  type SenFateModelProfile,
} from "@senfate/core";
import type { CompiledReferenceRecord } from "./compiler";
import { evaluateReferenceContributions, materializeResolvedReferenceFeatures, type ContributionCertificate, type ReferenceFeatureSnapshot } from "./evaluator";

export interface ReferenceCalculationResult {
  readonly schema:"senfate-reference-calculation.v3";
  readonly normalForm:ReferenceNormalFormPhaseResult;
  readonly resolvedFeatures:ReferenceFeatureSnapshot;
  readonly topicCertificate:ContributionCertificate;
}
export type ReferenceCalculationFailure=DynamicStateFailure|NormalFormFailure;

export class ReferenceCalculationRuntime {
  constructor(private readonly records:readonly CompiledReferenceRecord[],private readonly model:SenFateModelProfile){}
  calculate(input:Readonly<{natal:FourPillarState;luck?:GanZhi;annual?:GanZhi;luckDirection?:string;sex?:string}>):ClosedResult<ReferenceCalculationResult,ReferenceCalculationFailure>{
    const dynamic=materializeDynamicChartState(input,this.model);if(!dynamic.ok)return dynamic;
    const normal=resolveReferenceNormalForm(dynamic.value,this.model);if(!normal.ok)return normal;
    const context={...(input.luckDirection?{luckDirection:input.luckDirection}:{}),...(input.sex?{sex:input.sex}:{})};const resolvedFeatures=materializeResolvedReferenceFeatures(normal.value,context);const topicCertificate=evaluateReferenceContributions(this.records,resolvedFeatures,this.model);
    return{ok:true,value:{schema:"senfate-reference-calculation.v3",normalForm:normal.value,resolvedFeatures,topicCertificate},certificate:{functional:"reference.calculation-runtime",model:`${this.model.id}@${this.model.version}`,phase:resolvedFeatures.phase,normalFormFingerprint:normal.value.fingerprint,topicCertificate:topicCertificate.schema}};
  }
}
