-- M3: the core memory tables with row level security.
--
-- Who can do what:
--   memories         the owner can read, create manual memories, edit text fields and soft-delete (deleted_at).
--                    Everything else (verification, drafts from uploads, permanent delete) is done by Edge Functions.
--   memory_files     the owner can only read. Edge Functions write.
--   memory_evidence  the owner can only read. Edge Functions write.

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  category text not null default 'other',
  category_confidence real check (category_confidence between 0 and 1),
  extracted_text text,
  search_text text,
  structured_fields jsonb not null default '{}'::jsonb,
  notes text check (char_length(notes) <= 5000),
  status text not null default 'confirmed' check (status in ('draft', 'confirmed')),
  verification text not null default 'unverified' check (verification in ('unverified', 'verified')),
  source_type text not null default 'manual' check (source_type in ('screenshot', 'image', 'pdf', 'manual')),
  document_date date,
  event_date date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memories_owner_recent_idx on public.memories (owner_id, deleted_at, created_at desc);
create index memories_owner_category_idx on public.memories (owner_id, category) where deleted_at is null;

create table public.memory_files (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid references public.memories (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (bucket in ('temp-uploads', 'originals')),
  storage_path text not null,
  original_filename text,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  retention text not null default 'temporary' check (retention in ('temporary', 'retained', 'discarded')),
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bucket, storage_path)
);

create index memory_files_memory_idx on public.memory_files (memory_id);
create index memory_files_expiry_idx on public.memory_files (expires_at) where retention = 'temporary';

create table public.memory_evidence (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  field_key text not null,
  value text,
  source text not null check (source in ('file', 'user_correction', 'external', 'manual')),
  is_critical boolean not null default false,
  confidence real check (confidence between 0 and 1),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index memory_evidence_memory_idx on public.memory_evidence (memory_id);

-- Row level security: a person only ever sees their own rows.
alter table public.memories enable row level security;
alter table public.memory_files enable row level security;
alter table public.memory_evidence enable row level security;

create policy "memories: read own" on public.memories
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "memories: create own manual" on public.memories
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and source_type = 'manual' and status = 'confirmed');

create policy "memories: update own" on public.memories
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "memory_files: read own" on public.memory_files
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "memory_evidence: read own" on public.memory_evidence
  for select to authenticated using (owner_id = (select auth.uid()));

-- Column-level privileges: the app can only touch the columns a person may change.
revoke all on public.memories, public.memory_files, public.memory_evidence from anon, authenticated;

grant select on public.memories, public.memory_files, public.memory_evidence to authenticated;

grant insert (title, category, extracted_text, structured_fields, notes, status, source_type, document_date, event_date)
  on public.memories to authenticated;

grant update (title, category, extracted_text, structured_fields, notes, document_date, event_date, deleted_at)
  on public.memories to authenticated;

-- Keep updated_at fresh.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger memories_set_updated_at
  before update on public.memories
  for each row execute function public.set_updated_at();

-- A verified record stops being verified if a person edits its figures or dates by hand.
-- Only the server (service role) can change those fields and keep the verified flag.
create function public.reset_verification_on_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'service_role'
     and (new.structured_fields is distinct from old.structured_fields
          or new.document_date is distinct from old.document_date
          or new.event_date is distinct from old.event_date)
  then
    new.verification := 'unverified';
  end if;
  return new;
end;
$$;

create trigger memories_reset_verification
  before update on public.memories
  for each row execute function public.reset_verification_on_edit();
