import{describe,expect,it}from"vitest";
import{createHash}from"node:crypto";
import{readFileSync}from"node:fs";
import{fileURLToPath}from"node:url";
import{TRANSPARENT_BASELINE_MODEL}from"@senfate/core";
import{EPHEMERIS_MANIFEST,SOLAR_TERM_ENTRIES,compileCertifiedBaziCalendar,solarTermWindowAt}from"./index";
describe("pinned JPL solar-term table",()=>{
  it("matches the pinned table digest",()=>{const bytes=readFileSync(fileURLToPath(new URL("../data/solar-terms.jpl-de441.v1.json",import.meta.url)));expect(createHash("sha256").update(bytes).digest("hex")).toBe(EPHEMERIS_MANIFEST.sha256)});
  it("contains exactly 24 ordered terms per covered year",()=>{expect(SOLAR_TERM_ENTRIES).toHaveLength((EPHEMERIS_MANIFEST.endYear-EPHEMERIS_MANIFEST.startYear+1)*24);for(let index=1;index<SOLAR_TERM_ENTRIES.length;index++)expect(SOLAR_TERM_ENTRIES[index]!.utcMs).toBeGreaterThan(SOLAR_TERM_ENTRIES[index-1]!.utcMs)});
  it("maps the 2024 post-Lichun window to the first Bazi month",()=>{const result=solarTermWindowAt(Date.UTC(2024,1,5));expect(result.ok).toBe(true);if(!result.ok)return;expect(result.value).toMatchObject({baziYear:2024,monthOrdinal:0});expect(result.value.previousJieUtcMs).toBeGreaterThan(Date.UTC(2024,1,4,7));expect(result.value.previousJieUtcMs).toBeLessThan(Date.UTC(2024,1,4,10))});
  it("fails closed outside the pinned range",()=>{expect(solarTermWindowAt(Date.UTC(1800,0,1))).toMatchObject({ok:false,code:"outside-ephemeris-range"})});
  it("calculates pillars, luck direction and luck start from pinned data",()=>{const result=compileCertifiedBaziCalendar({year:2000,month:2,day:10,hour:12,minute:0,timeZone:"Asia/Shanghai",longitudeDegrees:121.4737,latitudeDegrees:31.2304},TRANSPARENT_BASELINE_MODEL,"male",2);expect(result.ok).toBe(true);if(!result.ok)return;expect(result.value.calendar.pillars.year).toMatchObject({stem:"庚",branch:"辰"});expect(result.value.calendar.direction).toBe("forward");expect(result.value.calendar.majorLuck).toHaveLength(2);expect(result.value.solarTermWindow.ephemerisDigest).toBe(EPHEMERIS_MANIFEST.sha256)});
});
