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
import { evaluateReferenceContributionMeasure, evaluateReferenceContributions, materializeResolvedReferenceFeatures, type ContributionCertificate, type ReferenceFeatureSnapshot } from "./evaluator";

export interface ReferenceCalculationResult {
  readonly schema:"senfate-reference-calculation.v4";
  readonly normalForm:ReferenceNormalFormPhaseResult;
  readonly resolvedFeatures:ReferenceFeatureSnapshot;
  readonly topicCertificate:ContributionCertificate;
}
export type ReferenceCalculationFailure=DynamicStateFailure|NormalFormFailure;

export class ReferenceCalculationRuntime {
  private readonly program:ContributionCertificate["program"];
  private readonly applicable:Readonly<Record<ReferenceFeatureSnapshot["phase"],readonly CompiledReferenceRecord[]>>;
  constructor(private readonly records:readonly CompiledReferenceRecord[],private readonly model:SenFateModelProfile){
    const counts={executable:0,deferred:0,contested:0,evidence:0,fixture:0};for(const record of records)counts[record.disposition]++;
    this.program={total:records.length,...counts};const executable=records.filter(record=>record.disposition==="executable");const applies=(record:CompiledReferenceRecord,phase:ReferenceFeatureSnapshot["phase"])=>record.scopes.length===0||record.scopes.includes("natal")||(phase==="luck"&&record.scopes.includes("luck"))||(phase==="annual"&&(record.scopes.includes("luck")||record.scopes.includes("annual")));
    this.applicable={natal:executable.filter(record=>applies(record,"natal")),luck:executable.filter(record=>applies(record,"luck")),annual:executable.filter(record=>applies(record,"annual"))};
  }
  calculate(input:Readonly<{natal:FourPillarState;luck?:GanZhi;annual?:GanZhi;month?:GanZhi;luckDirection?:string;sex?:string}>):ClosedResult<ReferenceCalculationResult,ReferenceCalculationFailure>{
    const dynamic=materializeDynamicChartState(input,this.model);if(!dynamic.ok)return dynamic;
    const normal=resolveReferenceNormalForm(dynamic.value,this.model);if(!normal.ok)return normal;
    const context={...(input.luckDirection?{luckDirection:input.luckDirection}:{}),...(input.sex?{sex:input.sex}:{})};const resolvedFeatures=materializeResolvedReferenceFeatures(normal.value,context);const evaluated=evaluateReferenceContributions(this.applicable[resolvedFeatures.phase],resolvedFeatures,this.model);const topicCertificate={...evaluated,program:this.program};
    return{ok:true,value:{schema:"senfate-reference-calculation.v4",normalForm:normal.value,resolvedFeatures,topicCertificate},certificate:{functional:"reference.calculation-runtime",model:`${this.model.id}@${this.model.version}`,phase:resolvedFeatures.phase,normalFormFingerprint:normal.value.fingerprint,topicCertificate:topicCertificate.schema}};
  }
  calculateTrajectorySample(input:Readonly<{natal:FourPillarState;luck:GanZhi;annual:GanZhi;month:GanZhi;luckDirection?:string;sex?:string}>):ClosedResult<Readonly<{schema:"senfate-reference-trajectory-sample.v1";normalFormFingerprint:string;contribution:ContributionCertificate["contribution"]}>,ReferenceCalculationFailure>{const dynamic=materializeDynamicChartState(input,this.model);if(!dynamic.ok)return dynamic;const normal=resolveReferenceNormalForm(dynamic.value,this.model);if(!normal.ok)return normal;const context={...(input.luckDirection?{luckDirection:input.luckDirection}:{}),...(input.sex?{sex:input.sex}:{})};const features=materializeResolvedReferenceFeatures(normal.value,context);const contribution=evaluateReferenceContributionMeasure(this.applicable.annual,features,this.model);return{ok:true,value:{schema:"senfate-reference-trajectory-sample.v1",normalFormFingerprint:normal.value.fingerprint,contribution},certificate:{functional:"reference.trajectory-sample",model:`${this.model.id}@${this.model.version}`,normalFormFingerprint:normal.value.fingerprint}}}
}
