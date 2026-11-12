-- Two-way matching for the home page. NOT yet applied to production.
-- Needs 020 and 021.
--
-- get_trade_matches returns one row per card that could move between the
-- signed-in user and another trader, in either direction. lib/matching.ts
-- groups the rows by trader and ranks them.
--
-- Also (decisions of 2026-11-08 on review findings 5 and 6):
--   * Starting a trade from a match is limited per rolling 24 hours. The limit
--     lives in plan_limits, so a paid tier is one row. Free is 10.
--   * One match chat per person per listing.
--   * Owners can turn match requests off (public_profiles.allow_match_requests).
--   * postcode_prefix on inventory_items is readable by its owner only, and a
--     shop's map position is not public.
--
-- What counts as tradable: everything for trade, plus spares, meaning every
-- copy of a keep stack beyond the first ("duplicates become trade stock").
-- A want names a worst acceptable condition; an ungraded card is shown rather
-- than hidden, because most of today's collection has no condition yet, and
-- the row says so.

begin;

-- ── Owner opt-out ───────────────────────────────────────────────
-- On by default. Public, so the app can hide "Start trade" on their matches.

alter table public.public_profiles
  add column if not exists allow_match_requests boolean not null default true;

create or replace function public.tb_condition_rank(p_code text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_code when 'NM' then 5 when 'LP' then 4 when 'MP' then 3 when 'HP' then 2 when 'DMG' then 1 end;
$$;

-- Copies of each stack on offer to other traders.
create or replace function public.tb_tradable_items()
returns table (
  id uuid,
  user_id uuid,
  game text,
  card_id text,
  set_id text,
  variant text,
  condition text,
  tradable integer,
  is_spare boolean,
  card_name text,
  set_name text,
  card_number text,
  image_url text
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    i.id, i.user_id, i.game, i.card_id, i.set_id, i.variant, i.condition,
    case when i.status = 'for_trade' then i.quantity else i.quantity - 1 end,
    i.status = 'keep',
    i.card_name, i.set_name, i.card_number, i.image_url
  from public.inventory_items i
  where i.status = 'for_trade' or (i.status = 'keep' and i.quantity > 1);
$$;

create or replace function public.tb_want_covers(
  p_want_variant text,
  p_want_condition text,
  p_variant text,
  p_condition text
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select (p_want_variant = 'Any' or p_want_variant = p_variant)
    and (
      p_want_condition is null
      or p_condition is null
      or public.tb_condition_rank(p_condition) >= public.tb_condition_rank(p_want_condition)
    );
$$;

create or replace function public.get_trade_matches(p_shop_id uuid default null)
returns table (
  trader_id uuid,
  username text,
  display_name text,
  direction text,
  item_id uuid,
  card_id text,
  set_id text,
  card_name text,
  set_name text,
  card_number text,
  image_url text,
  variant text,
  condition text,
  tradable integer,
  is_spare boolean,
  want_priority text,
  accepts_requests boolean
)
language sql
stable
set search_path = public, pg_temp
as $$
  with me as (
    select (select auth.uid()) as id
  ),
  scoped_traders as (
    select us.user_id from public.user_shops us where us.shop_id = p_shop_id
  ),
  matches as (
    -- They have it, I want it.
    select t.user_id as trader_id, 'they_have'::text as direction, t.*, w.priority as want_priority
    from me
    join public.inventory_items w on w.user_id = me.id and w.status = 'want'
    join public.tb_tradable_items() t
      on t.game = w.game and t.card_id = w.card_id and t.user_id <> me.id
      and public.tb_want_covers(w.variant, w.condition, t.variant, t.condition)
    union all
    -- I have it, they want it.
    select w.user_id, 'i_have', t.*, w.priority
    from me
    join public.tb_tradable_items() t on t.user_id = me.id
    join public.inventory_items w
      on w.game = t.game and w.card_id = t.card_id and w.status = 'want' and w.user_id <> me.id
      and public.tb_want_covers(w.variant, w.condition, t.variant, t.condition)
  )
  select
    m.trader_id, p.username, p.display_name, m.direction, m.id, m.card_id, m.set_id,
    coalesce(m.card_name, c.name), coalesce(m.set_name, s.name), coalesce(m.card_number, c.number),
    coalesce(m.image_url, c.image_small), m.variant, m.condition, m.tradable, m.is_spare, m.want_priority,
    coalesce(p.allow_match_requests, true)
  from matches m
  left join public.public_profiles p on p.user_id = m.trader_id
  left join public.catalog_cards c on c.game = m.game and c.id = m.card_id
  left join public.catalog_sets s on s.game = m.game and s.id = m.set_id
  where p_shop_id is null or m.trader_id in (select user_id from scoped_traders);
$$;

revoke execute on function public.get_trade_matches(uuid) from anon, public;
grant execute on function public.get_trade_matches(uuid) to authenticated;

-- ── Daily match limit ───────────────────────────────────────────
-- The limit is data, not code: a paid tier is one row here plus a row in
-- user_plans. Anyone without a user_plans row is on 'free'.

create table if not exists public.plan_limits (
  plan text primary key,
  match_daily_limit integer not null check (match_daily_limit >= 0)
);

insert into public.plan_limits (plan, match_daily_limit)
values ('free', 10)
on conflict (plan) do nothing;

alter table public.plan_limits enable row level security;

drop policy if exists "Plan limits are public" on public.plan_limits;
create policy "Plan limits are public"
on public.plan_limits
for select
using (true);

-- Set by billing (service role) once paid tiers exist. No client writes.
create table if not exists public.user_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' references public.plan_limits (plan),
  updated_at timestamptz not null default now()
);

alter table public.user_plans enable row level security;

drop policy if exists "Users see their own plan" on public.user_plans;
create policy "Users see their own plan"
on public.user_plans
for select
to authenticated
using ((select auth.uid()) = user_id);

-- One row per match chat started. Counts toward the limit and stops a second
-- chat on the same listing. Written only by start_match_conversation.
create table if not exists public.match_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid references public.inventory_items (id) on delete set null,
  listing_id uuid references public.trade_listings (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint match_requests_one_per_listing unique (user_id, listing_id)
);

create index if not exists match_requests_user_created_idx on public.match_requests (user_id, created_at desc);

alter table public.match_requests enable row level security;

drop policy if exists "Users see their own match requests" on public.match_requests;
create policy "Users see their own match requests"
on public.match_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.tb_match_daily_limit(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select l.match_daily_limit
     from public.user_plans u
     join public.plan_limits l on l.plan = u.plan
     where u.user_id = p_user),
    (select l.match_daily_limit from public.plan_limits l where l.plan = 'free'),
    0
  );
$$;

revoke execute on function public.tb_match_daily_limit(uuid) from anon, authenticated, public;

-- What the signed-in user has left today, for the home page.
create or replace function public.get_match_allowance()
returns table (daily_limit integer, used integer, resets_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (select (select auth.uid()) as id),
  recent as (
    select r.created_at
    from me join public.match_requests r on r.user_id = me.id
    where r.created_at > now() - interval '24 hours'
  )
  select
    public.tb_match_daily_limit(me.id),
    (select count(*)::integer from recent),
    (select min(recent.created_at) + interval '24 hours' from recent)
  from me
  where me.id is not null;
$$;

revoke execute on function public.get_match_allowance() from anon, public;
grant execute on function public.get_match_allowance() to authenticated;

-- Starting a trade from a match. Conversations hang off a listing, and spares
-- have none, so this makes one when needed. Only ever on stock the owner put up
-- for trade or holds as a spare, and the listing is plain trade with no price.
-- Refuses when the owner has match requests off, when the caller already has a
-- chat about this card, and past the caller's daily limit.
create or replace function public.start_match_conversation(p_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
  item public.inventory_items;
  listing uuid;
  conversation uuid;
  daily_limit integer;
  used integer;
  oldest timestamptz;
begin
  if actor is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  -- One start at a time per user, so two quick taps cannot both slip under
  -- the limit.
  perform pg_advisory_xact_lock(hashtext('tb_match:' || actor::text));

  select i.* into item
  from public.inventory_items i
  where i.id = p_item_id and (i.status = 'for_trade' or (i.status = 'keep' and i.quantity > 1))
  for update of i;

  if item.id is null then
    raise exception 'that card is no longer available' using errcode = '22023';
  end if;
  if item.user_id = actor then
    raise exception 'that card is yours' using errcode = '22023';
  end if;

  if not coalesce(
    (select p.allow_match_requests from public.public_profiles p where p.user_id = item.user_id),
    true
  ) then
    raise exception 'this trader is not taking match requests' using errcode = '42501';
  end if;

  select l.id into listing
  from public.inventory_listing_links k
  join public.trade_listings l on l.id = k.listing_id
  where k.item_id = item.id and l.is_active
  order by l.created_at
  limit 1;

  -- One chat per person per card: an earlier match on this stack or its
  -- listing, or any chat already open on the listing. DETAIL names the chat
  -- to open instead.
  if exists (
    select 1 from public.match_requests r
    where r.user_id = actor and (r.item_id = item.id or r.listing_id = listing)
  ) or exists (
    select 1 from public.conversations c where c.listing_id = listing and c.buyer_id = actor
  ) then
    select coalesce(
      (select r.conversation_id from public.match_requests r
       where r.user_id = actor and (r.item_id = item.id or r.listing_id = listing)
       order by r.created_at limit 1),
      (select c.id from public.conversations c
       where c.listing_id = listing and c.buyer_id = actor
       order by c.created_at limit 1)
    ) into conversation;
    raise exception 'you already have a chat about this card'
      using errcode = '23505', detail = coalesce(conversation::text, '');
  end if;

  daily_limit := public.tb_match_daily_limit(actor);
  select count(*), min(r.created_at) into used, oldest
  from public.match_requests r
  where r.user_id = actor and r.created_at > now() - interval '24 hours';

  if used >= daily_limit then
    raise exception 'Daily match limit reached, resets in % h',
      greatest(1, ceil(extract(epoch from (coalesce(oldest, now()) + interval '24 hours' - now())) / 3600))::integer
      using errcode = '54000', hint = 'match_limit';
  end if;

  if listing is null then
    perform public.tb_mark_syncing();

    insert into public.trade_listings (
      user_id, card_id, card_name, set_name, set_id, card_number, variant, condition,
      listing_type, trade_description, card_image_url
    )
    values (
      item.user_id, item.card_id, coalesce(item.card_name, item.card_id), coalesce(item.set_name, ''),
      coalesce(item.set_id, public.tb_set_from_card(item.card_id), ''), coalesce(item.card_number, ''),
      item.variant, public.tb_condition_label(item.condition), 'trade',
      case when item.status = 'keep' then 'Spare copy' end, item.image_url
    )
    returning id into listing;

    insert into public.inventory_listing_links (listing_id, item_id) values (listing, item.id);

    perform public.tb_mark_syncing(false);
  end if;

  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (listing, actor, item.user_id)
  returning id into conversation;

  insert into public.match_requests (user_id, item_id, listing_id, conversation_id)
  values (actor, item.id, listing, conversation);

  return conversation;
end;
$$;

revoke execute on function public.start_match_conversation(uuid) from anon, public;
grant execute on function public.start_match_conversation(uuid) to authenticated;

-- ── Privacy ─────────────────────────────────────────────────────
-- Everyone can still read the card, set, condition, quantity, price, photo
-- and wants on inventory_items. postcode_prefix is left out of the column
-- grant, so only the owner sees it, through my_inventory_postcodes().

revoke select on public.inventory_items from anon, authenticated;
grant select (
  id, user_id, game, card_id, set_id, variant, condition, status, quantity,
  card_name, set_name, card_number, image_url, priority, note, listing_type,
  price, currency, trade_description, photo_url, legacy_condition, created_at, updated_at
) on public.inventory_items to anon, authenticated;

-- These two read and return whole rows, which the column grant above no
-- longer allows a signed-in user. Both already act only on the caller's rows.
alter function public.inventory_add(text, text, text, text, integer, text, text, text, text, text) security definer;
alter function public.inventory_move(uuid, text, integer, text) security definer;

create or replace function public.my_inventory_postcodes()
returns table (item_id uuid, postcode_prefix text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, i.postcode_prefix
  from public.inventory_items i
  where i.user_id = (select auth.uid()) and i.postcode_prefix is not null;
$$;

revoke execute on function public.my_inventory_postcodes() from anon, public;
grant execute on function public.my_inventory_postcodes() to authenticated;

-- Home shops (user_shops) say which shop a trader uses, which gives a town.
-- A shop's map position is not readable by anyone, so no finer location
-- comes with it.
revoke select on public.shops from anon, authenticated;
grant select (
  id, slug, name, description, address, town, postcode_prefix, website,
  opening_hours, games, status, featured_until, created_at, updated_at
) on public.shops to anon, authenticated;

commit;
