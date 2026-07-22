import { interval, type ClosedInterval, type ClosedResult } from "./algebra";
import { BRANCHES, STEMS, modulo, sexagenary, type GanZhi } from "./ontology";
import type { SenFateModelProfile } from "./model";

export interface CivilBirthInput {
  readonly year: number; readonly month: number; readonly day: number;
  readonly hour: number; readonly minute: number; readonly second?: number;
  readonly utcOffsetMinutes: number; readonly longitudeDegrees: number; readonly latitudeDegrees: number;
  readonly clockUncertaintySeconds?: number; readonly coordinateUncertaintyMeters?: number;
}

export interface CalendarProfile {
  readonly id: string;
  readonly version: string;
  readonly useApparentSolarTime: boolean;
  readonly dayBoundary: "midnight" | "zi-initial";
  readonly luckDirection: "yang-male-yin-female-forward";
  readonly daysPerLuckYear: 3;
}

export interface SolarTermWindow {
  readonly ephemerisId: string; readonly ephemerisVersion: string;
  readonly baziYear: number; readonly monthOrdinal: number;
  readonly previousJieUtcMs: number; readonly nextJieUtcMs: number;
  readonly previousJieUncertaintySeconds?:number;readonly nextJieUncertaintySeconds?:number;
  readonly ephemerisDigest?:string;
}

export interface NormalizedBirthTime {
  readonly civilUtcMs: number; readonly apparentSolarWallTimeMs: number;
  readonly apparentSolarCorrectionMinutes: number; readonly equationOfTimeMinutes: number;
  readonly uncertaintySeconds: number;
}

export interface FourPillars { readonly year: GanZhi; readonly month: GanZhi; readonly day: GanZhi; readonly hour: GanZhi }
export interface MajorLuckPeriod { readonly ordinal: number; readonly pillar: GanZhi; readonly startAgeYears: number;readonly startAgeInterval:ClosedInterval; readonly startUtcMs: number;readonly startUtcInterval:ClosedInterval }
export interface BaziCalendarResult { readonly normalizedTime: NormalizedBirthTime; readonly pillars: FourPillars; readonly direction: "forward"|"reverse"; readonly luckStartAgeYears: number;readonly luckStartAgeInterval:ClosedInterval; readonly majorLuck: readonly MajorLuckPeriod[] }

export type CalendarFailure = "invalid-input"|"ephemeris-window-mismatch"|"boundary-ambiguous";

export function calendarProfileFromModel(model:SenFateModelProfile):CalendarProfile{return{id:model.id,version:model.version,useApparentSolarTime:model.calendar.useApparentSolarTime,dayBoundary:model.calendar.dayBoundary,luckDirection:"yang-male-yin-female-forward",daysPerLuckYear:model.calendar.daysPerLuckYear}}

function isGregorianDate(input: CivilBirthInput): boolean {
  const date = new Date(Date.UTC(input.year,input.month-1,input.day,input.hour,input.minute,input.second??0));
  return date.getUTCFullYear()===input.year&&date.getUTCMonth()===input.month-1&&date.getUTCDate()===input.day&&date.getUTCHours()===input.hour&&date.getUTCMinutes()===input.minute;
}

export function equationOfTimeMinutes(utcMs: number): number {
  const date = new Date(utcMs); const year=date.getUTCFullYear(); const start=Date.UTC(year,0,0); const day=Math.floor((Date.UTC(year,date.getUTCMonth(),date.getUTCDate())-start)/86_400_000); const daysInYear=(year%4===0&&year%100!==0)||year%400===0?366:365;
  const fractionalHour=date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600; const gamma=2*Math.PI/daysInYear*(day-1+(fractionalHour-12)/24);
  return 229.18*(0.000075+0.001868*Math.cos(gamma)-0.032077*Math.sin(gamma)-0.014615*Math.cos(2*gamma)-0.040849*Math.sin(2*gamma));
}

export function normalizeBirthTime(input: CivilBirthInput, profile: CalendarProfile): ClosedResult<NormalizedBirthTime,CalendarFailure> {
  const certificate={functional:"calendar.normalize",profile:`${profile.id}@${profile.version}`,input};
  if(!isGregorianDate(input)||Math.abs(input.utcOffsetMinutes)>14*60||input.longitudeDegrees < -180||input.longitudeDegrees>180||input.latitudeDegrees < -90||input.latitudeDegrees>90) return {ok:false,code:"invalid-input",reason:"Civil date, offset or coordinates are outside the supported domain",certificate};
  const civilWallTimeMs=Date.UTC(input.year,input.month-1,input.day,input.hour,input.minute,input.second??0);
  const civilUtcMs=civilWallTimeMs-input.utcOffsetMinutes*60_000;
  const eot=profile.useApparentSolarTime?equationOfTimeMinutes(civilWallTimeMs):0;
  const standardMeridian=input.utcOffsetMinutes/4;
  const longitudeCorrection=profile.useApparentSolarTime?4*(input.longitudeDegrees-standardMeridian):0;
  const correction=eot+longitudeCorrection;
  const coordinateSeconds=(input.coordinateUncertaintyMeters??0)/111_320*240;
  const uncertaintySeconds=(input.clockUncertaintySeconds??0)+coordinateSeconds+1;
  return {ok:true,value:{civilUtcMs,apparentSolarWallTimeMs:civilWallTimeMs+correction*60_000,apparentSolarCorrectionMinutes:correction,equationOfTimeMinutes:eot,uncertaintySeconds},certificate:{...certificate,standardMeridianDegrees:standardMeridian,longitudeCorrectionMinutes:longitudeCorrection}};
}

function gregorianJdn(year:number,month:number,day:number):number { const a=Math.floor((14-month)/12); const y=year+4800-a; const m=month+12*a-3; return day+Math.floor((153*m+2)/5)+365*y+Math.floor(y/4)-Math.floor(y/100)+Math.floor(y/400)-32045; }
function dateParts(utcMs:number):[number,number,number]{const d=new Date(utcMs);return[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()]}

export function compileBaziCalendar(input:CivilBirthInput,profile:CalendarProfile,terms:SolarTermWindow,sex:"female"|"male",periodCount=8):ClosedResult<BaziCalendarResult,CalendarFailure>{
  const normalized=normalizeBirthTime(input,profile); if(!normalized.ok)return normalized;
  const n=normalized.value; const birthLower=n.civilUtcMs-n.uncertaintySeconds*1000; const birthUpper=n.civilUtcMs+n.uncertaintySeconds*1000;
  const cert={functional:"calendar.pillars-and-luck",profile:`${profile.id}@${profile.version}`,ephemeris:`${terms.ephemerisId}@${terms.ephemerisVersion}`};
  const previousLatest=terms.previousJieUtcMs+(terms.previousJieUncertaintySeconds??0)*1000;const nextEarliest=terms.nextJieUtcMs-(terms.nextJieUncertaintySeconds??0)*1000;
  if(!(previousLatest<=birthLower&&birthUpper<nextEarliest)||terms.monthOrdinal<0||terms.monthOrdinal>11) return {ok:false,code:"ephemeris-window-mismatch",reason:"Birth interval is not strictly contained in the supplied solar-term uncertainty window",certificate:{...cert,previousLatest,nextEarliest}};
  const calcLower=n.apparentSolarWallTimeMs-n.uncertaintySeconds*1000; const calcUpper=n.apparentSolarWallTimeMs+n.uncertaintySeconds*1000;
  const shiftedLower=profile.dayBoundary==="zi-initial"?calcLower+3_600_000:calcLower; const shiftedUpper=profile.dayBoundary==="zi-initial"?calcUpper+3_600_000:calcUpper;
  if(dateParts(shiftedLower).join("-")!==dateParts(shiftedUpper).join("-")) return {ok:false,code:"boundary-ambiguous",reason:"Input uncertainty crosses the configured day boundary",certificate:cert};
  const [dayYear,dayMonth,dayDate]=dateParts(shiftedLower); const dayPillar=sexagenary(gregorianJdn(dayYear,dayMonth,dayDate)+49);
  const yearPillar=sexagenary(terms.baziYear-4); const yearStemIndex=STEMS.indexOf(yearPillar.stem);
  const monthPillar=baziMonthPillar(terms.baziYear,terms.monthOrdinal);const monthPillarIndex=sexagenaryIndexFromComponents(STEMS.indexOf(monthPillar.stem),BRANCHES.indexOf(monthPillar.branch));
  const hourBranchAt=(ms:number)=>modulo(Math.floor((new Date(ms).getUTCHours()+1)/2),12);
  const hbLower=hourBranchAt(calcLower); const hbUpper=hourBranchAt(calcUpper); if(hbLower!==hbUpper)return{ok:false,code:"boundary-ambiguous",reason:"Input uncertainty crosses a two-hour branch boundary",certificate:cert};
  const hourStemIndex=modulo((STEMS.indexOf(dayPillar.stem)%5)*2+hbLower,10); const hourPillarIndex=sexagenaryIndexFromComponents(hourStemIndex,hbLower);
  const yangYear=yearStemIndex%2===0; const direction=(yangYear&&sex==="male")||(!yangYear&&sex==="female")?"forward":"reverse";
  const intervalMs=direction==="forward"?terms.nextJieUtcMs-n.civilUtcMs:n.civilUtcMs-terms.previousJieUtcMs; const luckStartAgeYears=intervalMs/86_400_000/3;const termUncertaintySeconds=direction==="forward"?(terms.nextJieUncertaintySeconds??0):(terms.previousJieUncertaintySeconds??0);const luckAgeUncertaintyYears=(termUncertaintySeconds+n.uncertaintySeconds)/86_400/3;const luckStartAgeInterval=interval(Math.max(0,luckStartAgeYears-luckAgeUncertaintyYears),luckStartAgeYears+luckAgeUncertaintyYears,"years");
  const majorLuck=Array.from({length:periodCount},(_,index)=>{const ordinal=index+1; const pillar=sexagenary(monthPillarIndex+(direction==="forward"?ordinal:-ordinal)); const startAgeYears=luckStartAgeYears+index*10;const startAgeInterval=interval(luckStartAgeInterval.lower+index*10,luckStartAgeInterval.upper+index*10,"years");const startUtcMs=n.civilUtcMs+startAgeYears*365.2425*86_400_000;const startUtcUncertaintyMs=n.uncertaintySeconds*1000+luckAgeUncertaintyYears*365.2425*86_400_000;return{ordinal,pillar,startAgeYears,startAgeInterval,startUtcMs,startUtcInterval:interval(startUtcMs-startUtcUncertaintyMs,startUtcMs+startUtcUncertaintyMs,"unix-ms")};});
  return{ok:true,value:{normalizedTime:n,pillars:{year:yearPillar,month:monthPillar,day:dayPillar,hour:sexagenary(hourPillarIndex)},direction,luckStartAgeYears,luckStartAgeInterval,majorLuck},certificate:{...cert,dayCycleAnchor:"JDN+49 mod 60",luckConversion:"3 days = 1 year",luckAgeUncertaintyYears,termWindow:terms}};
}

export function baziMonthPillar(baziYear:number,monthOrdinal:number):GanZhi{const yearStemIndex=STEMS.indexOf(sexagenary(baziYear-4).stem);const stemIndex=modulo((yearStemIndex%5)*2+2+monthOrdinal,10);const branchIndex=modulo(2+monthOrdinal,12);return sexagenary(sexagenaryIndexFromComponents(stemIndex,branchIndex))}

function sexagenaryIndexFromComponents(stemIndex:number,branchIndex:number):number{for(let index=modulo(stemIndex,10);index<60;index+=10)if(index%12===modulo(branchIndex,12))return index;throw new Error("Stem and branch parity mismatch")}
