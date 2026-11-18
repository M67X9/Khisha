# Khisha (خِشّه): project brief

**Tagline:** Save it now, find it later. (خِشّه الحين، تلقاه بعدين)

## What the application is about

Khisha is an iPhone-first personal AI memory assistant, available in Arabic and English. You save the things you will need later, such as a receipt, a warranty card, an invoice or a screenshot, and Khisha reads the file, keeps the important facts, and lets you search them or ask a question in plain language. Every answer shows which saved memory it came from.

## The problem it solves

Important details end up scattered across screenshots, photos, PDFs and chats. When you need them later (what did I pay, when does the warranty end, which invoice was that) you scroll through a camera roll and still cannot find it. General chatbots do not know your documents, and they can invent numbers with confidence. Khisha solves both problems: it turns files into searchable memories, and it only answers personal questions from what you saved, and says so when it does not know.

## Features implemented

**Accounts and personalization**
- Sign up, sign in and sign out with Supabase Auth. The session is kept in the phone's secure storage.
- Name and gender at sign-up, a personal greeting on Home, and three colour tones that keep the same visual identity.
- Arabic and English with a full right-to-left layout, Alexandria and Inter fonts, and Western digits in both languages. Dates are chosen from a calendar and shown day first (for example 18 Nov 2026).

**Saving memories**
- Add a memory by hand, or upload a screenshot, photo or PDF (checked for type, size and PDF page count, then stored privately).
- The AI reads the file into a titled, categorised draft with the amount, dates, merchant and the important facts.
- Review before saving: the original file is shown next to the draft, and every important amount or date must be explicitly confirmed. Values the AI was unsure about are flagged. Nothing is marked verified until you confirm it.
- Choose whether to keep the original file (stored privately) or delete it after saving.
- Edit and delete memories (soft delete), with home categories and a recent list.

**Finding memories**
- Search in Arabic or English. It ignores diacritics, treats alternate Arabic spellings as the same, forgives typos, and filters by category and date.
- Ask AI: ask a question and get an answer built only from your own memories, with tappable source cards. General knowledge is labelled as such, and a missing answer is stated plainly instead of invented.

**Reliability and privacy**
- Row level security on every table: each person only ever sees their own data. Private storage buckets, signed upload links, and file limits checked on the server.
- All AI and server logic runs in Supabase Edge Functions, never inside the app.
- Retries when the AI provider fails, a free manual retry, and a scheduled cleanup (pg_cron every 5 minutes) that deletes expired temporary uploads, unfinished drafts and stuck jobs.

## How it is built

| Part | Technology |
|---|---|
| Mobile app | Expo (React Native) with Expo Router, TypeScript, run in Expo Go |
| Backend | Supabase: Postgres with row level security, Auth, private Storage, Edge Functions (Deno), pg_cron |
| AI | OpenRouter (free models while testing, premium models planned), JSON output validated with zod |
| Search | Postgres trigram index over a normalized Arabic and English search column |
| Website | Next.js on Vercel |
| Code | npm workspaces monorepo with a shared types package |

## Honest status and what comes next

Khisha is a capstone in private testing: the app runs in Expo Go, and the AI runs on free models with fake data. The credit system and plans, a Recently Deleted screen, the welcome walkthrough, and a quality comparison of premium AI models are planned next. See [PLAN.md](PLAN.md) for the full milestone list, with each finished milestone ticked.
