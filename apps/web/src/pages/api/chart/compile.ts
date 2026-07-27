import type { APIRoute } from "astro";
import { TRANSPARENT_BASELINE_MODEL } from "@senfate/core";
import { compileCertifiedBaziCalendar } from "@senfate/ephemeris";

const sexValues = new Set(["female", "male"]);

function error(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let input: Record<string, unknown>;
  try {
    input = await request.json() as Record<string, unknown>;
  } catch {
    return error("请求必须是 JSON。", 415);
  }

  const requiredNumbers = ["year", "month", "day", "hour", "minute", "longitudeDegrees", "latitudeDegrees"];
  if (requiredNumbers.some((field) => typeof input[field] !== "number" || !Number.isFinite(input[field]))) {
    return error("请提供完整的出生日期、时间与经纬度。",
    );
  }
  if (typeof input.timeZone !== "string" || !input.timeZone) return error("请提供 IANA 时区，例如 Asia/Shanghai。");
  if (!sexValues.has(String(input.sex))) return error("sex 仅可为 female 或 male；这是传统大运顺逆行所需参数。");

  const result = compileCertifiedBaziCalendar(
    {
      year: input.year as number,
      month: input.month as number,
      day: input.day as number,
      hour: input.hour as number,
      minute: input.minute as number,
      second: typeof input.second === "number" ? input.second : undefined,
      timeZone: input.timeZone,
      longitudeDegrees: input.longitudeDegrees as number,
      latitudeDegrees: input.latitudeDegrees as number,
      disambiguation: input.disambiguation === "earlier" || input.disambiguation === "later" || input.disambiguation === "reject" ? input.disambiguation : undefined,
      clockUncertaintySeconds: typeof input.clockUncertaintySeconds === "number" ? input.clockUncertaintySeconds : undefined,
      coordinateUncertaintyMeters: typeof input.coordinateUncertaintyMeters === "number" ? input.coordinateUncertaintyMeters : undefined,
    },
    TRANSPARENT_BASELINE_MODEL,
    input.sex as "female" | "male",
  );

  if (!result.ok) return error(result.reason, 422);
  return new Response(JSON.stringify({
    schema: "senfate-chart-compile.v1",
    calculationProfile: {
      id: "transparent-calendar.v1",
      apparentSolarTime: true,
      dayBoundary: "zi-initial",
      luckConversion: "3 days = 1 year",
    },
    result: result.value,
    certificate: result.certificate,
  }), { headers: { "content-type": "application/json; charset=utf-8" } });
};
