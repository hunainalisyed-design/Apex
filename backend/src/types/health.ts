export interface HealthResponse {
  status: "ok" | "degraded";
  database: "connected" | "unreachable";
  uptimeSeconds: number;
}
