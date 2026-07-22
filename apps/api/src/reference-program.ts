import corpusBytes from "../../../data/classical-rules/classical-source-corpus.v4.0.json.gz";
import { compileReferenceCorpusData, type CompiledReferenceRecord } from "@senfate/rules/compiler";

export interface ReferenceProgramStore {
  load():Promise<readonly CompiledReferenceRecord[]>;
}

let programPromise:Promise<readonly CompiledReferenceRecord[]>|undefined;

async function compileBundledProgram():Promise<readonly CompiledReferenceRecord[]> {
  const decompressed=new Blob([corpusBytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const corpus=await new Response(decompressed).json() as unknown;
  const audit=compileReferenceCorpusData(corpus);
  if(audit.total!==37_231||audit.counts.executable!==4_118||audit.counts.deferred!==7_785||audit.counts.contested!==41)throw new Error("reference-program-integrity-error");
  return audit.records;
}

export const bundledReferenceProgram:ReferenceProgramStore={
  load(){programPromise??=compileBundledProgram();return programPromise;},
};
