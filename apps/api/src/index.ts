import {
  API_HEALTH_SCHEMA,
  API_META_SCHEMA,
  API_PREFIX,
  type ApiErrorResponse,
  type ApiHealthResponse,
  type ApiMetaResponse,
} from "@senfate/contracts";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: JSON_HEADERS });
}

function error(requestId: string, status: number, code: string, message: string): Response {
  const body: ApiErrorResponse = {
    schemaVersion: "senfate-api-error.v1",
    requestId,
    error: { code, message },
  };
  return json(body, status);
}

export function handleRequest(request: Request): Response {
  const requestId = crypto.randomUUID();
  const { pathname } = new URL(request.url);
  if (request.method !== "GET") {
    return error(requestId, 405, "method-not-allowed", "Only GET is available during kernel reconstruction");
  }
  if (pathname === `${API_PREFIX}/health` || pathname === "/health") {
    const body: ApiHealthResponse = {
      schemaVersion: API_HEALTH_SCHEMA,
      status: "ok",
      service: "senfate-api",
      requestId,
    };
    return json(body);
  }
  if (pathname === `${API_PREFIX}/meta` || pathname === "/meta") {
    const body: ApiMetaResponse = {
      schemaVersion: API_META_SCHEMA,
      requestId,
      product: "SenFate",
      architecture: "formal-bazi-pipeline",
      corpus: { version: "4.0", records: 37_231, families: 11_306, books: 7 },
      calculationStatus: "kernel-rebuild",
    };
    return json(body);
  }
  return error(requestId, 404, "not-found", "API route not found");
}

export default {
  fetch(request): Response {
    return handleRequest(request);
  },
} satisfies ExportedHandler<Env>;
