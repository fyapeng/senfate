import { ANALYSIS_REQUEST_SCHEMA,ANALYSIS_RESPONSE_SCHEMA,type ApiAnalysisRequest, type ApiAnalysisResponse, type ApiLocation, type ApiSex } from "@senfate/contracts";

export const ANALYSIS_SESSION_KEY="senfate.analysis-workbench.v2";
export const ANALYSIS_TABS=["命盘","结构","格局与调候","大运","人生轨迹","年度主题","计算证书"] as const;
export type AnalysisTab=(typeof ANALYSIS_TABS)[number];

export interface AnalysisSessionSnapshot {
  readonly version:2;
  readonly date:string;
  readonly time:string;
  readonly targetYear:number;
  readonly sex:ApiSex;
  readonly clockUncertaintySeconds:number;
  readonly useExactCoordinates:boolean;
  readonly latitude:string;
  readonly longitude:string;
  readonly coordinateUncertaintyMeters:string;
  readonly disambiguation:"earlier"|"later"|"reject";
  readonly query:string;
  readonly selectedLocation?:ApiLocation;
  readonly resultLocationLabel?:string;
  readonly request?:ApiAnalysisRequest;
  readonly result?:ApiAnalysisResponse;
  readonly activeTab:AnalysisTab;
}

interface SessionStorageLike {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
function record(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null&&!Array.isArray(value)}
function location(value:unknown):value is ApiLocation{return record(value)&&Number.isInteger(value.id)&&typeof value.displayName==="string"&&typeof value.timeZone==="string"&&typeof value.latitude==="number"&&typeof value.longitude==="number"}
function analysis(value:unknown):value is ApiAnalysisResponse{return record(value)&&value.schemaVersion===ANALYSIS_RESPONSE_SCHEMA&&record(value.calendar)&&record(value.structure)&&record(value.annual)}
function finite(value:unknown):value is number{return typeof value==="number"&&Number.isFinite(value)}
function request(value:unknown):value is ApiAnalysisRequest{const keys=["schemaVersion","targetYear","locationId","localDateTime","sex","modelId","modelOverrides","exactCoordinates","disambiguation","clockUncertaintySeconds","periodCount"];return record(value)&&Object.keys(value).every(key=>keys.includes(key))&&value.schemaVersion===ANALYSIS_REQUEST_SCHEMA&&Number.isInteger(value.targetYear)&&Number(value.targetYear)>=1850&&Number(value.targetYear)<=2100&&Number.isInteger(value.locationId)&&record(value.localDateTime)&&Number.isInteger(value.localDateTime.year)&&Number.isInteger(value.localDateTime.month)&&Number.isInteger(value.localDateTime.day)&&Number.isInteger(value.localDateTime.hour)&&Number.isInteger(value.localDateTime.minute)&&(value.sex==="female"||value.sex==="male")&&(value.modelId===undefined||value.modelId==="transparent-baseline"||value.modelId==="month-command"||value.modelId==="climate-priority")&&(value.disambiguation===undefined||value.disambiguation==="earlier"||value.disambiguation==="later"||value.disambiguation==="reject")&&(value.modelOverrides===undefined||record(value.modelOverrides))&&(value.exactCoordinates===undefined||record(value.exactCoordinates))}

export function parseAnalysisSession(raw:string|null):AnalysisSessionSnapshot|undefined{
  if(!raw)return undefined;let value:unknown;try{value=JSON.parse(raw)}catch{return undefined}
  if(!record(value)||value.version!==2||typeof value.date!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(value.date)||typeof value.time!=="string"||!/^[0-9]{2}:[0-9]{2}$/u.test(value.time)||!Number.isInteger(value.targetYear)||Number(value.targetYear)<1850||Number(value.targetYear)>2100||(value.sex!=="female"&&value.sex!=="male")||!finite(value.clockUncertaintySeconds)||typeof value.useExactCoordinates!=="boolean"||typeof value.latitude!=="string"||typeof value.longitude!=="string"||typeof value.coordinateUncertaintyMeters!=="string"||(value.disambiguation!=="earlier"&&value.disambiguation!=="later"&&value.disambiguation!=="reject")||typeof value.query!=="string"||!ANALYSIS_TABS.includes(value.activeTab as AnalysisTab))return undefined;
  if(value.selectedLocation!==undefined&&!location(value.selectedLocation))return undefined;if(value.resultLocationLabel!==undefined&&(typeof value.resultLocationLabel!=="string"||value.resultLocationLabel.length<1))return undefined;
  const calculationRequest=value.request!==undefined&&request(value.request)?value.request:undefined;if(value.request!==undefined&&!calculationRequest)return undefined;
  const result=value.result!==undefined&&analysis(value.result)?value.result:undefined;
  if(result&&(!calculationRequest||calculationRequest.targetYear!==result.annual.targetYear||calculationRequest.targetYear!==Number(value.targetYear)))return undefined;
  return{version:2,date:value.date,time:value.time,targetYear:Number(value.targetYear),sex:value.sex,clockUncertaintySeconds:value.clockUncertaintySeconds,useExactCoordinates:value.useExactCoordinates,latitude:value.latitude,longitude:value.longitude,coordinateUncertaintyMeters:value.coordinateUncertaintyMeters,disambiguation:value.disambiguation,query:value.query,...(value.selectedLocation?{selectedLocation:value.selectedLocation}:{}),...(typeof value.resultLocationLabel==="string"?{resultLocationLabel:value.resultLocationLabel}:{}),...(calculationRequest?{request:calculationRequest}:{}),...(result?{result}:{}),activeTab:value.activeTab as AnalysisTab};
}

export function loadAnalysisSession(storage:SessionStorageLike):AnalysisSessionSnapshot|undefined{try{return parseAnalysisSession(storage.getItem(ANALYSIS_SESSION_KEY))}catch{return undefined}}
export function saveAnalysisSession(storage:SessionStorageLike,snapshot:AnalysisSessionSnapshot):boolean{try{storage.setItem(ANALYSIS_SESSION_KEY,JSON.stringify(snapshot));return true}catch{return false}}
export function clearAnalysisSession(storage:SessionStorageLike):void{try{storage.removeItem(ANALYSIS_SESSION_KEY)}catch{}}
