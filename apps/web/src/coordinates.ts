import type { ApiCalendarRequest } from "@senfate/contracts";

export interface ExactCoordinateState {
  readonly enabled:boolean;
  readonly latitude:string;
  readonly longitude:string;
  readonly uncertaintyMeters:string;
}

export type ExactCoordinateValidation=
  | Readonly<{valid:true;value?:ApiCalendarRequest["exactCoordinates"]}>
  | Readonly<{valid:false;reason:string}>;

export function validateExactCoordinates(input:ExactCoordinateState):ExactCoordinateValidation{
  if(!input.enabled)return{valid:true};
  if(input.latitude.trim()===""||input.longitude.trim()===""||input.uncertaintyMeters.trim()==="")return{valid:false,reason:"请填写完整的经纬度与坐标误差。"};
  const latitude=Number(input.latitude),longitude=Number(input.longitude),uncertaintyMeters=Number(input.uncertaintyMeters);
  if(!Number.isFinite(latitude)||latitude< -90||latitude>90)return{valid:false,reason:"纬度必须位于 -90 至 90 度。"};
  if(!Number.isFinite(longitude)||longitude< -180||longitude>180)return{valid:false,reason:"经度必须位于 -180 至 180 度。"};
  if(!Number.isFinite(uncertaintyMeters)||uncertaintyMeters<0||uncertaintyMeters>1_000_000)return{valid:false,reason:"坐标误差必须位于 0 至 1,000,000 米。"};
  return{valid:true,value:{latitude,longitude,uncertaintyMeters}};
}

export function formatCoordinateUncertainty(uncertaintyMeters:number):string{
  if(uncertaintyMeters<1000)return`±${Math.round(uncertaintyMeters)} 米`;
  return`±${new Intl.NumberFormat("zh-CN",{maximumFractionDigits:1}).format(uncertaintyMeters/1000)} 公里`;
}
