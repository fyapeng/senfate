import type { Branch, Stem } from "./ontology";
import commandDaysData from "./command-days.json";

export interface CommandSegment {
  readonly daysFromJie: readonly [number, number];
  readonly stem: Stem;
  readonly note: string;
}

interface CommandDaysDocument {
  readonly schema: "senfate-command-days.v1";
  readonly entries: Readonly<Record<Branch, readonly CommandSegment[]>>;
}

const DOCUMENT = commandDaysData as unknown as CommandDaysDocument;

/**
 * 月令司令分日查询：根据月支与距该月"节"的天数，返回当前当令司令之神。
 * @param monthBranch 月支
 * @param daysFromJie 距该月"节"交节当日的天数（0 = 交节当日，可为小数）
 * @returns 司令天干；若天数落在表外则返回该月支本气藏干作为回退
 */
export function commandStemAt(monthBranch: Branch, daysFromJie: number): Stem {
  const segments = DOCUMENT.entries[monthBranch];
  if (segments) {
    for (const segment of segments) {
      if (daysFromJie >= segment.daysFromJie[0] && daysFromJie < segment.daysFromJie[1]) {
        return segment.stem;
      }
    }
  }
  // 回退：取月支本气藏干
  return segments?.at(-1)?.stem ?? "甲";
}

/**
 * 返回某月支完整的司令分日序列（用于审计与展示）。
 */
export function commandSegments(monthBranch: Branch): readonly CommandSegment[] {
  return DOCUMENT.entries[monthBranch] ?? [];
}

export const COMMAND_DAYS_SCHEMA = "senfate-command-days.v1";
