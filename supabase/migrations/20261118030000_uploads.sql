-- M4: private storage buckets for uploads and the table that tracks each extraction attempt.
--
-- Both buckets are private and have NO storage policies, so the app cannot read or write them directly.
-- Uploads go through a short-lived signed upload URL created by the `upload` Edge Function, and files are
-- only ever read by Edge Functions. Bucket-level limits are a second line of defence behind the function.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('temp-uploads', 'temp-uploads', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('originals', 'originals', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table public.extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  file_id uuid not null references public.memory_files (id) on delete cascade,
  memory_id uuid references public.memories (id) on delete set null,
  status text not null default 'created' check (status in ('created', 'uploaded', 'processing', 'succeeded', 'failed')),
  attempt int not null default 0 check (attempt >= 0),
  error_code text,
  credit_ledger_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index extraction_jobs_owner_idx on public.extraction_jobs (owner_id, created_at desc);
create index extraction_jobs_file_idx on public.extraction_jobs (file_id);

alter table public.extraction_jobs enable row level security;

create policy "extraction_jobs: read own" on public.extraction_jobs
  for select to authenticated using (owner_id = (select auth.uid()));

-- The app can only read its jobs. Edge Functions (service role) create and update them.
revoke all on public.extraction_jobs from anon, authenticated;
grant select on public.extraction_jobs to authenticated;

create trigger extraction_jobs_set_updated_at
  before update on public.extraction_jobs
  for each row execute function public.set_updated_at();
