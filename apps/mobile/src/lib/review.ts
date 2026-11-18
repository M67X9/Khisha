import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

import type { MessageKey } from "../i18n";
import { supabase } from "./supabase";

export class ReviewFailure extends Error {
  constructor(public key: MessageKey, public code: string) {
    super(code);
  }
}

async function call<T>(body: Record<string, unknown>, fallback: MessageKey): Promise<T> {
  const { data, error } = await supabase.functions.invoke("finalize", { body });
  if (!error) return data as T;
  let code = "server_error";
  if (error instanceof FunctionsFetchError) code = "network";
  else if (error instanceof FunctionsHttpError) {
    try {
      code = ((await error.context.json()) as { error?: string }).error ?? "server_error";
    } catch {
      code = "server_error";
    }
  }
  const key: MessageKey = code === "not_found" ? "review.err.gone" : code === "unconfirmed_critical" ? "review.err.unconfirmed" : code.startsWith("invalid_") ? "review.err.invalid" : code === "network" ? "memory.err.save" : fallback;
  throw new ReviewFailure(key, code);
}

export type FinalizeInput = {
  memory_id: string;
  title: string;
  category: string;
  notes: string;
  document_date: string | null;
  event_date: string | null;
  amount: number | null;
  currency: string | null;
  merchant: string;
  confirmed: string[];
  keep_original: boolean;
};

export async function finalizeMemory(input: FinalizeInput): Promise<{ keptOriginal: boolean }> {
  const data = await call<{ kept_original?: boolean }>({ action: "finalize", ...input }, "review.err.save");
  return { keptOriginal: data.kept_original === true };
}

export async function discardDraft(memoryId: string): Promise<void> {
  await call({ action: "discard", memory_id: memoryId }, "review.err.discard");
}

export type Preview = { url: string; mimeType: string; expiresAt: string | null };

/** A short-lived link to the uploaded file, or null when there is no file or it has expired. */
export async function getPreview(memoryId: string): Promise<Preview | null> {
  try {
    const data = await call<{ url: string; mime_type: string; expires_at: string | null }>({ action: "preview", memory_id: memoryId }, "review.previewFailed");
    return { url: data.url, mimeType: data.mime_type, expiresAt: data.expires_at };
  } catch {
    return null;
  }
}
