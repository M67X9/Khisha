// The AI reader: turns one image or PDF into a structured draft.
//
// - Calls OpenRouter with a chain of models chosen by AI_PROFILE ("free" while testing, "premium" later).
// - Asks for one JSON object, checks it with zod, and asks the model once to repair it if it is invalid.
// - Cleans the result: dates must be real, amounts sane, and every important figure becomes an "evidence" row
//   that the person still has to confirm (nothing is verified here).
// - Never logs document content.
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { z } from "npm:zod@3.23.8";

export const CATEGORIES = ["receipt", "movie", "product", "place", "car", "document", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export type AiProfile = "free" | "premium";

/** Model chains per profile. Free models first (testing, fake data only); premium models after the bake-off (M5b). */
const PROFILES: Record<AiProfile, { models: string[]; privacy: boolean }> = {
  free: { models: ["google/gemma-4-31b-it:free", "nvidia/nemotron-3.5-super-vl:free", "inclusionai/ling-3.2-flash:free"], privacy: false },
  premium: { models: ["anthropic/claude-haiku-5.5", "google/gemini-3.8-flash"], privacy: true },
};

export class AiError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

// ---------- what the model must return ----------

const nullableString = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().nullable().default(null));
const nullableNumber = z.preprocess((v) => {
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return v;
}, z.number().nullable().default(null));
const unit = z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().min(0).max(1));

const FieldSchema = z.object({
  key: z.string().min(1).max(60),
  value: z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string().max(300)),
  is_critical: z.boolean().catch(false),
  confidence: unit.catch(0.5),
});

export const ExtractionSchema = z.object({
  title: z.string().min(1).max(160),
  category: z.enum(CATEGORIES).catch("other"),
  category_confidence: unit.catch(0.5),
  language: z.enum(["ar", "en", "mixed", "other"]).catch("other"),
  extracted_text: z.string().max(12000).default(""),
  document_date: nullableString,
  event_date: nullableString,
  amount: nullableNumber,
  currency: nullableString,
  merchant: nullableString,
  notes: nullableString,
  fields: z.array(FieldSchema).max(30).default([]),
});

type Raw = z.infer<typeof ExtractionSchema>;

export type Evidence = { field_key: string; value: string; is_critical: boolean; confidence: number };

export type Extraction = {
  title: string;
  category: Category;
  category_confidence: number;
  extracted_text: string;
  document_date: string | null;
  event_date: string | null;
  notes: string | null;
  structured_fields: Record<string, unknown>;
  evidence: Evidence[];
};

// ---------- prompts ----------

const SYSTEM_PROMPT = `You are the document reader inside Khisha, a personal memory app. People save screenshots, photos, receipts, invoices and PDFs. Read the one file you are given and reply with ONE JSON object and nothing else (no markdown, no commentary).

Rules:
- Use only what is in the file. Never invent or guess a value. When something is not there, use null.
- Keep Arabic and English text exactly as written. The file may mix both.
- Dates must be ISO "YYYY-MM-DD". Use Western digits. If the year is missing, use null.
- "amount" is the final total paid or due, as a plain number with a dot as the decimal separator (no currency symbol, no thousands separator). "currency" is the 3-letter code (KWD, USD, SAR, AED...), or null. Arabic markers: د.ك or دينار كويتي = KWD, ر.س = SAR, د.إ = AED, ر.ق = QAR, د.ب = BHD, ر.ع = OMR, $ = USD.
- "document_date" is the date printed on the document (for example the receipt or invoice date). "event_date" is a date something happens later (warranty end, booking, due date), or null.
- "category" is one of: receipt, movie, product, place, car, document, other.
- "title" is short and specific, in the document's main language, for example "Carrefour - groceries" or "Dune: Part Two".
- "extracted_text" is a faithful transcription of the readable text, at most about 3000 characters.
- "fields" lists the important facts you found. Each has "key" (a short English name such as total, date, merchant, invoice_number, warranty_end), "value" (as text), "is_critical" (true for money amounts and dates), and "confidence" (0 to 1: how sure you are you read it correctly).
- Be honest about confidence: blurry, cropped or ambiguous values get a low confidence.

Reply with exactly this shape:
{"title": string, "category": string, "category_confidence": number, "language": "ar"|"en"|"mixed"|"other", "extracted_text": string, "document_date": string|null, "event_date": string|null, "amount": number|null, "currency": string|null, "merchant": string|null, "notes": string|null, "fields": [{"key": string, "value": string, "is_critical": boolean, "confidence": number}]}`;

const USER_PROMPT = "Read this file and return the JSON object.";

// ---------- calling OpenRouter ----------

type Message = { role: "system" | "user" | "assistant"; content: unknown };

async function callModels(apiKey: string, profile: AiProfile, messages: Message[], isPdf: boolean, deadline: number): Promise<string> {
  const remaining = deadline - Date.now();
  if (remaining < 8000) throw new AiError("timeout");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(55000, remaining - 2000));

  const config = PROFILES[profile];
  const body: Record<string, unknown> = {
    models: config.models,
    messages,
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 6000,
  };
  if (isPdf) body.plugins = [{ id: "file-parser", pdf: { engine: "pdf-text" } }];
  // Premium stage: only providers that do not keep or train on the data.
  if (config.privacy) body.provider = { data_collection: "deny", zdr: true };

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Khisha" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new AiError("timeout");
    throw new AiError("provider_error", "network");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) throw new AiError("ai_not_configured", `auth ${res.status}`);
  if (res.status === 429) throw new AiError("provider_busy", "429");
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload) throw new AiError("provider_error", `http ${res.status}`);
  if (payload.error) throw new AiError("provider_error", String(payload.error.code ?? payload.error.message ?? "error").slice(0, 80));

  const content = payload.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p: { text?: string }) => p.text ?? "").join("") : "";
  if (!text.trim()) throw new AiError("unreadable", "empty answer");
  return text;
}

function parseJson(text: string): unknown {
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object found");
  return JSON.parse(s.slice(start, end + 1));
}

function describeProblems(e: unknown): string {
  if (e instanceof z.ZodError) return e.issues.slice(0, 6).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  return e instanceof Error ? e.message : "invalid";
}

// ---------- cleaning ----------

function validDate(s: string | null): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return m[0];
}

function confidenceFor(fields: Raw["fields"], keys: string[], fallback: number): number {
  const hit = fields.find((f) => keys.includes(f.key.toLowerCase().replace(/[\s-]+/g, "_")));
  return hit ? hit.confidence : fallback;
}

function normalize(raw: Raw): Extraction {
  const category: Category = (CATEGORIES as readonly string[]).includes(raw.category) ? raw.category : "other";
  const documentDate = validDate(raw.document_date);
  const eventDate = validDate(raw.event_date);
  const amount = raw.amount !== null && Number.isFinite(raw.amount) && raw.amount >= 0 && raw.amount <= 1_000_000_000 ? Math.round(raw.amount * 1000) / 1000 : null;
  const currency = raw.currency && /^[A-Za-z]{3}$/.test(raw.currency.trim()) ? raw.currency.trim().toUpperCase() : null;
  const merchant = raw.merchant ? raw.merchant.trim().slice(0, 120) : null;

  const evidence: Evidence[] = [];
  const used = new Set<string>();
  const add = (key: string, value: string, critical: boolean, confidence: number) => {
    if (used.has(key)) return;
    used.add(key);
    evidence.push({ field_key: key, value, is_critical: critical, confidence: Math.max(0, Math.min(1, confidence)) });
  };
  // Important figures always become evidence that still needs the person's confirmation.
  if (amount !== null) add("total", currency ? `${amount} ${currency}` : String(amount), true, confidenceFor(raw.fields, ["total", "amount", "total_amount"], 0.5));
  if (documentDate) add("date", documentDate, true, confidenceFor(raw.fields, ["date", "document_date", "invoice_date"], 0.5));
  if (eventDate) add("event_date", eventDate, true, confidenceFor(raw.fields, ["event_date", "due_date", "warranty_end", "expiry_date"], 0.5));
  if (merchant) add("merchant", merchant, false, confidenceFor(raw.fields, ["merchant", "store", "vendor"], 0.6));
  for (const f of raw.fields) {
    const key = f.key.toLowerCase().replace(/[\s-]+/g, "_").slice(0, 60);
    if (["total", "amount", "total_amount", "date", "document_date", "invoice_date", "merchant", "store", "vendor"].includes(key)) continue;
    if (f.value.trim() === "") continue;
    add(key, f.value.trim(), f.is_critical, f.confidence);
  }

  const structured: Record<string, unknown> = { language: raw.language };
  if (amount !== null) structured.amount = amount;
  if (currency) structured.currency = currency;
  if (merchant) structured.merchant = merchant;

  return {
    title: raw.title.trim().slice(0, 160),
    category,
    category_confidence: raw.category_confidence,
    extracted_text: raw.extracted_text.trim(),
    document_date: documentDate,
    event_date: eventDate,
    notes: raw.notes ? raw.notes.trim().slice(0, 500) : null,
    structured_fields: structured,
    evidence,
  };
}

// ---------- the public entry point ----------

export type ReadOptions = { bytes: Uint8Array; mime: string; filename: string; apiKey: string; profile: AiProfile; deadline: number };

export async function readFile(opts: ReadOptions): Promise<Extraction> {
  const isPdf = opts.mime === "application/pdf";
  const base64 = encodeBase64(opts.bytes);
  const filePart = isPdf
    ? { type: "file", file: { filename: opts.filename || "document.pdf", file_data: `data:application/pdf;base64,${base64}` } }
    : { type: "image_url", image_url: { url: `data:${opts.mime};base64,${base64}` } };

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: [{ type: "text", text: USER_PROMPT }, filePart] },
  ];

  let lastError: unknown = new AiError("unreadable");
  for (let pass = 0; pass < 2; pass++) {
    try {
      const first = await callModels(opts.apiKey, opts.profile, messages, isPdf, opts.deadline);
      try {
        return finish(ExtractionSchema.parse(parseJson(first)), isPdf);
      } catch (problem) {
        if (problem instanceof AiError) throw problem;
        // One repair attempt: show the model its own answer and what was wrong with it.
        const repaired = await callModels(
          opts.apiKey,
          opts.profile,
          [...messages, { role: "assistant", content: first }, { role: "user", content: `That reply was not usable (${describeProblems(problem)}). Reply again with ONLY the corrected JSON object.` }],
          isPdf,
          opts.deadline,
        );
        try {
          return finish(ExtractionSchema.parse(parseJson(repaired)), isPdf);
        } catch (e) {
          if (e instanceof AiError) throw e;
          throw new AiError("invalid_output", describeProblems(e).slice(0, 120));
        }
      }
    } catch (e) {
      lastError = e;
      // These will not get better by asking again.
      if (e instanceof AiError && ["ai_not_configured", "pdf_no_text"].includes(e.code)) throw e;
      if (opts.deadline - Date.now() < 12000) break;
    }
  }
  throw lastError instanceof AiError ? lastError : new AiError("unreadable");
}

function finish(raw: Raw, isPdf: boolean): Extraction {
  const result = normalize(raw);
  if (isPdf && result.extracted_text.length < 20) throw new AiError("pdf_no_text");
  return result;
}
