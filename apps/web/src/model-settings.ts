import type {ApiModelId,ApiModelOverrides} from "@senfate/contracts";

export const MODEL_SETTINGS_STORAGE_KEY="senfate.public-model-settings.v1";
export interface StoredModelSettings {readonly schema:"senfate-web-model-settings.v1";readonly baseModelId:ApiModelId;readonly overrides:ApiModelOverrides}

function isModelId(value:unknown):value is ApiModelId{return value==="transparent-baseline"||value==="month-command"||value==="climate-priority"}
export function loadModelSettings():StoredModelSettings|undefined{try{const raw=window.localStorage.getItem(MODEL_SETTINGS_STORAGE_KEY);if(!raw)return undefined;const value=JSON.parse(raw) as Partial<StoredModelSettings>;return value.schema==="senfate-web-model-settings.v1"&&isModelId(value.baseModelId)&&value.overrides&&typeof value.overrides==="object"?value as StoredModelSettings:undefined}catch{return undefined}}
export function saveModelSettings(settings:StoredModelSettings):void{window.localStorage.setItem(MODEL_SETTINGS_STORAGE_KEY,JSON.stringify(settings))}
export function clearModelSettings():void{window.localStorage.removeItem(MODEL_SETTINGS_STORAGE_KEY)}
export function modelOverrideCount(overrides:ApiModelOverrides):number{return Object.keys(overrides.temporalLayers??{}).length+Object.keys(overrides.pattern??{}).length+Object.keys(overrides.climate??{}).length+Object.keys(overrides.balancing??{}).length+Object.keys(overrides.topics?.domainWeights??{}).length}

export function valuesWithOverrides(base:Readonly<Record<string,number>>,overrides:ApiModelOverrides):Record<string,number>{return{...base,...Object.fromEntries(Object.entries(overrides.temporalLayers??{}).map(([key,value])=>[`temporalLayers.${key}`,value])),...Object.fromEntries(Object.entries(overrides.pattern??{}).map(([key,value])=>[`pattern.${key}`,value])),...Object.fromEntries(Object.entries(overrides.climate??{}).map(([key,value])=>[`climate.${key}`,value])),...Object.fromEntries(Object.entries(overrides.balancing??{}).map(([key,value])=>[`balancing.${key}`,value])),...Object.fromEntries(Object.entries(overrides.topics?.domainWeights??{}).map(([key,value])=>[`topics.domainWeights.${key}`,value]))}}
export function overridesFromValues(base:Readonly<Record<string,number>>,values:Readonly<Record<string,number>>):ApiModelOverrides{
  const temporalLayers:Record<string,number>={};const pattern:Record<string,number>={};const climate:Record<string,number>={};const balancing:Record<string,number>={};const domainWeights:Record<string,number>={};
  for(const[path,value]of Object.entries(values)){if(base[path]===undefined||Math.abs(base[path]-value)<1e-9)continue;const parts=path.split(".");if(parts[0]==="temporalLayers")temporalLayers[parts[1]]=value;else if(parts[0]==="pattern")pattern[parts[1]]=value;else if(parts[0]==="climate")climate[parts[1]]=value;else if(parts[0]==="balancing")balancing[parts[1]]=value;else if(parts[0]==="topics"&&parts[1]==="domainWeights")domainWeights[parts[2]]=value}
  return{...(Object.keys(temporalLayers).length?{temporalLayers}:{}),...(Object.keys(pattern).length?{pattern}:{}),...(Object.keys(climate).length?{climate}:{}),...(Object.keys(balancing).length?{balancing}:{}),...(Object.keys(domainWeights).length?{topics:{domainWeights}}:{})};
}
