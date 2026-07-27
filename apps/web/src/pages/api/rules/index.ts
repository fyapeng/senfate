import type { APIRoute } from "astro";
import { publicRule, rules } from "../../../lib/rules";

export const GET: APIRoute = async ({ url }) => {
  const school = url.searchParams.get("school");
  const query = url.searchParams.get("q")?.trim().toLowerCase();
  const records = (await rules()).filter((rule) =>
    (!school || rule.school_id === school)
    && (!query || `${rule.title} ${rule.description} ${rule.rule_id}`.toLowerCase().includes(query)),
  );
  return new Response(JSON.stringify({
    schema: "senfate-public-rules.v1",
    total: records.length,
    rules: records.map(publicRule),
  }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
};
