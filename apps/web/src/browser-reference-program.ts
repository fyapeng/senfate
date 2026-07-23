import corpusUrl from "../../../data/classical-rules/classical-source-corpus.v4.0.json.gz?url";
import { compileReferenceCorpusData, type CompiledReferenceRecord } from "@senfate/rules/compiler";

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
    const response = await fetch(corpusUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error("reference-program-download-failed");
    const audit = compileReferenceCorpusData(await decodeCorpus(response));
    if (audit.total !== 37_231 || audit.counts.executable !== 4_118 || audit.counts.deferred !== 7_785 || audit.counts.contested !== 41) {
      throw new Error("reference-program-integrity-error");
    }
    return audit.records;
  })();
  return programPromise;
}
