import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { compileReferenceCorpusData, type ReferenceCompilationAudit } from "./compiler.ts";

export function compileReferenceCorpus(corpusPath: string): ReferenceCompilationAudit {
  const bytes = readFileSync(corpusPath);
  const corpus = JSON.parse(gunzipSync(bytes).toString("utf8")) as unknown;
  return compileReferenceCorpusData(corpus);
}
