export const API_PREFIX = "/senfate/api/v1" as const;
export const API_HEALTH_SCHEMA = "senfate-api-health.v1" as const;
export const API_META_SCHEMA = "senfate-api-meta.v1" as const;

export interface ApiHealthResponse {
  readonly schemaVersion: typeof API_HEALTH_SCHEMA;
  readonly status: "ok";
  readonly service: "senfate-api";
  readonly requestId: string;
}

export interface ApiMetaResponse {
  readonly schemaVersion: typeof API_META_SCHEMA;
  readonly requestId: string;
  readonly product: "SenFate";
  readonly architecture: "formal-bazi-pipeline";
  readonly corpus: Readonly<{
    version: "4.0";
    records: 37_231;
    families: 11_306;
    books: 7;
  }>;
  readonly calculationStatus: "kernel-rebuild";
}

export interface ApiErrorResponse {
  readonly schemaVersion: "senfate-api-error.v1";
  readonly requestId: string;
  readonly error: Readonly<{ code: string; message: string }>;
}
