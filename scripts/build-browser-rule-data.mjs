import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "vendor/bazi-rules-v1.8.0/rules/compiled/rules.jsonl");
const target = resolve(root, "apps/web/public/data/ruleir.v1.json");
const rows = (await readFile(source, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
const profilesDir = resolve(root, "vendor/bazi-rules-v1.8.0/profiles");
const climateMatrix = JSON.parse(await readFile(resolve(root, "vendor/bazi-rules-v1.8.0/ontology/classical_ziping/W03_CLIMATE_MATRIX.json"), "utf8"));
const shaoPatternMatrix = JSON.parse(await readFile(resolve(root, "vendor/bazi-rules-v1.8.0/ontology/shao_weihua/W04_PATTERN_MATRIX.json"), "utf8"));
const shaoUsefulGodCases = JSON.parse(await readFile(resolve(root, "vendor/bazi-rules-v1.8.0/ontology/shao_weihua/W04_USEFUL_GOD_CASES.json"), "utf8"));
const profiles = Object.fromEntries(await Promise.all((await readdir(profilesDir)).filter((name) => name.endsWith(".profile.json")).map(async (name) => {
  const profile = JSON.parse(await readFile(resolve(profilesDir, name), "utf8"));
  return [profile.school_id, profile];
})));

await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify({
  schema: "senfate-browser-ruleir.v1",
  sourceVersion: "bazi-rules-v1.8.0",
  profiles,
  rules: rows,
  classicalZiping: { climateMatrix: climateMatrix.entries },
  shaoWeihua: { patternMatrix: shaoPatternMatrix.entries, usefulGodCases: shaoUsefulGodCases.entries },
}), "utf8");
console.log(`Wrote ${rows.length} RuleIR records to ${target}`);
