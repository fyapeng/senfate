import { fileURLToPath } from "node:url";
import { describe,expect,it } from "vitest";
import { compileReferenceCorpus } from "./compiler";

const corpusPath=fileURLToPath(new URL("../../../data/classical-rules/classical-source-corpus.v4.0.json.gz",import.meta.url));
describe("reference corpus compiler",()=>{
  it("assigns every source record exactly one explicit disposition",()=>{const audit=compileReferenceCorpus(corpusPath);expect(audit.total).toBe(37_231);expect(Object.values(audit.counts).reduce((a,b)=>a+b,0)).toBe(37_231);expect(audit.families).toBe(11_306)});
  it("allows at most one executable representative per family",()=>{const audit=compileReferenceCorpus(corpusPath);const executable=audit.records.filter(record=>record.disposition==="executable");expect(new Set(executable.map(record=>record.familyId)).size).toBe(executable.length)});
  it("never promotes untyped generic symbol conditions",()=>{const audit=compileReferenceCorpus(corpusPath);for(const record of audit.records.filter(record=>record.disposition==="executable"))expect(record.reason).not.toBe("condition-not-canonically-typed")});
});
