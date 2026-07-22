export type ClosedResult<T, C extends string = string> =
  | Readonly<{ ok: true; value: T; certificate: Readonly<Record<string, unknown>> }>
  | Readonly<{ ok: false; code: C; reason: string; certificate: Readonly<Record<string, unknown>> }>;

export type KleeneTruth = "true" | "false" | "unknown";

export function kleeneNot(value: KleeneTruth): KleeneTruth {
  return value === "true" ? "false" : value === "false" ? "true" : "unknown";
}

export function kleeneAnd(values: readonly KleeneTruth[]): KleeneTruth {
  if (values.includes("false")) return "false";
  return values.includes("unknown") ? "unknown" : "true";
}

export function kleeneOr(values: readonly KleeneTruth[]): KleeneTruth {
  if (values.includes("true")) return "true";
  return values.includes("unknown") ? "unknown" : "false";
}

export interface ClosedInterval {
  readonly lower: number;
  readonly upper: number;
  readonly unit: string;
}

export function interval(lower: number, upper: number, unit: string): ClosedInterval {
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper) {
    throw new Error(`Invalid closed interval [${lower}, ${upper}] ${unit}`);
  }
  return { lower, upper, unit };
}

export function intervalContainsBoundary(value: ClosedInterval, boundaries: readonly number[]): boolean {
  return boundaries.some((boundary) => value.lower <= boundary && boundary <= value.upper);
}

export interface FiniteSignedMeasure<K extends string> {
  readonly space: readonly K[];
  readonly atoms: Readonly<Record<K, number>>;
  readonly total: number;
  readonly totalVariation: number;
}

export function finiteSignedMeasure<K extends string>(space: readonly K[], atoms: Readonly<Record<K, number>>): FiniteSignedMeasure<K> {
  if (new Set(space).size !== space.length) throw new Error("Measure space atoms must be unique");
  const values = space.map((key) => atoms[key]);
  if (values.some((value) => !Number.isFinite(value))) throw new Error("Measure values must be finite");
  return {
    space: [...space],
    atoms: { ...atoms },
    total: values.reduce((sum, value) => sum + value, 0),
    totalVariation: values.reduce((sum, value) => sum + Math.abs(value), 0),
  };
}

export interface CertifiedFunctional<I, O> {
  readonly id: string;
  readonly version: string;
  readonly domain: string;
  readonly codomain: string;
  evaluate(input: I): ClosedResult<O>;
}
