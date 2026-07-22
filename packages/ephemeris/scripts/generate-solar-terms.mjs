import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args=process.argv.slice(2).filter(value=>value!=="--");
const START_YEAR=Number(args[0]??1900);
const END_YEAR=Number(args[1]??2035);
const CHUNK_YEARS=10;
const GENERATED_AT=new Date().toISOString();
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const dataPath=resolve(root,"data/solar-terms.jpl-de441.v1.json");
const manifestPath=resolve(root,"data/manifest.json");
const MONTHS=new Map([["Jan","01"],["Feb","02"],["Mar","03"],["Apr","04"],["May","05"],["Jun","06"],["Jul","07"],["Aug","08"],["Sep","09"],["Oct","10"],["Nov","11"],["Dec","12"]]);
const TERM_NAMES=["春分","清明","谷雨","立夏","小满","芒种","夏至","小暑","大暑","立秋","处暑","白露","秋分","寒露","霜降","立冬","小雪","大雪","冬至","小寒","大寒","立春","雨水","惊蛰"];

function requestUrl(startYear,endYear){
  const params=new URLSearchParams({format:"text",COMMAND:"'10'",OBJ_DATA:"'NO'",MAKE_EPHEM:"'YES'",EPHEM_TYPE:"'OBSERVER'",CENTER:"'500@399'",START_TIME:`'${startYear}-01-01'`,STOP_TIME:`'${endYear+1}-01-01'`,STEP_SIZE:"'6 h'",QUANTITIES:"'31'",TIME_TYPE:"'UT'",TIME_DIGITS:"'SECONDS'",CSV_FORMAT:"'YES'",CAL_FORMAT:"'BOTH'",CAL_TYPE:"'GREGORIAN'",REF_SYSTEM:"'ICRF'",APPARENT:"'AIRLESS'",EXTRA_PREC:"'YES'"});
  return`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`;
}

async function fetchText(url){
  let failure;for(let attempt=1;attempt<=4;attempt++){try{const response=await fetch(url,{headers:{"user-agent":"SenFate ephemeris generator/1.0"}});if(!response.ok)throw new Error(`HTTP ${response.status}`);const text=await response.text();if(!text.includes("$$SOE")||!text.includes("source: DE441"))throw new Error("Unexpected Horizons response");return text}catch(error){failure=error;if(attempt<4)await new Promise(resolvePromise=>setTimeout(resolvePromise,attempt*1000))}}
  throw failure;
}

function parseSamples(text){
  const body=text.split("$$SOE")[1]?.split("$$EOE")[0]??"";const samples=[];
  for(const line of body.split(/\r?\n/u)){const match=line.match(/^\s*(\d{4})-([A-Z][a-z]{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2}),\s*([\d.]+),\s*,\s*,\s*([\d.]+)/u);if(!match)continue;const month=MONTHS.get(match[2]);if(month===undefined)throw new Error(`Unknown month ${match[2]}`);const utcMs=Date.parse(`${match[1]}-${month}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`);samples.push({utcMs,jd:Number(match[7]),longitude:Number(match[8])})}
  if(samples.length<2)throw new Error("Horizons response contained too few samples");return samples;
}

function crossings(samples){
  const output=[];let offset=0;let previous=samples[0];let previousLongitude=previous.longitude;
  for(let index=1;index<samples.length;index++){const current=samples[index];if(current.longitude+offset<previousLongitude-180)offset+=360;const longitude=current.longitude+offset;const firstTarget=Math.ceil((previousLongitude+1e-10)/15)*15;for(let target=firstTarget;target<=longitude;target+=15){const fraction=(target-previousLongitude)/(longitude-previousLongitude);const utcMs=Math.round((previous.utcMs+fraction*(current.utcMs-previous.utcMs))/1000)*1000;const normalized=((target%360)+360)%360;const name=TERM_NAMES[normalized/15];if(!name)throw new Error(`Missing term name at ${normalized}`);const year=new Date(utcMs).getUTCFullYear();if(year>=START_YEAR&&year<=END_YEAR){const kind=normalized%30===15?"jie":"qi";const uncertaintySeconds=utcMs<Date.UTC(1962,0,1)||utcMs>Date.parse(GENERATED_AT)?120:5;output.push([utcMs,normalized,name,kind,uncertaintySeconds])}}previous=current;previousLongitude=longitude}
  return output;
}

const entries=[];
for(let start=START_YEAR;start<=END_YEAR;start+=CHUNK_YEARS){const end=Math.min(END_YEAR,start+CHUNK_YEARS-1);process.stdout.write(`Horizons ${start}-${end}\n`);entries.push(...crossings(parseSamples(await fetchText(requestUrl(start,end)))))}
const unique=[...new Map(entries.map(entry=>[`${entry[0]}:${entry[1]}`,entry])).values()].sort((a,b)=>a[0]-b[0]);
for(let year=START_YEAR;year<=END_YEAR;year++){const count=unique.filter(entry=>new Date(entry[0]).getUTCFullYear()===year).length;if(count!==24)throw new Error(`Expected 24 terms in ${year}, found ${count}`)}
const table={schema:"senfate-solar-term-table.v1",provider:"NASA/JPL Horizons",sourceEphemeris:"DE441",generatedAt:GENERATED_AT,range:{startYear:START_YEAR,endYear:END_YEAR},timeScale:"UT1 before 1962; UTC from 1962",sampleStepHours:6,entries:unique};
const json=JSON.stringify(table);const digest=createHash("sha256").update(json).digest("hex");const manifest={schema:"senfate-ephemeris-manifest.v1",table:"solar-terms.jpl-de441.v1.json",sha256:digest,bytes:Buffer.byteLength(json),terms:unique.length,...table.range,provider:table.provider,sourceEphemeris:table.sourceEphemeris,generatedAt:GENERATED_AT,query:{target:"Sun (10)",center:"Earth geocenter (500@399)",quantity:"31 ObsEcLon",step:"6 h",timeType:"UT",calendar:"Gregorian",apparent:"airless"},sourceUrl:"https://ssd.jpl.nasa.gov/api/horizons.api",reproduction:`NODE_USE_ENV_PROXY=1 pnpm --filter @senfate/ephemeris generate:solar-terms -- ${START_YEAR} ${END_YEAR}`};
await mkdir(dirname(dataPath),{recursive:true});await writeFile(dataPath,json,{encoding:"utf8"});await writeFile(manifestPath,JSON.stringify(manifest,null,2)+"\n",{encoding:"utf8"});process.stdout.write(JSON.stringify(manifest)+"\n");
