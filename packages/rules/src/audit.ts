import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

export interface CorpusAudit {
  readonly valid: boolean;
  readonly version: string;
  readonly books: number;
  readonly records: number;
  readonly families: number;
  readonly bytes: number;
  readonly sha256: string;
}

interface CompactCorpus {
  readonly v: string;
  readonly books: readonly unknown[];
  readonly families: readonly unknown[];
  readonly rules: readonly (readonly unknown[])[];
}

export function auditCorpus(corpusPath: string): CorpusAudit {
  const bytes = readFileSync(corpusPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const corpus = JSON.parse(gunzipSync(bytes).toString("utf8")) as CompactCorpus;
  const records = corpus.rules.reduce((sum, bookRules) => sum + bookRules.length, 0);
  const audit = {
    valid:
      corpus.v === "4.0" &&
      corpus.books.length === 7 &&
      records === 37_231 &&
      corpus.families.length === 11_306 &&
      bytes.length === 641_575 &&
      sha256 === "44f8a77abac4c0a607ef87e697730e0bd8f6e9ce8bba5d9ce5abc1bf797cb4e4",
    version: corpus.v,
    books: corpus.books.length,
    records,
    families: corpus.families.length,
    bytes: bytes.length,
    sha256,
  } as const;
  return audit;
}
