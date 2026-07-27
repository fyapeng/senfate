type CompileInput = {
  year: number; month: number; day: number; hour: number; minute: number;
  timeZone: string; longitudeDegrees: number; latitudeDegrees: number;
  sex: "female" | "male";
};

export async function compileChartInBrowser(input: CompileInput): Promise<{ result: any; certificate: any }> {
  // The certified ephemeris package contains a legacy timezone bundle that is not
  // worker-safe in every browser. It therefore runs locally in this page; the
  // heavier 80-year RuleIR analysis remains on a dedicated Worker.
  const compiled = compileCertifiedBaziCalendar(input, TRANSPARENT_BASELINE_MODEL, input.sex, 8);
  if (!compiled.ok) throw new Error(compiled.reason);
  return { result: compiled.value, certificate: compiled.certificate };
}
import { TRANSPARENT_BASELINE_MODEL } from "@senfate/core";
import { compileCertifiedBaziCalendar } from "@senfate/ephemeris";
