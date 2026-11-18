import type { Memory, MemoryInput, MemorySummary } from "@khisha/shared";

import { supabase } from "./supabase";

const SUMMARY_COLUMNS = "id,title,category,structured_fields,document_date,created_at,verification";

/** Newest first. Soft-deleted and draft memories are left out. */
export async function listMemories(options: { limit?: number; category?: string } = {}): Promise<MemorySummary[]> {
  let query = supabase
    .from("memories")
    .select(SUMMARY_COLUMNS)
    .is("deleted_at", null)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.category) query = query.eq("category", options.category);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MemorySummary[];
}

export async function countMemories(category: string): Promise<number> {
  const { count, error } = await supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "confirmed")
    .eq("category", category);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Returns null when the memory does not exist (or is deleted, or belongs to someone else). */
export async function getMemory(id: string): Promise<Memory | null> {
  const { data, error } = await supabase.from("memories").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Memory | null) ?? null;
}

export async function createMemory(input: MemoryInput): Promise<string> {
  const { data, error } = await supabase
    .from("memories")
    .insert({ ...input, source_type: "manual", status: "confirmed" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function updateMemory(id: string, input: MemoryInput): Promise<void> {
  const { error } = await supabase.from("memories").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Soft delete: the row stays for 30 days (Recently Deleted comes in a later milestone). */
export async function softDeleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from("memories").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
