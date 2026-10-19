-- user_cards: one row per card variant a user owns. The core "owned cards"
-- table behind binder, collection, trade and profile pages.
--
-- The live table was created by hand and never captured, so a fresh Supabase
-- project following "apply migrations in order" was broken. Numbered 000 so it
-- runs before 008/009, which update this table. Columns match what the app
-- reads/writes (app/binder/types.ts UserCardRow, app/binder/useBinder.ts).
-- Safe to run on the live project: everything is "if not exists" / idempotent.

create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  -- Null on legacy rows saved before set tracking (app treats null as the legacy set).
  set_id text,
  variant text not null,
  owned boolean not null default true,
  created_at timestamptz not null default now(),
  -- Matches the app's upsert onConflict: 'user_id,card_id,variant,set_id'.
  unique (user_id, card_id, variant, set_id)
);

create index if not exists user_cards_user_id_set_id_idx
  on public.user_cards (user_id, set_id);

alter table public.user_cards enable row level security;

-- Owner access, plus public read of owned rows (public profiles show collections).
-- Matches the live project's policies. Written with (select auth.uid()) per 007_rls_performance.
drop policy if exists "User cards are readable by owner" on public.user_cards;
create policy "User cards are readable by owner"
on public.user_cards
for select
using ((select auth.uid()) = user_id);

drop policy if exists "User cards are insertable by owner" on public.user_cards;
create policy "User cards are insertable by owner"
on public.user_cards
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "User cards are updatable by owner" on public.user_cards;
create policy "User cards are updatable by owner"
on public.user_cards
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "User cards are deletable by owner" on public.user_cards;
create policy "User cards are deletable by owner"
on public.user_cards
for delete
using ((select auth.uid()) = user_id);

drop policy if exists "Owned cards are publicly viewable" on public.user_cards;
create policy "Owned cards are publicly viewable"
on public.user_cards
for select
using (owned = true);
