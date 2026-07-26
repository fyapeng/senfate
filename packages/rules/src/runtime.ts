import type { ClosedResult } from "@senfate/core/algebra";
import { materializeDynamicChartState, type DynamicStateFailure } from "@senfate/core/lifecycle";
import type { NormalFormFailure } from "@senfate/core/normal-form";
import type { GanZhi } from "@senfate/core/ontology";
import { resolveReferenceNormalForm, type ReferenceNormalFormPhaseResult } from "@senfate/core/resolution";
import type { SenFateModelProfile } from "@senfate/core/model";
import type { FourPillarState } from "@senfate/core/structure";
import type { CompiledReferenceRecord } from "./compiler";
import { evaluateReferenceContributionSummary, evaluateReferenceContributions, materializeResolvedReferenceFeatures, type ContributionCertificate, type ReferenceFeatureSnapshot } from "./evaluator";
import { SCHOOL_PROFILES, type SchoolProfile, ruleWeight } from "./schools";

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
  constructor(private readonly records:readonly CompiledReferenceRecord[],private readonly model:SenFateModelProfile,readonly school:SchoolProfile=SCHOOL_PROFILES["integrated-classical"]){
    const executable=records.filter(record=>record.disposition==="executable");
    this.program={total:executable.length,executable:executable.length,deferred:0,contested:0,evidence:0,fixture:0};const applies=(record:CompiledReferenceRecord,phase:ReferenceFeatureSnapshot["phase"])=>record.scopes.length===0||record.scopes.includes("natal")||(phase==="luck"&&record.scopes.includes("luck"))||(phase==="annual"&&(record.scopes.includes("luck")||record.scopes.includes("annual")));
    const adopted=executable.filter(record=>ruleWeight(record,this.school)>0);
    this.applicable={natal:adopted.filter(record=>applies(record,"natal")),luck:adopted.filter(record=>applies(record,"luck")),annual:adopted.filter(record=>applies(record,"annual"))};
  }
  calculate(input:Readonly<{natal:FourPillarState;luck?:GanZhi;annual?:GanZhi;month?:GanZhi;luckDirection?:string;sex?:string}>):ClosedResult<ReferenceCalculationResult,ReferenceCalculationFailure>{
    const dynamic=materializeDynamicChartState(input,this.model);if(!dynamic.ok)return dynamic;
    const normal=resolveReferenceNormalForm(dynamic.value,this.model);if(!normal.ok)return normal;
    const context={...(input.luckDirection?{luckDirection:input.luckDirection}:{}),...(input.sex?{sex:input.sex}:{})};const resolvedFeatures=materializeResolvedReferenceFeatures(normal.value,context);const evaluated=evaluateReferenceContributions(this.applicable[resolvedFeatures.phase],resolvedFeatures,this.model,(record)=>ruleWeight(record,this.school));const topicCertificate={...evaluated,program:this.program};
    return{ok:true,value:{schema:"senfate-reference-calculation.v4",normalForm:normal.value,resolvedFeatures,topicCertificate},certificate:{functional:"reference.calculation-runtime",model:`${this.model.id}@${this.model.version}`,school:this.school.id,phase:resolvedFeatures.phase,normalFormFingerprint:normal.value.fingerprint,topicCertificate:topicCertificate.schema}};
  }
  calculateTrajectorySample(input:Readonly<{natal:FourPillarState;luck:GanZhi;annual:GanZhi;month?:GanZhi;luckDirection?:string;sex?:string}>):ClosedResult<Readonly<{schema:"senfate-reference-trajectory-sample.v1";normalForm:ReferenceNormalFormPhaseResult;contribution:ContributionCertificate["contribution"];activated:number}>,ReferenceCalculationFailure>{const dynamic=materializeDynamicChartState(input,this.model);if(!dynamic.ok)return dynamic;const normal=resolveReferenceNormalForm(dynamic.value,this.model);if(!normal.ok)return normal;const context={...(input.luckDirection?{luckDirection:input.luckDirection}:{}),...(input.sex?{sex:input.sex}:{})};const features=materializeResolvedReferenceFeatures(normal.value,context);const summary=evaluateReferenceContributionSummary(this.applicable.annual,features,this.model,(record)=>ruleWeight(record,this.school));return{ok:true,value:{schema:"senfate-reference-trajectory-sample.v1",normalForm:normal.value,...summary},certificate:{functional:"reference.trajectory-sample",model:`${this.model.id}@${this.model.version}`,school:this.school.id,normalFormFingerprint:normal.value.fingerprint}}}
}
