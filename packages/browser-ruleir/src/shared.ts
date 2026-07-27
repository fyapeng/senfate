export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue | undefined; }

export function deepClone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => deepEqual(value, b[index]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as Record<string, unknown>).sort();
    const bk = Object.keys(b as Record<string, unknown>).sort();
    return ak.length === bk.length && ak.every((key, index) => key === bk[index] && deepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ));
  }
  return false;
}

export function slug(value: string): string {
  const normalized = value.normalize("NFKC").replace(/[^\p{L}\p{N}_.-]+/gu, "_");
  return normalized.replace(/^_+|_+$/g, "") || "unknown";
}

export function stableStringify(value: unknown): string {
  function normalize(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(item as Record<string, unknown>).sort()) {
        out[key] = normalize((item as Record<string, unknown>)[key]);
      }
      return out;
    }
    return item;
  }
  return JSON.stringify(normalize(value));
}
