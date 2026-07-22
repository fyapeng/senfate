export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
export const ELEMENTS = ["木", "火", "土", "金", "水"] as const;
export const YIN_YANG = ["阳", "阴"] as const;

export type Stem = (typeof STEMS)[number];
export type Branch = (typeof BRANCHES)[number];
export type Element = (typeof ELEMENTS)[number];
export type YinYang = (typeof YIN_YANG)[number];
export type TenGod = "比肩" | "劫财" | "食神" | "伤官" | "偏财" | "正财" | "七杀" | "正官" | "偏印" | "正印";

export interface StemDefinition { readonly symbol: Stem; readonly element: Element; readonly polarity: YinYang }
export interface HiddenStem { readonly stem: Stem; readonly rank: "main" | "middle" | "residual" }
export interface BranchDefinition { readonly symbol: Branch; readonly element: Element; readonly polarity: YinYang; readonly hiddenStems: readonly HiddenStem[] }

export const STEM_DEFINITIONS: Readonly<Record<Stem, StemDefinition>> = {
  甲:{symbol:"甲",element:"木",polarity:"阳"},乙:{symbol:"乙",element:"木",polarity:"阴"},丙:{symbol:"丙",element:"火",polarity:"阳"},丁:{symbol:"丁",element:"火",polarity:"阴"},
  戊:{symbol:"戊",element:"土",polarity:"阳"},己:{symbol:"己",element:"土",polarity:"阴"},庚:{symbol:"庚",element:"金",polarity:"阳"},辛:{symbol:"辛",element:"金",polarity:"阴"},
  壬:{symbol:"壬",element:"水",polarity:"阳"},癸:{symbol:"癸",element:"水",polarity:"阴"},
};

export const BRANCH_DEFINITIONS: Readonly<Record<Branch, BranchDefinition>> = {
  子:{symbol:"子",element:"水",polarity:"阳",hiddenStems:[{stem:"癸",rank:"main"}]},
  丑:{symbol:"丑",element:"土",polarity:"阴",hiddenStems:[{stem:"己",rank:"main"},{stem:"癸",rank:"middle"},{stem:"辛",rank:"residual"}]},
  寅:{symbol:"寅",element:"木",polarity:"阳",hiddenStems:[{stem:"甲",rank:"main"},{stem:"丙",rank:"middle"},{stem:"戊",rank:"residual"}]},
  卯:{symbol:"卯",element:"木",polarity:"阴",hiddenStems:[{stem:"乙",rank:"main"}]},
  辰:{symbol:"辰",element:"土",polarity:"阳",hiddenStems:[{stem:"戊",rank:"main"},{stem:"乙",rank:"middle"},{stem:"癸",rank:"residual"}]},
  巳:{symbol:"巳",element:"火",polarity:"阴",hiddenStems:[{stem:"丙",rank:"main"},{stem:"戊",rank:"middle"},{stem:"庚",rank:"residual"}]},
  午:{symbol:"午",element:"火",polarity:"阳",hiddenStems:[{stem:"丁",rank:"main"},{stem:"己",rank:"middle"}]},
  未:{symbol:"未",element:"土",polarity:"阴",hiddenStems:[{stem:"己",rank:"main"},{stem:"丁",rank:"middle"},{stem:"乙",rank:"residual"}]},
  申:{symbol:"申",element:"金",polarity:"阳",hiddenStems:[{stem:"庚",rank:"main"},{stem:"壬",rank:"middle"},{stem:"戊",rank:"residual"}]},
  酉:{symbol:"酉",element:"金",polarity:"阴",hiddenStems:[{stem:"辛",rank:"main"}]},
  戌:{symbol:"戌",element:"土",polarity:"阳",hiddenStems:[{stem:"戊",rank:"main"},{stem:"辛",rank:"middle"},{stem:"丁",rank:"residual"}]},
  亥:{symbol:"亥",element:"水",polarity:"阴",hiddenStems:[{stem:"壬",rank:"main"},{stem:"甲",rank:"middle"}]},
};

export interface GanZhi { readonly stem: Stem; readonly branch: Branch; readonly index: number }

export function modulo(value: number, divisor: number): number { return ((value % divisor) + divisor) % divisor; }

export function sexagenary(index: number): GanZhi {
  const normalized = modulo(Math.trunc(index), 60);
  return { stem: STEMS[normalized % 10]!, branch: BRANCHES[normalized % 12]!, index: normalized };
}

export function sexagenaryIndex(stem: Stem, branch: Branch): number | undefined {
  const stemIndex = STEMS.indexOf(stem);
  const branchIndex = BRANCHES.indexOf(branch);
  if (stemIndex % 2 !== branchIndex % 2) return undefined;
  for (let index = stemIndex; index < 60; index += 10) if (index % 12 === branchIndex) return index;
  return undefined;
}

const GENERATES: Readonly<Record<Element, Element>> = { 木:"火",火:"土",土:"金",金:"水",水:"木" };
const CONTROLS: Readonly<Record<Element, Element>> = { 木:"土",火:"金",土:"水",金:"木",水:"火" };

export function tenGod(dayStem: Stem, observedStem: Stem): TenGod {
  const day = STEM_DEFINITIONS[dayStem];
  const observed = STEM_DEFINITIONS[observedStem];
  const samePolarity = day.polarity === observed.polarity;
  if (day.element === observed.element) return samePolarity ? "比肩" : "劫财";
  if (GENERATES[day.element] === observed.element) return samePolarity ? "食神" : "伤官";
  if (CONTROLS[day.element] === observed.element) return samePolarity ? "偏财" : "正财";
  if (CONTROLS[observed.element] === day.element) return samePolarity ? "七杀" : "正官";
  return samePolarity ? "偏印" : "正印";
}

export type RelationKind = "stem-combine" | "branch-combine" | "branch-clash" | "branch-harm" | "branch-break" | "three-harmony" | "three-meeting";
export interface RelationCandidate { readonly kind: RelationKind; readonly members: readonly (Stem | Branch)[]; readonly targetElement?: Element }

const STEM_COMBINES: readonly [Stem,Stem,Element][] = [["甲","己","土"],["乙","庚","金"],["丙","辛","水"],["丁","壬","木"],["戊","癸","火"]];
const BRANCH_PAIRS: Readonly<Record<Exclude<RelationKind,"stem-combine"|"three-harmony"|"three-meeting">,readonly [Branch,Branch][]>> = {
  "branch-combine":[["子","丑"],["寅","亥"],["卯","戌"],["辰","酉"],["巳","申"],["午","未"]],
  "branch-clash":[["子","午"],["丑","未"],["寅","申"],["卯","酉"],["辰","戌"],["巳","亥"]],
  "branch-harm":[["子","未"],["丑","午"],["寅","巳"],["卯","辰"],["申","亥"],["酉","戌"]],
  "branch-break":[["子","酉"],["丑","辰"],["寅","亥"],["卯","午"],["巳","申"],["未","戌"]],
};
const THREE_HARMONY: readonly [Branch,Branch,Branch,Element][] = [["申","子","辰","水"],["亥","卯","未","木"],["寅","午","戌","火"],["巳","酉","丑","金"]];
const THREE_MEETING: readonly [Branch,Branch,Branch,Element][] = [["寅","卯","辰","木"],["巳","午","未","火"],["申","酉","戌","金"],["亥","子","丑","水"]];

export function detectRelationCandidates(stems: readonly Stem[], branches: readonly Branch[]): readonly RelationCandidate[] {
  const stemSet = new Set(stems); const branchSet = new Set(branches); const output: RelationCandidate[] = [];
  for (const [a,b,targetElement] of STEM_COMBINES) if (stemSet.has(a)&&stemSet.has(b)) output.push({kind:"stem-combine",members:[a,b],targetElement});
  for (const [kind,pairs] of Object.entries(BRANCH_PAIRS) as [keyof typeof BRANCH_PAIRS,(readonly [Branch,Branch][])][]) for (const [a,b] of pairs) if(branchSet.has(a)&&branchSet.has(b)) output.push({kind,members:[a,b]});
  for (const [a,b,c,targetElement] of THREE_HARMONY) if(branchSet.has(a)&&branchSet.has(b)&&branchSet.has(c)) output.push({kind:"three-harmony",members:[a,b,c],targetElement});
  for (const [a,b,c,targetElement] of THREE_MEETING) if(branchSet.has(a)&&branchSet.has(b)&&branchSet.has(c)) output.push({kind:"three-meeting",members:[a,b,c],targetElement});
  return output;
}
