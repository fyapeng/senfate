import { BRANCH_DEFINITIONS,ELEMENTS,STEM_DEFINITIONS,finiteSignedMeasure,kleeneAnd,tenGod,type FiniteSignedMeasure,type KleeneTruth,type ReferenceNormalFormPhaseResult,type SenFateModelProfile } from "@senfate/core";
import type { CompiledReferenceRecord,NormalizedReferenceCondition } from "./compiler";

export type TopicDomain="career"|"family"|"general"|"health"|"mobility"|"personality"|"relationship"|"risk"|"study"|"wealth";
export const TOPIC_DOMAINS:readonly TopicDomain[]=["career","family","general","health","mobility","personality","relationship","risk","study","wealth"];
export interface ReferenceFeatureSnapshot {
  readonly schema:"senfate-resolved-reference-features.v1"; readonly phase:"natal"|"luck"|"annual";
  readonly dayStem:string; readonly monthBranch:string; readonly dayMasterState?:string; readonly luckDirection?:string; readonly sex?:string;
  readonly elementStates:Readonly<Record<string,string|undefined>>; readonly presentGanZhi:ReadonlySet<string>; readonly resolvedRelations:ReadonlySet<string>; readonly seasonalCommands:ReadonlySet<string>; readonly presentSymbols:ReadonlySet<string>; readonly abundantSymbols:ReadonlySet<string>;
}
export interface ContributionCertificate { readonly schema:"senfate-topic-contribution-certificate.v1"; readonly phase:ReferenceFeatureSnapshot["phase"]; readonly model:string; readonly evaluated:number; readonly activatedFamilies:readonly string[]; readonly unresolvedFamilies:readonly string[]; readonly contribution:FiniteSignedMeasure<TopicDomain> }

const RELATION_LABEL:Readonly<Record<string,string>>={"stem-combine":"合","branch-combine":"合","branch-clash":"冲","branch-harm":"害","branch-break":"破","branch-punishment":"刑","three-harmony":"三合","three-meeting":"三会"};
const GENERATES:Readonly<Record<string,string>>={木:"火",火:"土",土:"金",金:"水",水:"木"};
export function materializeResolvedReferenceFeatures(normal:ReferenceNormalFormPhaseResult,context:Readonly<{luckDirection?:string;sex?:string}>={}):ReferenceFeatureSnapshot{
  const state=normal.dynamicState;const atoms=state.elementMeasure.atoms;const mean=state.elementMeasure.total/ELEMENTS.length;const elementStates=Object.fromEntries(ELEMENTS.map(element=>[element,atoms[element]>=mean*1.25?"abundant":"deficient"]));const presentSymbols=new Set<string>();const presentGanZhi=new Set<string>();
  for(const item of state.pillars){presentSymbols.add(item.pillar.stem);presentSymbols.add(item.pillar.branch);presentGanZhi.add(`${item.pillar.stem}${item.pillar.branch}`);for(const hidden of BRANCH_DEFINITIONS[item.pillar.branch].hiddenStems)presentSymbols.add(hidden.stem);presentSymbols.add(tenGod(state.natal.day.stem,item.pillar.stem))}
  const active=normal.relations.filter(item=>item.status==="effective"||item.status==="transformed");const resolvedRelations=new Set(active.map(item=>RELATION_LABEL[item.candidate.kind]!).filter(Boolean));const seasonalCommands=new Set<string>();const monthElement=BRANCH_DEFINITIONS[state.natal.month.branch].element;const dayElement=STEM_DEFINITIONS[state.natal.day.stem].element;seasonalCommands.add(monthElement===dayElement||GENERATES[monthElement]===dayElement?"supported":"unsupported");for(const relation of active)if(relation.status==="transformed"&&relation.candidate.targetElement)seasonalCommands.add(`${relation.candidate.targetElement}局`);
  return{schema:"senfate-resolved-reference-features.v1",phase:normal.phase,dayStem:state.natal.day.stem,monthBranch:state.natal.month.branch,dayMasterState:state.strength.state,...(context.luckDirection?{luckDirection:context.luckDirection}:{}),...(context.sex?{sex:context.sex}:{}),elementStates,presentGanZhi,resolvedRelations,seasonalCommands,presentSymbols,abundantSymbols:new Set(ELEMENTS.filter(element=>elementStates[element]==="abundant"))};
}

function equality(actual:string|undefined,expected:unknown):KleeneTruth{if(actual===undefined)return"unknown";if(Array.isArray(expected))return expected.includes(actual)?"true":"false";return actual===expected?"true":"false"}
export function evaluateReferenceCondition(condition:NormalizedReferenceCondition,snapshot:ReferenceFeatureSnapshot):KleeneTruth{
  const expected=condition.value;
  switch(condition.operator){
    case"dayMasterState.equals":return equality(snapshot.dayMasterState,expected);case"dayStem.equals":return equality(snapshot.dayStem,expected);case"monthBranch.equals":return equality(snapshot.monthBranch,expected);case"monthBranch.in":return equality(snapshot.monthBranch,expected);case"luckDirection.equals":return equality(snapshot.luckDirection,expected);case"sex.equals":return equality(snapshot.sex,expected);
    case"element.state":return condition.subject?equality(snapshot.elementStates[condition.subject],expected):"unknown";
    case"ganZhi.present":return snapshot.presentGanZhi.has(String(expected))?"true":"false";case"ganZhi.in":return(Array.isArray(expected)?expected:[expected]).some(x=>snapshot.presentGanZhi.has(String(x)))?"true":"false";
    case"relation.exists":return snapshot.resolvedRelations.has(String(expected))?"true":"false";case"seasonalCommand":case"branchFormation.equals":return snapshot.seasonalCommands.has(String(expected))?"true":"false";
    case"symbol.present":return snapshot.presentSymbols.has(String(expected))?"true":"false";case"symbol.absent":return snapshot.presentSymbols.has(String(expected))?"false":"true";case"symbol.abundant":return snapshot.abundantSymbols.has(String(expected))?"true":"false";default:return"unknown";
  }
}

function scopeApplies(record:CompiledReferenceRecord,phase:ReferenceFeatureSnapshot["phase"]):boolean {if(record.scopes.length===0)return true;if(record.scopes.includes("natal"))return true;if(phase==="luck"&&record.scopes.includes("luck"))return true;if(phase==="annual"&&(record.scopes.includes("luck")||record.scopes.includes("annual")))return true;return false}
export function evaluateReferenceContributions(records:readonly CompiledReferenceRecord[],snapshot:ReferenceFeatureSnapshot,model:SenFateModelProfile):ContributionCertificate{
  const contributions:Record<TopicDomain,number>={career:0,family:0,general:0,health:0,mobility:0,personality:0,relationship:0,risk:0,study:0,wealth:0};const activatedFamilies:string[]=[];const unresolvedFamilies:string[]=[];let evaluated=0;
  for(const record of records){if(record.disposition!=="executable"||!scopeApplies(record,snapshot.phase))continue;evaluated++;const truth=kleeneAnd(record.conditions.map(condition=>evaluateReferenceCondition(condition,snapshot)));if(truth==="unknown"){unresolvedFamilies.push(record.familyId);continue}if(truth==="false")continue;activatedFamilies.push(record.familyId);for(const effect of record.effects){const sign=effect.polarity==="support"?1:effect.polarity==="pressure"?-1:0;for(const domain of effect.domains)if(TOPIC_DOMAINS.includes(domain as TopicDomain))contributions[domain as TopicDomain]+=sign*(model.topics.domainWeights[domain]??0)}}
  return{schema:"senfate-topic-contribution-certificate.v1",phase:snapshot.phase,model:`${model.id}@${model.version}`,evaluated,activatedFamilies,unresolvedFamilies,contribution:finiteSignedMeasure(TOPIC_DOMAINS,contributions)};
}
