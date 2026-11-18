-- M0: a one-row table the `health` Edge Function reads to prove the database is reachable.
-- Row Level Security is on with no policies, so the app (anon/authenticated roles) cannot read it.
-- Only the service role, used by Edge Functions, can.
create table public.app_health (
  id int primary key,
  note text not null
);

insert into public.app_health (id, note) values (1, 'ok');

alter table public.app_health enable row level security;
