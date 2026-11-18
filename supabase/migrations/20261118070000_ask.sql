-- Ask AI with sources (milestone M8).
--   conversations     one chat
--   messages          turns in a chat (written by the `ask` Edge Function only)
--   message_sources   which saved memories an answer used, so each answer shows clickable sources
-- People can read their own chats and delete them. They cannot write messages or sources themselves.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_owner_idx on public.conversations (owner_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  answer_kind text check (answer_kind in ('personal', 'general', 'mixed', 'none')),
  credit_ledger_id uuid, -- filled in once credits exist (milestone M10)
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_owner_day_idx on public.messages (owner_id, created_at desc) where role = 'user';

create table public.message_sources (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  memory_id uuid not null references public.memories (id) on delete cascade,
  evidence_ids uuid[] not null default '{}',
  rank int not null default 0
);
create index message_sources_message_idx on public.message_sources (message_id, rank);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_sources enable row level security;

create policy "conversations: read own" on public.conversations for select to authenticated using (owner_id = (select auth.uid()));
create policy "conversations: delete own" on public.conversations for delete to authenticated using (owner_id = (select auth.uid()));
create policy "messages: read own" on public.messages for select to authenticated using (owner_id = (select auth.uid()));
create policy "message_sources: read own" on public.message_sources for select to authenticated using (owner_id = (select auth.uid()));

-- Which of the person's saved memories might answer a question? Looser than search: any word may match.
-- Only the best few are sent to the AI, never the whole library. Runs as the caller, so RLS keeps it to their own.
create or replace function public.retrieve_memories(q text, p_limit int default 6)
returns table (id uuid, score real)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  stop text[] := array[
    'the','and','for','how','much','what','when','where','which','who','was','were','did','does','are','you','your','with','from','that','this','have','has','had','can','could','about','tell','show','find','get','all','any','has','not','but',
    'كم','ما','ماذا','متى','اين','أين','من','في','على','عن','هل','هو','هي','كان','كانت','لي','لدي','عندي','الى','إلى','هذا','هذه','ذلك','التي','الذي'
  ];
  tokens text[];
begin
  select coalesce(array_agg(distinct tok), '{}') into tokens
  from unnest(regexp_split_to_array(public.normalize_search(left(coalesce(q, ''), 300)), '[^[:alnum:]]+')) as tok
  where char_length(tok) >= 3 and not (public.normalize_search(tok) = any (select public.normalize_search(s) from unnest(stop) s));

  if cardinality(tokens) = 0 then
    return;
  end if;

  return query
    select m.id,
           (select coalesce(sum(case
                    when m.search_text like '%' || tok || '%' then 1.0
                    when tok !~ '[0-9]' and char_length(tok) >= 4 and extensions.word_similarity(tok, m.search_text) >= 0.5 then 0.6
                    else 0 end), 0)
            from unnest(tokens) as tok)::real as score
    from public.memories m
    where m.deleted_at is null and m.status = 'confirmed'
    order by score desc, m.created_at desc
    limit least(greatest(p_limit, 1), 10);
end;
$$;

revoke all on function public.retrieve_memories(text, int) from public, anon;
grant execute on function public.retrieve_memories(text, int) to authenticated;
