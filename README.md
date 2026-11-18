# Khisha (خِشّه)

iPhone-first personal AI memory assistant. The plan is in [docs/PLAN.md](docs/PLAN.md).

| Folder | What it is |
|---|---|
| `apps/mobile` | Expo (React Native) app, run in Expo Go |
| `apps/web` | Next.js website, deployed on Vercel |
| `packages/shared` | Types and constants shared by the apps (file limits, health response) |
| `supabase/` | Database migrations and Edge Functions (all server-side and AI code) |

## Run it locally

```bash
npm install
```

Mobile app (scan the QR code with Expo Go, or press `i` for the iOS simulator):

```bash
cp apps/mobile/.env.example apps/mobile/.env   # then fill in your Supabase URL and anon key
npm run mobile
```

Website:

```bash
npm run web
```

Typecheck everything:

```bash
npm run typecheck
```

## Set up Supabase (milestone M0)

1. Create a Supabase project and note its reference (the part before `.supabase.co`).
2. Link and push the database and function:

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push
npx supabase functions deploy health
```

3. Put the project URL and anon key into `apps/mobile/.env`.

Secrets such as the OpenRouter key never go in the app or in git. They are set on Supabase (needed from milestone M5):

```bash
npx supabase secrets set OPENROUTER_API_KEY=your-key-here
```

## Deploy the website (Vercel)

Import the repository in Vercel and set the **Root Directory** to `apps/web`.
