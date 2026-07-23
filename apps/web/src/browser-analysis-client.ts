import type { ApiAnalysisRequest, ApiAnalysisResponse, ApiAnnualTrajectory } from "@senfate/contracts";

type AnnualDetail = Readonly<{
  annual: ApiAnalysisResponse["annual"];
  point: ApiAnnualTrajectory["points"][number];
  certificate: Readonly<Record<string, unknown>>;
}>;
type WorkerResponse =
  | Readonly<{ id: number; kind: "trajectory-point"; point: ApiAnnualTrajectory["points"][number] }>
  | Readonly<{ id: number; kind: "annual-result"; detail: AnnualDetail }>
  | Readonly<{ id: number; kind: "complete" }>
  | Readonly<{ id: number; kind: "error"; error: string }>;

let nextId = 1;

function createWorker(): Worker {
  return new Worker(new URL("./browser-analysis.worker.ts", import.meta.url), { name: "senfate-analysis" });
}

export async function calculateTrajectoryInBrowser(
  base: ApiAnalysisResponse,
  request: ApiAnalysisRequest,
  years: readonly number[],
  onPoint: (point: ApiAnnualTrajectory["points"][number]) => void,
  signal?: AbortSignal,
): Promise<void> {
  const worker = createWorker();
  const id = nextId++;
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { signal?.removeEventListener("abort", abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(signal?.reason ?? new DOMException("Aborted", "AbortError")); };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.id !== id) return;
      if (message.kind === "trajectory-point") { onPoint(message.point); return; }
      cleanup();
      if (message.kind === "complete") resolve();
      else reject(new Error(message.kind === "error" ? message.error : "unexpected-worker-response"));
    });
    worker.addEventListener("error", (event) => { cleanup(); reject(new Error(event.message || "analysis-worker-failed")); }, { once: true });
    worker.postMessage({ id, kind: "trajectory", base, request, years });
  });
}

export async function calculateAnnualDetailInBrowser(
  base: ApiAnalysisResponse,
  request: ApiAnalysisRequest,
  year: number,
  signal?: AbortSignal,
): Promise<AnnualDetail> {
  const worker = createWorker();
  const id = nextId++;
  return new Promise<AnnualDetail>((resolve, reject) => {
    const cleanup = () => { signal?.removeEventListener("abort", abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(signal?.reason ?? new DOMException("Aborted", "AbortError")); };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.id !== id) return;
      if (message.kind === "trajectory-point" || message.kind === "complete") return;
      cleanup();
      if (message.kind === "annual-result") resolve(message.detail);
      else reject(new Error(message.error));
    });
    worker.addEventListener("error", (event) => { cleanup(); reject(new Error(event.message || "analysis-worker-failed")); }, { once: true });
    worker.postMessage({ id, kind: "annual", base, request, year });
  });
}
