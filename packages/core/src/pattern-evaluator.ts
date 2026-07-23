import { BRANCH_DEFINITIONS, STEM_DEFINITIONS, tenGod, type Branch, type Element, type Stem, type TenGod } from "./ontology";
import type { ReferenceNormalFormPhaseResult } from "./resolution";
import { commandStemAt, type CommandSegment } from "./command-days";
import type { FourPillarState, StrengthEvaluation } from "./structure";

/**
 * 规则驱动的格局判定（子平法口径）。
 *
 * 与 interpretation.ts 的参数化投影不同，本模块按子平法标准流程判定格局：
 * 月令司令分日 → 透干定格 → 成败救应 → 特殊格（禄/刃/月劫）→ 从格细分 → 合局变格。
 * 每条结论携带古籍书证来源（bookId + lineRange），保证可追溯。
 */

const POSITIONS = ["year", "month", "day", "hour"] as const;
type PillarPosition = (typeof POSITIONS)[number];

/** 古籍来源引用 */
export interface PatternSourceEvidence {
  readonly bookId: string;
  readonly bookLabel: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly rule: string;
}

/** 规则驱动格局结论 */
export interface RuleDrivenPatternConclusion {
  readonly id: string;
  readonly label: string;
  readonly family: "regular" | "special" | "follow" | "transform";
  readonly status: "qualified" | "contested" | "candidate" | "broken";
  readonly commandStem: Stem;
  readonly tenGod: TenGod;
  readonly exposed: boolean;
  readonly evidence: readonly string[];
  readonly unmetConditions: readonly string[];
  readonly sourceEvidence: readonly PatternSourceEvidence[];
}

export interface PatternEvaluationContext {
  /** 距该月"节"交节当日的天数，用于查司令分日表。 */
  readonly daysFromJie: number;
}

export interface RuleDrivenPatternResult {
  readonly conclusions: readonly RuleDrivenPatternConclusion[];
  readonly commandStem: Stem;
  readonly commandSegments: readonly CommandSegment[];
}

// ── 子平法常数表 ──────────────────────────────────────────────

const PROSPERITY_BRANCH: Readonly<Record<Stem, Branch>> = { 甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳", 己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子" };
const BLADE_BRANCH: Readonly<Record<Stem, Branch>> = { 甲: "卯", 乙: "辰", 丙: "午", 丁: "未", 戊: "午", 己: "未", 庚: "酉", 辛: "戌", 壬: "子", 癸: "丑" };
const GENERATES: Readonly<Record<Element, Element>> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CONTROLS: Readonly<Record<Element, Element>> = { 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" };
const SUPPORTING_TEN_GODS: ReadonlySet<TenGod> = new Set(["比肩", "劫财", "正印", "偏印"]);

/** 常规格（八格）的十神标签 */
const REGULAR_PATTERN_LABEL: Readonly<Partial<Record<TenGod, string>>> = {
  食神: "食神格", 伤官: "伤官格", 偏财: "偏财格", 正财: "正财格",
  七杀: "七杀格", 正官: "正官格", 偏印: "偏印格", 正印: "正印格",
};

// ── 古籍来源 ──────────────────────────────────────────────────
const SOURCE_ZI_PING_ZHEN_QUAN = (lineStart: number, lineEnd: number, rule: string): PatternSourceEvidence => ({
  bookId: "zi-ping-zhen-quan", bookLabel: "《子平真诠》", lineStart, lineEnd, rule,
});
const SOURCE_YUAN_HAI = (lineStart: number, lineEnd: number, rule: string): PatternSourceEvidence => ({
  bookId: "yuan-hai-zi-ping", bookLabel: "《渊海子平》", lineStart, lineEnd, rule,
});
const SOURCE_DI_TIAN_SUI = (lineStart: number, lineEnd: number, rule: string): PatternSourceEvidence => ({
  bookId: "di-tian-sui", bookLabel: "《滴天髓》", lineStart, lineEnd, rule,
});
const SOURCE_QIAN_LI = (lineStart: number, lineEnd: number, rule: string): PatternSourceEvidence => ({
  bookId: "qian-li-ming-gao", bookLabel: "《千里命稿》", lineStart, lineEnd, rule,
});

function visibleStems(pillars: FourPillarState, excludeDay = true): Stem[] {
  return POSITIONS.filter((p) => !(excludeDay && p === "day")).map((p) => pillars[p].stem);
}

function allHiddenStems(pillars: FourPillarState): { stem: Stem; position: PillarPosition; rank: "main" | "middle" | "residual" }[] {
  const result: { stem: Stem; position: PillarPosition; rank: "main" | "middle" | "residual" }[] = [];
  for (const position of POSITIONS) {
    for (const hidden of BRANCH_DEFINITIONS[pillars[position].branch].hiddenStems) {
      result.push({ stem: hidden.stem, position, rank: hidden.rank });
    }
  }
  return result;
}

function isExposed(stem: Stem, pillars: FourPillarState): boolean {
  return visibleStems(pillars).includes(stem);
}

/**
 * 判定某十神是否被冲破（败格检查）。
 * 读取 normalForm 的已裁决关系，判断与格局用神相冲的关系是否 effective。
 */
function isBrokenByClash(tenGodStem: Stem, normalForm: ReferenceNormalFormPhaseResult): { broken: boolean; clashDescription: string | undefined } {
  const clashes = normalForm.relations.filter(
    (rel) => rel.status === "effective" && rel.candidate.kind === "branch-clash" && rel.candidate.members.includes(tenGodStem as Stem | Branch),
  );
  if (clashes.length > 0) {
    return { broken: true, clashDescription: clashes.map((c) => c.id).join("、") };
  }
  return { broken: false, clashDescription: undefined };
}

/**
 * 判定破格后是否有救应（印星或通关化解）。
 */
function hasRemedy(tenGodStem: Stem, dayStem: Stem, normalForm: ReferenceNormalFormPhaseResult): boolean {
  const tenGodElement = STEM_DEFINITIONS[tenGodStem].element;
  const dayElement = STEM_DEFINITIONS[dayStem].element;
  // 通关：存在有效的合局或三合/三会，且目标元素能化解冲克
  const bridges = normalForm.relations.filter(
    (rel) => rel.status === "effective" && (rel.candidate.kind === "stem-combine" || rel.candidate.kind === "three-harmony" || rel.candidate.kind === "three-meeting"),
  );
  // 印星救应：日主之印（生扶日主的元素）在命局中显现且有根
  const resource = Object.entries(STEM_DEFINITIONS).find(([, def]) => GENERATES[def.element] === dayElement)?.[0];
  const hasResourceRoot = resource ? allHiddenStems({ ...({} as FourPillarState) }).some((h) => h.stem === resource) : false;
  return bridges.length > 0 || hasResourceRoot;
}

// ── 主判定函数 ────────────────────────────────────────────────

export function evaluateRuleDrivenPatterns(
  pillars: FourPillarState,
  strength: StrengthEvaluation,
  normalForm: ReferenceNormalFormPhaseResult,
  context: PatternEvaluationContext,
): RuleDrivenPatternResult {
  const dayStem = pillars.day.stem;
  const monthBranch = pillars.month.branch;
  const commandStem = commandStemAt(monthBranch, context.daysFromJie);
  const commandTenGod = tenGod(dayStem, commandStem);
  const exposed = isExposed(commandStem, pillars);
  const conclusions: RuleDrivenPatternConclusion[] = [];

  // ── 1. 常规格：月令司令之神透干定格 ──
  evaluateRegularPattern(conclusions, pillars, dayStem, commandStem, commandTenGod, exposed, normalForm, context);

  // ── 2. 建禄格 / 羊刃格 / 月劫格 ──
  evaluateSpecialPatterns(conclusions, pillars, dayStem, monthBranch, normalForm);

  // ── 3. 从强 / 从弱 / 从财 / 从杀 等细分 ──
  evaluateFollowingPatterns(conclusions, pillars, dayStem, strength, normalForm);

  // ── 4. 合局变格（三合三会化气改格）──
  evaluateTransformPatterns(conclusions, pillars, dayStem, monthBranch, normalForm);

  // 排序：qualified 优先，follow 最先，然后 special、regular、transform
  const priority = (item: RuleDrivenPatternConclusion): number => {
    const statusOrder = item.status === "qualified" ? 0 : item.status === "contested" ? 1 : item.status === "candidate" ? 2 : 3;
    const familyOrder = item.family === "follow" ? 0 : item.family === "special" ? 1 : item.family === "regular" ? 2 : 3;
    return statusOrder * 10 + familyOrder;
  };
  conclusions.sort((a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id));

  return { conclusions, commandStem, commandSegments: [] };
}

function evaluateRegularPattern(
  conclusions: RuleDrivenPatternConclusion[],
  pillars: FourPillarState,
  dayStem: Stem,
  commandStem: Stem,
  commandTenGod: TenGod,
  exposed: boolean,
  normalForm: ReferenceNormalFormPhaseResult,
  context: PatternEvaluationContext,
): void {
  const label = REGULAR_PATTERN_LABEL[commandTenGod];
  // 比肩/劫财无常规格标签（走月劫格，见 evaluateSpecialPatterns）
  if (!label) return;

  const evidence: string[] = [
    `司令之神=${commandStem}（十神 ${commandTenGod}）`,
    exposed ? `司令之神透于天干` : `司令之神未透`,
    `距节气 ${context.daysFromJie.toFixed(1)} 日`,
  ];
  const unmet: string[] = [];
  const sources: PatternSourceEvidence[] = [
    SOURCE_ZI_PING_ZHEN_QUAN(71, 78, "月令藏干透干者取格"),
    SOURCE_QIAN_LI(2715, 2719, "月支本气透於天干取格三法"),
  ];

  // 透干定格：司令之神透出为成格的硬条件
  if (!exposed) {
    unmet.push("司令之神未透天干，需考察本气或中余气透干");
    // 未透时退而求其次：检查月支本气是否透干
    const mainStem = BRANCH_DEFINITIONS[pillars.month.branch].hiddenStems.find((h) => h.rank === "main")?.stem;
    if (mainStem && mainStem !== commandStem && isExposed(mainStem, pillars)) {
      const mainTenGod = tenGod(dayStem, mainStem);
      const mainLabel = REGULAR_PATTERN_LABEL[mainTenGod];
      if (mainLabel) {
        conclusions.push({
          id: `regular.${mainTenGod}`,
          label: mainLabel,
          family: "regular",
          status: "candidate",
          commandStem: mainStem,
          tenGod: mainTenGod,
          exposed: true,
          evidence: [`退取本气=${mainStem}（十神 ${mainTenGod}）透干`, `司令=${commandStem}未透`],
          unmetConditions: [`司令之神 ${commandStem} 未透，暂以透干本气 ${mainStem} 为候选`],
          sourceEvidence: sources,
        });
      }
    }
    return;
  }

  // 成败救应：检查是否被冲破
  const breakage = isBrokenByClash(commandStem, normalForm);
  if (breakage.broken) {
    const remedied = hasRemedy(commandStem, dayStem, normalForm);
    conclusions.push({
      id: `regular.${commandTenGod}`,
      label,
      family: "regular",
      status: remedied ? "contested" : "broken",
      commandStem,
      tenGod: commandTenGod,
      exposed,
      evidence: [...evidence, `被冲破：${breakage.clashDescription}`, remedied ? `存在救应（印星或通关）` : `无救应`],
      unmetConditions: remedied ? [`格局被冲破但有救应，降为争议`] : [`格局被冲破且无救应，作破格论`],
      sourceEvidence: [SOURCE_ZI_PING_ZHEN_QUAN(95, 102, "成格之后有冲破，看救应"), ...sources],
    });
    return;
  }

  conclusions.push({
    id: `regular.${commandTenGod}`,
    label,
    family: "regular",
    status: "qualified",
    commandStem,
    tenGod: commandTenGod,
    exposed,
    evidence,
    unmetConditions: unmet,
    sourceEvidence: sources,
  });
}

function evaluateSpecialPatterns(
  conclusions: RuleDrivenPatternConclusion[],
  pillars: FourPillarState,
  dayStem: Stem,
  monthBranch: Branch,
  normalForm: ReferenceNormalFormPhaseResult,
): void {
  // 建禄格：月支为日主临官之地
  if (monthBranch === PROSPERITY_BRANCH[dayStem]) {
    conclusions.push({
      id: "special.established-prosperity",
      label: "建禄格",
      family: "special",
      status: "qualified",
      commandStem: dayStem,
      tenGod: tenGod(dayStem, dayStem),
      exposed: isExposed(dayStem, pillars),
      evidence: [`日主=${dayStem}`, `月支=${monthBranch}（日主临官禄地）`],
      unmetConditions: [],
      sourceEvidence: [SOURCE_YUAN_HAI(120, 128, "月建为禄为建禄格"), SOURCE_QIAN_LI(147, 152, "建禄格取用")],
    });
  }

  // 羊刃格：月支为日主帝旺刃地
  if (monthBranch === BLADE_BRANCH[dayStem]) {
    const yangDay = STEM_DEFINITIONS[dayStem].polarity === "阳";
    conclusions.push({
      id: "special.yang-blade",
      label: "羊刃格",
      family: "special",
      status: yangDay ? "qualified" : "contested",
      commandStem: dayStem,
      tenGod: tenGod(dayStem, dayStem),
      exposed: isExposed(dayStem, pillars),
      evidence: [`日主=${dayStem}`, `月支=${monthBranch}（日主帝旺刃地）`, yangDay ? "阳干羊刃" : "阴干羊刃（流派分歧）"],
      unmetConditions: yangDay ? [] : ["阴干羊刃的取法存在流派分歧（《子平真诠》与《滴天髓》口径不同）"],
      sourceEvidence: [SOURCE_ZI_PING_ZHEN_QUAN(110, 118, "月建为刃为羊刃格"), SOURCE_DI_TIAN_SUI(45, 50, "阳刃阴刃之辨")],
    });
  }

  // 月劫格：月令藏干透出比劫（非禄非刃）
  const monthHidden = BRANCH_DEFINITIONS[monthBranch].hiddenStems;
  for (const hidden of monthHidden) {
    const tg = tenGod(dayStem, hidden.stem);
    if ((tg === "比肩" || tg === "劫财") && isExposed(hidden.stem, pillars)) {
      // 仅当非禄非刃时才论月劫
      if (monthBranch !== PROSPERITY_BRANCH[dayStem] && monthBranch !== BLADE_BRANCH[dayStem]) {
        conclusions.push({
          id: "special.month-robbery",
          label: tg === "劫财" ? "月劫格" : "月刃格",
          family: "special",
          status: "candidate",
          commandStem: hidden.stem,
          tenGod: tg,
          exposed: true,
          evidence: [`月令藏干 ${hidden.stem}（${hidden.rank}，十神 ${tg}）透干`, `月支=${monthBranch} 非禄非刃`],
          unmetConditions: ["月劫格需配合官星制劫或食伤泄秀方能成格"],
          sourceEvidence: [SOURCE_ZI_PING_ZHEN_QUAN(120, 128, "月令为劫为月劫格"), SOURCE_YUAN_HAI(130, 138, "月劫取用")],
        });
      }
    }
  }
}

function evaluateFollowingPatterns(
  conclusions: RuleDrivenPatternConclusion[],
  pillars: FourPillarState,
  dayStem: Stem,
  strength: StrengthEvaluation,
  normalForm: ReferenceNormalFormPhaseResult,
): void {
  const observed = [
    ...visibleStems(pillars).map((s) => tenGod(dayStem, s)),
    ...allHiddenStems(pillars).map((h) => tenGod(dayStem, h.stem)),
  ];
  const allSupport = observed.every((tg) => SUPPORTING_TEN_GODS.has(tg));
  const allPressure = observed.every((tg) => !SUPPORTING_TEN_GODS.has(tg));

  // 从强格
  if (strength.state === "very-strong") {
    conclusions.push({
      id: "follow.follow-strong",
      label: "从强格",
      family: "follow",
      status: allSupport ? "qualified" : "candidate",
      commandStem: dayStem,
      tenGod: tenGod(dayStem, dayStem),
      exposed: true,
      evidence: [`日主极强（supportRatio=${strength.supportRatio.toFixed(3)}）`, `全局生扶一致=${allSupport}`],
      unmetConditions: allSupport ? [] : ["原局仍见克泄耗成分，暂保留极强候选"],
      sourceEvidence: [SOURCE_DI_TIAN_SUI(180, 195, "从强从旺之论"), SOURCE_YUAN_HAI(160, 172, "从象格")],
    });
  }

  // 从弱格
  if (strength.state === "very-weak") {
    const dayMasterRootMass = strength.rootExposure.dayMasterRootMass;
    const rootless = dayMasterRootMass === 0;
    conclusions.push({
      id: "follow.follow-weak",
      label: "从弱格",
      family: "follow",
      status: allPressure && rootless ? "qualified" : "candidate",
      commandStem: dayStem,
      tenGod: tenGod(dayStem, dayStem),
      exposed: true,
      evidence: [`日主极弱（supportRatio=${strength.supportRatio.toFixed(3)}）`, `全局克泄耗一致=${allPressure}`, `日主无根=${rootless}`],
      unmetConditions: [...(!allPressure ? ["原局仍见比劫或印星生扶"] : []), ...(!rootless ? ["日主仍有通根"] : [])],
      sourceEvidence: [SOURCE_DI_TIAN_SUI(196, 210, "从弱从衰之论"), SOURCE_YUAN_HAI(173, 185, "从杀从儿格")],
    });

    // 从弱细分：从财 / 从杀 / 从儿
    if (allPressure && rootless) {
      const dayElement = STEM_DEFINITIONS[dayStem].element;
      const wealth = CONTROLS[dayElement]; // 日主所克
      const officer = Object.entries(STEM_DEFINITIONS).find(([, def]) => CONTROLS[def.element] === dayElement)?.[1].element; // 克日主
      const output = GENERATES[dayElement]; // 日主所生
      const visibleElements = visibleStems(pillars).map((s) => STEM_DEFINITIONS[s].element);
      const dominantWealth = visibleElements.filter((e) => e === wealth).length;
      const dominantOfficer = visibleElements.filter((e) => e === officer).length;
      const dominantOutput = visibleElements.filter((e) => e === output).length;
      if (dominantWealth >= 2) {
        conclusions.push({
          id: "follow.follow-wealth",
          label: "从财格",
          family: "follow",
          status: "qualified",
          commandStem: dayStem, tenGod: "偏财", exposed: true,
          evidence: [`日主极弱无根`, `财星 ${wealth} 旺（透 ${dominantWealth} 干）`],
          unmetConditions: [],
          sourceEvidence: [SOURCE_YUAN_HAI(173, 178, "从财格"), SOURCE_DI_TIAN_SUI(200, 205, "从财之论")],
        });
      } else if (dominantOfficer >= 2) {
        conclusions.push({
          id: "follow.follow-officer",
          label: "从杀格",
          family: "follow",
          status: "qualified",
          commandStem: dayStem, tenGod: "七杀", exposed: true,
          evidence: [`日主极弱无根`, `官杀 ${officer} 旺（透 ${dominantOfficer} 干）`],
          unmetConditions: [],
          sourceEvidence: [SOURCE_YUAN_HAI(179, 185, "从杀格"), SOURCE_DI_TIAN_SUI(206, 210, "从杀之论")],
        });
      } else if (dominantOutput >= 2) {
        conclusions.push({
          id: "follow.follow-output",
          label: "从儿格",
          family: "follow",
          status: "qualified",
          commandStem: dayStem, tenGod: "伤官", exposed: true,
          evidence: [`日主极弱无根`, `食伤 ${output} 旺（透 ${dominantOutput} 干）`],
          unmetConditions: [],
          sourceEvidence: [SOURCE_YUAN_HAI(186, 192, "从儿格"), SOURCE_DI_TIAN_SUI(211, 215, "从儿之论")],
        });
      }
    }
  }
}

function evaluateTransformPatterns(
  conclusions: RuleDrivenPatternConclusion[],
  pillars: FourPillarState,
  dayStem: Stem,
  monthBranch: Branch,
  normalForm: ReferenceNormalFormPhaseResult,
): void {
  // 合局变格：三合三会化气成功（normalForm 中有 transformed 状态的三合/三会）
  const transformed = normalForm.relations.filter(
    (rel) => rel.status === "transformed" && (rel.candidate.kind === "three-harmony" || rel.candidate.kind === "three-meeting") && rel.candidate.targetElement,
  );
  for (const rel of transformed) {
    const targetElement = rel.candidate.targetElement!;
    const targetStem = Object.values(STEM_DEFINITIONS).find((def) => def.element === targetElement)?.symbol ?? dayStem;
    conclusions.push({
      id: `transform.${rel.candidate.kind}`,
      label: `${rel.candidate.kind === "three-harmony" ? "三合" : "三会"}${targetElement}局变格`,
      family: "transform",
      status: "candidate",
      commandStem: targetStem,
      tenGod: tenGod(dayStem, targetStem),
      exposed: isExposed(targetStem, pillars),
      evidence: [`${rel.candidate.kind} 成化`, `化气目标=${targetElement}`, `关系=${rel.id}`],
      unmetConditions: ["合局化气需满足当令、全无破绽等严格条件，当前列为候选"],
      sourceEvidence: [SOURCE_ZI_PING_ZHEN_QUAN(140, 155, "合化成局变格"), SOURCE_DI_TIAN_SUI(220, 235, "方局合化之论")],
    });
  }
}
