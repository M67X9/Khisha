import { isHealthResponse } from "@khisha/shared";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type HealthState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "error"; code: "http" | "unexpected" | "timeout" | "network"; httpStatus?: number }
  | { status: "ok"; db: boolean; time: string };

/** Calls the `health` Edge Function and reports whether the function and the database both answer. */
export async function checkHealth(): Promise<HealthState> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes("YOUR-PROJECT-REF")) {
    return { status: "unconfigured" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: controller.signal,
    });
    if (!res.ok) return { status: "error", code: "http", httpStatus: res.status };
    const body: unknown = await res.json();
    if (!isHealthResponse(body)) return { status: "error", code: "unexpected" };
    return { status: "ok", db: body.db, time: body.time };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { status: "error", code: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
