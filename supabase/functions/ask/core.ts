// Ask AI with sources (milestone M8).
// 1. Find the few saved memories that might answer the question (database, the person's own only).
// 2. Give just those to the model with strict rules: personal facts only from them, anything else labelled general knowledge.
// 3. Save the chat turn and which memories were used, so the app can show clickable sources.
// Credits are not charged yet (ledger arrives in M10). A failed or empty answer saves nothing.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { AiError, chatJson, type AiProfile, type ChatMessage } from "./ai.ts";

export type Result = { status: number; body: Record<string, unknown> };
const fail = (status: number, error: string): Result => ({ status, body: { error } });

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_QUESTION = 500;
const DAILY_LIMIT = 60;
const TOP_K = 6;
const MIN_CONTEXT = 4; // when few memories match, add the newest ones so "this month"-style questions still work
const HISTORY_TURNS = 6;

const SYSTEM_PROMPT = `You are the assistant inside Khisha, a personal memory app. The person saved receipts, documents and notes. You will get their question and a short list of their saved memories (JSON, may be empty).

Rules:
- Answer facts about the person's own life ONLY from the memories given. Never invent amounts, dates, names or places.
- If the memories do not contain the answer, say so plainly and briefly. Do not guess.
- You may add general knowledge only if it clearly helps, and say it is general knowledge, not from their memories.
- Reply in the language of the question (Arabic or English). Use Western digits (0-9) in both languages. Keep it short and direct: one to four sentences.
- Amounts: give the number with its currency. If a memory's "verified" is false, the figures were not confirmed against the file yet: add "(not verified)" in English answers or "(غير موثّق)" in Arabic answers next to that figure, only when you state it.
- List in "source_ids" only the ids of memories you actually used for the answer. If none, use an empty list.
- "answer_kind": "personal" if the answer comes only from their memories, "general" if only from general knowledge, "mixed" if both, "none" if you could not answer.

Reply with ONE JSON object and nothing else: {"answer": string, "answer_kind": "personal"|"general"|"mixed"|"none", "source_ids": [string]}`;

type Admin = SupabaseClient;

type MemoryRow = {
  id: string;
  title: string;
  category: string;
  document_date: string | null;
  event_date: string | null;
  structured_fields: Record<string, unknown> | null;
  notes: string | null;
  extracted_text: string | null;
  verification: string;
  created_at: string;
};

export async function ask(userClient: SupabaseClient, admin: Admin, userId: string, body: Record<string, unknown>, apiKey: string | undefined, profile: AiProfile): Promise<Result> {
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > MAX_QUESTION) return fail(422, "invalid_question");
  const conversationIdIn = typeof body.conversation_id === "string" ? body.conversation_id : null;
  if (conversationIdIn !== null && !UUID.test(conversationIdIn)) return fail(400, "invalid_request");
  if (!apiKey) return fail(503, "ai_not_configured");

  // Daily limit (a simple guard until credits exist).
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("role", "user").gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) return fail(429, "daily_limit");

  // An existing conversation must be this person's.
  let history: ChatMessage[] = [];
  let previousQuestion = "";
  if (conversationIdIn) {
    const { data: convo } = await admin.from("conversations").select("id").eq("id", conversationIdIn).eq("owner_id", userId).maybeSingle();
    if (!convo) return fail(404, "not_found");
    const { data: prior } = await admin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationIdIn)
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS);
    history = (prior ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 1500) }));
    previousQuestion = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  }

  // 1. Retrieve. A short follow-up ("and the date?") is searched together with the previous question.
  const retrievalText = question.split(/\s+/).length < 6 && previousQuestion ? `${previousQuestion} ${question}` : question;
  const { data: hits, error: hitsError } = await userClient.rpc("retrieve_memories", { q: retrievalText, p_limit: TOP_K });
  if (hitsError) return fail(500, "server_error");
  const ids: string[] = ((hits ?? []) as { id: string; score: number }[]).filter((h) => h.score > 0).map((h) => h.id);
  if (ids.length < MIN_CONTEXT) {
    const { data: recent } = await userClient.from("memories").select("id").eq("status", "confirmed").is("deleted_at", null).order("created_at", { ascending: false }).limit(MIN_CONTEXT);
    for (const r of recent ?? []) if (!ids.includes(r.id as string) && ids.length < TOP_K) ids.push(r.id as string);
  }

  let memories: MemoryRow[] = [];
  const evidenceByMemory = new Map<string, { id: string; field_key: string; value: string | null; is_critical: boolean }[]>();
  if (ids.length) {
    const { data: rows } = await admin
      .from("memories")
      .select("id, title, category, document_date, event_date, structured_fields, notes, extracted_text, verification, created_at")
      .in("id", ids)
      .eq("owner_id", userId)
      .eq("status", "confirmed")
      .is("deleted_at", null);
    memories = ids.map((id) => (rows ?? []).find((r) => r.id === id)).filter(Boolean) as MemoryRow[];
    const { data: ev } = await admin.from("memory_evidence").select("id, memory_id, field_key, value, is_critical").in("memory_id", ids).eq("owner_id", userId);
    for (const e of ev ?? []) {
      const list = evidenceByMemory.get(e.memory_id as string) ?? [];
      list.push({ id: e.id as string, field_key: e.field_key as string, value: e.value as string | null, is_critical: e.is_critical as boolean });
      evidenceByMemory.set(e.memory_id as string, list);
    }
  }

  const context = memories.map((m) => ({
    id: m.id,
    title: m.title,
    category: m.category,
    date: m.document_date,
    important_date: m.event_date,
    amount: m.structured_fields?.amount ?? null,
    currency: m.structured_fields?.currency ?? null,
    merchant: m.structured_fields?.merchant ?? null,
    notes: m.notes,
    text: m.extracted_text ? m.extracted_text.slice(0, 700) : null,
    verified: m.verification === "verified",
  }));

  // 2. Ask the model.
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: `Saved memories (JSON):\n${JSON.stringify(context)}\n\nQuestion: ${question}` },
  ];
  let answer = "";
  let kind: "personal" | "general" | "mixed" | "none" = "none";
  let cited: string[] = [];
  try {
    const raw = (await chatJson(apiKey, profile, messages, Date.now() + 110_000)) as Record<string, unknown>;
    answer = typeof raw.answer === "string" ? raw.answer.trim().slice(0, 4000) : "";
    kind = ["personal", "general", "mixed", "none"].includes(String(raw.answer_kind)) ? (raw.answer_kind as typeof kind) : "personal";
    cited = Array.isArray(raw.source_ids) ? raw.source_ids.filter((s): s is string => typeof s === "string" && ids.includes(s)) : [];
  } catch (e) {
    const code = e instanceof AiError ? e.code : "provider_error";
    return fail(code === "ai_not_configured" ? 503 : code === "timeout" ? 504 : 502, code);
  }
  if (!answer) return fail(502, "empty");
  if (kind === "none" || kind === "general") cited = []; // nothing from their memories was used

  // 3. Save the turn and its sources (only after a good answer, so a failure leaves nothing behind).
  let conversationId = conversationIdIn;
  if (!conversationId) {
    const { data: created, error } = await admin.from("conversations").insert({ owner_id: userId, title: question.slice(0, 120) }).select("id").single();
    if (error || !created) return fail(500, "server_error");
    conversationId = created.id as string;
  }
  const { error: userMsgError } = await admin.from("messages").insert({ conversation_id: conversationId, owner_id: userId, role: "user", content: question });
  if (userMsgError) return fail(500, "server_error");
  const { data: assistant, error: asstError } = await admin
    .from("messages")
    .insert({ conversation_id: conversationId, owner_id: userId, role: "assistant", content: answer, answer_kind: kind })
    .select("id, created_at")
    .single();
  if (asstError || !assistant) return fail(500, "server_error");

  const sources = cited.map((memoryId, rank) => {
    const ev = (evidenceByMemory.get(memoryId) ?? []).filter((e) => e.is_critical).map((e) => e.id).slice(0, 10);
    return { message_id: assistant.id, owner_id: userId, memory_id: memoryId, evidence_ids: ev, rank };
  });
  if (sources.length) await admin.from("message_sources").insert(sources);
  await admin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  return {
    status: 200,
    body: {
      ok: true,
      conversation_id: conversationId,
      message: { id: assistant.id, role: "assistant", content: answer, answer_kind: kind, created_at: assistant.created_at },
      sources: cited.map((id, rank) => ({ memory_id: id, rank })),
    },
  };
}
