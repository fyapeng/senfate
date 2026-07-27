import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface RuleRecord {
  rule_id: string;
  title: string;
  description: string;
  school_id: string;
  module: string;
  status: string[];
  maturity: string;
  enabled: boolean;
  scope: string[];
  phase: string;
  priority: number;
  when: unknown;
  actions: unknown[];
  source_refs: unknown[];
  review: unknown;
}

const schoolLabels: Record<string, string> = { classical_ziping: "传统子平", shao_weihua: "邵伟华体系", li_hanchen: "李涵辰体系", duan_li_xiang: "段氏理象体系" };
const scopeLabels: Record<string, string> = { natal: "原局", luck: "大运", annual: "流年", month: "流月" };
const phaseLabels: Record<string, string> = {
  "school.pattern_selection": "格局取用",
  "school.pattern_lifecycle": "格局成败",
  "school.strength_resolution": "旺衰裁决",
  "school.follow_transform_resolution": "从化辨析",
  "school.qi_flow_resolution": "气势流通",
  "school.temporal_resolution": "岁运作用",
};
const workLabels: Record<string, string> = {
  "classic.di_tian_sui": "滴天髓",
  "classic.ming_li_yue_yan": "命理约言",
  "classic.qian_li_ming_gao": "千里命稿",
  "classic.qiong_tong_bao_jian": "穷通宝鉴",
  "classic.san_ming_tong_hui": "三命通会",
  "classic.shen_feng_tong_kao": "神峰通考",
  "classic.yuan_hai_zi_ping": "渊海子平",
  "classic.zi_ping_zhen_quan": "子平真诠",
  "modern.duan_li_xiang": "段氏理象",
  "modern.li_hanchen_ba_zi_yu_ce_zhen_zong": "李涵辰《八字预测真踪》",
  "modern.shao_si_zhu_yu_ce_xue": "邵伟华《四柱预测学》",
};

export function rulePresentation(rule: RuleRecord) {
  const sources = (rule.source_refs as Array<Record<string, unknown>>).map(source => ({
    work: workLabels[String(source.work_id ?? "")] ?? "公开文献来源",
    section: Array.isArray(source.section_path) ? source.section_path.join(" / ") : "",
    quote: String(source.quote ?? ""),
    verification: String(source.verification ?? ""),
  }));
  return {
    school: schoolLabels[rule.school_id] ?? rule.school_id,
    scope: rule.scope.map(scope => scopeLabels[scope] ?? scope).join("、"),
    phase: phaseLabels[rule.phase] ?? "规则推演",
    status: rule.status.includes("executable") ? "已纳入运行" : "已公开说明",
    sources,
  };
}

let rulesPromise: Promise<readonly RuleRecord[]> | undefined;

export function rules(): Promise<readonly RuleRecord[]> {
  rulesPromise ??= (async () => {
    const cwd = process.cwd();
    const root = process.env.SENFATE_ROOT ?? (await access(resolve(cwd, "vendor")).then(() => cwd).catch(() => resolve(cwd, "../..")));
    const source = await readFile(resolve(root, "vendor/bazi-rules-v1.8.0/rules/compiled/rules.jsonl"), "utf8");
    return source.split("\n").filter(Boolean).map((line) => JSON.parse(line) as RuleRecord);
  })();
  return rulesPromise;
}

export function publicRule(rule: RuleRecord): Omit<RuleRecord, "when" | "actions" | "source_refs" | "review"> & { presentation: ReturnType<typeof rulePresentation> } {
  const { when: _when, actions: _actions, source_refs: _sources, review: _review, ...summary } = rule;
  return { ...summary, presentation: rulePresentation(rule) };
}
