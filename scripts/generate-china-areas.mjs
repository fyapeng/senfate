import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = "https://raw.githubusercontent.com/pfinal/city/master/region.sql";
const output = resolve("apps/web/src/data/china-counties.json");
const sql = await (await fetch(source)).text();
if (!sql.includes("INSERT INTO `region`")) throw new Error("行政区划源数据未能下载。");

const rows = new Map();
for (const match of sql.matchAll(/\('([^']*)','([^']*)','([^']*)','([^']*)','([^']*)',/g)) {
  const [, code, name, parentCode, longitude, latitude] = match;
  rows.set(code, { code, name, parentCode, longitude: Number(longitude), latitude: Number(latitude) });
}

function lineage(row) {
  const names = [row.name];
  let parent = rows.get(row.parentCode);
  while (parent) { names.unshift(parent.name); parent = rows.get(parent.parentCode); }
  return names.join(" / ");
}

const counties = [...rows.values()]
  .filter(row => row.code.length === 6 && Number.isFinite(row.longitude) && Number.isFinite(row.latitude))
  .map(row => ({ code: row.code, label: lineage(row), longitude: row.longitude, latitude: row.latitude, timeZone: "Asia/Shanghai" }))
  .sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ source, generatedAt: new Date().toISOString(), counties })}\n`, "utf8");
console.log(`Wrote ${counties.length} county-level locations to ${output}`);
