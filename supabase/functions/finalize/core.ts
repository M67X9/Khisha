// The rules for turning a draft memory into a saved one (milestone M6). Kept apart from the HTTP wrapper so it can be tested.
//
//   finalize  Person has checked the draft. Every important figure/date the reader found must be confirmed.
//             Saves their edits, marks the memory confirmed, then keeps the original file or deletes it.
//   discard   Throw the draft away (and its uploaded file).
//   preview   A short-lived link so the person can look at their file while reviewing.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Result = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown> = {}): Result => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, error: string, extra: Record<string, unknown> = {}): Result => ({ status, body: { error, ...extra } });

const CATEGORIES = ["receipt", "movie", "product", "place", "car", "document", "other"];
const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PREVIEW_SECONDS = 300;

type Admin = SupabaseClient;

function validDate(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !DATE.test(v)) return undefined; // undefined = invalid
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return undefined;
  const year = d.getUTCFullYear();
  return year >= 1990 && year <= 2100 ? v : undefined;
}

async function loadDraft(admin: Admin, userId: string, memoryId: string) {
  const { data } = await admin
    .from("memories")
    .select("id, status, structured_fields, deleted_at")
    .eq("id", memoryId)
    .eq("owner_id", userId)
    .maybeSingle();
  return data;
}

export async function finalize(admin: Admin, userId: string, body: Record<string, unknown>): Promise<Result> {
  const memoryId = typeof body.memory_id === "string" ? body.memory_id : "";
  if (!UUID.test(memoryId)) return fail(400, "invalid_request");

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 1 || title.length > 200) return fail(422, "invalid_title");
  const category = typeof body.category === "string" ? body.category : "";
  if (!CATEGORIES.includes(category)) return fail(422, "invalid_category");
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  if (notes && notes.length > 5000) return fail(422, "invalid_notes");
  const documentDate = validDate(body.document_date);
  const eventDate = validDate(body.event_date);
  if (documentDate === undefined || eventDate === undefined) return fail(422, "invalid_date");

  let amount: number | null = null;
  if (body.amount !== null && body.amount !== undefined && body.amount !== "") {
    if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 0 || body.amount > 1_000_000_000) return fail(422, "invalid_amount");
    amount = Math.round(body.amount * 1000) / 1000;
  }
  let currency: string | null = null;
  if (typeof body.currency === "string" && body.currency.trim()) {
    if (!/^[A-Za-z]{3}$/.test(body.currency.trim())) return fail(422, "invalid_currency");
    currency = body.currency.trim().toUpperCase();
  }
  const merchant = typeof body.merchant === "string" && body.merchant.trim() ? body.merchant.trim().slice(0, 120) : null;
  const confirmed = new Set(Array.isArray(body.confirmed) ? body.confirmed.filter((k): k is string => typeof k === "string") : []);
  const keepOriginal = body.keep_original === true;

  const memory = await loadDraft(admin, userId, memoryId);
  if (!memory || memory.deleted_at) return fail(404, "not_found");
  if (memory.status === "confirmed") return ok({ already: true }); // saved twice: nothing more to do

  // What each known evidence row should now say. null = the person cleared it.
  const final: Record<string, { value: string | null; critical: boolean }> = {
    total: { value: amount === null ? null : currency ? `${amount} ${currency}` : String(amount), critical: true },
    date: { value: documentDate, critical: true },
    event_date: { value: eventDate, critical: true },
    merchant: { value: merchant, critical: false },
  };

  const { data: rows, error: rowsError } = await admin
    .from("memory_evidence")
    .select("id, field_key, value, is_critical, confirmed_at")
    .eq("memory_id", memoryId)
    .eq("owner_id", userId);
  if (rowsError) return fail(500, "server_error");
  const evidence = rows ?? [];

  // Every important fact that is still there must have been confirmed by the person.
  const unconfirmed: string[] = [];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  const removals: string[] = [];
  const now = new Date().toISOString();
  const seen = new Set<string>();

  for (const row of evidence) {
    seen.add(row.field_key);
    const target = final[row.field_key];
    if (target && target.value === null) {
      removals.push(row.id); // cleared in the form: no longer a fact we hold
      continue;
    }
    const value = target ? target.value : row.value;
    if (row.is_critical && !confirmed.has(row.field_key)) {
      unconfirmed.push(row.field_key);
      continue;
    }
    const patch: Record<string, unknown> = {};
    if (target && value !== row.value) {
      patch.value = value;
      patch.source = "user_correction";
    }
    if (row.is_critical) patch.confirmed_at = now;
    if (Object.keys(patch).length) updates.push({ id: row.id, patch });
  }
  if (unconfirmed.length) return fail(422, "unconfirmed_critical", { fields: unconfirmed });

  // Values the person typed in that the reader had not found: confirmed by definition.
  const inserts = Object.entries(final)
    .filter(([key, t]) => t.value !== null && !seen.has(key))
    .map(([key, t]) => ({
      memory_id: memoryId,
      owner_id: userId,
      field_key: key,
      value: t.value,
      source: "user_correction",
      is_critical: t.critical,
      confidence: 1,
      confirmed_at: t.critical ? now : null,
    }));

  // Files first, so a failure here leaves the draft untouched and the person can try again.
  const fileResult = await settleFile(admin, userId, memoryId, keepOriginal);
  if (fileResult.error) return fail(500, "server_error");

  for (const id of removals) await admin.from("memory_evidence").delete().eq("id", id);
  for (const u of updates) await admin.from("memory_evidence").update(u.patch).eq("id", u.id);
  if (inserts.length) {
    const { error } = await admin.from("memory_evidence").insert(inserts);
    if (error) return fail(500, "server_error");
  }

  const hasConfirmedCritical = evidence.some((r) => r.is_critical && !removals.includes(r.id)) || inserts.some((i) => i.is_critical);
  const structured: Record<string, unknown> = { ...(memory.structured_fields as Record<string, unknown> | null) };
  for (const key of ["amount", "currency", "merchant"]) delete structured[key];
  if (amount !== null) structured.amount = amount;
  if (currency) structured.currency = currency;
  if (merchant) structured.merchant = merchant;

  const { error: saveError } = await admin
    .from("memories")
    .update({
      title,
      category,
      notes,
      document_date: documentDate,
      event_date: eventDate,
      structured_fields: structured,
      status: "confirmed",
      verification: hasConfirmedCritical ? "verified" : "unverified",
    })
    .eq("id", memoryId)
    .eq("owner_id", userId);
  if (saveError) return fail(500, "server_error");

  return ok({ kept_original: fileResult.kept });
}

/** Keep the original (move it out of the temporary bucket) or delete it. */
async function settleFile(admin: Admin, userId: string, memoryId: string, keep: boolean): Promise<{ kept: boolean; error?: true }> {
  const { data: files } = await admin
    .from("memory_files")
    .select("id, bucket, storage_path, retention, expires_at")
    .eq("memory_id", memoryId)
    .eq("owner_id", userId)
    .eq("retention", "temporary")
    .is("deleted_at", null);

  let kept = false;
  for (const file of files ?? []) {
    const expired = file.expires_at && new Date(file.expires_at as string).getTime() < Date.now();
    if (keep && !expired) {
      const { error } = await admin.storage.from("temp-uploads").move(file.storage_path as string, file.storage_path as string, { destinationBucket: "originals" });
      if (error) return { kept: false, error: true };
      await admin.from("memory_files").update({ bucket: "originals", retention: "retained", expires_at: null }).eq("id", file.id);
      kept = true;
    } else {
      await admin.storage.from("temp-uploads").remove([file.storage_path as string]);
      await admin.from("memory_files").update({ retention: "discarded", deleted_at: new Date().toISOString() }).eq("id", file.id);
    }
  }
  return { kept };
}

export async function discard(admin: Admin, userId: string, body: Record<string, unknown>): Promise<Result> {
  const memoryId = typeof body.memory_id === "string" ? body.memory_id : "";
  if (!UUID.test(memoryId)) return fail(400, "invalid_request");
  const memory = await loadDraft(admin, userId, memoryId);
  if (!memory) return ok({ already: true });
  if (memory.status !== "draft") return fail(409, "not_a_draft"); // saved memories are deleted from the memory screen

  const settled = await settleFile(admin, userId, memoryId, false);
  if (settled.error) return fail(500, "server_error");
  // Deleting the draft also removes its evidence and file rows.
  const { error } = await admin.from("memories").delete().eq("id", memoryId).eq("owner_id", userId).eq("status", "draft");
  if (error) return fail(500, "server_error");
  return ok();
}

export async function preview(admin: Admin, userId: string, body: Record<string, unknown>): Promise<Result> {
  const memoryId = typeof body.memory_id === "string" ? body.memory_id : "";
  if (!UUID.test(memoryId)) return fail(400, "invalid_request");
  const { data: file } = await admin
    .from("memory_files")
    .select("bucket, storage_path, mime_type, original_filename, expires_at, retention")
    .eq("memory_id", memoryId)
    .eq("owner_id", userId)
    .in("retention", ["temporary", "retained"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!file) return fail(404, "no_file");
  if (file.retention === "temporary" && file.expires_at && new Date(file.expires_at as string).getTime() < Date.now()) return fail(410, "expired");

  const { data: signed, error } = await admin.storage.from(file.bucket as string).createSignedUrl(file.storage_path as string, PREVIEW_SECONDS);
  if (error || !signed) return fail(500, "server_error");
  return ok({ url: signed.signedUrl, mime_type: file.mime_type, filename: file.original_filename, expires_at: file.expires_at, retained: file.retention === "retained" });
}
