import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { compileReferenceCorpusData } from "../src/compiler.ts";

const root=fileURLToPath(new URL("../../..",import.meta.url));
const corpus=JSON.parse(gunzipSync(readFileSync(`${root}/data/classical-rules/classical-source-corpus.v4.0.json.gz`)).toString("utf8"));
const sourceLines=Object.fromEntries(corpus.books.map(book=>[book,readFileSync(`${root}/data/classical-corpus/sources/${book}.txt`,"utf8").split(String.fromCharCode(10))]));
const audit=compileReferenceCorpusData(corpus);
const categories={executable:"public-machine-rule",deferred:"needs-semantic-rewrite",evidence:"source-evidence-or-duplicate",fixture:"case-material",contested:"conflicting-statement"};
const signals={
  explicitGanzhi:/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/u,
  explicitStemElement:/[甲乙丙丁戊己庚辛壬癸][木火土金水]/u,
  branchRelation:/[子丑寅卯辰巳午未申酉戌亥]{2}(?:冲|合|刑|害|破)/u,
  seasonalPhrase:/(?:春|夏|秋|冬|正|一|二|三|四|五|六|七|八|九|十|冬|腊)[月季]/u,
};
const totals={};const recovery={};
for(const record of audit.records){
  const category=categories[record.disposition];totals[category]??={records:0,byBook:{},byRuleType:{}};
  const bucket=totals[category];bucket.records++;bucket.byBook[record.bookId]=(bucket.byBook[record.bookId]??0)+1;bucket.byRuleType[record.ruleType]=(bucket.byRuleType[record.ruleType]??0)+1;
  if(record.disposition!=="deferred"||record.conditions.length>0)continue;
  const text=(sourceLines[record.bookId]??[]).slice(record.lineStart-1,record.lineEnd).join("");
  const found=Object.entries(signals).filter(([,pattern])=>pattern.test(text)).map(([name])=>name);
  const key=found.length?found.join("+"):"no-high-confidence-signal";
  recovery[key]??={records:0,byBook:{},samples:[]};const item=recovery[key];item.records++;item.byBook[record.bookId]=(item.byBook[record.bookId]??0)+1;
  if(item.samples.length<3)item.samples.push({recordId:record.recordId,bookId:record.bookId,lineStart:record.lineStart,lineEnd:record.lineEnd,text:text.slice(0,180)});
}
process.stdout.write(`${JSON.stringify({schema:"senfate-semantic-review-audit.v1",sourceCorpus:audit.corpusVersion,total:audit.total,categories:totals,conditionRecoveryQueue:{records:audit.records.filter(record=>record.disposition==="deferred"&&record.conditions.length===0).length,signals:recovery}},null,2)}\n`);
