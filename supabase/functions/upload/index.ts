// Upload gatekeeper (milestone M4).
//
//   POST { action: "prepare", filename, mime_type, size_bytes }
//        Checks the file type and size, creates the memory_files and extraction_jobs rows and returns a
//        short-lived signed upload URL token for the private `temp-uploads` bucket.
//   POST { action: "complete", file_id }
//        After the app has uploaded, checks the stored object (really there, real size, right type) and marks the
//        job `uploaded`. A file that breaks the limits is deleted.
//
// The limits below must match packages/shared/src/limits.ts and the bucket settings in the uploads migration.
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PDF_TYPE = "application/pdf";
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const TEMP_TTL_MS = 60 * 60 * 1000; // temporary uploads live for one hour
const MAX_PENDING_UPLOADS = 20; // unexpired temporary files one person can have at once
const BUCKET = "temp-uploads";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const maxBytesFor = (mime: string) => (mime === PDF_TYPE ? MAX_PDF_BYTES : MAX_IMAGE_BYTES);

type Admin = ReturnType<typeof createClient>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Who is calling? Use the caller's own token; never trust a user id sent in the body.
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

  const admin = createClient(url, serviceKey);
  try {
    if (body.action === "prepare") return await prepare(admin, userId, body);
    if (body.action === "complete") return await complete(admin, userId, body);
  } catch (_e) {
    return json({ error: "server_error" }, 500);
  }
  return json({ error: "invalid_request" }, 400);
});

async function prepare(admin: Admin, userId: string, body: Record<string, unknown>): Promise<Response> {
  const filename = typeof body.filename === "string" ? body.filename.trim().slice(0, 200) : "";
  const mime = typeof body.mime_type === "string" ? body.mime_type : "";
  const size = body.size_bytes;
  if (!filename || typeof size !== "number" || !Number.isInteger(size) || size <= 0) return json({ error: "invalid_request" }, 400);

  if (mime !== PDF_TYPE && !IMAGE_TYPES.includes(mime)) return json({ error: "unsupported_type" }, 422);
  if (size > maxBytesFor(mime)) return json({ error: "too_large", max_bytes: maxBytesFor(mime) }, 422);

  const { count } = await admin
    .from("memory_files")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("retention", "temporary")
    .is("deleted_at", null)
    .gt("expires_at", new Date().toISOString());
  if ((count ?? 0) >= MAX_PENDING_UPLOADS) return json({ error: "too_many_pending" }, 429);

  const fileId = crypto.randomUUID();
  const path = `${userId}/${fileId}.${EXTENSIONS[mime]}`;
  const expiresAt = new Date(Date.now() + TEMP_TTL_MS).toISOString();

  const { error: fileError } = await admin.from("memory_files").insert({
    id: fileId,
    owner_id: userId,
    bucket: BUCKET,
    storage_path: path,
    original_filename: filename,
    mime_type: mime,
    size_bytes: size,
    retention: "temporary",
    expires_at: expiresAt,
  });
  if (fileError) return json({ error: "server_error" }, 500);

  const { data: job, error: jobError } = await admin.from("extraction_jobs").insert({ owner_id: userId, file_id: fileId, status: "created" }).select("id").single();
  if (jobError || !job) {
    await admin.from("memory_files").delete().eq("id", fileId);
    return json({ error: "server_error" }, 500);
  }

  const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signError || !signed) {
    await admin.from("memory_files").delete().eq("id", fileId); // cascades to the job
    return json({ error: "server_error" }, 500);
  }

  return json({ file_id: fileId, job_id: job.id, path: signed.path, token: signed.token, expires_at: expiresAt });
}

async function complete(admin: Admin, userId: string, body: Record<string, unknown>): Promise<Response> {
  const fileId = typeof body.file_id === "string" ? body.file_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return json({ error: "invalid_request" }, 400);

  const { data: file } = await admin
    .from("memory_files")
    .select("id, storage_path, mime_type, expires_at, retention, deleted_at")
    .eq("id", fileId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!file || file.deleted_at || file.retention !== "temporary") return json({ error: "not_found" }, 404);
  if (new Date(file.expires_at as string).getTime() < Date.now()) return json({ error: "expired" }, 410);

  const name = String(file.storage_path).split("/").pop()!;
  const { data: objects } = await admin.storage.from(BUCKET).list(userId, { search: name, limit: 5 });
  const object = objects?.find((o) => o.name === name);
  if (!object) return json({ error: "not_uploaded" }, 409);

  const actualSize = Number((object.metadata as Record<string, unknown> | null)?.size ?? 0);
  const actualType = String((object.metadata as Record<string, unknown> | null)?.mimetype ?? "");
  const mime = String(file.mime_type);

  let problem: "too_large" | "type_mismatch" | "empty" | null = null;
  if (!actualSize) problem = "empty";
  else if (actualSize > maxBytesFor(mime)) problem = "too_large";
  else if (actualType && actualType !== mime) problem = "type_mismatch";

  if (problem) {
    await admin.storage.from(BUCKET).remove([String(file.storage_path)]);
    await admin.from("memory_files").update({ retention: "discarded", deleted_at: new Date().toISOString() }).eq("id", fileId);
    await admin.from("extraction_jobs").update({ status: "failed", error_code: problem }).eq("file_id", fileId);
    return json({ error: problem }, 422);
  }

  await admin.from("memory_files").update({ size_bytes: actualSize }).eq("id", fileId);
  const { data: job } = await admin
    .from("extraction_jobs")
    .update({ status: "uploaded" })
    .eq("file_id", fileId)
    .eq("status", "created")
    .select("id")
    .maybeSingle();

  return json({ status: "uploaded", file_id: fileId, job_id: job?.id ?? null, size_bytes: actualSize });
}
