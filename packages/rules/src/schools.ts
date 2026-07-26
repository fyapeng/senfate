import type { CompiledReferenceRecord } from "./compiler";

export const SCHOOL_IDS = ["integrated-classical", "ziping-pattern", "climate-priority"] as const;
export type SchoolId = (typeof SCHOOL_IDS)[number];
export type RuleReviewStatus = "adopted" | "provisional" | "disabled";

export interface SourcePolicy {
  readonly bookId: string;
  readonly enabled: boolean;
  readonly weight: number;
  readonly rationale: string;
}

export interface SchoolProfile {
  readonly schema: "senfate-school-profile.v1";
  readonly id: SchoolId;
  readonly label: string;
  readonly description: string;
  readonly sourcePolicies: readonly SourcePolicy[];
  readonly review: Readonly<{
    provisionalAllowed: boolean;
    disabledRecordIds: readonly string[];
    disabledFamilyIds: readonly string[];
  }>;
}

const ALL_BOOKS = [
  "san-ming-tong-hui", "qian-li-ming-gao", "zi-ping-zhen-quan", "yuan-hai-zi-ping",
  "di-tian-sui", "shen-feng-tong-kao", "qiong-tong-bao-jian",
] as const;

function sources(values: Readonly<Record<string, readonly [boolean, number, string]>>): readonly SourcePolicy[] {
  return ALL_BOOKS.map((bookId) => {
    const [enabled, weight, rationale] = values[bookId] ?? [false, 0, "Not adopted by this school profile"];
    return { bookId, enabled, weight, rationale };
  });
}

const review = { provisionalAllowed: true, disabledRecordIds: [], disabledFamilyIds: [] } as const;

export const SCHOOL_PROFILES: Readonly<Record<SchoolId, SchoolProfile>> = {
  "integrated-classical": {
    schema: "senfate-school-profile.v1", id: "integrated-classical", label: "综合古法",
    description: "保留七书中已结构化且可判定的规则；同类来源不因重复而累加。",
    sourcePolicies: sources(Object.fromEntries(ALL_BOOKS.map((id) => [id, [true, 1, "Included as a provisional classical source"]]))), review,
  },
  "ziping-pattern": {
    schema: "senfate-school-profile.v1", id: "ziping-pattern", label: "子平格局",
    description: "以月令、格局和制化为中心；汇编性与神煞性来源不进入主题规则运行时。",
    sourcePolicies: sources({
      "zi-ping-zhen-quan": [true, 1, "Primary pattern and useful-god source"],
      "yuan-hai-zi-ping": [true, 0.9, "Supporting pattern source"],
      "di-tian-sui": [true, 0.8, "Structural and transformation source"],
      "qian-li-ming-gao": [true, 0.7, "Modern explanatory support"],
    }), review,
  },
  "climate-priority": {
    schema: "senfate-school-profile.v1", id: "climate-priority", label: "调候优先",
    description: "将季节寒热燥湿作为优先约束；格局规则仍保留为结构条件。",
    sourcePolicies: sources({
      "qiong-tong-bao-jian": [true, 1, "Primary seasonal climate source"],
      "zi-ping-zhen-quan": [true, 0.8, "Pattern constraint source"],
      "di-tian-sui": [true, 0.7, "Structural and transformation source"],
      "yuan-hai-zi-ping": [true, 0.65, "Supporting pattern source"],
    }), review,
  },
};

export function ruleReviewStatus(record: CompiledReferenceRecord, profile: SchoolProfile): RuleReviewStatus {
  if (profile.review.disabledRecordIds.includes(record.recordId) || profile.review.disabledFamilyIds.includes(record.familyId)) return "disabled";
  return "provisional";
}

export function ruleWeight(record: CompiledReferenceRecord, profile: SchoolProfile): number {
  if (ruleReviewStatus(record, profile) === "disabled") return 0;
  const policy = profile.sourcePolicies.find((item) => item.bookId === record.bookId);
  if (!policy) return profile.id === "integrated-classical" ? 1 : 0;
  return policy.enabled ? policy.weight : 0;
}
