-- Row level security test for the memory tables (milestone M3).
-- Run it against the project (Supabase SQL editor, `supabase db query`, or the MCP execute_sql tool).
-- It creates two fake users, checks what each can and cannot do, then ENDS WITH AN ERROR ON PURPOSE so that
-- everything is rolled back and nothing is left behind. The error message is the report: read it.
-- Expected report: every line says "OK".

do $$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  m1 uuid;
  vid uuid;
  n int;
  v text;
  report text := '';
begin
  insert into auth.users (id, email) values (u1, 'rls-a@example.invalid'), (u2, 'rls-b@example.invalid');

  -- user 1 creates a manual memory
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.memories (title, category) values ('A private receipt', 'receipt') returning id into m1;
  select count(*) into n from public.memories;
  report := report || format(E'\n%s u1 sees own memory (%s)', case when n = 1 then 'OK' else 'FAIL' end, n);

  -- user 2 cannot read or change it
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.memories;
  report := report || format(E'\n%s u2 sees none of u1''s memories (%s)', case when n = 0 then 'OK' else 'FAIL' end, n);
  update public.memories set title = 'hacked' where id = m1;
  get diagnostics n = row_count;
  report := report || format(E'\n%s u2 cannot update u1''s memory (rows changed: %s)', case when n = 0 then 'OK' else 'FAIL' end, n);
  begin
    insert into public.memories (title, owner_id) values ('x', u1);
    report := report || E'\nFAIL u2 could insert a memory owned by u1';
  exception when others then
    report := report || E'\nOK u2 cannot insert a memory for u1';
  end;
  begin
    insert into public.memories (title, source_type) values ('x', 'pdf');
    report := report || E'\nFAIL u2 could insert a non-manual memory';
  exception when others then
    report := report || E'\nOK a person cannot insert non-manual memories';
  end;
  begin
    delete from public.memories where id = m1;
    get diagnostics n = row_count;
    report := report || format(E'\n%s u2 delete changes nothing (rows: %s)', case when n = 0 then 'OK' else 'FAIL' end, n);
  exception when others then
    report := report || E'\nOK u2 cannot delete memories';
  end;

  -- user 1 limits
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.memories set verification = 'verified' where id = m1;
    report := report || E'\nFAIL u1 could mark own memory verified';
  exception when others then
    report := report || E'\nOK u1 cannot set verification';
  end;
  begin
    delete from public.memories where id = m1;
    report := report || E'\nFAIL u1 could hard-delete';
  exception when others then
    report := report || E'\nOK u1 cannot hard-delete (soft delete only)';
  end;
  update public.memories set deleted_at = now() where id = m1;
  get diagnostics n = row_count;
  report := report || format(E'\n%s u1 can soft-delete own memory (rows: %s)', case when n = 1 then 'OK' else 'FAIL' end, n);

  -- verified status is dropped when a person edits figures by hand
  reset role;
  insert into public.memories (owner_id, title, verification, structured_fields)
    values (u1, 'Verified receipt', 'verified', '{"amount": 10}') returning id into vid;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.memories set structured_fields = '{"amount": 99}' where id = vid;
  reset role;
  select verification into v from public.memories where id = vid;
  report := report || format(E'\n%s editing a verified amount by hand resets it to unverified (now: %s)', case when v = 'unverified' then 'OK' else 'FAIL' end, v);

  -- signed-out visitors (anon) get nothing
  set local role anon;
  begin
    select count(*) into n from public.memories;
    report := report || format(E'\n%s anon can read memories (%s)', case when n = 0 then 'OK' else 'FAIL' end, n);
  exception when others then
    report := report || E'\nOK anon cannot read memories';
  end;
  reset role;

  raise exception E'RLS_TEST_REPORT%', report;
end $$;
