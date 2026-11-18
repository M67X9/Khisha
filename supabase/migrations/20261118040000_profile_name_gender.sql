-- Personal touch: a display name and an optional gender on the profile.
-- Both are given by the person at sign-up (or later in the profile screen) and are never inferred.
-- Gender only changes the app's colours and the grammar of Arabic sentences. "unspecified" is a valid choice.

alter table public.profiles
  add column display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  add column gender text not null default 'unspecified' check (gender in ('male', 'female', 'unspecified'));

-- The person can edit these two fields (the existing grant already covers preferred_language).
grant update (display_name, gender) on public.profiles to authenticated;

-- Fill the profile from the sign-up form. Values are cleaned here because they come from the app.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_name text := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60), '');
  raw_gender text := new.raw_user_meta_data ->> 'gender';
begin
  insert into public.profiles (id, email, display_name, gender)
  values (
    new.id,
    new.email,
    raw_name,
    case when raw_gender in ('male', 'female') then raw_gender else 'unspecified' end
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
