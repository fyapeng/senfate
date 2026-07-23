/// <reference lib="webworker" />

import type { ApiAnalysisRequest, ApiAnalysisResponse } from "@senfate/contracts";
import { calculateBrowserAnnualDetail, calculateBrowserTrajectoryYear } from "./browser-analysis-engine";
import { loadBrowserReferenceProgram } from "./browser-reference-program";

type WorkerRequest =
  | Readonly<{ id: number; kind: "trajectory"; request: ApiAnalysisRequest; base: ApiAnalysisResponse; years: readonly number[] }>
  | Readonly<{ id: number; kind: "annual"; request: ApiAnalysisRequest; base: ApiAnalysisResponse; year: number }>;

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void (async () => {
    const message = event.data;
    try {
      const records = await loadBrowserReferenceProgram();
      const context = { request: message.request, base: message.base, records };
      if (message.kind === "trajectory") {
        for (const year of message.years) {
          const point = calculateBrowserTrajectoryYear(context, year);
          self.postMessage({ id: message.id, kind: "trajectory-point", point });
        }
        self.postMessage({ id: message.id, kind: "complete" });
        return;
      }
      const detail = calculateBrowserAnnualDetail(context, message.year);
      self.postMessage({ id: message.id, kind: "annual-result", detail });
    } catch (cause) {
      self.postMessage({ id: message.id, kind: "error", error: cause instanceof Error ? cause.message : String(cause) });
    }
  })();
});
