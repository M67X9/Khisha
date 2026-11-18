// Extraction (milestone M5).
//
//   POST { action: "start", job_id }
//        Checks the job belongs to the caller and the file is still there, marks the job `processing` and returns
//        straight away (HTTP 202). The AI reading then runs in the background; the app polls the job row.
//        On success the job becomes `succeeded` with a draft memory (status "draft") and evidence rows.
//        On failure it becomes `failed` with an error_code, and the person can simply start it again (free).
//
// Nothing here is verified: important figures and dates are saved as evidence that the person must confirm
// in the review screen (milestone M6). No credits are charged yet (credits arrive in M10).
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

import { AiError, readFile, type AiProfile } from "./ai.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

// These limits must match packages/shared/src/limits.ts.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 10;
const MAX_ATTEMPTS_PER_JOB = 5;
const DAILY_JOB_LIMIT = 40; // per person; protects the AI budget
const STALE_PROCESSING_MS = 4 * 60 * 1000;
const WORK_BUDGET_MS = 130_000; // the platform stops background work at about 150 s

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type Admin = ReturnType<typeof createClient>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  if (body.action !== "start") return json({ error: "invalid_request" }, 400);
  try {
    return await start(createClient(url, serviceKey), userId, body);
  } catch (_e) {
    return json({ error: "server_error" }, 500);
  }
});

async function failJob(admin: Admin, jobId: string, code: string) {
  await admin.from("extraction_jobs").update({ status: "failed", error_code: code, finished_at: new Date().toISOString() }).eq("id", jobId);
}

async function start(admin: Admin, userId: string, body: Record<string, unknown>): Promise<Response> {
  const jobId = typeof body.job_id === "string" ? body.job_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: "invalid_request" }, 400);

  const { data: job } = await admin
    .from("extraction_jobs")
    .select("id, file_id, status, attempt, memory_id, started_at")
    .eq("id", jobId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!job) return json({ error: "not_found" }, 404);

  if (job.status === "succeeded" && job.memory_id) return json({ status: "succeeded", memory_id: job.memory_id });
  const startedAgo = job.started_at ? Date.now() - new Date(job.started_at as string).getTime() : Number.POSITIVE_INFINITY;
  if (job.status === "processing" && startedAgo < STALE_PROCESSING_MS) return json({ status: "processing" }, 202);
  if (!["uploaded", "failed", "processing"].includes(job.status as string)) return json({ error: "not_ready" }, 409);
  if ((job.attempt as number) >= MAX_ATTEMPTS_PER_JOB) return json({ error: "too_many_attempts" }, 429);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("extraction_jobs").select("id", { count: "exact", head: true }).eq("owner_id", userId).gte("started_at", since);
  if ((count ?? 0) >= DAILY_JOB_LIMIT) return json({ error: "daily_limit" }, 429);

  const { data: file } = await admin
    .from("memory_files")
    .select("id, bucket, storage_path, original_filename, mime_type, expires_at, retention, deleted_at")
    .eq("id", job.file_id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!file || file.deleted_at || file.retention !== "temporary") {
    await failJob(admin, jobId, "file_missing");
    return json({ error: "file_missing" }, 410);
  }
  if (new Date(file.expires_at as string).getTime() < Date.now()) {
    await failJob(admin, jobId, "file_expired");
    return json({ error: "file_expired" }, 410);
  }

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    await failJob(admin, jobId, "ai_not_configured");
    return json({ error: "ai_not_configured" }, 503);
  }
  const profile: AiProfile = Deno.env.get("AI_PROFILE") === "premium" ? "premium" : "free";

  // Claim the job, then do the slow work in the background.
  await admin
    .from("extraction_jobs")
    .update({ status: "processing", attempt: (job.attempt as number) + 1, error_code: null, started_at: new Date().toISOString(), finished_at: null })
    .eq("id", jobId);

  EdgeRuntime.waitUntil(run(admin, userId, jobId, file as FileRow, apiKey, profile));
  return json({ status: "processing" }, 202);
}

type FileRow = { id: string; bucket: string; storage_path: string; original_filename: string | null; mime_type: string };

async function run(admin: Admin, userId: string, jobId: string, file: FileRow, apiKey: string, profile: AiProfile) {
  let memoryId: string | null = null;
  try {
    const { data: blob, error: downloadError } = await admin.storage.from(file.bucket).download(file.storage_path);
    if (downloadError || !blob) throw new AiError("file_missing");
    const bytes = new Uint8Array(await blob.arrayBuffer());

    // Re-check the limits on the real bytes (the app's checks are only a convenience).
    const isPdf = file.mime_type === "application/pdf";
    if (bytes.byteLength === 0 || bytes.byteLength > (isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES)) throw new AiError("too_large");
    if (isPdf) {
      let pages = 0;
      try {
        pages = (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount();
      } catch (e) {
        throw new AiError(/encrypt|password/i.test(String(e)) ? "pdf_encrypted" : "pdf_unreadable");
      }
      if (pages > MAX_PDF_PAGES) throw new AiError("pdf_too_many_pages", String(pages));
    }

    const result = await readFile({ bytes, mime: file.mime_type, filename: file.original_filename ?? "", apiKey, profile, deadline: Date.now() + WORK_BUDGET_MS });

    const { data: memory, error: memoryError } = await admin
      .from("memories")
      .insert({
        owner_id: userId,
        title: result.title,
        category: result.category,
        category_confidence: result.category_confidence,
        extracted_text: result.extracted_text || null,
        structured_fields: result.structured_fields,
        notes: result.notes,
        status: "draft",
        verification: "unverified",
        source_type: isPdf ? "pdf" : "image",
        document_date: result.document_date,
        event_date: result.event_date,
      })
      .select("id")
      .single();
    if (memoryError || !memory) throw new AiError("save_failed");
    memoryId = memory.id as string;

    if (result.evidence.length > 0) {
      const { error: evidenceError } = await admin
        .from("memory_evidence")
        .insert(result.evidence.map((e) => ({ memory_id: memoryId, owner_id: userId, field_key: e.field_key, value: e.value, source: "file", is_critical: e.is_critical, confidence: e.confidence })));
      if (evidenceError) throw new AiError("save_failed");
    }

    await admin.from("memory_files").update({ memory_id: memoryId }).eq("id", file.id);
    await admin.from("extraction_jobs").update({ status: "succeeded", memory_id: memoryId, error_code: null, finished_at: new Date().toISOString() }).eq("id", jobId);
  } catch (e) {
    if (memoryId) await admin.from("memories").delete().eq("id", memoryId); // do not leave a half-saved draft
    const code = e instanceof AiError ? e.code : "internal";
    // Log only the code and a short technical hint, never any document content.
    console.error("extract failed", { code, hint: e instanceof AiError ? e.message.slice(0, 80) : "unexpected" });
    await failJob(admin, jobId, code);
  }
}
