/// <reference lib="webworker" />

import { annualPillar, classicalZipingResolvers, classicalZipingW03Resolvers, compileClassicalZipingFacts, compileClassicalZipingW03, compileDuanLiXiangFacts, compileLiHanchenFacts, compileShaoWeihuaFacts, duanLiXiangResolvers, liHanchenResolvers, materializePillar, monthlyPillar, shaoWeihuaResolvers, tenGod } from "@senfate/browser-ruleir";
import { evaluateRulesWithTrace } from "@senfate/browser-ruleir";

type Request = { id: string; type: "analyze"; compiled: any; sex: "female" | "male"; targetYear: number; ruleDataUrl: string };
type RuleData = { profiles: Record<string, { school_id: string; phase_order: string[] }>; rules: any[]; classicalZiping: { climateMatrix: any[] }; shaoWeihua: { patternMatrix: any[]; usefulGodCases: any[] } };

const labels: Record<string, string> = { classical_ziping: "传统子平", shao_weihua: "邵伟华体系", li_hanchen: "李涵辰体系", duan_li_xiang: "段氏理象体系" };
const supporting = new Set(["比肩", "劫财", "正印", "偏印"]);
const clashes = new Set(["子午", "午子", "丑未", "未丑", "寅申", "申寅", "卯酉", "酉卯", "辰戌", "戌辰", "巳亥", "亥巳"]);
const harmonies = new Set(["子丑", "丑子", "寅亥", "亥寅", "卯戌", "戌卯", "辰酉", "酉辰", "巳申", "申巳", "午未", "未午"]);
const growthWeight: Record<string, number> = { 长生: .32, 沐浴: .05, 冠带: .22, 临官: .42, 帝旺: .58, 衰: -.08, 病: -.26, 死: -.42, 墓: -.20, 绝: -.55, 胎: -.12, 养: .03 };
const relationWords: Record<string, string> = { combine: "相合", control: "相克", generate: "相生" };
let cachedRules: Promise<RuleData> | undefined;

function rules(url: string) { return cachedRules ??= fetch(url).then(async response => { if (!response.ok) throw new Error("规则资料暂未加载完成，请刷新页面后重试。"); return response.json() as Promise<RuleData>; }); }
function clamp(value: number, low = -0.98, high = .98) { return Math.max(low, Math.min(high, value)); }
function display(value: number) { return Math.round((value + 100) / 2 * 100) / 100; }
function relationPressure(month: any, pillars: any[]) {
  let support = 0, pressure = 0;
  for (const pillar of pillars) {
    if (clashes.has(`${month.branch}${pillar.branch}`)) pressure += .72;
    if (harmonies.has(`${month.branch}${pillar.branch}`)) {
      if (supporting.has(month.stem_ten_god)) support += .36; else pressure += .36;
    }
    if (month.branch === pillar.branch) {
      if (supporting.has(month.stem_ten_god)) support += .18; else pressure += .18;
    }
  }
  return { support, pressure };
}
function layerCoordinate(chart: any, luck: any, annual: any, month: any) {
  let support = .5, pressure = .5;
  const layers = [...Object.values(chart.pillars) as any[], luck, annual, month];
  for (const layer of layers) for (const god of [layer.stem_ten_god, ...(layer.hidden_stems || []).map((row: any) => row.ten_god)]) supporting.has(god) ? support += 1 : pressure += 1;
  const relation = relationPressure(month, [...Object.values(chart.pillars) as any[], luck, annual]); support += relation.support; pressure += relation.pressure;
  const seasonal = growthWeight[month.twelve_growth_stage] || 0; if (seasonal >= 0) support += seasonal; else pressure -= seasonal;
  return clamp(Math.tanh(Math.log(support / pressure)));
}
function candle(chart: any, luck: any, annual: any, anchor: number, previous?: number) {
  const months = Array.from({ length: 12 }, (_, index) => {
    const pillar = materializePillar(monthlyPillar(annual.year, index), chart.day_master);
    const indexValue = Math.tanh(.68 * Math.atanh(clamp(anchor)) + .32 * Math.atanh(layerCoordinate(chart, luck, annual, pillar)));
    return { ordinal: index + 1, pillar: `${pillar.stem}${pillar.branch}`, index: Math.round(indexValue * 10000) / 100 };
  });
  const monthOpen = months[0]!.index, close = months.at(-1)!.index, open = previous ?? monthOpen;
  return { open, high: Math.max(open, ...months.map(row => row.index)), low: Math.min(open, ...months.map(row => row.index)), close, monthOpen, monthlySamples: months };
}
function buildFacts(chart: any, luck: any, annual: any, data: RuleData) {
  const stems = Object.values(chart.pillars).map((row: any) => row.stem);
  const branches = Object.values(chart.pillars).map((row: any) => row.branch);
  const all = [...Object.values(chart.pillars) as any[], luck, annual];
  const gods = all.flatMap((row: any) => [row.stem_ten_god, ...(row.hidden_stems || []).map((item: any) => item.ten_god)]);
  const counts = Object.fromEntries(["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印"].map(name => [name, gods.filter(item => item === name).length]));
  const w03 = compileClassicalZipingW03(chart, data.classicalZiping.climateMatrix, luck, annual);
  const w04 = compileShaoWeihuaFacts(chart, data.shaoWeihua, luck, annual);
  const w05 = compileLiHanchenFacts(chart, luck, annual);
  const w06 = compileDuanLiXiangFacts(chart, luck, annual);
  return { chart, luck, annual, facts: { browser: { chart: { day_master: chart.day_master, stems, branches, ten_gods: counts, month_command: chart.pillars.month.branch }, temporal: { luck: `${luck.stem}${luck.branch}`, annual: `${annual.stem}${annual.branch}` } }, classical_ziping: { w02: compileClassicalZipingFacts(chart), w03 }, shao_weihua: { w04 }, li_hanchen: { w05 }, duan_li_xiang: { w06 } }, relations: w03.compiled_relations, findings: [] as any[] };
}
function verdict(schoolId: string, chart: any, findings: any[], context: any) {
  const gods = Object.values(chart.pillars).flatMap((row: any) => [row.stem_ten_god, ...(row.hidden_stems || []).map((item: any) => item.ten_god)]);
  const supportCount = gods.filter(item => supporting.has(item)).length;
  const strength = supportCount >= gods.length / 2 ? "身强" : "身弱";
  const monthGod = chart.pillars.month.stem_ten_god;
  const w02 = context.facts.classical_ziping.w02;
  const w03 = context.facts.classical_ziping.w03;
  const w04 = context.facts.shao_weihua.w04;
  const w05 = context.facts.li_hanchen.w05;
  const w06 = context.facts.duan_li_xiang.w06;
  const climateCandidates = w03.climate.ordered_candidates || [];
  const primaryClimate = climateCandidates[0];
  const climateVisibility = w03.climate.primary_candidate_visibility === "visible" ? "原局透出" : w03.climate.primary_candidate_visibility === "hidden" ? "藏于地支" : "原局未见";
  const climate = primaryClimate ? `调候：${w03.climate.condition_note || "依月令"}，先取${primaryClimate}${climateCandidates.slice(1).length ? `，次取${climateCandidates.slice(1).join("、")}` : ""}；${primaryClimate}${climateVisibility}，岁运可继续留意其出现与配合。` : "调候：以月令寒暖燥湿为先，与全局五行一同参看。";
  const dayPillar = chart.pillars.day;
  const workRelations = [...new Set((w06.work.work_graph || []).slice(0, 18).map((path: any) => `${path.participants.join("与")}${relationWords[path.method] || "发生作用"}`))].slice(0, 3);
  const duanWork = workRelations.length ? `原局与岁运可见${workRelations.join("、")}等关系，须结合出现的位置判断作用方向。` : "暂未见需要优先处理的合冲关系，先以日主与日支为主线参看岁运。";
  const duanFocus = [w06.work.relation_combine && "天干相合", w06.work.relation_clash && "地支相冲", w06.work.relation_control && "五行制化", w06.work.relation_generate && "五行相生"].filter(Boolean).join("、") || "日主与日支";
  const schoolResult = schoolId === "classical_ziping"
    ? { headline: `${monthGod}当令，${w02.strength.resolved_category || strength}`, structure: `月令见${monthGod}，以月令、通关与全局平衡一同观察。`, strength: w02.strength.resolved_category || strength, use: `岁运宜留意${(w02.strength.recommended_categories || []).join("、") || "扶抑与通关"}的调节作用。`, climate }
    : schoolId === "shao_weihua"
      ? { headline: `五行配置${w04.strength.category === "balanced_or_contested" ? "较为均衡" : w04.strength.category === "strong" ? "偏强" : "偏弱"}`, structure: "五行分布与十神配置共同构成原局的观察重点。", strength: w04.strength.category === "balanced_or_contested" ? "力量较均衡" : w04.strength.category === "strong" ? "日主偏强" : "日主偏弱", use: w04.useful_god.specific_useful_available ? `岁运可重点留意${w04.useful_god.specific_useful_tokens.join("、")}的出现与配合。` : "岁运宜以五行是否相互扶持、是否失衡作为观察重点。" }
      : schoolId === "li_hanchen"
        ? { headline: `干支作用为主，日主${w05.classification.classification === "strong" ? "偏强" : "偏弱"}`, structure: "观察原局干支之间的生、克、合、冲，并结合岁运看力量变化。", strength: w05.classification.classification === "strong" ? "日主偏强" : "日主偏弱", use: `岁运可留意${w05.useful_party.useful_groups.join("、") || "能够使力量趋于平衡的五行"}一侧的变化。` }
        : { headline: `体以${chart.day_master}日主，重看${duanFocus}`, structure: `体以${chart.day_master}日主为中心，日支${dayPillar.branch}作为日主所坐的位置；先分清本命与岁运的主客位置。`, strength: w06.work.work_count ? "原局存在可观察的干支作用" : "原局关系需结合岁运继续观察", use: w06.entry.day_stem_combine ? "日干相合是岁运观察的优先入口。" : w06.entry.day_branch_relations ? "日支关系是岁运观察的优先入口。" : "先看日主、日支，再看岁运是否带来新的合、冲、刑、害。", work: duanWork };
  return { headline: schoolResult.headline, primary_structure: schoolResult.structure, primary_use: schoolResult.use, climate: schoolResult.climate, work: schoolResult.work, strength_or_axis: schoolResult.strength, secondary_structures: ["原局为基础", "大运与流年分别参看"], rejected_routes: [], caveats: ["本页呈现的是传统命理的结构解读，供学习与比较使用，不对应现实事件的确定预测。"] };
}
function themes(close: number, annual: any) {
  const god = annual.stem_ten_god;
  const stance = supporting.has(god) ? "supportive" : /正财|偏财|正官|七杀/.test(god) ? "mixed" : "cautionary";
  return [{ topic: "career", stance, headline: /正官|七杀/.test(god) ? "工作与责任更容易成为当年重点，适合把目标和节奏安排得更清楚。" : "行动节奏有变化，适合根据阶段轻重安排投入。" }, { topic: "wealth", stance: /正财|偏财/.test(god) ? "supportive" : stance, headline: /正财|偏财/.test(god) ? "资源安排与收支节奏值得留意，宜保持稳健。" : "财务主题以规划和节制为主，避免跟随短期波动。" }, { topic: "relationships", stance: /正财|偏财|正官|七杀/.test(god) ? "mixed" : "descriptive", headline: "人际相处宜重视沟通与边界，关系主题不对具体事件作预测。" }, { topic: "health", stance: "descriptive", headline: "年内节奏会有起伏，忙闲转换时宜为自己留出缓冲。" }];
}
async function analyze(request: Request) {
  const data = await rules(request.ruleDataUrl);
  const calendar = request.compiled.result?.calendar || request.compiled.calendar;
  const day = calendar.pillars.day.stem;
  const pillars = Object.fromEntries(["year", "month", "day", "hour"].map(name => { const row = calendar.pillars[name]; return [name, materializePillar(`${row.stem}${row.branch}`, day)]; }));
  const chart: any = { pillars, day_master: day, ten_god_map: Object.fromEntries("甲乙丙丁戊己庚辛壬癸".split("").map(stem => [stem, tenGod(day, stem)])) };
  const luckCycles = calendar.majorLuck.slice(0, 8).map((source: any) => { const start = new Date(source.startUtcMs).getUTCFullYear(); const row = materializePillar(`${source.pillar.stem}${source.pillar.branch}`, day); return { luck_cycle_id: `luck.${String(source.ordinal).padStart(2, "0")}`, order: source.ordinal, stem: row.stem, branch: row.branch, start_year: start, end_year: start + 9, stem_ten_god: row.stem_ten_god, hidden_stems: row.hidden_stems, start_utc_ms: source.startUtcMs, start_age_years: source.startAgeYears }; });
  if (!luckCycles.length) throw new Error("认证排盘没有可用的大运。");
  const annualContexts = luckCycles.flatMap((luck: any) => Array.from({ length: 10 }, (_, offset) => { const year = luck.start_year + offset; const row = materializePillar(annualPillar(year), day); return { annual_id: `annual.${year}`, year, stem: row.stem, branch: row.branch, stem_ten_god: row.stem_ten_god, hidden_stems: row.hidden_stems, twelve_growth_stage: row.twelve_growth_stage }; }));
  const target = annualContexts.some((row: any) => row.year === request.targetYear) ? request.targetYear : annualContexts[0]!.year;
  const trajectory: Record<string, any[]> = {}, audits: any[] = [], schools: any[] = [];
  for (const schoolId of Object.keys(labels)) {
    const profile = data.profiles[schoolId]; const profileRules = data.rules.filter(rule => rule.enabled && rule.school_id === schoolId);
    const current = annualContexts.find((row: any) => row.year === target)!; const currentLuck = luckCycles.find((row: any) => current.year >= row.start_year && current.year <= row.end_year)!;
    const resolvers = schoolId === "classical_ziping" ? { ...classicalZipingResolvers, ...classicalZipingW03Resolvers } : schoolId === "shao_weihua" ? shaoWeihuaResolvers : schoolId === "li_hanchen" ? liHanchenResolvers : schoolId === "duan_li_xiang" ? duanLiXiangResolvers : undefined;
    const traceOptions = { schoolProfileId: schoolId, chartId: "senfate.certified.chart", stateId: `state.${schoolId}.${current.year}`, phaseOrder: profile?.phase_order || [], resolvers };
    const currentFacts = buildFacts(chart, currentLuck, current, data);
    const trace = evaluateRulesWithTrace(profileRules, currentFacts, traceOptions);
    const findings = trace.evaluations.flatMap((row: any) => row.emitted_findings);
    schools.push({ school: labels[schoolId], verdict: verdict(schoolId, chart, findings, currentFacts), themes: themes(0, current) });
    const ruleTitles = new Map(profileRules.map((rule: any) => [rule.rule_id, { title: rule.title, description: rule.description }]));
    const publicTrace = trace.evaluations.map((row: any) => ({ ...row, ...ruleTitles.get(row.rule_id) }));
    audits.push({ schoolId, ruleCount: profileRules.length, evaluationCounts: { evaluated: trace.evaluations.length, true: trace.evaluations.filter((row: any) => row.condition_truth === "true").length, unknown: trace.evaluations.filter((row: any) => row.condition_truth === "unknown").length }, warnings: ["本次解读以该体系已公开的原局、岁运规则为依据；资料未覆盖的内容不会写入结论。"], trace: publicTrace, stateChain: { phaseOrder: profile?.phase_order || [] } });
    let previous: number | undefined;
    trajectory[schoolId] = annualContexts.map((annual: any) => { const luck = luckCycles.find((row: any) => annual.year >= row.start_year && annual.year <= row.end_year)!; const annualTrace = evaluateRulesWithTrace(profileRules, buildFacts(chart, luck, annual, data), { ...traceOptions, stateId: `state.${schoolId}.${annual.year}` }); const trueFindings = annualTrace.evaluations.flatMap((row: any) => row.emitted_findings).filter((row: any) => row.truth === "true"); const ruleAnchor = clamp((trueFindings.filter((row: any) => row.direction === "supportive").length - trueFindings.filter((row: any) => row.direction === "inhibitory").length) / 8); const raw = candle(chart, luck, annual, ruleAnchor, previous); previous = raw.close; return { year: annual.year, luckCycleId: luck.luck_cycle_id, annualRuleAnchor: display(ruleAnchor * 100), themeSignals: themes(raw.close, annual), open: display(raw.open), high: display(raw.high), low: display(raw.low), close: display(raw.close), monthOpen: display(raw.monthOpen), monthlySamples: raw.monthlySamples.map(row => ({ ...row, index: display(row.index) })) }; });
  }
  const selectedLuck = luckCycles.find((row: any) => target >= row.start_year && target <= row.end_year)!;
  return { schema: "senfate-browser-ruleir.v3", analysisId: `browser.${Date.now()}`, chart: { pillars, luckCycles, annualContexts, activeLuck: selectedLuck, provenance: { provider: "senfate-browser-worker", input_boundary: "certified-calendar", notes: ["规则资料与计算均在当前设备完成。"] } }, selectedYear: target, schools, trajectory, audit: audits, labels, calculationMethod: { annual: "每一年都会同时参看原局、所在大运、流年与十二个月的干支关系；四个体系各自给出解读。", monthlyCandle: "年度 K 线的开盘取年初状态，收盘取年末状态，影线表示十二个月间的变化范围。", unit: "0—100 是便于比较的相对结构刻度，不代表概率、收益或现实事件评分。" }, scope: "红色表示年末状态高于年初，绿色表示年末状态低于年初。" };
}

const worker: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async ({ data }: MessageEvent<Request>) => { try { if (data.type !== "analyze") throw new Error("不支持的本地分析请求。"); worker.postMessage({ id: data.id, ok: true, result: await analyze(data) }); } catch (cause) { worker.postMessage({ id: data.id, ok: false, error: cause instanceof Error ? cause.message : "本地分析失败。" }); } };
export {};
