export const STEMS = "甲乙丙丁戊己庚辛壬癸";
export const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";

const element: Record<string, string> = { 甲: "wood", 乙: "wood", 丙: "fire", 丁: "fire", 戊: "earth", 己: "earth", 庚: "metal", 辛: "metal", 壬: "water", 癸: "water" };
const branchElement: Record<string, string> = { 子: "water", 丑: "earth", 寅: "wood", 卯: "wood", 辰: "earth", 巳: "fire", 午: "fire", 未: "earth", 申: "metal", 酉: "metal", 戌: "earth", 亥: "water" };
const elementZh: Record<string, string> = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
const hidden: Record<string, string> = { 子: "癸", 丑: "己癸辛", 寅: "甲丙戊", 卯: "乙", 辰: "戊乙癸", 巳: "丙庚戊", 午: "丁己", 未: "己丁乙", 申: "庚壬戊", 酉: "辛", 戌: "戊辛丁", 亥: "壬甲" };
const nayin = ["海中金","炉中火","大林木","路旁土","剑锋金","山头火","涧下水","城头土","白蜡金","杨柳木","泉中水","屋上土","霹雳火","松柏木","长流水","砂中金","山下火","平地木","壁上土","金箔金","覆灯火","天河水","大驿土","钗钏金","桑柘木","大溪水","沙中土","天上火","石榴木","大海水"];
const growthBase: Record<string, string> = { 甲: "亥", 乙: "午", 丙: "寅", 丁: "酉", 戊: "寅", 己: "酉", 庚: "巳", 辛: "子", 壬: "申", 癸: "卯" };
const growth = ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"];
const monthStem: Record<string, string> = { 甲: "丙", 己: "丙", 乙: "戊", 庚: "戊", 丙: "庚", 辛: "庚", 丁: "壬", 壬: "壬", 戊: "甲", 癸: "甲" };
const generates: Record<string, string> = { wood: "fire", fire: "earth", earth: "metal", metal: "water", water: "wood" };
const controls: Record<string, string> = { wood: "earth", fire: "metal", earth: "water", metal: "wood", water: "fire" };
const yang = new Set("甲丙戊庚壬");

export type BrowserPillar = { stem: string; branch: string; stem_ten_god: string; stem_element: string; stem_element_zh: string; branch_element: string; branch_element_zh: string; nayin: { name: string; element: string; element_zh: string }; twelve_growth_stage: string; hidden_stems: Array<{ stem: string; order: number; role: string; ten_god: string; element: string; element_zh: string }> };

export function sexagenaryIndex(token: string): number {
  for (let index = 0; index < 60; index += 1) if (`${STEMS[index % 10]}${BRANCHES[index % 12]}` === token) return index;
  throw new Error(`无效干支：${token}`);
}

export function advance(token: string, steps: number): string { return `${STEMS[(STEMS.indexOf(token[0]!) + steps + 100) % 10]}${BRANCHES[(BRANCHES.indexOf(token[1]!) + steps + 120) % 12]}`; }
export function annualPillar(year: number): string { return `${STEMS[(year - 1984 + 600) % 10]}${BRANCHES[(year - 1984 + 720) % 12]}`; }
export function monthlyPillar(year: number, ordinal: number): string { const annual = annualPillar(year); const start = STEMS.indexOf(monthStem[annual[0]!]!); return `${STEMS[(start + ordinal) % 10]}${BRANCHES[(2 + ordinal) % 12]}`; }

export function tenGod(day: string, target: string): string {
  const same = yang.has(day) === yang.has(target); const own = element[day]!; const other = element[target]!;
  if (own === other) return same ? "比肩" : "劫财";
  if (generates[own] === other) return same ? "食神" : "伤官";
  if (controls[own] === other) return same ? "偏财" : "正财";
  if (generates[other] === own) return same ? "偏印" : "正印";
  return same ? "七杀" : "正官";
}

export function materializePillar(token: string, day: string): BrowserPillar {
  const stem = token[0]!; const branch = token[1]!; const index = sexagenaryIndex(token); const qi = hidden[branch] || "";
  const delta0 = (BRANCHES.indexOf(branch) - BRANCHES.indexOf(growthBase[day]!)+12) % 12;
  const delta = yang.has(day) ? delta0 : (12 - delta0) % 12;
  return { stem, branch, stem_ten_god: tenGod(day, stem), stem_element: element[stem]!, stem_element_zh: elementZh[element[stem]!]!, branch_element: branchElement[branch]!, branch_element_zh: elementZh[branchElement[branch]!]!, nayin: { name: nayin[Math.floor(index / 2)]!, element: { 金: "metal", 木: "wood", 水: "water", 火: "fire", 土: "earth" }[nayin[Math.floor(index / 2)]!.at(-1)!]!, element_zh: nayin[Math.floor(index / 2)]!.at(-1)! }, twelve_growth_stage: growth[delta]!, hidden_stems: [...qi].map((item, index2) => ({ stem: item, order: index2 + 1, role: ["main", "middle", "residual"][index2] || "residual", ten_god: tenGod(day, item), element: element[item]!, element_zh: elementZh[element[item]!]! })) };
}
