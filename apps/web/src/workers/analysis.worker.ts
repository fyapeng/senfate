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
const tenGodGroupLabels: Record<string, string> = { peer: "比劫", resource: "印星", output: "食伤", wealth: "财星", official: "官杀", official_kill: "官杀" };
const stemCombinePairs = ["甲己", "乙庚", "丙辛", "丁壬", "戊癸"];
const branchClashPairs = ["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"];
const branchCombinePairs = ["子丑", "寅亥", "卯戌", "辰酉", "巳申", "午未"];
const positionLabels: Record<string, string> = { year: "年", month: "月", hour: "时" };
let cachedRules: Promise<RuleData> | undefined;

function rules(url: string) { return cachedRules ??= fetch(url).then(async response => { if (!response.ok) throw new Error("规则资料暂未加载完成，请刷新页面后重试。"); return response.json() as Promise<RuleData>; }); }
function clamp(value: number, low = -0.98, high = .98) { return Math.max(low, Math.min(high, value)); }
function display(value: number) { return Math.round((value + 100) / 2 * 100) / 100; }
function displayGroups(values: string[] | undefined) { return [...new Set((values || []).map(value => tenGodGroupLabels[value] || value))].join("、"); }
function pairMatches(a: string, b: string, pairs: string[]) { return pairs.some(pair => pair.includes(a) && pair.includes(b)); }
function useAndAvoid(side: "strong" | "weak") {
  return side === "strong"
    ? { use: "食伤、财星、官杀", avoid: "印星、比劫" }
    : { use: "印星、比劫", avoid: "食伤、财星、官杀" };
}
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
function buildFacts(chart: any, luck: any | undefined, annual: any | undefined, data: RuleData) {
  const stems = Object.values(chart.pillars).map((row: any) => row.stem);
  const branches = Object.values(chart.pillars).map((row: any) => row.branch);
  const all = [...Object.values(chart.pillars) as any[], ...(luck ? [luck] : []), ...(annual ? [annual] : [])];
  const gods = all.flatMap((row: any) => [row.stem_ten_god, ...(row.hidden_stems || []).map((item: any) => item.ten_god)]);
  const counts = Object.fromEntries(["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印"].map(name => [name, gods.filter(item => item === name).length]));
  const w03 = compileClassicalZipingW03(chart, data.classicalZiping.climateMatrix, luck, annual);
  const w04 = compileShaoWeihuaFacts(chart, data.shaoWeihua, luck, annual);
  const w05 = compileLiHanchenFacts(chart, luck, annual);
  const w06 = compileDuanLiXiangFacts(chart, luck, annual);
  return { chart, luck, annual, facts: { browser: { chart: { day_master: chart.day_master, stems, branches, ten_gods: counts, month_command: chart.pillars.month.branch }, temporal: { luck: luck ? `${luck.stem}${luck.branch}` : null, annual: annual ? `${annual.stem}${annual.branch}` : null } }, classical_ziping: { w02: compileClassicalZipingFacts(chart), w03 }, shao_weihua: { w04 }, li_hanchen: { w05 }, duan_li_xiang: { w06 } }, relations: w03.compiled_relations, findings: [] as any[] };
}
function verdict(schoolId: string, chart: any, context: any) {
  const gods = Object.values(chart.pillars).flatMap((row: any) => [row.stem_ten_god, ...(row.hidden_stems || []).map((item: any) => item.ten_god)]);
  const supportCount = gods.filter(item => supporting.has(item)).length;
  const fallbackStrength = supportCount >= gods.length / 2 ? "身强" : "身弱";
  const w02 = context.facts.classical_ziping.w02;
  const w03 = context.facts.classical_ziping.w03;
  const w04 = context.facts.shao_weihua.w04;
  const w05 = context.facts.li_hanchen.w05;
  const w06 = context.facts.duan_li_xiang.w06;
  const climateCandidates = w03.climate.ordered_candidates || [];
  const primaryClimate = climateCandidates[0];
  const climateVisibility = w03.climate.primary_candidate_visibility;
  const climate = primaryClimate
    ? `调候用神取${primaryClimate}${climateCandidates.slice(1).length ? `，辅取${climateCandidates.slice(1).join("、")}` : ""}。${primaryClimate}${climateVisibility === "visible" ? "已透，调候条件已具" : climateVisibility === "hidden" ? "藏支，调候有根但不显" : "原局不现，调候条件不足"}。`
    : "本局没有形成单一调候用神结论。";

  const dayPillar = chart.pillars.day;
  const workRelations = [...new Set((w06.work.work_graph || []).slice(0, 18).map((path: any) => `${path.participants.join("与")}${relationWords[path.method] || "发生作用"}`))].slice(0, 3);
  const otherPillars = (["year", "month", "hour"] as const).map(position => ({ position, ...chart.pillars[position] }));
  const dayStemCombines = otherPillars.filter(row => pairMatches(chart.day_master, row.stem, stemCombinePairs));
  const dayBranchClashes = otherPillars.filter(row => pairMatches(dayPillar.branch, row.branch, branchClashPairs));
  const dayBranchCombines = otherPillars.filter(row => pairMatches(dayPillar.branch, row.branch, branchCombinePairs));
  const directRelations = [
    ...dayStemCombines.map(row => `${positionLabels[row.position]}干${row.stem}与日干${chart.day_master}相合`),
    ...dayBranchClashes.map(row => `${positionLabels[row.position]}支${row.branch}冲日支${dayPillar.branch}`),
    ...dayBranchCombines.map(row => `${positionLabels[row.position]}支${row.branch}合日支${dayPillar.branch}`),
  ];
  const duanPrimary = directRelations[0] || (workRelations[0] ? `${workRelations[0]}为首要作用关系` : "日干无合、日支无六合六冲");
  const duanSummary = directRelations.length ? `原局共有${directRelations.length}处直接作用，首要作用直接落在日柱。` : workRelations.length ? `原局没有直接合冲日柱，次级做功由${workRelations.join("、")}构成。` : "原局没有形成显著合冲做功，日主与日支保持原位。";
  const duanRelationCount = `日干五合${dayStemCombines.length}处，日支六冲${dayBranchClashes.length}处、六合${dayBranchCombines.length}处。`;

  const resolvedStrength = w02.strength.resolved_category || fallbackStrength;
  const classicalSide: "strong" | "weak" = w02.strength.resolved_side === "strong" ? "strong" : "weak";
  const classicalUse = useAndAvoid(classicalSide);
  const patternName = w02.lifecycle.confirmed_pattern || w02.pattern.candidate_class || chart.pillars.month.stem_ten_god;
  const patternTitle = `${patternName}${String(patternName).endsWith("格") ? "" : "格"}`;
  const modernStrength = w04.strength.category === "balanced_or_contested" ? "力量中和" : w04.strength.category === "strong" ? "日主偏强" : "日主偏弱";
  const modernSide: "strong" | "weak" = w04.strength.category === "strong" ? "strong" : "weak";
  const modernUse = useAndAvoid(modernSide);
  const modernSpecific = w04.useful_god.specific_useful_available ? w04.useful_god.specific_useful_tokens.join("、") : modernUse.use;
  const interactionStrength = w05.classification.classification === "strong" ? "日主偏强" : "日主偏弱";
  const interactionUsefulGroups = displayGroups(w05.useful_party.useful_groups) || "印星、比劫";
  const interactionUnfavorableGroups = displayGroups(w05.useful_party.unfavorable_groups) || "食伤、财星、官杀";

  const schoolResult = schoolId === "classical_ziping"
    ? {
      headline: `${patternTitle}，日主${resolvedStrength}`,
      summary: `本局定为${patternTitle}，日主${resolvedStrength}；取${classicalUse.use}为用，${classicalUse.avoid}为忌。`,
      natal_points: [
        { label: "格局结论", text: `${patternTitle}成立，月令主气以${patternName}定格。` },
        { label: "旺衰结论", text: `日主${resolvedStrength}，扶身力量${classicalSide === "weak" ? "不足" : "充足"}。` },
        { label: "用忌结论", text: `用${classicalUse.use}，忌${classicalUse.avoid}。` },
        { label: "调候结论", text: climate },
      ],
      timing_focus: `${classicalUse.use}岁运为顺势，${classicalUse.avoid}岁运为逆势。`,
      method_note: "子平格局体系以月令定格，再用根气、透干、制化和调候完成旺衰与用忌判断。",
    }
    : schoolId === "shao_weihua"
      ? {
        headline: modernStrength === "力量中和" ? "日主中和，五行力量相持" : `${modernStrength}，${modernSpecific}为用`,
        summary: modernStrength === "力量中和" ? "本局日主中和，不设单一扶抑用神；维持现有五行制化即为结论。" : `本局${modernStrength}；取${modernSpecific}为用，${modernUse.avoid}为忌。`,
        natal_points: [
          { label: "旺衰结论", text: modernStrength === "力量中和" ? "扶助与泄耗相持，日主定为中和。" : `${modernStrength}，${modernStrength === "日主偏强" ? "扶助超过泄耗" : "泄耗克制超过扶助"}。` },
          { label: "用神结论", text: modernStrength === "力量中和" ? "不另立单一扶抑用神。" : `用神取${modernSpecific}。` },
          { label: "忌神结论", text: modernStrength === "力量中和" ? "任何一方继续集中都会破坏现有平衡。" : `忌神为${modernUse.avoid}。` },
        ],
        timing_focus: modernStrength === "力量中和" ? "岁运维持五行相持为顺势，单方过旺为逆势。" : `${modernSpecific}岁运为顺势，${modernUse.avoid}岁运为逆势。`,
        method_note: "现代综合体系综合月令、旺衰、五行流通与十神配置，不把单一缺失五行直接等同于用神。",
      }
      : schoolId === "li_hanchen"
        ? {
          headline: `${interactionStrength}，${interactionUsefulGroups}为用`,
          summary: `本局定为${interactionStrength}；${interactionUsefulGroups}为用神，${interactionUnfavorableGroups}为忌神。`,
          natal_points: [
            { label: "旺衰结论", text: `按七字两党划分，日主支持${interactionStrength === "日主偏强" ? "多于克泄耗" : "少于克泄耗"}，定为${interactionStrength}。` },
            { label: "用神结论", text: `${interactionUsefulGroups}为用神。` },
            { label: "忌神结论", text: `${interactionUnfavorableGroups}为忌神。` },
          ],
          timing_focus: `${interactionUsefulGroups}岁运为吉向，${interactionUnfavorableGroups}岁运为忌向。`,
          method_note: "干支作用体系先定旺衰与有利一侧，再逐层加入大运、流年判断作用关系。",
        }
        : {
          headline: `${chart.day_master}为体，${duanPrimary}`,
          summary: duanSummary,
          natal_points: [
            { label: "体用结论", text: `日主${chart.day_master}为体，日支${dayPillar.branch}为体之落点。` },
            { label: "做功结论", text: directRelations.length ? `第一做功关系为${duanPrimary}。` : workRelations.length ? `${workRelations[0]}构成第一做功关系。` : "原局不成显著做功。" },
            { label: "关系结论", text: duanRelationCount },
          ],
          timing_focus: directRelations.length ? `岁运重复${directRelations[0]}时加强原局做功，合住参与干支时改变原局做功。` : "岁运形成新的合冲时才建立新的做功主线。",
          method_note: "理象做功体系先分体用与主客，再以具体合、冲、生、克确定作用对象和结果去向。",
        };
  return { ...schoolResult, caveats: ["以上是所选流派按公开规则得出的命理结论，不作为现实事件的事实预测。"] };
}
function themes(_close: number, annual: any) {
  const god = annual.stem_ten_god;
  const stance = supporting.has(god) ? "supportive" : /正财|偏财|正官|七杀/.test(god) ? "mixed" : "cautionary";
  return [{ topic: "career", stance, headline: /正官|七杀/.test(god) ? "事业主题偏强：责任、规则与职位压力上升。" : "事业主题平稳：本年没有形成强官杀信号。" }, { topic: "wealth", stance: /正财|偏财/.test(god) ? "supportive" : stance, headline: /正财|偏财/.test(god) ? "财务主题偏强：资源流动与收支活动增加。" : "财务主题平稳：本年没有形成强财星信号。" }, { topic: "relationships", stance: /正财|偏财|正官|七杀/.test(god) ? "mixed" : "descriptive", headline: /正财|偏财|正官|七杀/.test(god) ? "关系主题被财官信号带动，互动强度上升。" : "关系主题平稳：没有形成强财官触发。" }, { topic: "health", stance: "descriptive", headline: "本项只呈现结构波动，不输出疾病或寿命结论。" }];
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
  const natalFacts = buildFacts(chart, undefined, undefined, data);
  for (const schoolId of Object.keys(labels)) {
    const profile = data.profiles[schoolId]; const profileRules = data.rules.filter(rule => rule.enabled && rule.school_id === schoolId);
    const current = annualContexts.find((row: any) => row.year === target)!; const currentLuck = luckCycles.find((row: any) => current.year >= row.start_year && current.year <= row.end_year)!;
    const resolvers = schoolId === "classical_ziping" ? { ...classicalZipingResolvers, ...classicalZipingW03Resolvers } : schoolId === "shao_weihua" ? shaoWeihuaResolvers : schoolId === "li_hanchen" ? liHanchenResolvers : schoolId === "duan_li_xiang" ? duanLiXiangResolvers : {};
    const traceOptions = { schoolProfileId: schoolId, chartId: "senfate.certified.chart", stateId: `state.${schoolId}.${current.year}`, phaseOrder: profile?.phase_order || [], resolvers };
    const currentFacts = buildFacts(chart, currentLuck, current, data);
    const trace = evaluateRulesWithTrace(profileRules, currentFacts, traceOptions);
    schools.push({ school: labels[schoolId], verdict: verdict(schoolId, chart, natalFacts), themes: themes(0, current) });
    const ruleTitles = new Map(profileRules.map((rule: any) => [rule.rule_id, { title: rule.title, description: rule.description }]));
    const publicTrace = trace.evaluations.map((row: any) => ({ ...row, ...ruleTitles.get(row.rule_id) }));
    audits.push({ schoolId, ruleCount: profileRules.length, evaluationCounts: { evaluated: trace.evaluations.length, true: trace.evaluations.filter((row: any) => row.condition_truth === "true").length, unknown: trace.evaluations.filter((row: any) => row.condition_truth === "unknown").length }, warnings: ["本次解读以该体系已公开的原局、岁运规则为依据；资料未覆盖的内容不会写入结论。"], trace: publicTrace, stateChain: { phaseOrder: profile?.phase_order || [] } });
    let previous: number | undefined;
    trajectory[schoolId] = annualContexts.map((annual: any) => { const luck = luckCycles.find((row: any) => annual.year >= row.start_year && annual.year <= row.end_year)!; const annualTrace = evaluateRulesWithTrace(profileRules, buildFacts(chart, luck, annual, data), { ...traceOptions, stateId: `state.${schoolId}.${annual.year}` }); const trueFindings = annualTrace.evaluations.flatMap((row: any) => row.emitted_findings).filter((row: any) => row.truth === "true"); const ruleAnchor = clamp((trueFindings.filter((row: any) => row.direction === "supportive").length - trueFindings.filter((row: any) => row.direction === "inhibitory").length) / 8); const raw = candle(chart, luck, annual, ruleAnchor, previous); previous = raw.close; return { year: annual.year, luckCycleId: luck.luck_cycle_id, annualRuleAnchor: display(ruleAnchor * 100), themeSignals: themes(raw.close, annual), open: display(raw.open), high: display(raw.high), low: display(raw.low), close: display(raw.close), monthOpen: display(raw.monthOpen), monthlySamples: raw.monthlySamples.map(row => ({ ...row, index: display(row.index) })) }; });
  }
  const selectedLuck = luckCycles.find((row: any) => target >= row.start_year && target <= row.end_year)!;
  return { schema: "senfate-browser-ruleir.v5", analysisId: `browser.${Date.now()}`, chart: { pillars, luckCycles, annualContexts, activeLuck: selectedLuck, provenance: { provider: "senfate-browser-worker", input_boundary: "certified-calendar", notes: ["规则资料与计算均在当前设备完成。"] } }, selectedYear: target, schools, trajectory, audit: audits, labels, calculationMethod: { annual: "每一年都会同时计算原局、所在大运、流年与十二个月的干支关系；四个体系各自给出结论。", monthlyCandle: "年度 K 线的开盘取年初状态，收盘取年末状态，影线表示十二个月间的变化范围。", unit: "0—100 是便于比较的相对结构刻度，不代表概率、收益或现实事件评分。" }, scope: "红色表示年末状态高于年初，绿色表示年末状态低于年初。" };
}

const worker: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async ({ data }: MessageEvent<Request>) => { try { if (data.type !== "analyze") throw new Error("不支持的本地分析请求。"); worker.postMessage({ id: data.id, ok: true, result: await analyze(data) }); } catch (cause) { worker.postMessage({ id: data.id, ok: false, error: cause instanceof Error ? cause.message : "本地分析失败。" }); } };
export {};
