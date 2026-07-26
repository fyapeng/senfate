import { readFile } from "node:fs/promises";
import { dirname,join } from "node:path";
import { fileURLToPath } from "node:url";

const root=join(dirname(fileURLToPath(import.meta.url)),"../../..");
const path=join(root,"data","classical-rules","source-reextracted-passages.v1.json");
const output=JSON.parse(await readFile(path,"utf8"));
if(output.schema!=="senfate-source-reextracted-passages.v1")throw new Error("Unexpected source re-extraction schema");
if(output.provenance.historicalCompactCorpusUsed!==false)throw new Error("Historical compact corpus must not be an input");
const caseMarkers=["乾造","坤造","命例","一命","此造","此命","某命","某人","本人","吾友"];
const ganZhi=/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;
for(const book of output.books){
  for(const candidate of book.candidates){
    if(caseMarkers.some(marker=>candidate.text.includes(marker)))throw new Error(`Case marker leaked into candidate: ${candidate.id}`);
    if((candidate.text.match(ganZhi)??[]).length>=3)throw new Error(`Four-pillar case leaked into candidate: ${candidate.id}`);
    if(candidate.extraction?.caseExcluded!==true)throw new Error(`Candidate missing case policy: ${candidate.id}`);
  }
}
const qiong=output.books.find(book=>book.bookId==="qiong-tong-bao-jian");
const ambiguous=qiong?.candidates.find(candidate=>candidate.lineStart===45);
if(ambiguous?.context?.monthBranch!==undefined)throw new Error("Ambiguous '正二月' passage must not inherit a single month branch");
console.log(`Verified ${output.books.length} books and ${output.books.reduce((sum,book)=>sum+book.candidates.length,0)} source-first candidates.`);
