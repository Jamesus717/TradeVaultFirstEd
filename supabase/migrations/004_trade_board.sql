create table if not exists public.trade_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  card_name text not null,
  set_name text not null,
  set_id text not null,
  card_number text not null,
  variant text not null check (variant in ('Normal', 'Reverse Holo')),
  condition text not null check (condition in ('Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played')),
  listing_type text not null check (listing_type in ('trade', 'sale', 'either')),
  price numeric(10,2),
  trade_description text,
  postcode_prefix text,
  image_url text,
  card_image_url text,
  created_at timestamptz default now(),
  is_active boolean default true
);

create index if not exists trade_listings_active_idx on public.trade_listings (is_active);
create index if not exists trade_listings_set_id_idx on public.trade_listings (set_id);
create index if not exists trade_listings_user_id_idx on public.trade_listings (user_id);
create index if not exists trade_listings_created_at_idx on public.trade_listings (created_at desc);

create table if not exists public.trade_interests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.trade_listings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  message text,
  created_at timestamptz default now(),
  unique(listing_id, user_id)
);

create index if not exists trade_interests_listing_id_idx on public.trade_interests (listing_id);
create index if not exists trade_interests_user_id_idx on public.trade_interests (user_id);

alter table public.trade_listings enable row level security;
alter table public.trade_interests enable row level security;

drop policy if exists "Anyone can view active listings" on public.trade_listings;
create policy "Anyone can view active listings"
on public.trade_listings
for select
using (is_active = true);

drop policy if exists "Users manage own listings" on public.trade_listings;
create policy "Users manage own listings"
on public.trade_listings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own interests" on public.trade_interests;
create policy "Users manage own interests"
on public.trade_interests
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Listing owners see interests" on public.trade_interests;
create policy "Listing owners see interests"
on public.trade_interests
for select
using (
  exists (
    select 1
    from public.trade_listings l
    where l.id = listing_id
      and l.user_id = auth.uid()
  )
);

