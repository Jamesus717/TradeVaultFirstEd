-- Applied to the live project on 2026-10-18.
--
-- The signup form used to set the chosen username by updating the profile
-- right after auth.signUp. With email confirmation on there is no session at
-- that point, so RLS matched zero rows, no error came back, and every new
-- user kept the generated `user_xxxxxxxx` name.
--
-- The form now sends the username as user metadata, and this trigger uses it
-- when it is valid and free, falling back to the generated name otherwise
-- (e.g. Google sign-ins, or a name taken between the form's check and now).

create or replace function public.create_public_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  desired text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  display text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  chosen text := fallback;
begin
  if desired ~ '^[a-z0-9_]{3,30}$'
     and not exists (
       select 1 from public.public_profiles
       where username = desired or profile_slug = desired
     ) then
    chosen := desired;
  end if;

  insert into public.public_profiles (user_id, username, profile_slug, display_name)
  values (new.id, chosen, chosen, case when chosen = fallback then null else coalesce(display, chosen) end)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
