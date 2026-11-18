/** Response of the `health` Edge Function. */
export type HealthResponse = {
  ok: boolean;
  /** true when the function could read the database */
  db: boolean;
  /** ISO timestamp from the server */
  time: string;
};

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.ok === "boolean" && typeof v.db === "boolean" && typeof v.time === "string";
}
