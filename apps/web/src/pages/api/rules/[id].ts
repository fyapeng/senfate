import type { APIRoute } from "astro";
import { rules } from "../../../lib/rules";

export async function getStaticPaths() {
  return (await rules()).map((rule) => ({ params: { id: rule.rule_id } }));
}

export const GET: APIRoute = async ({ params }) => {
  const id = params.id ? decodeURIComponent(params.id) : "";
  const rule = (await rules()).find((item) => item.rule_id === id);
  if (!rule) return new Response(JSON.stringify({ error: "未找到该规则。" }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
  return new Response(JSON.stringify({ schema: "senfate-public-rule-detail.v1", rule }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
};
