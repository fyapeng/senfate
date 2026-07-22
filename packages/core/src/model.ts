import { BRANCHES, ELEMENTS, type Branch, type Element, type RelationKind } from "./ontology";

export const MODEL_PROFILE_SCHEMA="senfate-model-profile.v2" as const;
export type PillarPosition="year"|"month"|"day"|"hour";
export interface ModelParameterMetadata {readonly path:string;readonly label:string;readonly unit:"coefficient"|"ratio"|"iterations";readonly minimum:number;readonly maximum:number;readonly step:number;readonly stage:string}
export interface SenFateModelProfile {
  readonly schema:typeof MODEL_PROFILE_SCHEMA;readonly id:string;readonly version:string;readonly label:string;
  readonly calendar:Readonly<{useApparentSolarTime:boolean;dayBoundary:"midnight"|"zi-initial";daysPerLuckYear:3}>;
  readonly elementMeasure:Readonly<{visiblePosition:Readonly<Record<PillarPosition,number>>;hiddenRank:Readonly<{main:number;middle:number;residual:number}>;seasonalMultiplier:Readonly<Record<Branch,Readonly<Record<Element,number>>>>}>;
  readonly strength:Readonly<{sameElement:number;resource:number;output:number;wealth:number;officer:number;rootBonus:number;thresholds:Readonly<{veryWeakUpper:number;weakUpper:number;strongLower:number;veryStrongLower:number}>}>;
  readonly temporalLayers:Readonly<{natal:number;luck:number;annual:number}>;
  readonly relationResolution:Readonly<{basePriority:Readonly<Record<RelationKind,number>>;completeness:number;seasonalSupport:number;exposure:number;rootedness:number;currentLayer:number;effectiveThreshold:number;transformThreshold:number;conflictMargin:number;maxIterations:number}>;
  readonly pattern:Readonly<{monthCommand:number;exposure:number;rootedness:number;qualificationThreshold:number;conflictMargin:number}>;
  readonly climate:Readonly<{temperature:number;humidity:number;seasonalCommand:number}>;
  readonly balancing:Readonly<{strength:number;climate:number;relationStability:number;decisionThreshold:number}>;
  readonly topics:Readonly<{domainWeights:Readonly<Record<string,number>>;unresolvedContribution:0}>;
}

export interface ModelValidationIssue {readonly path:string;readonly message:string}
const DOMAIN_KEYS=["career","family","general","health","mobility","personality","relationship","risk","study","wealth"] as const;
export const MODEL_PARAMETER_METADATA:readonly ModelParameterMetadata[]=[
  {path:"elementMeasure.visiblePosition.*",label:"四柱位置权重",unit:"coefficient",minimum:0,maximum:4,step:.05,stage:"element-measure"},
  {path:"elementMeasure.hiddenRank.*",label:"藏干主中余气权重",unit:"coefficient",minimum:0,maximum:1,step:.05,stage:"element-measure"},
  {path:"elementMeasure.seasonalMultiplier.*.*",label:"月令季节乘数",unit:"coefficient",minimum:0,maximum:3,step:.05,stage:"element-measure"},
  {path:"strength.*",label:"强弱关系系数",unit:"coefficient",minimum:0,maximum:4,step:.05,stage:"strength"},
  {path:"strength.thresholds.*",label:"强弱分级阈值",unit:"ratio",minimum:0,maximum:1,step:.01,stage:"strength"},
  {path:"temporalLayers.*",label:"原局、大运、流年层权重",unit:"coefficient",minimum:0,maximum:4,step:.05,stage:"dynamic-state"},
  {path:"relationResolution.*",label:"关系裁决参数",unit:"coefficient",minimum:0,maximum:10,step:.05,stage:"relation-resolution"},
  {path:"relationResolution.maxIterations",label:"正规形迭代上限",unit:"iterations",minimum:1,maximum:1000,step:1,stage:"normal-form"},
  {path:"pattern.*",label:"格局候选参数",unit:"coefficient",minimum:0,maximum:10,step:.05,stage:"pattern"},
  {path:"climate.*",label:"调候坐标权重",unit:"coefficient",minimum:0,maximum:4,step:.05,stage:"climate"},
  {path:"balancing.*",label:"扶抑候选参数",unit:"coefficient",minimum:0,maximum:4,step:.05,stage:"balancing"},
  {path:"topics.domainWeights.*",label:"主题显示权重",unit:"coefficient",minimum:0,maximum:4,step:.05,stage:"topic-projection"},
] as const;

const dominantElement:Readonly<Record<Branch,Element>>={子:"水",丑:"土",寅:"木",卯:"木",辰:"土",巳:"火",午:"火",未:"土",申:"金",酉:"金",戌:"土",亥:"水"};
function seasonalTable(dominant:number,other=1):Record<Branch,Record<Element,number>>{return Object.fromEntries(BRANCHES.map(branch=>[branch,Object.fromEntries(ELEMENTS.map(element=>[element,dominantElement[branch]===element?dominant:other]))])) as Record<Branch,Record<Element,number>>}
const relationBase:Record<RelationKind,number>={"stem-combine":1,"branch-combine":1,"branch-clash":1,"branch-harm":.75,"branch-break":.6,"branch-punishment":.8,"three-harmony":1.5,"three-meeting":1.5};
const domainWeights=Object.fromEntries(DOMAIN_KEYS.map(key=>[key,1]));

export const TRANSPARENT_BASELINE_MODEL:SenFateModelProfile={schema:MODEL_PROFILE_SCHEMA,id:"transparent-baseline",version:"0.4.0",label:"透明综合基准",calendar:{useApparentSolarTime:true,dayBoundary:"zi-initial",daysPerLuckYear:3},elementMeasure:{visiblePosition:{year:.8,month:1.15,day:1,hour:.85},hiddenRank:{main:1,middle:.55,residual:.3},seasonalMultiplier:seasonalTable(1.35)},strength:{sameElement:1,resource:1,output:1,wealth:1,officer:1,rootBonus:.15,thresholds:{veryWeakUpper:.25,weakUpper:.42,strongLower:.58,veryStrongLower:.75}},temporalLayers:{natal:1,luck:1,annual:1},relationResolution:{basePriority:relationBase,completeness:1,seasonalSupport:1,exposure:.75,rootedness:.75,currentLayer:1,effectiveThreshold:2.5,transformThreshold:4,conflictMargin:.25,maxIterations:64},pattern:{monthCommand:2,exposure:1,rootedness:1,qualificationThreshold:2.5,conflictMargin:.25},climate:{temperature:1,humidity:1,seasonalCommand:1},balancing:{strength:1,climate:1,relationStability:.25,decisionThreshold:.2},topics:{domainWeights,unresolvedContribution:0}};
export const MONTH_COMMAND_MODEL:SenFateModelProfile={...TRANSPARENT_BASELINE_MODEL,id:"month-command",label:"月令结构优先",elementMeasure:{...TRANSPARENT_BASELINE_MODEL.elementMeasure,visiblePosition:{...TRANSPARENT_BASELINE_MODEL.elementMeasure.visiblePosition,month:1.5},seasonalMultiplier:seasonalTable(1.65)},relationResolution:{...TRANSPARENT_BASELINE_MODEL.relationResolution,seasonalSupport:1.35},pattern:{...TRANSPARENT_BASELINE_MODEL.pattern,monthCommand:2.75,exposure:1.25}};
export const CLIMATE_PRIORITY_MODEL:SenFateModelProfile={...TRANSPARENT_BASELINE_MODEL,id:"climate-priority",label:"调候优先",climate:{temperature:1.6,humidity:1.6,seasonalCommand:1.35},balancing:{...TRANSPARENT_BASELINE_MODEL.balancing,climate:1.6}};
export const MODEL_PRESETS:readonly SenFateModelProfile[]=[TRANSPARENT_BASELINE_MODEL,MONTH_COMMAND_MODEL,CLIMATE_PRIORITY_MODEL];

function range(issues:ModelValidationIssue[],path:string,value:number,min:number,max:number):void{if(!Number.isFinite(value)||value<min||value>max)issues.push({path,message:`Expected a finite value in [${min}, ${max}]`})}
export function validateModelProfile(profile:SenFateModelProfile):readonly ModelValidationIssue[]{const issues:ModelValidationIssue[]=[];if(profile.schema!==MODEL_PROFILE_SCHEMA)issues.push({path:"schema",message:"Unsupported model schema"});if(!profile.id||!profile.version)issues.push({path:"identity",message:"Model ID and version are required"});for(const [key,value]of Object.entries(profile.elementMeasure.visiblePosition))range(issues,`elementMeasure.visiblePosition.${key}`,value,0,4);for(const [key,value]of Object.entries(profile.elementMeasure.hiddenRank))range(issues,`elementMeasure.hiddenRank.${key}`,value,0,1);for(const branch of BRANCHES)for(const element of ELEMENTS)range(issues,`elementMeasure.seasonalMultiplier.${branch}.${element}`,profile.elementMeasure.seasonalMultiplier[branch][element],0,3);for(const key of ["sameElement","resource","output","wealth","officer","rootBonus"] as const)range(issues,`strength.${key}`,profile.strength[key],0,4);for(const [key,value]of Object.entries(profile.temporalLayers))range(issues,`temporalLayers.${key}`,value,0,4);const t=profile.strength.thresholds;for(const[key,value]of Object.entries(t))range(issues,`strength.thresholds.${key}`,value,0,1);if(!(t.veryWeakUpper<t.weakUpper&&t.weakUpper<t.strongLower&&t.strongLower<t.veryStrongLower))issues.push({path:"strength.thresholds",message:"Strength thresholds must be strictly increasing"});for(const [key,value]of Object.entries(profile.relationResolution.basePriority))range(issues,`relationResolution.basePriority.${key}`,value,0,10);for(const key of ["completeness","seasonalSupport","exposure","rootedness","currentLayer","effectiveThreshold","transformThreshold","conflictMargin"] as const)range(issues,`relationResolution.${key}`,profile.relationResolution[key],0,10);range(issues,"relationResolution.maxIterations",profile.relationResolution.maxIterations,1,1000);if(!Number.isInteger(profile.relationResolution.maxIterations))issues.push({path:"relationResolution.maxIterations",message:"Iteration limit must be an integer"});for(const [key,value]of Object.entries(profile.pattern))range(issues,`pattern.${key}`,value,0,10);for(const [key,value]of Object.entries(profile.climate))range(issues,`climate.${key}`,value,0,4);for(const [key,value]of Object.entries(profile.balancing))range(issues,`balancing.${key}`,value,0,4);for(const domain of DOMAIN_KEYS)range(issues,`topics.domainWeights.${domain}`,profile.topics.domainWeights[domain]??Number.NaN,0,4);return issues}

function canonical(value:unknown):unknown{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));return value}
export function serializeModelProfile(profile:SenFateModelProfile):string{const issues=validateModelProfile(profile);if(issues.length)throw new Error(`Invalid model profile: ${issues.map(x=>x.path).join(", ")}`);return JSON.stringify(canonical(profile))}
