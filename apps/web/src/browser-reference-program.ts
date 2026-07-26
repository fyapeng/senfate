import programUrl from "../../../data/classical-rules/classical-runtime-program.v1.json.gz?url";
import type { CompiledReferenceRecord } from "@senfate/rules/compiler";

let programPromise: Promise<readonly CompiledReferenceRecord[]> | undefined;

async function decodeCorpus(response: Response): Promise<unknown> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzip) return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  if (typeof DecompressionStream === "undefined") throw new Error("gzip-decompression-unavailable");
  const decompressed = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(decompressed).json() as Promise<unknown>;
}

export async function loadBrowserReferenceProgram(): Promise<readonly CompiledReferenceRecord[]> {
  programPromise ??= (async () => {
    const response = await fetch(programUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error("reference-program-download-failed");
    const payload = await decodeCorpus(response) as Readonly<{schema?:string;records?:unknown}>;
    if (payload.schema !== "senfate-curated-runtime-program.v1" || !Array.isArray(payload.records) || payload.records.length !== 4_332 || payload.records.some(record => !record || typeof record !== "object" || (record as {disposition?:unknown}).disposition !== "executable")) {
      throw new Error("reference-program-integrity-error");
    }
    return payload.records as readonly CompiledReferenceRecord[];
  })();
  return programPromise;
}
