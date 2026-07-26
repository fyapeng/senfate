import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";

it("includes reviewed semantic curations in the public runtime program",()=>{
  const path=fileURLToPath(new URL("../../../data/classical-rules/classical-runtime-program.v1.json.gz",import.meta.url));
  const payload=JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as {records:readonly Record<string,unknown>[]};
  expect(payload.records).toHaveLength(4_330);
  expect(payload.records.find(record=>record.recordId==="curated:shen-feng-tong-kao:1301:build-lu-ancestry")).toMatchObject({
    bookId:"shen-feng-tong-kao",lineStart:1301,scopes:["natal"],
    conditions:[{operator:"dayStem.equals",value:"甲"},{operator:"monthBranch.equals",value:"寅"}],
    effects:[{operator:"pressure",domains:["family"],polarity:"pressure"}],reason:"semantic-curation",
  });
});
