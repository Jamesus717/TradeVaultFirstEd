-- Card catalog: our own copy of sets and cards, so pages stop depending on a
-- live third-party API. NOT yet applied to production. See docs/CARD-DATA-PLAN.md.
--
-- `game` is part of every key so other TCGs can sit alongside Pokémon later.
-- Card and set ids stay the pokemontcg.io ids: every user row already uses
-- them, and Scrydex keeps them. Ids from other sources live in `source_ids`.
-- Filled by scripts/import-catalog.mjs with the service role; there are no
-- client write policies. Purely additive.

create table if not exists public.catalog_sets (
  game text not null default 'pokemon',
  id text not null,
  name text not null,
  series text,
  release_date date,
  printed_total integer,
  total integer,
  logo_url text,
  source text not null,
  source_ids jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (game, id)
);

create table if not exists public.catalog_cards (
  game text not null default 'pokemon',
  id text not null,
  set_id text not null,
  name text not null,
  number text not null,
  rarity text,
  image_small text,
  image_large text,
  source text not null,
  source_ids jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (game, id),
  foreign key (game, set_id) references public.catalog_sets (game, id) on delete cascade
);

create index if not exists catalog_cards_set_idx on public.catalog_cards (game, set_id);
create index if not exists catalog_cards_name_idx on public.catalog_cards (lower(name) text_pattern_ops);

alter table public.catalog_sets enable row level security;
alter table public.catalog_cards enable row level security;

-- Live since September but missing from the repo's history (010 never enabled
-- it), so a fresh project left the price cache writable by anyone. No-op on prod.
alter table public.card_prices enable row level security;

drop policy if exists "Catalog sets are public" on public.catalog_sets;
create policy "Catalog sets are public"
on public.catalog_sets
for select
using (true);

drop policy if exists "Catalog cards are public" on public.catalog_cards;
create policy "Catalog cards are public"
on public.catalog_cards
for select
using (true);
