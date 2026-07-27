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
let cachedRules: Promise<RuleData> | undefined;

function rules(url: string) { return cachedRules ??= fetch(url).then(async response => { if (!response.ok) throw new Error("本地 RuleIR 数据包未能载入。"); return response.json() as Promise<RuleData>; }); }
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
  const structural = findings.find(row => row.finding_type === "structural")?.proposition?.value;
  const w02 = context.facts.classical_ziping.w02;
  const w04 = context.facts.shao_weihua.w04;
  const w05 = context.facts.li_hanchen.w05;
  const w06 = context.facts.duan_li_xiang.w06;
  const schoolResult = schoolId === "classical_ziping"
    ? { axis: `${monthGod}月令为阅读起点`, strength: w02.strength.resolved_category || strength, use: `调候 / 流通优先观察：${(w02.strength.recommended_categories || []).join("、") || "以已命中规则为准"}` }
    : schoolId === "shao_weihua"
      ? { axis: "五行与十神配置为阅读起点", strength: w04.strength.category === "balanced_or_contested" ? "均衡待辨" : w04.strength.category === "strong" ? "身强" : "身弱", use: w04.useful_god.specific_useful_available ? `用神候选：${w04.useful_god.specific_useful_tokens.join("、")}` : "用神候选须在已公开案例中继续核对" }
      : schoolId === "li_hanchen"
        ? { axis: "干支作用与两党强弱为阅读起点", strength: w05.classification.classification === "strong" ? "身强" : "身弱", use: `取用党：${w05.useful_party.useful_groups.join("、")}` }
        : { axis: "体用、虚实与做功图为阅读起点", strength: `${w06.work.work_count} 条已编译做功关系`, use: w06.entry.day_stem_combine ? "先从日干合的做功路径进入" : w06.entry.day_branch_relations ? "先从日支关系进入做功路径" : "未形成明确做功入口，保留取象未知" };
  return { headline: `${schoolResult.axis}；${schoolResult.strength}${structural ? `，RuleIR 命中：${structural}` : ""}。`, primary_structure: schoolResult.axis, primary_use: schoolResult.use, strength_or_axis: schoolResult.strength, secondary_structures: ["原局固定映射", "岁运独立上下文"], rejected_routes: [], caveats: ["仅将已编译的浏览器事实参与 RuleIR；缺失专用事实的规则保留为未知，不会被伪造为命中。"] };
}
function themes(close: number, annual: any) {
  const god = annual.stem_ten_god;
  const stance = supporting.has(god) ? "supportive" : /正财|偏财|正官|七杀/.test(god) ? "mixed" : "cautionary";
  return [{ topic: "career", stance, headline: /正官|七杀/.test(god) ? "流年官杀进入主题层，观察职责与规则关系。" : "以年度结构收盘与流月波动观察行动节奏。" }, { topic: "wealth", stance: /正财|偏财/.test(god) ? "supportive" : stance, headline: /正财|偏财/.test(god) ? "流年财星进入主题层，按结构强弱观察资源配置。" : "本主题以流年十神和年度结构为公开参考。" }, { topic: "relationships", stance: /正财|偏财|正官|七杀/.test(god) ? "mixed" : "descriptive", headline: "关系主题不输出现实事件预测，只呈现结构条件。" }, { topic: "health", stance: "descriptive", headline: `当年流月波幅 ${Math.abs(close).toFixed(2)}（内部坐标），用于观察结构起伏。` }];
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
    audits.push({ schoolId, ruleCount: profileRules.length, evaluationCounts: { evaluated: trace.evaluations.length, true: trace.evaluations.filter((row: any) => row.condition_truth === "true").length, unknown: trace.evaluations.filter((row: any) => row.condition_truth === "unknown").length }, warnings: [schoolId === "classical_ziping" ? "子平 W02 原局、W03 调候/流通/调剂与岁运关系已在浏览器编译；无法从公开 ChartIR 直接恢复的边界判断仍按 RuleIR 三值逻辑保留 unknown。" : schoolId === "shao_weihua" ? "邵伟华 W04 的格局候选、旺衰、用神案例、干支关系和岁运结构已在浏览器编译；神煞目录尚未迁入，相关规则保留 unknown。" : schoolId === "li_hanchen" ? "李涵辰 W05 的两党旺衰、干支作用与岁运上下文已在浏览器编译；原始资料未公开的细则保持 unknown。" : "段氏理象 W06 的体用、虚实、做功图与岁运重算已在浏览器编译；未公开的深层取象保持 unknown。"], trace: trace.evaluations, stateChain: { phaseOrder: profile?.phase_order || [] } });
    let previous: number | undefined;
    trajectory[schoolId] = annualContexts.map((annual: any) => { const luck = luckCycles.find((row: any) => annual.year >= row.start_year && annual.year <= row.end_year)!; const annualTrace = evaluateRulesWithTrace(profileRules, buildFacts(chart, luck, annual, data), { ...traceOptions, stateId: `state.${schoolId}.${annual.year}` }); const trueFindings = annualTrace.evaluations.flatMap((row: any) => row.emitted_findings).filter((row: any) => row.truth === "true"); const ruleAnchor = clamp((trueFindings.filter((row: any) => row.direction === "supportive").length - trueFindings.filter((row: any) => row.direction === "inhibitory").length) / 8); const raw = candle(chart, luck, annual, ruleAnchor, previous); previous = raw.close; return { year: annual.year, luckCycleId: luck.luck_cycle_id, annualRuleAnchor: display(ruleAnchor * 100), themeSignals: themes(raw.close, annual), open: display(raw.open), high: display(raw.high), low: display(raw.low), close: display(raw.close), monthOpen: display(raw.monthOpen), monthlySamples: raw.monthlySamples.map(row => ({ ...row, index: display(row.index) })) }; });
  }
  const selectedLuck = luckCycles.find((row: any) => target >= row.start_year && target <= row.end_year)!;
  return { schema: "senfate-browser-ruleir.v1", analysisId: `browser.${Date.now()}`, chart: { pillars, luckCycles, annualContexts, activeLuck: selectedLuck, provenance: { provider: "senfate-browser-worker", input_boundary: "certified-calendar", notes: ["RuleIR 数据由 GitHub Pages 静态发布；计算发生在浏览器 Worker。"] } }, selectedYear: target, schools, trajectory, audit: audits, labels, calculationMethod: { annual: "浏览器 Worker 以认证原局、所属大运与流年分别构造事实上下文，再按流派独立执行 RuleIR。", monthlyCandle: "年度 K 线：开盘取上年收盘（首年取寅月），收盘取当年丑月，影线覆盖十二流月。内部支持/压力坐标经 Fisher 合成后映射为 0—100 公开结构指数。", unit: "0—100 结构指数，不是概率、收益或现实事件评分。" }, scope: "红色表示本年收盘高于开盘，绿色表示本年收盘低于开盘。计算与规则数据均在本机浏览器中完成。" };
}

const worker: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async ({ data }: MessageEvent<Request>) => { try { if (data.type !== "analyze") throw new Error("不支持的本地分析请求。"); worker.postMessage({ id: data.id, ok: true, result: await analyze(data) }); } catch (cause) { worker.postMessage({ id: data.id, ok: false, error: cause instanceof Error ? cause.message : "本地分析失败。" }); } };
export {};
