import tableJson from "../data/solar-terms.jpl-de441.v1.json";
import manifestJson from "../data/manifest.json";

export type SolarTermKind = "jie" | "qi";
export interface SolarTermEntry {
  readonly utcMs: number;
  readonly longitude: number;
  readonly name: string;
  readonly kind: SolarTermKind;
  readonly uncertaintySeconds: number;
}
export interface EphemerisManifest {
  readonly schema: "senfate-ephemeris-manifest.v1";
  readonly sha256: string;
  readonly terms: number;
  readonly startYear: number;
  readonly endYear: number;
  readonly sourceEphemeris: string;
  readonly generatedAt: string;
}

type RawEntry = readonly [number, number, string, SolarTermKind, number];
const raw = tableJson.entries as unknown as readonly RawEntry[];
export const SOLAR_TERM_ENTRIES: readonly SolarTermEntry[] = raw.map(
  ([utcMs, longitude, name, kind, uncertaintySeconds]) => ({ utcMs, longitude, name, kind, uncertaintySeconds }),
);
export const EPHEMERIS_MANIFEST = manifestJson as EphemerisManifest;
