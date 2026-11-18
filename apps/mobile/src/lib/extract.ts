import { MAX_PDF_PAGES } from "@khisha/shared";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

import type { MessageKey } from "../i18n";
import { supabase } from "./supabase";

export type ExtractIssue = { key: MessageKey; params?: Record<string, string | number> };

export class ExtractFailure extends Error {
  constructor(public issue: ExtractIssue) {
    super(issue.key);
  }
}

/** Maps a server error code (from the function or from the job row) to a message the person can act on. */
export function issueForCode(code: string | null | undefined): ExtractIssue {
  switch (code) {
    case "unreadable":
      return { key: "extract.err.unreadable" };
    case "invalid_output":
      return { key: "extract.err.invalid" };
    case "timeout":
      return { key: "extract.err.timeout" };
    case "provider_error":
    case "provider_busy":
    case "network":
      return { key: code === "network" ? "extract.err.network" : "extract.err.provider" };
    case "ai_not_configured":
      return { key: "extract.err.notConfigured" };
    case "pdf_no_text":
      return { key: "extract.err.pdfNoText" };
    case "pdf_too_many_pages":
      return { key: "extract.err.pdfPages", params: { limit: MAX_PDF_PAGES } };
    case "pdf_encrypted":
      return { key: "extract.err.pdfEncrypted" };
    case "pdf_unreadable":
      return { key: "extract.err.pdfUnreadable" };
    case "file_expired":
    case "file_missing":
      return { key: "extract.err.expired" };
    case "daily_limit":
      return { key: "extract.err.dailyLimit" };
    case "too_many_attempts":
      return { key: "extract.err.tooMany" };
    default:
      return { key: "extract.err.generic" };
  }
}

/** Asks the server to start reading the uploaded file. Returns as soon as the job is running (or already finished). */
export async function startExtraction(jobId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("extract", { body: { action: "start", job_id: jobId } });
  if (!error) return;
  let code = "server_error";
  if (error instanceof FunctionsFetchError) code = "network";
  else if (error instanceof FunctionsHttpError) {
    try {
      code = ((await error.context.json()) as { error?: string }).error ?? "server_error";
    } catch {
      code = "server_error";
    }
  }
  throw new ExtractFailure(issueForCode(code));
}

const POLL_MS = 2000;
const TIMEOUT_MS = 160_000;

/** Waits until the job finishes. Resolves with the draft memory id, or throws an ExtractFailure. */
export async function waitForExtraction(jobId: string, control: { cancelled: boolean }): Promise<{ memoryId: string }> {
  const startedAt = Date.now();
  let networkErrors = 0;
  while (!control.cancelled) {
    const { data, error } = await supabase.from("extraction_jobs").select("status,memory_id,error_code").eq("id", jobId).maybeSingle();
    if (error || !data) {
      networkErrors += 1;
      if (networkErrors >= 4) throw new ExtractFailure({ key: "extract.err.network" });
    } else {
      networkErrors = 0;
      if (data.status === "succeeded" && data.memory_id) return { memoryId: data.memory_id as string };
      if (data.status === "failed") throw new ExtractFailure(issueForCode(data.error_code as string | null));
    }
    if (Date.now() - startedAt > TIMEOUT_MS) throw new ExtractFailure({ key: "extract.err.timeout" });
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new ExtractFailure({ key: "extract.err.generic" }); // cancelled: the caller ignores this
}
