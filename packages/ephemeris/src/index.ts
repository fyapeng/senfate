import{calendarProfileFromModel,compileBaziCalendar,resolveZonedCivilBirth,type BaziCalendarResult,type ClosedResult,type CalendarFailure,type ResolvedZonedBirth,type SenFateModelProfile,type SolarTermWindow,type TimeZoneFailure,type ZonedCivilBirthInput}from"@senfate/core";
import tableJson from"../data/solar-terms.jpl-de441.v1.json";
import manifestJson from"../data/manifest.json";

export type SolarTermKind="jie"|"qi";
export interface SolarTermEntry{readonly utcMs:number;readonly longitude:number;readonly name:string;readonly kind:SolarTermKind;readonly uncertaintySeconds:number}
export interface EphemerisManifest{readonly schema:"senfate-ephemeris-manifest.v1";readonly sha256:string;readonly terms:number;readonly startYear:number;readonly endYear:number;readonly sourceEphemeris:string;readonly generatedAt:string}
export type EphemerisFailure="outside-ephemeris-range"|"invalid-ephemeris-table";
export type CertifiedCalendarFailure=EphemerisFailure|TimeZoneFailure|CalendarFailure;
export interface CertifiedBaziCalendarResult{readonly schema:"senfate-certified-bazi-calendar.v1";readonly zonedBirth:ResolvedZonedBirth;readonly solarTermWindow:SolarTermWindow;readonly calendar:BaziCalendarResult}

type RawEntry=readonly[number,number,string,SolarTermKind,number];
const raw=tableJson.entries as unknown as readonly RawEntry[];
export const SOLAR_TERM_ENTRIES:readonly SolarTermEntry[]=raw.map(([utcMs,longitude,name,kind,uncertaintySeconds])=>({utcMs,longitude,name,kind,uncertaintySeconds}));
export const EPHEMERIS_MANIFEST=manifestJson as EphemerisManifest;
const JIE_ORDINAL:Readonly<Record<number,number>>={315:0,345:1,15:2,45:3,75:4,105:5,135:6,165:7,195:8,225:9,255:10,285:11};
const JIE=SOLAR_TERM_ENTRIES.filter(entry=>entry.kind==="jie");

function validTable():boolean{return SOLAR_TERM_ENTRIES.length===EPHEMERIS_MANIFEST.terms&&SOLAR_TERM_ENTRIES.every((entry,index)=>Number.isFinite(entry.utcMs)&&entry.longitude%15===0&&(index===0||entry.utcMs>SOLAR_TERM_ENTRIES[index-1]!.utcMs))&&JIE.every(entry=>JIE_ORDINAL[entry.longitude]!==undefined)}
const TABLE_IS_VALID=validTable();

export function solarTermWindowAt(utcMs:number):ClosedResult<SolarTermWindow,EphemerisFailure>{
  const certificate={functional:"ephemeris.solar-term-window",ephemeris:`JPL-DE441@${EPHEMERIS_MANIFEST.generatedAt}`,digest:EPHEMERIS_MANIFEST.sha256};if(!Number.isFinite(utcMs)||!TABLE_IS_VALID)return{ok:false,code:"invalid-ephemeris-table",reason:"Solar-term table failed integrity validation",certificate};
  let lower=0,upper=JIE.length;while(lower<upper){const middle=(lower+upper)>>>1;if(JIE[middle]!.utcMs<=utcMs)lower=middle+1;else upper=middle}const previous=JIE[lower-1],next=JIE[lower];if(!previous||!next)return{ok:false,code:"outside-ephemeris-range",reason:`Timestamp is outside ${EPHEMERIS_MANIFEST.startYear}-${EPHEMERIS_MANIFEST.endYear} solar-term coverage`,certificate};
  const monthOrdinal=JIE_ORDINAL[previous.longitude];if(monthOrdinal===undefined)return{ok:false,code:"invalid-ephemeris-table",reason:"Previous jie has no Bazi month mapping",certificate};const eventYear=new Date(previous.utcMs).getUTCFullYear();const baziYear=previous.longitude===285?eventYear-1:eventYear;
  return{ok:true,value:{ephemerisId:"NASA-JPL-Horizons",ephemerisVersion:`DE441:${EPHEMERIS_MANIFEST.generatedAt}`,ephemerisDigest:EPHEMERIS_MANIFEST.sha256,baziYear,monthOrdinal,previousJieUtcMs:previous.utcMs,nextJieUtcMs:next.utcMs,previousJieUncertaintySeconds:previous.uncertaintySeconds,nextJieUncertaintySeconds:next.uncertaintySeconds},certificate:{...certificate,previous:{name:previous.name,longitude:previous.longitude,uncertaintySeconds:previous.uncertaintySeconds},next:{name:next.name,longitude:next.longitude,uncertaintySeconds:next.uncertaintySeconds}}};
}

export function compileCertifiedBaziCalendar(input:ZonedCivilBirthInput,model:SenFateModelProfile,sex:"female"|"male",tzdbVersion:string,periodCount=8):ClosedResult<CertifiedBaziCalendarResult,CertifiedCalendarFailure>{
  const zoned=resolveZonedCivilBirth(input,tzdbVersion);if(!zoned.ok)return zoned;const terms=solarTermWindowAt(zoned.value.selected.utcMs);if(!terms.ok)return terms;const calendar=compileBaziCalendar(zoned.value.civilBirth,calendarProfileFromModel(model),terms.value,sex,periodCount);if(!calendar.ok)return calendar;
  return{ok:true,value:{schema:"senfate-certified-bazi-calendar.v1",zonedBirth:zoned.value,solarTermWindow:terms.value,calendar:calendar.value},certificate:{functional:"calendar.certified-bazi",model:`${model.id}@${model.version}`,tzdbVersion,ephemerisDigest:EPHEMERIS_MANIFEST.sha256,location:{timeZone:input.timeZone,longitude:input.longitudeDegrees,latitude:input.latitudeDegrees},upstream:{timeZone:zoned.certificate,solarTerms:terms.certificate,calendar:calendar.certificate}}};
}
