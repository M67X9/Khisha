-- Search (milestone M7).
-- A normalized search column makes Arabic, English and mixed text match: no diacritics or tatweel, one form of alef / yaa /
-- taa marbuta, and Arabic-Indic digits turned into 0-9. A trigram index handles substrings and typos.
-- Search is free: it never calls an AI model and never charges credits.

create extension if not exists pg_trgm with schema extensions;

create or replace function public.normalize_search(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(
      lower(
        -- remove Arabic diacritics (tashkeel, dagger alef) and tatweel
        regexp_replace(coalesce(input, ''), '[ً-ٰٟـ]', '', 'g')
      ),
      -- Arabic-Indic and Persian digits, alef variants, alef maqsura, taa marbuta, hamza on waw / yaa
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹أإآٱىةؤئ',
      '01234567890123456789اااايهوي'
    ),
    '\s+', ' ', 'g'
  ));
$$;

create or replace function public.memories_set_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := public.normalize_search(concat_ws(' ',
    new.title,
    new.notes,
    new.extracted_text,
    new.structured_fields ->> 'merchant',
    new.category,
    new.document_date::text,
    new.event_date::text
  ));
  return new;
end;
$$;

create trigger memories_search_text
  before insert or update of title, notes, extracted_text, structured_fields, category, document_date, event_date
  on public.memories
  for each row execute function public.memories_set_search_text();

-- Fill in the column for memories that already exist.
update public.memories set title = title;

create index memories_search_trgm_idx on public.memories using gin (search_text extensions.gin_trgm_ops);
create index memories_owner_list_idx on public.memories (owner_id, created_at desc) where deleted_at is null and status = 'confirmed';

-- Every word typed must match: as part of a word in the memory, or closely enough to forgive a typo.
-- Runs as the caller, so row level security keeps it to their own memories.
create or replace function public.search_memories(
  q text,
  p_category text default null,
  p_from date default null,
  p_to date default null,
  p_limit int default 50
)
returns table (
  id uuid,
  title text,
  category text,
  structured_fields jsonb,
  document_date date,
  created_at timestamptz,
  verification text,
  score real
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  normalized text := public.normalize_search(left(coalesce(q, ''), 200));
  tokens text[] := regexp_split_to_array(normalized, ' ');
begin
  if normalized = '' then
    return query
      select m.id, m.title, m.category, m.structured_fields, m.document_date, m.created_at, m.verification, 0::real
      from public.memories m
      where m.deleted_at is null and m.status = 'confirmed'
        and (p_category is null or m.category = p_category)
        and (p_from is null or coalesce(m.document_date, m.created_at::date) >= p_from)
        and (p_to is null or coalesce(m.document_date, m.created_at::date) <= p_to)
      order by m.created_at desc
      limit least(greatest(p_limit, 1), 100);
    return;
  end if;

  return query
    select m.id, m.title, m.category, m.structured_fields, m.document_date, m.created_at, m.verification,
           (select coalesce(sum(extensions.word_similarity(tok, m.search_text)), 0) from unnest(tokens) as tok)::real
           + (case when m.search_text like '%' || normalized || '%' then 1 else 0 end)::real
           + (case when public.normalize_search(m.title) like '%' || normalized || '%' then 1 else 0 end)::real as score
    from public.memories m
    where m.deleted_at is null and m.status = 'confirmed'
      and (p_category is null or m.category = p_category)
      and (p_from is null or coalesce(m.document_date, m.created_at::date) >= p_from)
      and (p_to is null or coalesce(m.document_date, m.created_at::date) <= p_to)
      and not exists (
        select 1 from unnest(tokens) as tok
        where not (
          m.search_text like '%' || tok || '%'
          or (char_length(tok) >= 4 and tok !~ '[0-9]' and extensions.word_similarity(tok, m.search_text) >= 0.5)
        )
      )
    order by score desc, m.created_at desc
    limit least(greatest(p_limit, 1), 100);
end;
$$;

revoke all on function public.search_memories(text, text, date, date, int) from public, anon;
grant execute on function public.search_memories(text, text, date, date, int) to authenticated;
