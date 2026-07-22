import type { ClosedResult } from "./algebra";
import { evaluateNormalForm, type NormalFormFailure, type RewriteOperator } from "./normal-form";
import { BRANCH_DEFINITIONS, STEM_DEFINITIONS, type Element, type RelationCandidate } from "./ontology";
import type { SenFateModelProfile } from "./model";
import type { DynamicChartState } from "./lifecycle";

export type RelationResolutionStatus="candidate"|"effective"|"contested"|"blocked"|"transformed";
export interface RelationScore {readonly base:number;readonly completeness:number;readonly seasonalSupport:number;readonly exposure:number;readonly rootedness:number;readonly currentLayer:number;readonly total:number}
export interface ResolvedRelation {readonly id:string;readonly candidate:RelationCandidate;readonly score:RelationScore;readonly status:RelationResolutionStatus;readonly competingIds:readonly string[]}
interface ResolutionState {readonly relations:readonly ResolvedRelation[]}
export interface ReferenceNormalFormPhaseResult {readonly schema:"senfate-reference-normal-form-phase.v1";readonly status:"stable";readonly phase:DynamicChartState["phase"];readonly dynamicState:DynamicChartState;readonly relations:readonly ResolvedRelation[];readonly iterations:number;readonly trace:readonly string[];readonly fingerprint:string;readonly model:string}

const MONTH_ELEMENT:Readonly<Record<DynamicChartState["natal"]["month"]["branch"],Element>>={子:"水",丑:"土",寅:"木",卯:"木",辰:"土",巳:"火",午:"火",未:"土",申:"金",酉:"金",戌:"土",亥:"水"};
function relationId(candidate:RelationCandidate):string{return`${candidate.kind}:${[...candidate.members].sort().join("+")}`}
function intersects(a:RelationCandidate,b:RelationCandidate):boolean{return a.members.some(member=>b.members.includes(member))}

function scored(candidate:RelationCandidate,state:DynamicChartState,model:SenFateModelProfile):ResolvedRelation{
  const p=model.relationResolution;const target=candidate.targetElement;const stems=state.pillars.map(item=>item.pillar.stem);const hidden=state.pillars.flatMap(item=>BRANCH_DEFINITIONS[item.pillar.branch].hiddenStems.map(value=>value.stem));const latest=state.phase==="annual"?state.annual:state.phase==="luck"?state.luck:undefined;const expected=candidate.kind.startsWith("three-")?3:2;
  const score:RelationScore={base:p.basePriority[candidate.kind],completeness:candidate.members.length/expected*p.completeness,seasonalSupport:target===MONTH_ELEMENT[state.natal.month.branch]?p.seasonalSupport:0,exposure:target&&stems.some(stem=>STEM_DEFINITIONS[stem].element===target)?p.exposure:0,rootedness:target&&hidden.some(stem=>STEM_DEFINITIONS[stem].element===target)?p.rootedness:0,currentLayer:latest&&candidate.members.some(member=>member===latest.stem||member===latest.branch)?p.currentLayer:0,total:0};
  return{id:relationId(candidate),candidate,score:{...score,total:score.base+score.completeness+score.seasonalSupport+score.exposure+score.rootedness+score.currentLayer},status:"candidate",competingIds:[]};
}

function resolveOperator(model:SenFateModelProfile):RewriteOperator<ResolutionState>{return{id:"resolution.relations.weighted-competition.v1",apply(state){if(state.relations.every(relation=>relation.status!=="candidate"))return{state,changed:false,ruleId:"resolution.relations.stable"};const relations=state.relations.map(relation=>{const competitors=state.relations.filter(other=>other.id!==relation.id&&intersects(relation.candidate,other.candidate));const best=Math.max(relation.score.total,...competitors.map(item=>item.score.total));let status:RelationResolutionStatus;if(relation.score.total<model.relationResolution.effectiveThreshold)status="blocked";else if(competitors.some(item=>Math.abs(item.score.total-relation.score.total)<=model.relationResolution.conflictMargin))status="contested";else if(relation.score.total<best)status="blocked";else if(relation.candidate.targetElement&&relation.score.total>=model.relationResolution.transformThreshold)status="transformed";else status="effective";return{...relation,status,competingIds:competitors.map(item=>item.id).sort()}});return{state:{relations},changed:true,ruleId:"resolution.relations.weighted-competition.v1"}}}}

function fingerprint(state:ResolutionState):string{return JSON.stringify([...state.relations].sort((a,b)=>a.id.localeCompare(b.id)).map(item=>[item.id,item.status,Number(item.score.total.toFixed(8)),item.competingIds]))}

export function resolveReferenceNormalForm(dynamicState:DynamicChartState,model:SenFateModelProfile):ClosedResult<ReferenceNormalFormPhaseResult,NormalFormFailure>{
  const initial:ResolutionState={relations:dynamicState.relationCandidates.map(candidate=>scored(candidate,dynamicState,model))};const result=evaluateNormalForm(initial,{maxIterations:model.relationResolution.maxIterations,fingerprint,operators:[resolveOperator(model)]});if(!result.ok)return result;
  return{ok:true,value:{schema:"senfate-reference-normal-form-phase.v1",status:"stable",phase:dynamicState.phase,dynamicState,relations:result.value.state.relations,iterations:result.value.iterations,trace:result.value.trace,fingerprint:result.value.fingerprint,model:`${model.id}@${model.version}`},certificate:{...result.certificate,functional:"resolution.reference-normal-form",model:`${model.id}@${model.version}`,phase:dynamicState.phase}};
}
