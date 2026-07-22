import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot=resolve(dirname(fileURLToPath(import.meta.url)),"../../..");
const args=process.argv.slice(2).filter(value=>value!=="--");
const input = resolve(workspaceRoot,args[0] ?? "local-data/geonames/cities500.txt");
const output = resolve(workspaceRoot,args[1] ?? "local-data/geonames/cities500.sql");
const sourceVersion = args[2] ?? new Date().toISOString().slice(0, 10);
const chunkSize = Number(args[3] ?? 5000);
const insertBatchSize = Number(args[4] ?? 50);
if(!Number.isInteger(chunkSize)||chunkSize<100)throw new Error("Chunk size must be an integer of at least 100");
if(!Number.isInteger(insertBatchSize)||insertBatchSize<1||insertBatchSize>500)throw new Error("Insert batch size must be an integer in [1, 500]");
await mkdir(dirname(output), { recursive: true });
const sql = (value) => `'${String(value ?? "").replaceAll("'", "''")}'`;
let stream;let count = 0;let chunk = 0;let chunkRecords=0;let batchRows=[];const files=[];
const chunkPath=()=>output.replace(/\.sql$/iu,`.${String(chunk).padStart(4,"0")}.sql`);
function openChunk(){chunk++;chunkRecords=0;const path=chunkPath();files.push(path);stream=createWriteStream(path,{encoding:"utf8"})}
function flushBatch(){if(!stream||batchRows.length===0)return;stream.write(`INSERT OR REPLACE INTO locations(id,name,ascii_name,alternate_names,country_code,admin1_code,admin2_code,feature_code,feature_level,latitude,longitude,time_zone,population,coordinate_use,source,source_version) VALUES\n${batchRows.join(",\n")};\n`);batchRows=[]}
async function closeChunk(){if(!stream)return;flushBatch();await new Promise((resolvePromise,reject)=>{stream.on("error",reject);stream.end(resolvePromise)});stream=undefined}
for await (const line of createInterface({ input: createReadStream(input, { encoding: "utf8" }), crlfDelay: Infinity })) {
  const f = line.split("\t");
  if (f.length < 19 || !f[0] || !f[1] || !f[8] || !f[17]) continue;
  const code = f[7] ?? "";
  const level = code.startsWith("PCL") ? "country" : code === "ADM1" ? "region" : ["ADM2", "PPLA2", "PPLA3"].includes(code) ? "county" : ["PPLC", "PPLA"].includes(code) ? "city" : "town";
  const coordinateUse = ["country", "region"].includes(level)||code==="ADM2" ? "administrative-centroid" : code.startsWith("PPLA")||level==="city" ? "settlement-centroid" : "source-point";
  const values = [Number(f[0]), f[1], f[2] || f[1], f[3] || "", f[8], f[10] || null, f[11] || null, code, level, Number(f[4]), Number(f[5]), f[17], Number(f[14]) || 0, coordinateUse, "GeoNames", sourceVersion];
  if(!stream)openChunk();
  batchRows.push(`(${values.map((v, i) => [0,9,10,12].includes(i) ? String(v) : v === null ? "NULL" : sql(v)).join(",")})`);
  count++;chunkRecords++;if(batchRows.length===insertBatchSize)flushBatch();if(chunkRecords===chunkSize)await closeChunk();
}
await closeChunk();
process.stdout.write(JSON.stringify({ input, outputPattern:output.replace(/\.sql$/iu,".NNNN.sql"), sourceVersion, records: count, chunks:files.length, chunkSize,insertBatchSize }) + "\n");
