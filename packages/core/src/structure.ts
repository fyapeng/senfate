import { finiteSignedMeasure, type CertifiedFunctional, type ClosedResult, type FiniteSignedMeasure } from "./algebra";
import { BRANCH_DEFINITIONS, ELEMENTS, STEM_DEFINITIONS, type Element, type GanZhi } from "./ontology";
import type { PillarPosition, SenFateModelProfile } from "./model";

export interface FourPillarState { readonly year:GanZhi; readonly month:GanZhi; readonly day:GanZhi; readonly hour:GanZhi }
export interface ElementMeasureProfile {
  readonly id:string; readonly version:string;
  readonly visiblePosition:Readonly<{year:number;month:number;day:number;hour:number}>;
  readonly hiddenRank:Readonly<{main:number;middle:number;residual:number}>;
  readonly seasonalMultiplier:Readonly<Record<Element,number>>;
}
export interface ElementMeasureResult { readonly measure:FiniteSignedMeasure<Element>; readonly unscaled:Readonly<Record<Element,number>> }
export interface RootEvidence {readonly visiblePosition:PillarPosition;readonly branchPosition:PillarPosition;readonly rank:"main"|"middle"|"residual";readonly weight:number}
export interface RootExposureSnapshot {readonly schema:"senfate-root-exposure.v1";readonly roots:Readonly<Record<PillarPosition,readonly RootEvidence[]>>;readonly exposedHiddenStems:readonly Readonly<{stem:string;branchPosition:PillarPosition;rank:"main"|"middle"|"residual"}>[];readonly dayMasterRootMass:number}
export type StrengthClass="very-weak"|"weak"|"balanced"|"strong"|"very-strong";
export type StrengthFailure="invalid-profile"|"zero-measure";
export interface StrengthEvaluation {readonly schema:"senfate-strength-evaluation.v1";readonly state:StrengthClass;readonly supportRatio:number;readonly support:number;readonly pressure:number;readonly decomposition:Readonly<{sameElement:number;resource:number;root:number;output:number;wealth:number;officer:number}>;readonly elementMeasure:ElementMeasureResult;readonly rootExposure:RootExposureSnapshot}

export function elementMeasureFunctional(profile:ElementMeasureProfile):CertifiedFunctional<FourPillarState,ElementMeasureResult>{
  return{id:"structure.element-measure",version:profile.version,domain:"FourPillarState",codomain:"FinitePositiveMeasure<Element>",evaluate(pillars):ClosedResult<ElementMeasureResult>{
    const values:Record<Element,number>={木:0,火:0,土:0,金:0,水:0};
    for(const [position,pillar] of Object.entries(pillars) as [keyof FourPillarState,GanZhi][]){const positionWeight=profile.visiblePosition[position];if(!Number.isFinite(positionWeight)||positionWeight<0)return{ok:false,code:"invalid-profile",reason:`Invalid visible weight at ${position}`,certificate:{profile:profile.id}};values[STEM_DEFINITIONS[pillar.stem].element]+=positionWeight;for(const hidden of BRANCH_DEFINITIONS[pillar.branch].hiddenStems){const weight=profile.hiddenRank[hidden.rank];if(!Number.isFinite(weight)||weight<0)return{ok:false,code:"invalid-profile",reason:`Invalid hidden weight ${hidden.rank}`,certificate:{profile:profile.id}};values[STEM_DEFINITIONS[hidden.stem].element]+=positionWeight*weight}}
    const scaled={...values};for(const element of ELEMENTS){const multiplier=profile.seasonalMultiplier[element];if(!Number.isFinite(multiplier)||multiplier<0)return{ok:false,code:"invalid-profile",reason:`Invalid seasonal multiplier ${element}`,certificate:{profile:profile.id}};scaled[element]*=multiplier}
    return{ok:true,value:{measure:finiteSignedMeasure(ELEMENTS,scaled),unscaled:values},certificate:{functional:"structure.element-measure",profile:`${profile.id}@${profile.version}`,parameters:profile}};
  }};
}

export function elementMeasureProfileFromModel(model:SenFateModelProfile,monthBranch:GanZhi["branch"]):ElementMeasureProfile{return{id:model.id,version:model.version,visiblePosition:model.elementMeasure.visiblePosition,hiddenRank:model.elementMeasure.hiddenRank,seasonalMultiplier:model.elementMeasure.seasonalMultiplier[monthBranch]}}

const POSITIONS:readonly PillarPosition[]=["year","month","day","hour"];
export function materializeRootExposure(pillars:FourPillarState,model:SenFateModelProfile):RootExposureSnapshot{
  const visible=new Set(POSITIONS.map(position=>pillars[position].stem));const roots={year:[],month:[],day:[],hour:[]} as Record<PillarPosition,RootEvidence[]>;const exposedHiddenStems:Readonly<{stem:string;branchPosition:PillarPosition;rank:"main"|"middle"|"residual"}>[]=[];
  for(const branchPosition of POSITIONS){const branch=pillars[branchPosition].branch;for(const hidden of BRANCH_DEFINITIONS[branch].hiddenStems){if(visible.has(hidden.stem))exposedHiddenStems.push({stem:hidden.stem,branchPosition,rank:hidden.rank});for(const visiblePosition of POSITIONS)if(pillars[visiblePosition].stem===hidden.stem)roots[visiblePosition].push({visiblePosition,branchPosition,rank:hidden.rank,weight:model.elementMeasure.visiblePosition[branchPosition]*model.elementMeasure.hiddenRank[hidden.rank]})}}
  const dayMasterRootMass=roots.day.reduce((sum,item)=>sum+item.weight,0);return{schema:"senfate-root-exposure.v1",roots,exposedHiddenStems,dayMasterRootMass};
}

const GENERATES:Readonly<Record<Element,Element>>={木:"火",火:"土",土:"金",金:"水",水:"木"};
const CONTROLS:Readonly<Record<Element,Element>>={木:"土",火:"金",土:"水",金:"木",水:"火"};
function inverse(mapping:Readonly<Record<Element,Element>>,target:Element):Element{return ELEMENTS.find(element=>mapping[element]===target)!}
export function evaluateDayMasterStrength(pillars:FourPillarState,model:SenFateModelProfile):ClosedResult<StrengthEvaluation,StrengthFailure>{
  const measureResult=elementMeasureFunctional(elementMeasureProfileFromModel(model,pillars.month.branch)).evaluate(pillars);if(!measureResult.ok)return{...measureResult,code:"invalid-profile"};const roots=materializeRootExposure(pillars,model);const dayElement=STEM_DEFINITIONS[pillars.day.stem].element;const resourceElement=inverse(GENERATES,dayElement);const outputElement=GENERATES[dayElement];const wealthElement=CONTROLS[dayElement];const officerElement=inverse(CONTROLS,dayElement);const atoms=measureResult.value.measure.atoms;
  const decomposition={sameElement:atoms[dayElement]*model.strength.sameElement,resource:atoms[resourceElement]*model.strength.resource,root:roots.dayMasterRootMass*model.strength.rootBonus,output:atoms[outputElement]*model.strength.output,wealth:atoms[wealthElement]*model.strength.wealth,officer:atoms[officerElement]*model.strength.officer};const support=decomposition.sameElement+decomposition.resource+decomposition.root;const pressure=decomposition.output+decomposition.wealth+decomposition.officer;const denominator=support+pressure;if(!(denominator>0))return{ok:false,code:"zero-measure",reason:"Strength functional has zero total support and pressure",certificate:{model:`${model.id}@${model.version}`}};const supportRatio=support/denominator;const t=model.strength.thresholds;const state:StrengthClass=supportRatio<t.veryWeakUpper?"very-weak":supportRatio<t.weakUpper?"weak":supportRatio<t.strongLower?"balanced":supportRatio<t.veryStrongLower?"strong":"very-strong";return{ok:true,value:{schema:"senfate-strength-evaluation.v1",state,supportRatio,support,pressure,decomposition,elementMeasure:measureResult.value,rootExposure:roots},certificate:{functional:"structure.strength",model:`${model.id}@${model.version}`,thresholds:t}};
}
