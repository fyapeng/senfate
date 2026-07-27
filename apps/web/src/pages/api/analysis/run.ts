import type { APIRoute } from "astro";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const root = process.env.SENFATE_ROOT ?? (existsSync(resolve(process.cwd(), "apps/engine/service.py")) ? process.cwd() : resolve(process.cwd(), "../.."));
const engine = resolve(root, "apps/engine/service.py");
const python = process.env.SENFATE_PYTHON ?? "C:\\Users\\ENAN\\miniforge3\\envs\\codex\\python.exe";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function invokeEngine(payload: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(python, [engine], {
      cwd: root,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || stdout || `engine exited with ${code}`));
      try { resolve(JSON.parse(stdout) as unknown); }
      catch { reject(new Error("规则引擎返回了无效 JSON。")); }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

export const POST: APIRoute = async ({ request }) => {
  let payload: Record<string, unknown>;
  try { payload = await request.json() as Record<string, unknown>; }
  catch { return response({ error: "请求必须是 JSON。" }, 415); }

  try {
    return response(await invokeEngine(payload));
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "未知引擎错误";
    return response({ error: "四派规则引擎未能完成分析。", detail }, 422);
  }
};
