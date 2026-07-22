import{describe,expect,it}from"vitest";
import{ANALYSIS_SESSION_KEY,clearAnalysisSession,parseAnalysisSession,saveAnalysisSession,type AnalysisSessionSnapshot}from"./analysis-session";

const base:AnalysisSessionSnapshot={version:1,date:"1993-01-26",time:"05:30",targetYear:2026,sex:"female",clockUncertaintySeconds:60,useExactCoordinates:false,latitude:"",longitude:"",coordinateUncertaintyMeters:"100",disambiguation:"reject",query:"北京",activeTab:"命盘"};

describe("analysis workbench session",()=>{
  it("round-trips bounded form state",()=>expect(parseAnalysisSession(JSON.stringify(base))).toEqual(base));
  it("rejects malformed and out-of-range snapshots",()=>{expect(parseAnalysisSession("{" )).toBeUndefined();expect(parseAnalysisSession(JSON.stringify({...base,targetYear:2101}))).toBeUndefined();expect(parseAnalysisSession(JSON.stringify({...base,activeTab:"原始图"}))).toBeUndefined()});
  it("uses only the supplied session store",()=>{const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}};expect(saveAnalysisSession(storage,base)).toBe(true);expect(values.has(ANALYSIS_SESSION_KEY)).toBe(true);clearAnalysisSession(storage);expect(values.has(ANALYSIS_SESSION_KEY)).toBe(false)});
});
