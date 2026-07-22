import { finiteSignedMeasure,kleeneAnd,type FiniteSignedMeasure,type KleeneTruth,type SenFateModelProfile } from "@senfate/core";
import type { CompiledReferenceRecord,NormalizedReferenceCondition } from "./compiler";

export type TopicDomain="career"|"family"|"general"|"health"|"mobility"|"personality"|"relationship"|"risk"|"study"|"wealth";
export const TOPIC_DOMAINS:readonly TopicDomain[]=["career","family","general","health","mobility","personality","relationship","risk","study","wealth"];
export interface ReferenceFeatureSnapshot {
  readonly schema:"senfate-resolved-reference-features.v1"; readonly phase:"natal"|"luck"|"annual";
  readonly dayStem:string; readonly monthBranch:string; readonly dayMasterState?:string; readonly luckDirection?:string; readonly sex?:string;
  readonly elementStates:Readonly<Record<string,string|undefined>>; readonly presentGanZhi:ReadonlySet<string>; readonly resolvedRelations:ReadonlySet<string>; readonly seasonalCommands:ReadonlySet<string>; readonly presentSymbols:ReadonlySet<string>; readonly abundantSymbols:ReadonlySet<string>;
}
export interface ContributionCertificate { readonly schema:"senfate-topic-contribution-certificate.v1"; readonly phase:ReferenceFeatureSnapshot["phase"]; readonly model:string; readonly evaluated:number; readonly activatedFamilies:readonly string[]; readonly unresolvedFamilies:readonly string[]; readonly contribution:FiniteSignedMeasure<TopicDomain> }

function equality(actual:string|undefined,expected:unknown):KleeneTruth{if(actual===undefined)return"unknown";if(Array.isArray(expected))return expected.includes(actual)?"true":"false";return actual===expected?"true":"false"}
export function evaluateReferenceCondition(condition:NormalizedReferenceCondition,snapshot:ReferenceFeatureSnapshot):KleeneTruth{
  const expected=condition.value;
  switch(condition.operator){
    case"dayMasterState.equals":return equality(snapshot.dayMasterState,expected);case"dayStem.equals":return equality(snapshot.dayStem,expected);case"monthBranch.equals":return equality(snapshot.monthBranch,expected);case"monthBranch.in":return equality(snapshot.monthBranch,expected);case"luckDirection.equals":return equality(snapshot.luckDirection,expected);case"sex.equals":return equality(snapshot.sex,expected);
    case"element.state":{if(!Array.isArray(expected)||expected.length<2)return"unknown";return equality(snapshot.elementStates[String(expected[0])],expected[1])}
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
