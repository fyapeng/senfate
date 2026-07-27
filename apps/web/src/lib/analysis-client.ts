type Response = { id: string; ok: boolean; result?: unknown; error?: string };
let worker: Worker | undefined;
let counter = 0;
const pending = new Map<string, { resolve(value: unknown): void; reject(reason: Error): void }>();
function getWorker() {
  worker ??= new Worker(new URL("../workers/analysis.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }: MessageEvent<Response>) => { const job = pending.get(data.id); if (!job) return; pending.delete(data.id); data.ok ? job.resolve(data.result) : job.reject(new Error(data.error || "本地规则分析失败。")); };
  worker.onerror = () => { for (const job of pending.values()) job.reject(new Error("本地规则分析线程异常退出。")); pending.clear(); worker?.terminate(); worker = undefined; };
  return worker;
}
export function analyzeChartInBrowser(compiled: any, sex: "female" | "male", targetYear: number) {
  const id = `analysis.${Date.now()}.${++counter}`;
  return new Promise<any>((resolve, reject) => { pending.set(id, { resolve, reject }); getWorker().postMessage({ id, type: "analyze", compiled, sex, targetYear, ruleDataUrl: `${import.meta.env.BASE_URL}data/ruleir.v1.json` }); });
}
