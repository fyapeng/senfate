import { fileURLToPath } from "node:url";
import { compileReferenceCorpus } from "../src/compiler.ts";

const corpusPath=fileURLToPath(new URL("../../../data/classical-rules/classical-source-corpus.v4.0.json.gz",import.meta.url));
const audit=compileReferenceCorpus(corpusPath);
if(audit.total!==37_231||Object.values(audit.counts).reduce((sum,value)=>sum+value,0)!==audit.total)throw new Error("Reference compilation is incomplete");
process.stdout.write(`${JSON.stringify({schema:audit.schema,corpusVersion:audit.corpusVersion,total:audit.total,families:audit.families,counts:audit.counts},null,2)}\n`);
