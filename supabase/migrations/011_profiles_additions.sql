insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  524288,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

alter table public.public_profiles
  drop constraint if exists username_length;
alter table public.public_profiles
  add constraint username_length
  check (char_length(username) >= 3 and char_length(username) <= 30);

alter table public.public_profiles
  drop constraint if exists username_format;
alter table public.public_profiles
  add constraint username_format
  check (username ~ '^[a-zA-Z0-9_]+$');

