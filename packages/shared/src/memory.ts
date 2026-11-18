/** Categories the app knows how to show (colour, icon, name). AI-made categories later map onto these or fall back to "other". */
export const MEMORY_CATEGORIES = ["receipt", "movie", "product", "place", "car", "document", "other"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

/** Extra structured data kept on a memory. `amount` is in `currency` (KWD for now). */
export type StructuredFields = {
  amount?: number;
  currency?: string;
  [key: string]: unknown;
};

/** A row of `public.memories`. */
export type Memory = {
  id: string;
  owner_id: string;
  title: string;
  category: string;
  category_confidence: number | null;
  extracted_text: string | null;
  structured_fields: StructuredFields;
  notes: string | null;
  status: "draft" | "confirmed";
  verification: "unverified" | "verified";
  source_type: "screenshot" | "image" | "pdf" | "manual";
  document_date: string | null; // YYYY-MM-DD
  event_date: string | null; // YYYY-MM-DD
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

/** The columns the list screens need. */
export type MemorySummary = Pick<Memory, "id" | "title" | "category" | "structured_fields" | "document_date" | "created_at" | "verification">;

/** What a person can set when they add or edit a memory by hand. */
export type MemoryInput = {
  title: string;
  category: string;
  notes: string | null;
  document_date: string | null;
  structured_fields: StructuredFields;
};

/** A row of `public.memory_evidence`: one fact read from a file, with how sure the reader was. */
export type MemoryEvidence = {
  id: string;
  memory_id: string;
  field_key: string;
  value: string | null;
  source: "file" | "user_correction" | "external" | "manual";
  is_critical: boolean;
  confidence: number | null;
  confirmed_at: string | null;
};
