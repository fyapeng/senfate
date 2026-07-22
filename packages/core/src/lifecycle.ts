import { finiteSignedMeasure, type ClosedResult, type FiniteSignedMeasure } from "./algebra";
import type { SenFateModelProfile, PillarPosition } from "./model";
import { BRANCH_DEFINITIONS, ELEMENTS, STEM_DEFINITIONS, detectRelationCandidates, type Element, type GanZhi, type RelationCandidate } from "./ontology";
import type { FourPillarState, StrengthClass } from "./structure";

export type CalculationPhase = "natal" | "luck" | "annual";
export type TemporalLayer = CalculationPhase|"month";
export interface LayeredPillar { readonly id:string; readonly layer:TemporalLayer; readonly position:PillarPosition|"period"; readonly pillar:GanZhi; readonly weight:number }
export interface DynamicStrength { readonly state:StrengthClass; readonly supportRatio:number; readonly support:number; readonly pressure:number }
export interface DynamicChartState {
  readonly schema:"senfate-dynamic-chart-state.v1"; readonly phase:CalculationPhase; readonly natal:FourPillarState;
  readonly luck?:GanZhi; readonly annual?:GanZhi; readonly month?:GanZhi; readonly pillars:readonly LayeredPillar[];
  readonly elementMeasure:FiniteSignedMeasure<Element>; readonly strength:DynamicStrength; readonly relationCandidates:readonly RelationCandidate[];
}
export type DynamicStateFailure="missing-luck-layer"|"invalid-model"|"zero-measure";

const POSITIONS:readonly PillarPosition[]=["year","month","day","hour"];
const GENERATES:Readonly<Record<Element,Element>>={木:"火",火:"土",土:"金",金:"水",水:"木"};
const CONTROLS:Readonly<Record<Element,Element>>={木:"土",火:"金",土:"水",金:"木",水:"火"};
function inverse(mapping:Readonly<Record<Element,Element>>,target:Element):Element{return ELEMENTS.find(element=>mapping[element]===target)!}

export function materializeDynamicChartState(input:Readonly<{natal:FourPillarState;luck?:GanZhi;annual?:GanZhi;month?:GanZhi}>,model:SenFateModelProfile):ClosedResult<DynamicChartState,DynamicStateFailure>{
  const phase:CalculationPhase=input.annual?"annual":input.luck?"luck":"natal";
  const certificate={functional:"lifecycle.dynamic-state",phase,model:`${model.id}@${model.version}`};
  if((input.annual&&!input.luck)||(input.month&&(!input.luck||!input.annual)))return{ok:false,code:"missing-luck-layer",reason:"Annual and monthly states require their enclosing temporal layers",certificate};
  if(Object.values(model.temporalLayers).some(value=>!Number.isFinite(value)||value<0))return{ok:false,code:"invalid-model",reason:"Temporal layer weights must be finite and non-negative",certificate};
  const pillars:LayeredPillar[]=POSITIONS.map(position=>({id:`natal.${position}`,layer:"natal",position,pillar:input.natal[position],weight:model.temporalLayers.natal*model.elementMeasure.visiblePosition[position]}));
  if(input.luck)pillars.push({id:"luck.period",layer:"luck",position:"period",pillar:input.luck,weight:model.temporalLayers.luck});
  if(input.annual)pillars.push({id:"annual.period",layer:"annual",position:"period",pillar:input.annual,weight:model.temporalLayers.annual});
  if(input.month)pillars.push({id:"month.period",layer:"month",position:"period",pillar:input.month,weight:model.temporalLayers.month});
  const values:Record<Element,number>={木:0,火:0,土:0,金:0,水:0};let rootMass=0;const dayStem=input.natal.day.stem;
  for(const item of pillars){values[STEM_DEFINITIONS[item.pillar.stem].element]+=item.weight;for(const hidden of BRANCH_DEFINITIONS[item.pillar.branch].hiddenStems){const mass=item.weight*model.elementMeasure.hiddenRank[hidden.rank];values[STEM_DEFINITIONS[hidden.stem].element]+=mass;if(hidden.stem===dayStem)rootMass+=mass}}
  const seasonal=model.elementMeasure.seasonalMultiplier[input.natal.month.branch];for(const element of ELEMENTS)values[element]*=seasonal[element];
  const measure=finiteSignedMeasure(ELEMENTS,values);const dayElement=STEM_DEFINITIONS[dayStem].element;const resource=inverse(GENERATES,dayElement);const output=GENERATES[dayElement];const wealth=CONTROLS[dayElement];const officer=inverse(CONTROLS,dayElement);
  const support=measure.atoms[dayElement]*model.strength.sameElement+measure.atoms[resource]*model.strength.resource+rootMass*model.strength.rootBonus;const pressure=measure.atoms[output]*model.strength.output+measure.atoms[wealth]*model.strength.wealth+measure.atoms[officer]*model.strength.officer;
  if(!(support+pressure>0))return{ok:false,code:"zero-measure",reason:"Dynamic state has zero support and pressure",certificate};const supportRatio=support/(support+pressure);const t=model.strength.thresholds;const state:StrengthClass=supportRatio<t.veryWeakUpper?"very-weak":supportRatio<t.weakUpper?"weak":supportRatio<t.strongLower?"balanced":supportRatio<t.veryStrongLower?"strong":"very-strong";
  const relationCandidates=detectRelationCandidates(pillars.map(item=>item.pillar.stem),pillars.map(item=>item.pillar.branch));
  return{ok:true,value:{schema:"senfate-dynamic-chart-state.v1",phase,natal:input.natal,...(input.luck?{luck:input.luck}:{}),...(input.annual?{annual:input.annual}:{}),...(input.month?{month:input.month}:{}),pillars,elementMeasure:measure,strength:{state,supportRatio,support,pressure},relationCandidates},certificate:{...certificate,layerWeights:model.temporalLayers,pillarIds:pillars.map(item=>item.id)}};
}
