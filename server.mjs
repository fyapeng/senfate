import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const python = process.env.SENFATE_PYTHON || "C:\\Users\\ENAN\\miniforge3\\envs\\codex\\python.exe";
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function reply(res, code, value, type = "application/json; charset=utf-8") { res.writeHead(code, { "content-type": type }); res.end(typeof value === "string" ? value : JSON.stringify(value)); }
function runEngine(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, [join(root, "apps", "engine", "service.py")], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (chunk) => out += chunk); child.stderr.on("data", (chunk) => err += chunk);
    child.on("error", reject);
    child.on("close", (code) => { if (code !== 0) reject(new Error(err || `分析服务退出：${code}`)); else { try { resolve(JSON.parse(out)); } catch { reject(new Error("分析服务返回格式无效")); } } });
    child.stdin.end(JSON.stringify(payload));
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "POST" && url.pathname === "/api/analyze") {
    let body = ""; for await (const chunk of req) body += chunk;
    try { reply(res, 200, await runEngine(JSON.parse(body))); } catch (error) { reply(res, 400, { error: error instanceof Error ? error.message : "分析失败" }); }
    return;
  }
  const requested = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, "");
  const file = join(root, "apps", "web", "public", requested);
  if (!file.startsWith(join(root, "apps", "web", "public"))) return reply(res, 403, "Forbidden", "text/plain");
  try { reply(res, 200, await readFile(file, "utf8"), types[extname(file)] ?? "application/octet-stream"); } catch { reply(res, 404, "Not found", "text/plain"); }
}).listen(process.env.PORT || 4321, () => console.log("SenFate 四派工作台：http://localhost:4321"));
