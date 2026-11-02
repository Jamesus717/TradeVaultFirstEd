-- wishlist_cards: cards a user is hunting for. NOT yet applied to production.
-- Public read (a wishlist is meant to be shared with traders), owner-only writes.

create table if not exists public.wishlist_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  set_id text,
  card_name text not null,
  card_number text,
  image_url text,
  set_name text,
  quantity integer not null default 1 check (quantity between 1 and 99),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, card_id)
);

create index if not exists wishlist_cards_user_id_idx on public.wishlist_cards (user_id);
create index if not exists wishlist_cards_card_id_idx on public.wishlist_cards (card_id);

alter table public.wishlist_cards enable row level security;

drop policy if exists "Wishlists are publicly viewable" on public.wishlist_cards;
create policy "Wishlists are publicly viewable"
on public.wishlist_cards
for select
using (true);

drop policy if exists "Wishlist cards are insertable by owner" on public.wishlist_cards;
create policy "Wishlist cards are insertable by owner"
on public.wishlist_cards
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Wishlist cards are updatable by owner" on public.wishlist_cards;
create policy "Wishlist cards are updatable by owner"
on public.wishlist_cards
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Wishlist cards are deletable by owner" on public.wishlist_cards;
create policy "Wishlist cards are deletable by owner"
on public.wishlist_cards
for delete
using ((select auth.uid()) = user_id);
