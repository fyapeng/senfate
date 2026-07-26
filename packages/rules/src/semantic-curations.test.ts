import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";

it("includes reviewed semantic curations in the public runtime program",()=>{
  const path=fileURLToPath(new URL("../../../data/classical-rules/classical-runtime-program.v1.json.gz",import.meta.url));
  const payload=JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as {records:readonly Record<string,unknown>[]};
  expect(payload.records).toHaveLength(4_332);
  expect(payload.records.find(record=>record.recordId==="curated:shen-feng-tong-kao:1301:build-lu-ancestry")).toMatchObject({
    bookId:"shen-feng-tong-kao",lineStart:1301,scopes:["natal"],
    conditions:[{operator:"dayStem.equals",value:"甲"},{operator:"monthBranch.equals",value:"寅"}],
    effects:[{operator:"pressure",domains:["family"],polarity:"pressure"}],reason:"semantic-curation",
  });
  expect(payload.records.find(record=>record.recordId==="curated:san-ming-tong-hui:1225:miscellaneous-resource-jia")).toMatchObject({
    conditions:[{operator:"dayStem.equals",value:"甲"},{operator:"monthBranch.equals",value:"辰"},{operator:"symbol.present",value:"正官"},{operator:"symbol.present",value:"正印"}],
    effects:[{operator:"support",domains:["general"],polarity:"support"}],reason:"semantic-curation",
  });
});
