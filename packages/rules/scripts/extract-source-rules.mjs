import { mkdir,readFile,writeFile } from "node:fs/promises";
import { dirname,join } from "node:path";
import { fileURLToPath } from "node:url";

const root=join(dirname(fileURLToPath(import.meta.url)),"../../..");
const sourceDirectory=join(root,"data","classical-corpus","sources");
const profilePath=join(root,"data","classical-rules","source-reextraction-profiles.v1.json");
const outputPath=join(root,"data","classical-rules","source-reextracted-passages.v1.json");
const STEMS="甲乙丙丁戊己庚辛壬癸";
const BRANCHES="子丑寅卯辰巳午未申酉戌亥";
const monthBranches={正:"寅",一:"寅",二:"卯",三:"辰",四:"巳",五:"午",六:"未",七:"申",八:"酉",九:"戌",十:"亥",十一:"子",十二:"丑"};
const outcomeTerms={support:["富贵","大富","大贵","科甲","登科","功名","显达","贵命","上上之格","福","寿"],pressure:["贫贱","贫苦","灾","病","夭","死","残疾","不吉","凶","孤","寡"]};
const paragraphStart=/^(《.+》\s*--|阅读地址|简介：|作者[：:]|[一二三四五六七八九十]+[、．.])/;
const caseMarkers=["乾造","坤造","命例","一命","此造","此命","某命","某人","本人","吾友"];
const ganZhi=new RegExp(`[${STEMS}][${BRANCHES}]`,"g");

function normalize(text){return text.replace(/\s+/g," ").trim()}
function hasCaseTuple(text){return (text.match(ganZhi)??[]).length>=3}
function isParatext(text,line){return line<18||paragraphStart.test(text)||text.startsWith("《")||text.includes("阅读地址")||text.startsWith("简介")}
function isCase(text,profile){
  if(caseMarkers.some(marker=>text.includes(marker))||hasCaseTuple(text))return true;
  if(profile.caseSensitivity!=="standard"&&/^(若|如|假如|譬如).{0,4}[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/.test(text))return true;
  return profile.caseSensitivity==="very-strict"&&/(行运|大运|流年).{0,24}(?:发|死|贵|贫|病|灾)/.test(text);
}
function headingContext(text,context,profile){
  const seasonal=text.match(/^(?:三春|三夏|三秋|三冬|春|夏|秋|冬).{0,4}([甲乙丙丁戊己庚辛壬癸])(?:木|火|土|金|水)/);
  const monthDay=text.match(/^((?:正二|五六|七八|十一|十二|正|一|二|三|四|五|六|七|八|九|十)月)([甲乙丙丁戊己庚辛壬癸])(?:木|火|土|金|水)?/);
  const directDay=text.match(new RegExp(`^([${STEMS}])(?:木|火|土|金|水)(?:日干|日主|生|坐|见|旺|弱)`));
  if(profile.mode==="seasonal-day-master"&&seasonal)context.dayStem=seasonal[1];
  if(directDay)context.dayStem=directDay[1];
  if(monthDay){context.dayStem=monthDay[2];const month=monthDay[1].replace("月","");if(monthBranches[month])context.monthBranch=monthBranches[month];else delete context.monthBranch;}
  return context;
}
function conditionSignals(text,context){
  const signals=[];
  if(context.dayStem)signals.push({operator:"dayStem.equals",value:context.dayStem,inferredFrom:"heading-or-passage"});
  if(context.monthBranch)signals.push({operator:"monthBranch.equals",value:context.monthBranch,inferredFrom:"heading-or-passage"});
  for(const match of text.matchAll(new RegExp(`([${STEMS}]{1,4})两透`,"g")))for(const stem of match[1])signals.push({operator:"symbol.exposed",value:stem,inferredFrom:"text"});
  for(const match of text.matchAll(new RegExp(`(?:不见|无|未见)([${STEMS}])`,"g")))signals.push({operator:"symbol.absent",value:match[1],inferredFrom:"text"});
  for(const match of text.matchAll(new RegExp(`支(?:成|会)([${BRANCHES}]{3})([局]?)`,"g")))signals.push({operator:"branchFormation.equals",value:`${match[1]}局`,inferredFrom:"text"});
  for(const match of text.matchAll(new RegExp(`([${STEMS}])(?:金|木|水|火|土)?透(?:干|出|天干)?`,"g")))signals.push({operator:"symbol.exposed",value:match[1],inferredFrom:"text"});
  return [...new Map(signals.map(signal=>[`${signal.operator}:${signal.value}`,signal])).values()];
}
function conclusionSignals(text){const values=[];for(const [polarity,terms] of Object.entries(outcomeTerms))for(const term of terms)if(text.includes(term))values.push({polarity,term});return values}
function directRuleCandidate(text,signals,conclusions,profile){
  if(conclusions.length===0||signals.length===0)return false;
  if(profile.mode==="case-heavy")return /(?:为|取|喜|忌|宜|不宜|主)/.test(text)&&!/(行运|大运|流年)/.test(text);
  return /(?:为|取|喜|忌|宜|不宜|主|得|见|无|透|成)/.test(text);
}
function classify(text,line,profile){if(!text)return"blank";if(isParatext(text,line))return"paratext";if(isCase(text,profile))return"case";return"rule-prose"}

const profiles=JSON.parse(await readFile(profilePath,"utf8"));
if(profiles.schema!=="senfate-source-reextraction-profiles.v1")throw new Error("Invalid source re-extraction profiles");
const books=[];
for(const profile of profiles.profiles){
  const lines=(await readFile(join(sourceDirectory,profile.sourceFile),"utf8")).split(/\r?\n/);
  const passages=[];const candidates=[];const context={};
  for(let index=0;index<lines.length;index++){
    const text=normalize(lines[index]);if(!text)continue;
    if(profile.mode!=="seasonal-day-master"){delete context.dayStem;delete context.monthBranch;}
    headingContext(text,context,profile);
    const contentKind=classify(text,index+1,profile);
    const passage={id:`${profile.bookId}:${index+1}`,bookId:profile.bookId,lineStart:index+1,lineEnd:index+1,text,contentKind,context:{...context}};
    passages.push(passage);
    if(contentKind!=="rule-prose")continue;
    const conditions=conditionSignals(text,context);const conclusions=conclusionSignals(text);
    if(directRuleCandidate(text,conditions,conclusions,profile))candidates.push({...passage,id:`${passage.id}:candidate`,classification:"machine-rule-candidate",conditions,conclusions,extraction:{method:"source-first-v1",profile:profile.mode,caseExcluded:true}});
  }
  books.push({bookId:profile.bookId,profile:{mode:profile.mode,description:profile.description,caseSensitivity:profile.caseSensitivity},source:{file:profile.sourceFile,lineCount:lines.length},summary:{passages:passages.length,candidates:candidates.length,casesExcluded:passages.filter(item=>item.contentKind==="case").length,paratextExcluded:passages.filter(item=>item.contentKind==="paratext").length},passages,candidates});
}
const output={schema:"senfate-source-reextracted-passages.v1",generatedAt:new Date().toISOString(),provenance:{input:"data/classical-corpus/sources/*.txt",historicalCompactCorpusUsed:false,casePolicy:"Cases are classified and excluded from machine-rule candidates."},books};
await mkdir(dirname(outputPath),{recursive:true});await writeFile(outputPath,`${JSON.stringify(output,null,2)}\n`,`utf8`);
console.log(JSON.stringify({output:outputPath,books:books.map(book=>({bookId:book.bookId,...book.summary}))},null,2));
