import { fileURLToPath } from "node:url";
import { describe,expect,it } from "vitest";
import { compileReferenceCorpus } from "./node";

const corpusPath=fileURLToPath(new URL("../../../data/classical-rules/classical-source-corpus.v4.0.json.gz",import.meta.url));
describe("reference corpus compiler",()=>{
  it("assigns every source record exactly one explicit disposition",()=>{const audit=compileReferenceCorpus(corpusPath);expect(audit.total).toBe(37_231);expect(Object.values(audit.counts).reduce((a,b)=>a+b,0)).toBe(37_231);expect(audit.families).toBe(11_306)});
  it("allows at most one executable representative per family",()=>{const audit=compileReferenceCorpus(corpusPath);const executable=audit.records.filter(record=>record.disposition==="executable");expect(new Set(executable.map(record=>record.familyId)).size).toBe(executable.length)});
  it("maps symbol abundance to an explicit element-state condition",()=>{const audit=compileReferenceCorpus(corpusPath);const mapped=audit.records.filter(record=>record.disposition==="executable"&&record.conditions.some(condition=>condition.operator==="element.state"&&condition.value==="abundant"));expect(mapped.length).toBeGreaterThan(0);for(const record of mapped)for(const condition of record.conditions.filter(condition=>condition.operator==="element.state"&&condition.value==="abundant"))expect(condition.subject).toMatch(/^[木火土金水]$/u)});
  it("defers element states without an unambiguous element binding",()=>{const audit=compileReferenceCorpus(corpusPath);for(const record of audit.records.filter(record=>record.disposition==="executable"))for(const condition of record.conditions.filter(condition=>condition.operator==="element.state"))expect(condition.subject).toMatch(/^[木火土金水]$/u)});
});
