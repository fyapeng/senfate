import type { APIRoute } from "astro";
import { publicRule, rules } from "../../lib/rules";

export const GET: APIRoute = async () => {
  const records = await rules();
  return new Response(JSON.stringify({
    schema: "senfate-public-rules.v1",
    total: records.length,
    rules: records.map(publicRule),
  }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
};
