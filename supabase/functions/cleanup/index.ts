// Cleanup (milestone M9). Run every few minutes by pg_cron (see the cleanup migration).
//   - Temporary uploads past their expiry (1 hour) are deleted from storage, and an unfinished AI draft that
//     belongs to them is deleted too.
//   - Extraction jobs stuck in "processing" for too long are marked failed so the person can retry.
// It only ever acts on data that is already expired or stuck, so it is safe to call at any time and takes no input.
// It is public (no login) because the scheduler calls it; it reveals nothing and changes nothing else.
import { createClient } from "npm:@supabase/supabase-js@2";

const BATCH = 200;
const STUCK_AFTER_MS = 6 * 60 * 1000;

Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();
  const summary = { expired_files: 0, drafts_deleted: 0, stuck_jobs: 0, errors: 0 };

  try {
    const { data: files } = await admin
      .from("memory_files")
      .select("id, bucket, storage_path, memory_id")
      .eq("retention", "temporary")
      .is("deleted_at", null)
      .lt("expires_at", now.toISOString())
      .limit(BATCH);

    for (const file of files ?? []) {
      const { error: removeError } = await admin.storage.from(file.bucket as string).remove([file.storage_path as string]);
      if (removeError) {
        summary.errors += 1; // leave the row so the next run tries again
        continue;
      }
      await admin.from("memory_files").update({ retention: "discarded", deleted_at: now.toISOString() }).eq("id", file.id);
      await admin
        .from("extraction_jobs")
        .update({ status: "failed", error_code: "file_expired", finished_at: now.toISOString() })
        .eq("file_id", file.id)
        .in("status", ["created", "uploaded", "processing"]);
      summary.expired_files += 1;

      if (file.memory_id) {
        const { data: deleted } = await admin.from("memories").delete().eq("id", file.memory_id).eq("status", "draft").select("id");
        summary.drafts_deleted += deleted?.length ?? 0;
      }
    }

    const { data: stuck } = await admin
      .from("extraction_jobs")
      .update({ status: "failed", error_code: "timeout", finished_at: now.toISOString() })
      .eq("status", "processing")
      .lt("started_at", new Date(now.getTime() - STUCK_AFTER_MS).toISOString())
      .select("id");
    summary.stuck_jobs = stuck?.length ?? 0;
  } catch (_e) {
    summary.errors += 1;
  }

  return new Response(JSON.stringify(summary), { headers: { "Content-Type": "application/json" } });
});
