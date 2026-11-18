// Review-before-saving gatekeeper (milestone M6). See core.ts for the rules.
//
//   POST { action: "finalize", memory_id, title, category, notes, document_date, event_date, amount, currency, merchant, confirmed: [field_key], keep_original }
//   POST { action: "discard", memory_id }
//   POST { action: "preview", memory_id }
import { createClient } from "npm:@supabase/supabase-js@2";

import { discard, finalize, preview, type Result } from "./core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    let result: Result | null = null;
    if (body.action === "finalize") result = await finalize(admin, userId, body);
    else if (body.action === "discard") result = await discard(admin, userId, body);
    else if (body.action === "preview") result = await preview(admin, userId, body);
    if (result) return json(result.body, result.status);
  } catch (_e) {
    return json({ error: "server_error" }, 500);
  }
  return json({ error: "invalid_request" }, 400);
});
