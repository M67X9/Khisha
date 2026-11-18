// Health check for the app's status screen (milestone M0).
// Confirms two things: the Edge Function runs, and it can read the database with the service role.
// It returns no secrets and no error details.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let db = false;
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await supabase.from("app_health").select("id").limit(1);
    db = !error && Array.isArray(data) && data.length > 0;
  } catch (_e) {
    db = false;
  }

  return Response.json({ ok: true, db, time: new Date().toISOString() }, { headers: corsHeaders });
});
