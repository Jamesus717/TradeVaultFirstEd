-- Two-way matching for the home page. NOT yet applied to production.
-- Needs 020 and 021.
--
-- get_trade_matches returns one row per card that could move between the
-- signed-in user and another trader, in either direction. lib/matching.ts
-- groups the rows by trader and ranks them.
--
-- What counts as tradable: everything for trade, plus spares, meaning every
-- copy of a keep stack beyond the first ("duplicates become trade stock").
-- A want names a worst acceptable condition; an ungraded card is shown rather
-- than hidden, because most of today's collection has no condition yet, and
-- the row says so.

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
  want_priority text
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
    coalesce(m.image_url, c.image_small), m.variant, m.condition, m.tradable, m.is_spare, m.want_priority
  from matches m
  left join public.public_profiles p on p.user_id = m.trader_id
  left join public.catalog_cards c on c.game = m.game and c.id = m.card_id
  left join public.catalog_sets s on s.game = m.game and s.id = m.set_id
  where p_shop_id is null or m.trader_id in (select user_id from scoped_traders);
$$;

revoke execute on function public.get_trade_matches(uuid) from anon, public;
grant execute on function public.get_trade_matches(uuid) to authenticated;

-- Starting a trade from a match. Conversations hang off a listing, and spares
-- have none, so this makes one when needed. Only ever on stock the owner put up
-- for trade or holds as a spare, and the listing is plain trade with no price.
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
begin
  if actor is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

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

  select l.id into listing
  from public.inventory_listing_links k
  join public.trade_listings l on l.id = k.listing_id
  where k.item_id = item.id and l.is_active
  order by l.created_at
  limit 1;

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

  select c.id into conversation
  from public.conversations c
  where c.listing_id = listing and c.buyer_id = actor;

  if conversation is null then
    insert into public.conversations (listing_id, buyer_id, seller_id)
    values (listing, actor, item.user_id)
    returning id into conversation;
  end if;

  return conversation;
end;
$$;

revoke execute on function public.start_match_conversation(uuid) from anon, public;
grant execute on function public.start_match_conversation(uuid) to authenticated;
