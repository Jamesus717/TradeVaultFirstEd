create table if not exists public.public_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text,
  profile_slug text not null unique,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.public_profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.public_profiles;
create policy "Public profiles are viewable by everyone"
on public.public_profiles
for select
using (true);

drop policy if exists "Users can insert their own profile" on public.public_profiles;
create policy "Users can insert their own profile"
on public.public_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.public_profiles;
create policy "Users can update their own profile"
on public.public_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_public_profiles_updated_at on public.public_profiles;
create trigger set_public_profiles_updated_at
before update on public.public_profiles
for each row
execute function public.set_updated_at();

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
    'user-' || substr(new.id::text, 1, 8),
    'user-' || substr(new.id::text, 1, 8),
    null
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_public_profile on auth.users;
create trigger on_auth_user_created_public_profile
after insert on auth.users
for each row
execute function public.create_public_profile_for_new_user();

