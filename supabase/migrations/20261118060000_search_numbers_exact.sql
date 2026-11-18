-- Search follow-up: words containing digits must match exactly (a year like 2026 must not also find 2025).
-- This replaces search_memories() with the same function as in 20261118050000_search.sql plus the digit rule.
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
