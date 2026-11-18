import type { MemorySummary } from "@khisha/shared";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

import type { MessageKey } from "../i18n";
import { supabase } from "./supabase";

export type AnswerKind = "personal" | "general" | "mixed" | "none";
export type Answer = { conversationId: string; content: string; kind: AnswerKind; sources: MemorySummary[] };

export class AskFailure extends Error {
  constructor(public key: MessageKey) {
    super(key);
  }
}

function keyForCode(code: string): MessageKey {
  switch (code) {
    case "network":
      return "ask.err.network";
    case "daily_limit":
      return "ask.err.dailyLimit";
    case "timeout":
      return "ask.err.timeout";
    case "ai_not_configured":
      return "extract.err.notConfigured";
    case "provider_busy":
    case "provider_error":
    case "invalid_output":
    case "empty":
      return "ask.err.provider";
    default:
      return "ask.err.generic";
  }
}

/** Asks a question about the person's own saved memories. Sources come back as memory summaries the app can open. */
export async function askQuestion(question: string, conversationId: string | null): Promise<Answer> {
  const { data, error } = await supabase.functions.invoke("ask", { body: { question, conversation_id: conversationId } });
  if (error) {
    let code = "server_error";
    if (error instanceof FunctionsFetchError) code = "network";
    else if (error instanceof FunctionsHttpError) {
      try {
        code = ((await error.context.json()) as { error?: string }).error ?? "server_error";
      } catch {
        code = "server_error";
      }
    }
    throw new AskFailure(keyForCode(code));
  }
  const reply = data as { conversation_id: string; message: { content: string; answer_kind: AnswerKind }; sources: { memory_id: string; rank: number }[] };
  const ids = reply.sources.map((s) => s.memory_id);
  let sources: MemorySummary[] = [];
  if (ids.length) {
    const { data: rows } = await supabase.from("memories").select("id,title,category,structured_fields,document_date,created_at,verification").in("id", ids).is("deleted_at", null);
    sources = ids.map((id) => (rows ?? []).find((r) => r.id === id)).filter(Boolean) as MemorySummary[];
  }
  return { conversationId: reply.conversation_id, content: reply.message.content, kind: reply.message.answer_kind, sources };
}
