-- Applied to the live project on 2026-10-18.
--
-- 1. Signup was broken. 011 added `username_format` (letters, digits, `_`),
--    but the new-user trigger from 001 still generated `user-xxxxxxxx`. The
--    hyphen failed the check, so every auth.users insert rolled back and no
--    one could sign up after 011 went in.
--
-- 2. The trade board uploads listing photos to a `trade-images` bucket that
--    no migration ever created, so every photo upload failed.
--
-- 3. `rls_auto_enable()` is a SECURITY DEFINER helper that anon could call
--    through /rest/v1/rpc. It is not used by the app.

create or replace function public.create_public_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.public_profiles (user_id, username, profile_slug, display_name)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 8),
    'user_' || substr(replace(new.id::text, '-', ''), 1, 8),
    null
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-images', 'trade-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "Trade images are publicly accessible" on storage.objects;
create policy "Trade images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'trade-images');

drop policy if exists "Users can upload their own trade images" on storage.objects;
create policy "Users can upload their own trade images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'trade-images' and (select auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own trade images" on storage.objects;
create policy "Users can delete their own trade images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'trade-images' and (select auth.uid())::text = (storage.foldername(name))[1]);

do $$
begin
  revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
exception
  when undefined_function then null;
end $$;
