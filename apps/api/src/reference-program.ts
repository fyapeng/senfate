import programBytes from "../../../data/classical-rules/classical-runtime-program.v1.json.gz";
import type { CompiledReferenceRecord } from "@senfate/rules/compiler";

export interface ReferenceProgramStore {
  load():Promise<readonly CompiledReferenceRecord[]>;
}

let programPromise:Promise<readonly CompiledReferenceRecord[]>|undefined;

async function compileBundledProgram():Promise<readonly CompiledReferenceRecord[]> {
  const decompressed=new Blob([programBytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const payload=await new Response(decompressed).json() as Readonly<{schema?:string;records?:unknown}>;
  if(payload.schema!=="senfate-curated-runtime-program.v1"||!Array.isArray(payload.records)||payload.records.length!==4_158||payload.records.some(record=>!record||typeof record!=="object"||(record as {disposition?:unknown}).disposition!=="executable"))throw new Error("reference-program-integrity-error");
  return payload.records as readonly CompiledReferenceRecord[];
}

export const bundledReferenceProgram:ReferenceProgramStore={
  load(){programPromise??=compileBundledProgram();return programPromise;},
};
