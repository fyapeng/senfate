import { finiteSignedMeasure, type CertifiedFunctional, type ClosedResult, type FiniteSignedMeasure } from "./algebra";
import { BRANCH_DEFINITIONS, ELEMENTS, STEM_DEFINITIONS, type Element, type GanZhi } from "./ontology";

export interface FourPillarState { readonly year:GanZhi; readonly month:GanZhi; readonly day:GanZhi; readonly hour:GanZhi }
export interface ElementMeasureProfile {
  readonly id:string; readonly version:string;
  readonly visiblePosition:Readonly<{year:number;month:number;day:number;hour:number}>;
  readonly hiddenRank:Readonly<{main:number;middle:number;residual:number}>;
  readonly seasonalMultiplier:Readonly<Record<Element,number>>;
}
export interface ElementMeasureResult { readonly measure:FiniteSignedMeasure<Element>; readonly unscaled:Readonly<Record<Element,number>> }

export function elementMeasureFunctional(profile:ElementMeasureProfile):CertifiedFunctional<FourPillarState,ElementMeasureResult>{
  return{id:"structure.element-measure",version:profile.version,domain:"FourPillarState",codomain:"FinitePositiveMeasure<Element>",evaluate(pillars):ClosedResult<ElementMeasureResult>{
    const values:Record<Element,number>={木:0,火:0,土:0,金:0,水:0};
    for(const [position,pillar] of Object.entries(pillars) as [keyof FourPillarState,GanZhi][]){const positionWeight=profile.visiblePosition[position];if(!Number.isFinite(positionWeight)||positionWeight<0)return{ok:false,code:"invalid-profile",reason:`Invalid visible weight at ${position}`,certificate:{profile:profile.id}};values[STEM_DEFINITIONS[pillar.stem].element]+=positionWeight;for(const hidden of BRANCH_DEFINITIONS[pillar.branch].hiddenStems){const weight=profile.hiddenRank[hidden.rank];if(!Number.isFinite(weight)||weight<0)return{ok:false,code:"invalid-profile",reason:`Invalid hidden weight ${hidden.rank}`,certificate:{profile:profile.id}};values[STEM_DEFINITIONS[hidden.stem].element]+=positionWeight*weight}}
    const scaled={...values};for(const element of ELEMENTS){const multiplier=profile.seasonalMultiplier[element];if(!Number.isFinite(multiplier)||multiplier<0)return{ok:false,code:"invalid-profile",reason:`Invalid seasonal multiplier ${element}`,certificate:{profile:profile.id}};scaled[element]*=multiplier}
    return{ok:true,value:{measure:finiteSignedMeasure(ELEMENTS,scaled),unscaled:values},certificate:{functional:"structure.element-measure",profile:`${profile.id}@${profile.version}`,parameters:profile}};
  }};
}
