export type ReferenceDisposition = "executable" | "deferred" | "contested" | "evidence" | "fixture";
export type CanonicalConditionKind = "branch-formation"|"day-master-state"|"day-stem"|"element-state"|"ganzhi"|"luck-direction"|"month-branch"|"resolved-relation"|"seasonal-command"|"sex"|"typed-symbol";

interface CompactCorpus {
  readonly v:string; readonly books:readonly string[]; readonly values:readonly unknown[];
  readonly terms:readonly (readonly string[])[];
  readonly enums:Readonly<Record<string,readonly string[]>>;
  readonly families:readonly string[];
  readonly rules:readonly (readonly (readonly unknown[])[])[];
}

export interface NormalizedReferenceCondition { readonly kind:CanonicalConditionKind; readonly operator:string; readonly value:unknown; readonly subject?:string }
export interface ReferenceEffect { readonly operator:string; readonly domains:readonly string[]; readonly polarity:string }
export interface CompiledReferenceRecord {
  readonly recordId:string; readonly bookId:string; readonly lineStart:number; readonly lineEnd:number;
  readonly familyId:string; readonly ruleType:string; readonly sourceRole:string; readonly scopes:readonly string[];
  readonly conditions:readonly NormalizedReferenceCondition[]; readonly effects:readonly ReferenceEffect[];
  readonly terms:Readonly<Record<string,readonly string[]>>; readonly extractionConfidence:number;
  readonly disposition:ReferenceDisposition; readonly reason:string;
}
export interface ReferenceCompilationAudit { readonly schema:"senfate-reference-compilation-audit.v1"; readonly corpusVersion:string; readonly total:number; readonly families:number; readonly counts:Readonly<Record<ReferenceDisposition,number>>; readonly records:readonly CompiledReferenceRecord[] }

const TERM_NAMES=["stems","branches","elements","yinYang","tenGods","relations","structures"] as const;
const CONDITION_KIND:Readonly<Record<string,CanonicalConditionKind>>={
  "branchFormation.equals":"branch-formation","dayMasterState.equals":"day-master-state","dayStem.equals":"day-stem","element.state":"element-state","ganZhi.in":"ganzhi","ganZhi.present":"ganzhi","luckDirection.equals":"luck-direction","monthBranch.equals":"month-branch","monthBranch.in":"month-branch","relation.exists":"resolved-relation","seasonalCommand":"seasonal-command","sex.equals":"sex","symbol.absent":"typed-symbol","symbol.present":"typed-symbol",
};

function enumValue(corpus:CompactCorpus,name:string,index:number):string { const value=corpus.enums[name]?.[index]; if(value===undefined)throw new Error(`Invalid ${name} enum index ${index}`);return value }
function integer(value:unknown,label:string):number { if(!Number.isInteger(value))throw new Error(`Invalid ${label}`);return value as number }
function decodeBits(bits:number,values:readonly string[]):readonly string[]{if(!Number.isSafeInteger(bits)||bits<0)throw new Error("Invalid bitset");return values.filter((_,index)=>Math.floor(bits/2**index)%2===1)}
function typedSymbol(value:unknown,corpus:CompactCorpus):boolean { if(typeof value!=="string")return false;return corpus.terms.some(dictionary=>dictionary.includes(value)) }

interface Candidate extends Omit<CompiledReferenceRecord,"disposition"|"reason"> { readonly provisional:ReferenceDisposition; readonly provisionalReason:string; readonly order:number }

export function compileReferenceCorpusData(input:unknown):ReferenceCompilationAudit {
  const corpus=input as CompactCorpus;
  if(corpus.v!=="4.0"||corpus.books.length!==7||corpus.families.length!==11_306)throw new Error("Unsupported or damaged reference corpus");
  const candidates:Candidate[]=[]; let order=0;
  corpus.rules.forEach((bookRules,bookIndex)=>bookRules.forEach((raw,ruleIndex)=>{
    if(raw.length<10)throw new Error(`Malformed record ${bookIndex}:${ruleIndex}`);
    const lineStart=integer(raw[0],"lineStart"),lineEnd=integer(raw[1],"lineEnd"),ruleTypeId=integer(raw[2],"ruleType"),sourceRoleId=integer(raw[3],"sourceRole"),scopeBits=integer(raw[4],"scopeBits"),confidenceByte=integer(raw[8],"confidence"),familyIndex=integer(raw[9],"familyIndex");
    const bookId=corpus.books[bookIndex]; const familyId=corpus.families[familyIndex]; if(!bookId||!familyId||lineStart<1||lineEnd<lineStart||confidenceByte<0||confidenceByte>255)throw new Error(`Invalid provenance ${bookIndex}:${ruleIndex}`);
    const rawConditions=raw[5]; const rawEffects=raw[6]; const rawTerms=raw[7]; if(!Array.isArray(rawConditions)||!Array.isArray(rawEffects)||!Array.isArray(rawTerms))throw new Error(`Invalid payload ${bookIndex}:${ruleIndex}`);
    let unsupported=false;
    let conditions:NormalizedReferenceCondition[]=rawConditions.map((entry)=>{if(!Array.isArray(entry)||entry.length<2)throw new Error("Invalid condition tuple");const op=enumValue(corpus,"condOp",integer(entry[0],"condition op"));const valueIndex=entry[1];const value=Array.isArray(valueIndex)?valueIndex.map(x=>corpus.values[integer(x,"value index")]):corpus.values[integer(valueIndex,"value index")];const kind=CONDITION_KIND[op];if(!kind||(op.startsWith("symbol.")&&!typedSymbol(value,corpus)))unsupported=true;return{kind:kind??"typed-symbol",operator:op,value}});
    const effects:ReferenceEffect[]=rawEffects.map((entry)=>{if(!Array.isArray(entry)||entry.length<3)throw new Error("Invalid effect tuple");return{operator:enumValue(corpus,"effOp",integer(entry[0],"effect op")),domains:decodeBits(integer(entry[1],"domain bits"),corpus.enums.domain??[]),polarity:enumValue(corpus,"polarity",integer(entry[2],"polarity"))}});
    const terms=Object.fromEntries(TERM_NAMES.map((name,index)=>[name,decodeBits(integer(rawTerms[index]??0,"term bits"),corpus.terms[index]??[])]));
    const elementTerms=terms.elements??[];const elementConditionIndexes=conditions.map((condition,index)=>condition.operator==="element.state"?index:-1).filter(index=>index>=0);if(elementConditionIndexes.length>0){if(elementTerms.length!==elementConditionIndexes.length)unsupported=true;else{const subjects=new Map(elementConditionIndexes.map((conditionIndex,index)=>[conditionIndex,elementTerms[index]!]));conditions=conditions.map((condition,index)=>condition.operator==="element.state"?{...condition,subject:subjects.get(index)!}:condition)}}
    const ruleType=enumValue(corpus,"ruleType",ruleTypeId),sourceRole=enumValue(corpus,"sourceRole",sourceRoleId),scopes=decodeBits(scopeBits,corpus.enums.scope??[]);
    let provisional:ReferenceDisposition="executable",provisionalReason="complete-canonical-rule";
    if(sourceRole==="case_observation"){provisional="fixture";provisionalReason="case-observation"}
    else if(sourceRole==="paratext"||sourceRole==="definition"||ruleType==="definition"||effects.every(effect=>effect.operator==="describe")){provisional="evidence";provisionalReason="explanatory-source"}
    else if(sourceRole==="critical_statement"){provisional="contested";provisionalReason="critical-or-conflicting-statement"}
    else if(conditions.length===0||effects.length===0||unsupported){provisional="deferred";provisionalReason=unsupported?"condition-not-canonically-typed":"incomplete-condition-or-effect"}
    candidates.push({recordId:`${bookId}:${lineStart}-${lineEnd}:${ruleIndex}`,bookId,lineStart,lineEnd,familyId,ruleType,sourceRole,scopes,conditions,effects,terms,extractionConfidence:confidenceByte/255,provisional,provisionalReason,order:order++});
  }));
  if(candidates.length!==37_231)throw new Error(`Expected 37231 source records, found ${candidates.length}`);
  const representatives=new Map<string,Candidate>();
  for(const candidate of candidates){if(candidate.provisional!=="executable")continue;const current=representatives.get(candidate.familyId);if(!current||candidate.conditions.length>current.conditions.length||(candidate.conditions.length===current.conditions.length&&candidate.effects.length>current.effects.length)||(candidate.conditions.length===current.conditions.length&&candidate.effects.length===current.effects.length&&candidate.extractionConfidence>current.extractionConfidence))representatives.set(candidate.familyId,candidate)}
  const records:CompiledReferenceRecord[]=candidates.map(candidate=>{if(candidate.provisional==="executable"&&representatives.get(candidate.familyId)!==candidate)return{...candidate,disposition:"evidence",reason:"duplicate-family-evidence"};return{...candidate,disposition:candidate.provisional,reason:candidate.provisionalReason}});
  const counts={executable:0,deferred:0,contested:0,evidence:0,fixture:0};for(const record of records)counts[record.disposition]++;
  return{schema:"senfate-reference-compilation-audit.v1",corpusVersion:corpus.v,total:records.length,families:corpus.families.length,counts,records};
}
