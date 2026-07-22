import { describe,expect,it } from "vitest";
import { BRANCH_DEFINITIONS,detectRelationCandidates,sexagenary,sexagenaryIndex,tenGod } from "./ontology";

describe("canonical Bazi ontology",()=>{
  it("round-trips the sexagenary cycle",()=>{for(let index=0;index<60;index++){const value=sexagenary(index);expect(sexagenaryIndex(value.stem,value.branch)).toBe(index)}});
  it("derives ten gods relative to the day stem",()=>{expect(tenGod("甲","甲")).toBe("比肩");expect(tenGod("甲","丁")).toBe("伤官");expect(tenGod("甲","己")).toBe("正财");expect(tenGod("甲","庚")).toBe("七杀");expect(tenGod("甲","癸")).toBe("正印")});
  it("retains canonical hidden-stem order",()=>{expect(BRANCH_DEFINITIONS.丑.hiddenStems.map(x=>x.stem)).toEqual(["己","癸","辛"])});
  it("emits relation candidates without deciding effectiveness",()=>{const output=detectRelationCandidates(["甲","己"],["申","子","辰","午"]);expect(output).toContainEqual({kind:"stem-combine",members:["甲","己"],targetElement:"土"});expect(output).toContainEqual({kind:"three-harmony",members:["申","子","辰"],targetElement:"水"});expect(output).toContainEqual({kind:"branch-clash",members:["子","午"]})});
});
