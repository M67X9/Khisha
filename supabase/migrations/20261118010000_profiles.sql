-- M1: one profile row per user, created automatically when someone signs up.
-- Users can read their own row and change only their preferred language.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ar')),
  account_status text not null default 'active' check (account_status in ('active', 'suspended', 'deleted')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Column-level privileges: the app may read the row and edit only preferred_language.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (preferred_language) on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
