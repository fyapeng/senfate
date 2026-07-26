import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { compileReferenceCorpusData } from "../src/compiler.ts";

const root=fileURLToPath(new URL("../../..",import.meta.url));
const corpus=JSON.parse(gunzipSync(readFileSync(`${root}/data/classical-rules/classical-source-corpus.v4.0.json.gz`)).toString("utf8"));
const audit=compileReferenceCorpusData(corpus);
const sourceLines=Object.fromEntries(corpus.books.map(book=>[book,readFileSync(`${root}/data/classical-corpus/sources/${book}.txt`,"utf8").split(String.fromCharCode(10))]));
const premise=/([甲乙丙丁戊己庚辛壬癸])日(?:生于|生|出生于)([子丑寅卯辰巳午未申酉戌亥])月/gu;
const outcomes=[
  [/(?:富贵|大贵|显达|发福|登科|科甲)/u,{operator:"support",domains:["career","wealth","study"],polarity:"support"}],
  [/(?:贫贱|贫苦|孤贫|夭折|残疾|无祖业|克妻)/u,{operator:"pressure",domains:["family","health","wealth"],polarity:"pressure"}],
];
const candidates=[];const seen=new Set;
for(const record of audit.records.filter(item=>item.disposition==="deferred"&&item.conditions.length===0)){
  const text=(sourceLines[record.bookId]??[]).slice(record.lineStart-1,record.lineEnd).join("");
  for(const sentence of text.split(/[。！？]/u)){
    const matches=[...sentence.matchAll(premise)];if(matches.length!==1||matches[0].index>12||/[如例假]/u.test(sentence.slice(0,matches[0].index)))continue;
    const outcome=outcomes.find(([pattern])=>pattern.test(sentence));if(!outcome)continue;
    const [,effect]=outcome;const [stem,branch]=matches[0].slice(1);const key=`${record.bookId}:${record.lineStart}:${stem}:${branch}:${JSON.stringify(effect)}:${sentence}`;
    if(seen.has(key))continue;seen.add(key);
    candidates.push({source:{bookId:record.bookId,lineStart:record.lineStart,lineEnd:record.lineEnd,sourceRecordId:record.recordId},sentence:sentence.trim(),conditions:[{kind:"day-stem",operator:"dayStem.equals",value:stem},{kind:"month-branch",operator:"monthBranch.equals",value:branch}],effect});
  }
}
process.stdout.write(`${JSON.stringify({schema:"senfate-semantic-candidate-queue.v1",count:candidates.length,candidates},null,2)}\n`);
