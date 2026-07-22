import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditCorpus } from "./audit";

describe("canonical classical corpus", () => {
  it("matches the frozen 37,231-record baseline", () => {
    const audit = auditCorpus(resolve(process.cwd(), "../../data/classical-rules/classical-source-corpus.v4.0.json.gz"));
    expect(audit).toEqual({
      valid: true,
      version: "4.0",
      books: 7,
      records: 37_231,
      families: 11_306,
      bytes: 641_575,
      sha256: "44f8a77abac4c0a607ef87e697730e0bd8f6e9ce8bba5d9ce5abc1bf797cb4e4",
    });
  });
});
