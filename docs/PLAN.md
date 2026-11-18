# Khisha (خِشّه) — Build Plan

Derived from `PRD.md`. Nothing is built yet; this is the plan only.

**Stack:** Expo (React Native, iPhone) · Supabase (Postgres, Auth, Storage, **Edge Functions for all AI and server-side logic**) · OpenRouter (AI models) · Next.js on Vercel (website: landing, privacy/support pages, later the admin console).

**Testing release (Phase 1):** the app runs only in **Expo Go** (iOS simulator or a phone), and the website only on **Vercel**. No TestFlight, no App Store, no development build. Supabase stays the backend (database, login, files, Edge Functions). Anything that needs a development build (Apple/Google sign-in, in-app purchases) waits for Phase 2.

**How "first version" is split:** the PRD has two tiers. **Phase 1 (M0–M11)** is the capstone MVP, ending in the non-negotiable demo path: sign in → upload screenshot → review/correct → save → ask AI → sourced answer. **Phase 2 (M12–M20)** is the first public version. Phase 2 is outlined at a coarser grain and should be re-split when Phase 1 is done.

---

## 1. Architecture

```
Expo app (iPhone)
 ├─ Supabase Auth ........ sign-in, session (tokens in expo-secure-store)
 ├─ Supabase Postgres .... reads/writes under RLS (memories, collections, ...)
 ├─ Supabase Storage ..... direct upload to private temp bucket (signed URL)
 └─ Supabase Edge Functions  anything that spends money or needs a secret:
        extract, ask, finalize, cleanup, exports, webhooks
Edge Functions ──► Postgres/Storage (service role) ──► OpenRouter ──► model
Next.js on Vercel: public website + admin console; not in the AI path
```

Decisions that shape the work:

- **Files go straight to Storage.** The app uploads to Supabase Storage with a signed URL; Edge Functions receive only the storage path and read the file server-side. This keeps large bodies out of function requests.
- **The app never holds an AI key.** All model calls are made by Supabase Edge Functions. The `OPENROUTER_API_KEY` lives only in Supabase secrets. The app calls functions with its Supabase JWT (JWT verification stays on); a function uses the service role for ledger and usage writes. Clients cannot write `credit_ledger` or `user_usage`.
- **Edge Function limits to design around:** Deno runtime, a wall-clock cap per request (150 s on free, longer on paid) and a small CPU-time cap (waiting on OpenRouter doesn't count). Extraction runs inside one request; if that proves too tight for 10-page PDFs, switch to queue-and-poll using the `extraction_jobs` table, which the schema already supports.
- **Credits are reserve → settle or refund.** Reserve at job start, settle on success, refund on system failure. This is how "failures don't consume credits" is enforced.
- **Structured data lives in Postgres.** Retrieval is Postgres-side: normalized text + `pg_trgm` + full-text search, top-k records sent to the model. No embeddings in v1 (PRD lists them as later). Never send a user's whole memory to the model.
- **Arabic search:** store a normalized search column (strip diacritics/tatweel, unify alef/yaa/taa-marbuta forms, Arabic-Indic → Western digits) so Arabic, English and mixed text match.
- **Temp-file expiry:** upload rows get `expires_at = now() + 1h`. A Supabase `pg_cron` job runs every few minutes and calls the `cleanup` Edge Function, which deletes expired objects. No Vercel cron needed.
- **AI provider:** OpenRouter, called from Edge Functions behind one shared `_shared/ai.ts` wrapper (vision input, JSON-schema output, model names read from config so we can switch without a release). See section 2 for the model recommendation.
- **Expo Go and Vercel only for Phase 1.** Apple sign-in and in-app purchases (Phase 2) need a development build, so email/password is the only sign-in until then. Stick to libraries that work inside Expo Go.

### Repo layout

```
apps/mobile      Expo + Expo Router, i18next, expo-document-picker / image-picker
apps/web         Next.js (App Router): landing, privacy, support; admin console in Phase 2
packages/shared  TS types, zod schemas (extraction output, function contracts), category list, file limits
supabase/        migrations/, functions/ (extract, ask, finalize, cleanup, _shared/), seed.sql, config.toml, RLS tests
docs/            PLAN.md
```

### File limits (answers PRD open question 5)

| Rule | Limit |
|---|---|
| Files per upload | 1 (one file = one memory) |
| Images / screenshots | JPEG, PNG, HEIC, WebP; ≤ 10 MB each. HEIC is converted to JPEG on the phone before upload. |
| PDF | `application/pdf`; ≤ 10 MB and ≤ 10 pages |
| Everything else (zip, docx, video, ...) | Rejected with a plain-language reason |
| Password-protected or corrupt PDF | Rejected with a specific message; no credit charged |
| Temporary upload lifetime | 1 hour, then deleted |

Enforced in three places so none can be bypassed: (1) the app checks before uploading and shows the limits on Add Memory; (2) the Storage bucket has `file_size_limit` and `allowed_mime_types` set; (3) the `extract` function re-checks type, size and PDF page count before spending any credit. Values live in `packages/shared` so all three agree. Larger or longer PDFs are a "later" feature.

---

## 2. AI models (OpenRouter)

> **Decision:** OpenRouter is the gateway. Models run in two stages, switched by one setting (`AI_PROFILE=free|premium`, a Supabase secret read by the Edge Functions; model ids are config, not code).
>
> - **Stage A, free models (testing):** use `:free` OpenRouter models with image input. Candidates listed on OpenRouter's [free models page](https://openrouter.ai/collections/free-models): `nvidia/nemotron-3.5-super-vl:free`, `inclusionai/ling-3.2-flash:free`, `thinkingmachines/inkling-2-small:free`. None of them states PDF support or JSON-schema output, so M5 asks for JSON in the prompt, validates it with zod, and allows one repair retry. Screenshots and photos come first; PDFs are confirmed in M5 and may have to wait for Stage B.
> - **Stage B, premium models (M5b onward):** `anthropic/claude-haiku-5.5` for extraction and Ask AI, Sonnet 5.5 as the escalation pass, Gemini 3.8 Flash as the outage fallback. The bake-off can overturn this; going direct to a vendor is revisited before public launch.
>
> **Free-stage limits to plan around.** Free models allow 20 requests/minute and **50 requests/day** until you have bought at least $10 of credits, then 1,000/day ([OpenRouter limits](https://openrouter.ai/docs/api-reference/limits)). Failed attempts count, and the cap is shared by every tester using your key. One upload plus one question is about 2 requests, so 50/day is only ~20 full demos. A one-time $10 top-up lifts the cap and also pays for Stage B.
>
> **Privacy in the free stage.** I couldn't find a retention or training statement for most free models, and one (LiquidAI) says outright that prompts may be used to train. So during Stage A use **only fake or sample files, never real receipts or IDs**, and do not send the zero-retention/`data_collection: deny` setting yet (it would likely exclude free endpoints). Turn it on at Stage B.

**What the work needs.** Two jobs: (a) *extraction*, which reads a screenshot or PDF and returns structured JSON, where critical figures must be right and Arabic/mixed text must work; (b) *Ask AI*, which answers from a handful of retrieved records as text, where price and Arabic fluency matter more than vision.

**What I found.** OpenRouter's own October 2026 OCR test (88 key values × 3 runs = 264 checks per model; prices are per 1,000 pages). Source: [Best OCR Model for Scanned Documents, Measured](https://openrouter.ai/blog/insights/best-ocr-model/).

| Model (OpenRouter id) | Correct / 264 | $ / 1,000 pages | Median latency | Notes |
|---|---|---|---|---|
| `anthropic/claude-opus-5.5` | 262 | 16.42 | 7.2 s | Most accurate; ~$4 in / $20 out per M tokens. Overkill as a default. |
| `mistral-ocr` (PDF engine) | 258 | 2.02 | 3.8 s | OCRs a PDF to Markdown before the model sees it; PDFs only; says nothing on Arabic. |
| `anthropic/claude-sonnet-5.5` | 256 | 7.68 | 4.2 s | Strong all-rounder; good "second opinion" tier. |
| `google/gemini-3.8-flash` | 254 | 7.50 | 9.3 s | Slower and not cheap here; useful as a different-vendor fallback. |
| `inclusionai/ling-3.0-flash-vl` | 254 | 0.12 | 7.2 s | Cheapest good result (with reasoning off). |
| **`anthropic/claude-haiku-5.5`** | **253** | **0.46** | **3.8 s** | Within 3% of Opus's error count at ~1/35 of the cost, and fast. |
| `openai/gpt-6.1-sol` | 252 | 6.03 | 8.4 s | Accurate, mid-priced, slower. |
| `z-ai/glm-5.3-flashx` | 252 | 1.45 | 5.5 s | Good value. |
| `deepseek/deepseek-v4.1-flash` | 248 | 0.20 | 4.8 s | Cheap; the test authors suggest it as a cross-checker. |
| `qwen/qwen3.8-flash` | 248 | 0.29 | 8.1 s | Cheap; Qwen is said to be strong on non-Latin scripts (unverified). |

**Caveats.** All test pages were English and synthetic (eight pages, five of them ordinary). No Arabic and no real receipts were tested, and I found no Arabic-specific OpenRouter benchmark. Treat this as a shortlist, not a verdict. Model lineups and prices change, so re-check them in M5.

**Recommendation**

1. **Extraction default: `anthropic/claude-haiku-5.5`.** Near-top accuracy, the fastest tier, and about $0.0005 per page, so a 10-page PDF costs roughly half a cent.
2. **Escalate to `anthropic/claude-sonnet-5.5`** on the same upload (no extra credit charged to the user) when the first pass has a low-confidence category, a failed validation (line items don't add up to the total, or a date is impossible), or a critical field is missing. The user still confirms critical figures either way.
3. **Ask AI: start with Haiku 5.5**, text-only over the top-k retrieved records. Compare against Sonnet 5.5 and Gemini 3.8 Flash in M8; the model name is config, not code.
4. **Fallback for outages:** an OpenRouter fallback list, e.g. Haiku 5.5 → Gemini 3.8 Flash. A different vendor means one outage doesn't take us down.
5. **Skip the cheapest tier (Ling, DeepSeek, Qwen, GLM) for v1.** They're attractive on cost, but receipts and invoices are private, I have no data on their retention terms, and none has Arabic evidence. Revisit after M5 if AI cost per user is too high.
6. **Skip Mistral OCR for v1.** Vision models read PDFs directly, so a second system isn't needed yet. It's an option later for long, text-heavy PDFs.

**Settings that matter**
- Send OpenRouter provider preferences that deny prompt logging/training and require zero-data-retention endpoints (`data_collection: "deny"`, ZDR), and confirm the exact fields in OpenRouter's docs in M5. This directly serves the PRD's privacy open question.
- Turn reasoning off for transcription; the test found this faster and cheaper with no loss.
- Check `finish_reason` on every response, because a truncated transcript still returns HTTP 200. Treat truncation as a system failure (refund and retry).
- Never trust a figure the model can't point to in the source: validate totals and dates in code, and flag, don't fix, disagreements.

**Bake-off in M5 (the real decision).** Run Haiku 5.5, Sonnet 5.5 and Gemini 3.8 Flash on ~30 real files: 10 Arabic receipts, 10 English, 5 mixed, 5 PDFs. Pass bar: ≥ 95% of critical fields (total, date, merchant) correct for the default model. Keep the results in `docs/AI-EVAL.md`.

---

## 3. Milestones — Phase 1 (capstone MVP)

Each milestone ends with something a person can try. Tick the box when its "Test" passes.

- [ ] **D0 — Design foundations and demo-path screens in Figma**
  - Build: Figma file with colour/type/spacing variables, the component set from section 8, and designed screens for the demo path (Sign in, Home, Add Memory, Review Extraction, Memory Detail, Ask AI with a sourced answer), plus an Arabic (RTL) Home.
  - Test: open the Figma file and click through the prototype from Sign in to a sourced answer; flip to the Arabic Home and see the layout mirrored.
  - Figma file: https://www.figma.com/design/lZ6CJFakCdd5gx2UWAESnC (pages: Foundations, Components, Screens). Designed so far: Sign in, Home (EN + AR), Add Memory, Review Extraction, Memory Detail, Ask AI, Search, Memories (Categories and Collections), Settings with usage, Plans (simulated payments), a 3-step Welcome walkthrough, and Recently Deleted. Arabic (RTL) versions of all of these now sit in a second row of the Screens page (cloned and mirrored from the English screens, so future design changes must be applied to both). Preferences and PDF Export Preview are designed too (EN and AR), so every screen in the PRD's screen list now has a design. Native-speaker review of the Arabic text is still needed.

- [x] **M0 — Foundations and a live "hello"** *(done: Supabase project "Khisha" with the `health` function, website at https://khisha-web.vercel.app, status screen confirmed working in Expo Go)*
  - Build: monorepo; Supabase project (dev); a `health` Edge Function that checks the DB; OpenRouter key stored as a Supabase secret; Next.js placeholder site deployed to Vercel; Expo app running in Expo Go (iOS simulator, or a phone on the same Wi-Fi).
  - Test: open the app in Expo Go; a status screen shows "Edge Function ✓ · Database ✓" fetched from the deployed function; the Vercel URL loads in a browser.

- [x] **M1 — Email/password sign-in** *(done: sign-up, sign-in, sign-out and session persistence confirmed in Expo Go)*
  - Build: Supabase Auth; register, sign in, sign out, clear error messages; session persists in secure storage; `profiles` row auto-created by trigger.
  - Test: register a new account, force-quit and reopen the app (still signed in), sign out (back at sign-in), sign in with a wrong password (readable error).

- [ ] **M2 — Arabic/English shell and Home** *(built and checked locally: i18n with English/Arabic, RTL switch with restart, Inter + Noto Sans Arabic, Home, Settings, placeholder screens, language saved on the profile; waiting for the manual test in Expo Go. Production builds need expo-updates for the restart.)*
  - Build: i18n with language switch; full RTL layout (RN needs a reload to flip direction); Home with Search, Ask AI, Add Memory, recent-memories list, usage indicator and Settings entries (placeholders OK); `preferred_language` saved on the profile.
  - Test: switch to Arabic from Settings; the whole app flips right-to-left and text is Arabic; switch back; choice survives a relaunch.

- [ ] **M3 — Core schema, security, and manual memories**
  - Build: migrations for `profiles`, `memories`, `memory_evidence`, `memory_files`; RLS on every table; a "pgTAP/SQL" test that user A cannot read or write user B's rows; Memory list, Memory Detail (compact → expanded), manual create/edit; soft delete (sets `deleted_at`, hidden from lists).
  - Test: create a memory by typing it in, see it on Home, open it, edit it, delete it (it disappears). Sign in as a second account and confirm the first account's memories are not visible.

- [ ] **M4 — Add Memory: pick and upload one file**
  - Build: Add Memory screen showing the file limits from section 1; picker for photo/screenshot/PDF; client-side type and size checks (HEIC → JPEG); bucket `file_size_limit` and `allowed_mime_types`; signed-URL upload to the private `temp-uploads` bucket; `extraction_jobs` row (`uploaded`); `memory_files` row with `expires_at`.
  - Test: pick a screenshot and see "uploaded"; pick a 30 MB file or a `.zip` and see a specific rejection message; confirm in the Supabase dashboard that the file sits in a private bucket and a direct URL without auth fails.

- [ ] **M5 — AI extraction into a draft**
  - Build: `extract` Edge Function; re-check limits and PDF page count; reserve credit; call OpenRouter with the active `AI_PROFILE` (free models first, per section 2) with the image (PDF if the model accepts it); zod-validate, with one repair retry for malformed JSON; structured output (title, readable text, category, dates, structured fields, per-field confidence, flags for critical numbers/dates); create a **draft** memory plus `memory_evidence` rows (`source = file`); settle credit; show a processing state in the app. One file → one memory, even with several subjects.
  - Test: upload a sample receipt screenshot (fake data only while on free models), wait a few seconds, and get a draft with a sensible title, extracted text, category and amount/date. Try one Arabic and one mixed Arabic/English screenshot.

- [ ] **M5b — Switch to premium models and run the bake-off**
  - Build: top up OpenRouter; set `AI_PROFILE=premium` (Haiku 5.5, Sonnet 5.5 escalation, Gemini 3.8 Flash fallback); turn on the zero-retention provider setting; test PDFs; run the bake-off on ~30 files (10 Arabic receipts, 10 English, 5 mixed, 5 PDFs) and record results in `docs/AI-EVAL.md`.
  - Test: flip the one setting and re-upload the same sample files; extraction quality visibly improves, Arabic fields come back correct, and `docs/AI-EVAL.md` shows the default model reaching ≥ 95% on critical fields (total, date, merchant). Real files are allowed from here on.

- [ ] **M6 — Review before saving, and the original-file choice**
  - Build: Review Extraction screen: source preview, editable fields, low-confidence category flag, **explicit confirmation required** for critical figures/dates (Save disabled until confirmed), category picker, manual title/description fallback, keep-original toggle with a category-based default. `finalize` Edge Function: confirmed → memory `confirmed` + evidence marked `verified`; keep → move file to private `originals` bucket; don't keep → delete the temp file after the user confirms.
  - Test: upload a receipt, change a wrong amount, confirm the amount and date, save with "keep original off"; the memory appears on Home and the temp file is gone. Repeat with "keep original on" and see the file in `originals`. Try saving without confirming the amount (blocked).

- [ ] **M7 — Search**
  - Build: normalized search column, trigram + full-text index, Search screen with keyword and filters (category, date); no credits charged; excludes soft-deleted rows.
  - Test: search an English word and an Arabic word from saved memories and find both; a typo or alternate Arabic spelling (e.g. أ/ا) still matches; a deleted memory does not show up.

- [ ] **M8 — Ask AI with sources** *(completes the demo success path)*
  - Build: `ask` Edge Function; retrieve top-k memories for the user only; prompt that answers from them and labels anything else as general knowledge; save `conversations`, `messages`, `message_sources`; answer UI with clickable source cards linking to Memory Detail and showing the extracted evidence; reserve/settle credit; empty answer = no charge.
  - Test: after saving a receipt, ask "How much was my [store] receipt?" and receive the right amount with a tappable source that opens that memory; ask something not in memory and see it clearly say so rather than invent.

- [ ] **M9 — Resilient workflow and temp-file cleanup**
  - Build: automatic single retry on extraction failure, then a free manual Retry; failures refund the reservation; keep the picked file locally on connection loss and offer Retry; `pg_cron` runs the `cleanup` Edge Function every few minutes to delete temp uploads older than 1 hour (and their draft state); Review shows a clear "original expired" state.
  - Test: turn on Airplane Mode mid-upload, see Retry, reconnect and complete; trigger a forced model error (a debug flag) and see the retry then a free manual retry with credits unchanged; wait out the 1-hour expiry (or run the cleanup manually) and watch the abandoned file vanish.

- [ ] **M10 — Credits, storage, and simulated plans**
  - Build: `plans`, `subscriptions`, `user_usage`, `credit_ledger`; Usage screen (credits left, storage used); Plans screen with a simulated "upgrade" that only changes demo state; zero-credit state blocks AI extraction/answers but still allows search and browsing; storage-full path allows information-only upload.
  - Test: watch credits drop by the expected amount after an upload and after an answer; set credits to 0 (debug tool) and see AI blocked with an explanation while search still works; "upgrade" on the Plans screen and see allowances change with no real payment.

- [ ] **M11 — Welcome walkthrough and demo hardening**
  - Build: Welcome / interactive demo screens (sample screenshots, sample retrieval); seeded demo account and sample files; error-state pass over all screens; `docs/DEMO.md` script of the 12-step path.
  - Test: on a fresh simulator and a fresh account, someone who hasn't seen the app completes sign-in → upload → correct → confirm → save → ask → sourced answer, three times in a row, with no errors, in English and in Arabic.

---

## 4. Milestones — Phase 2 (first public version)

Outlined only; split further when we get here. Each still ends in something testable.

- [ ] **M12 — Recently Deleted.** 30-day restore, permanent delete, excluded from search/AI, retained originals still count toward storage. *Test:* delete, find it in Recently Deleted, restore it, delete again and permanently delete; confirm Ask AI never cites it.
- [ ] **M13 — Categories, collections, related memories.** Compact cards, user collections, category correction, suggested links that need confirmation. *Test:* create a collection, add two memories, accept one suggested link and reject another.
- [ ] **M14 — Ask AI v2.** Follow-ups with chat context, free retry then normal charge, report-error flow, contradictory records shown together, user-initiated live price check labelled with source and date. *Test:* ask a follow-up, retry a bad answer for free, report it, run a live price check and see source and date.
- [ ] **M15 — Preferences and sensitive-content warning.** Inferred non-sensitive preferences with edit/delete; warning before processing passwords, API keys or ID documents. *Test:* see a learned preference, delete it; upload a screenshot of a password and see the warning before any AI call.
- [ ] **M16 — Upcoming dates on Home.** From confirmed dates only (uncertain ones never shown as reminders). *Test:* confirm a warranty expiry and see it on Home; leave a date unconfirmed and see it absent.
- [ ] **M17 — Exports and account deletion.** Download retained originals, PDF report with record selection, export before account deletion, delete account and data. *Test:* download a kept receipt, export a 3-record PDF, delete the account and confirm sign-in fails and storage is empty.
- [ ] **M18 — Apple and Google sign-in, one active device.** *Test:* sign in with Apple and with Google; sign in on a second device and see the first signed out with a clear message.
- [ ] **M19 — Real Apple in-app purchases.** StoreKit (RevenueCat or `expo-iap`, decide then), server verification, webhook handled by an Edge Function, expiry falls back to free limits. *Test:* sandbox purchase raises allowances; sandbox expiry lowers them while old memories stay readable.
- [ ] **M20 — Privacy/security pass and friends-and-family beta.** RLS audit, analytics consent with no document content sent, backup-retention wording, TestFlight build. *Test:* invited testers use real screenshots and receipts for a week; error reports triaged.

---

## 5. Database tables

All tables have `id uuid pk`, `created_at`, and (where user-owned) `owner_id → auth.users` with an RLS policy `owner_id = auth.uid()`. "Server-only" means only the service role (Edge Functions) can write; users can read their own rows.

### Phase 1

| Table | Stores |
|---|---|
| `profiles` | One row per user (id = `auth.users.id`): email copy, `preferred_language` (`ar`/`en`), `account_status`, and the demo flag. Created by trigger on sign-up. |
| `memories` | The core record. `owner_id`, `title`, `category`, `category_confidence`, `extracted_text`, `search_text` (normalized, indexed), `structured_fields` (jsonb: amounts, merchant, etc.), `notes`, `status` (`draft`/`confirmed`), `verification` (unverified/verified), `source_type` (screenshot/image/pdf/manual), `document_date`, `event_date`, `deleted_at`, `updated_at`. |
| `memory_files` | The uploaded file behind a memory: `memory_id`, `owner_id`, `bucket`, `storage_path`, `original_filename`, `mime_type`, `size_bytes`, `retention` (temporary/retained/discarded), `expires_at` (1 hour for temporary), `deleted_at`. Never a public URL. |
| `memory_evidence` | Where each field came from: `memory_id`, `field_key`, `value`, `source` (file / user_correction / external), `is_critical`, `confidence`, `confirmed_at`. Drives "verified" status and the source panel under an answer. |
| `extraction_jobs` | One AI extraction attempt per upload: `memory_id`, `file_id`, `status` (uploaded/processing/succeeded/failed), `attempt` (auto retry count), `error_code`, `credit_ledger_id`, `started_at`, `finished_at`. |
| `conversations` | An Ask AI chat: `owner_id`, `title`, `updated_at`. |
| `messages` | Chat turns: `conversation_id`, `role`, `content`, `answer_kind` (personal/general/mixed), `credit_ledger_id`, retry/report metadata. |
| `message_sources` | Which memories (and evidence fields) a message used: `message_id`, `memory_id`, `evidence_ids`, `rank`. Makes sources clickable and auditable. |
| `plans` | Plan definitions, configurable without code: `code`, `monthly_credits`, `storage_bytes`, `price_label`, `is_simulated`. |
| `subscriptions` | A user's current plan: `owner_id`, `plan_id`, `status`, `period_start/end`, `source` (demo/apple). Server-only. |
| `user_usage` | Cached balances: `owner_id`, `credits_balance`, `storage_bytes_used`, `period_resets_at`. Server-only. |
| `credit_ledger` | Append-only credit history: `owner_id`, `delta`, `kind` (grant/reserve/charge/refund/purchase), `reason`, `job_or_message_id`, `balance_after`. Server-only. Refunds make "failures cost nothing" auditable. |

### Phase 2

| Table | Stores |
|---|---|
| `collections` | User-created collections: `owner_id`, `name`, `sort_order`. |
| `memory_collections` | Join: `memory_id`, `collection_id`. |
| `memory_links` | Suggested relationships between memories: `memory_a`, `memory_b`, `relation`, `status` (suggested/confirmed/rejected). Active only when confirmed. |
| `preferences` | Learned non-sensitive preferences: `owner_id`, `text`, `context`, `confidence`, `updated_at`, `deleted_at`. |
| `device_sessions` | The single active session: `owner_id`, `device_id`, `session_id`, `last_seen`, `revoked_at`. |
| `error_reports` | User-reported bad answers/extractions: `message_id` or `job_id`, `note`, `status`. Admin reads these through restricted access, not private content by default. |
| `purchases` | Apple IAP transactions: `owner_id`, `product_id`, `transaction_id`, `kind` (subscription/credit pack/storage pack), `status`. Server-only. |
| `export_jobs` | PDF/report exports: `owner_id`, `memory_ids`, `status`, `file_path`, `expires_at`. |
| `price_checks` | Optional live price lookups: `message_id`, `query`, `source_url`, `price`, `checked_at`. Kept separate so web data is never confused with saved facts. |

### Storage buckets (private, no public URLs)

- `temp-uploads` — new uploads awaiting review; expire after 1 hour.
- `originals` — files the user chose to keep; counted against storage.

### Indexes and policies to set up with the schema

`memories(owner_id, deleted_at, created_at desc)`; GIN trigram + full-text on `search_text`; `memory_files(expires_at) where retention = 'temporary'`; storage policies scoping paths to `owner_id/…`; every retrieval query filters `owner_id` and `deleted_at is null`.

---

## 6. Risks and open questions to settle early

| Item | Needed by |
|---|---|
| Model bake-off on real Arabic/English files; confirm OpenRouter zero-retention settings and model prices | M5 |
| Edge Function time limit vs 10-page PDFs (fallback: queue-and-poll via `extraction_jobs`) | M5 |
| Model choice for Ask AI (Haiku vs Sonnet vs Gemini Flash) | M8 |
| Which free vision model actually returns usable JSON (and whether any reads PDFs); free-tier cap of 50 requests/day until $10 is bought | M5 |
| Free models' data retention is undocumented: fake data only until Stage B | M5–M5b |
| Credit prices per action and starting balance (illustrative for the demo; cost-test before public) | M10 |
| What happens to a draft when its original expires after one hour (proposal: draft remains, "original expired" banner, can still be saved as info-only after confirmation) | M9 |
| Does a user with zero credits get a manual text-only memory? (M3 already allows it; confirm that's wanted) | M10 |
| Arabic search quality on real data (diacritics, mixed scripts) | M7 |
| Apple/Google sign-in timing; IAP compliance review | M18–M19 |
| Machine-readable full export, backup-deletion timeline, session-invalidation policy | M17–M18 |

## 8. Design direction

Based on reference apps the owner shared (a finance analytics app for gradient cards, an AI studio app for glass buttons). Light theme first; dark theme later.

**Look**
- **Base:** light gray background (`#EEEEF0`), white rounded panels, near-black ink (`#111114`), muted text `#6B6B76`.
- **Gradient cards:** soft, blurred, one-hue gradients with large white numerals or titles. One gradient per category, so browsing feels visual: Receipts & invoices = coral, Movies & shows = violet, Products = blue, Restaurants & places = amber, Cars & maintenance = teal. Unmapped categories get a neutral gradient.
- **Glass:** translucent white fill (~12%), 1 px light border, background blur, round or pill. Used for back/menu buttons, quick-action chips, the corner arrow on cards, and the floating bar, and only over gradient areas (on plain white it reads as a gray blob).
- **Navigation:** no tab bar. A floating pill at the bottom with Search, a prominent Add Memory, and Ask AI. Segmented pill control (black selected pill) for filters and ranges.
- **Status colours:** verified green `#1F9D6B`, needs-confirmation amber `#D98A1C`, error red `#D64545`. Critical figures awaiting confirmation always show the amber state, never only a colour (also an icon and label).

**Type:** Inter for Latin, Noto Sans Arabic for Arabic (both in Google Fonts and available in Expo). Large numerals for amounts and dates.

**Components to design once:** gradient category card, hero card, white panel, glass button/chip, segmented control, floating bar, memory card (compact → expanded), confirm-field row, evidence chip (source link), usage meter, chat bubble with source cards.

**Rules**
- Arabic is a first-class design, not a mirror afterthought: right-to-left layout, mirrored back/chevron/corner-arrow icons, Arabic numerals handled consistently, longer strings tolerated.
- Text contrast ≥ 4.5:1; white text only on dark or saturated gradients; touch targets ≥ 44 pt.
- Expo Go-safe: gradients via `expo-linear-gradient`, glass via `expo-blur`, mesh-style glow via exported gradient images (no Skia). Use blur sparingly (floating bar and a few buttons), never on every list row.

**Screens in design order:** Sign in → Home → Add Memory → Review Extraction → Memory Detail → Ask AI (answer with sources) → Search → Memories/Collections → Settings/Usage/Plans → Welcome walkthrough.

---

## 7. Out of scope (from the PRD)

Share Sheet and bulk import, offline use, multi-device, AI editing records via chat, public sharing links, automatic reminder notifications, specialized per-document templates, real payments in the capstone, marketplace/merchant integrations.
