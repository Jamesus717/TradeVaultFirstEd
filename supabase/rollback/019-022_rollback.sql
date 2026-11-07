-- Rollback for migrations 019 to 022. NOT a migration: run by hand, only if
-- they have to come out. See docs/INVENTORY-MIGRATION.md.
--
-- Puts the schema back to how it was before 019. user_cards, wishlist_cards,
-- trade_listings and conversations keep their rows. What is lost:
--   * everything only in the new tables: inventory copies, conditions and
--     statuses, the card catalog, shops and home shops
--   * the shop on a listing and the meet step on a conversation (the columns
--     021 added are dropped)
-- Two things stay on purpose:
--   * Row level security on card_prices (019). It is how prod already runs,
--     and turning it off would leave the price cache writable by anyone.
--   * Listings saved as Damaged or Ungraded. The old condition check cannot
--     take them, so the script stops instead of changing them. Decide what
--     they should become, update them, then run this again.
--
-- Safe to run twice: everything is "if exists".

begin;

do $$
declare
  newer_conditions integer;
begin
  select count(*) into newer_conditions
  from public.trade_listings
  where condition in ('Damaged', 'Ungraded');

  if newer_conditions > 0 then
    raise exception 'rollback stopped: % listings use Damaged or Ungraded, which the old check rejects. Update them first.',
      newer_conditions;
  end if;
end $$;

-- ── 022 matching ────────────────────────────────────────────────

drop function if exists public.start_match_conversation(uuid);
drop function if exists public.get_trade_matches(uuid);
drop function if exists public.tb_want_covers(text, text, text, text);
drop function if exists public.tb_tradable_items();
drop function if exists public.tb_condition_rank(text);

-- ── 021 shops ───────────────────────────────────────────────────

drop function if exists public.propose_meet(uuid, uuid, timestamptz);
drop function if exists public.respond_meet(uuid, boolean, uuid, timestamptz);
drop function if exists public.tb_open_conversation_for(uuid);
drop trigger if exists reset_conversation_meet on public.conversations;
drop function if exists public.reset_conversation_meet();

-- Back to the 016 version, before the meet columns it guards go.
create or replace function public.guard_conversation_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null or public.tb_internal() then
    return new;
  end if;

  if new.listing_id is distinct from old.listing_id
     or new.buyer_id is distinct from old.buyer_id
     or new.seller_id is distinct from old.seller_id
     or new.created_at is distinct from old.created_at then
    raise exception 'conversations cannot be reassigned' using errcode = '42501';
  end if;

  -- The one status change a user makes directly: an accepted trade is done.
  -- Accept / decline come from deciding an offer; cancelled comes from the
  -- seller deactivating the listing.
  if new.status is distinct from old.status
     and not (old.status = 'accepted' and new.status = 'completed') then
    raise exception 'conversation status cannot be changed that way' using errcode = '42501';
  end if;

  return new;
end;
$$;

alter table public.conversations drop constraint if exists conversations_meet_status_check;
alter table public.conversations
  drop column if exists meet_shop_id,
  drop column if exists meet_at,
  drop column if exists meet_proposed_by,
  drop column if exists meet_status;

drop index if exists public.trade_listings_shop_id_idx;
alter table public.trade_listings drop column if exists shop_id;

drop table if exists public.user_shops;
drop table if exists public.shops;

-- ── 020 inventory ───────────────────────────────────────────────

drop trigger if exists on_user_card_changed on public.user_cards;
drop trigger if exists on_wishlist_card_changed on public.wishlist_cards;
drop trigger if exists on_listing_stock_changed on public.trade_listings;
drop trigger if exists on_listing_stock_removed on public.trade_listings;

-- These return inventory rows, so they go before the table.
drop function if exists public.inventory_add(text, text, text, text, integer, text, text, text, text, text);
drop function if exists public.inventory_move(uuid, text, integer, text);

drop table if exists public.inventory_listing_links;
drop table if exists public.inventory_items;

drop function if exists public.on_inventory_changed();
drop function if exists public.on_listing_stock_changed();
drop function if exists public.on_wishlist_card_changed();
drop function if exists public.on_user_card_changed();
drop function if exists public.tb_unstock_listing(uuid, boolean);
drop function if exists public.tb_stock_listing(public.trade_listings);
drop function if exists public.tb_mark_syncing(boolean);
drop function if exists public.tb_syncing();
drop function if exists public.tb_set_from_card(text);
drop function if exists public.tb_condition_label(text);
drop function if exists public.tb_condition_code(text);

-- The condition check from 004, found by column as 020 does.
do $$
declare
  existing record;
begin
  for existing in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attname = 'condition'
    where con.conrelid = 'public.trade_listings'::regclass
      and con.contype = 'c'
      and con.conkey = array[att.attnum]
  loop
    execute format('alter table public.trade_listings drop constraint %I', existing.conname);
  end loop;
end $$;

alter table public.trade_listings add constraint trade_listings_condition_check
  check (condition in ('Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played'));

-- ── 019 catalog ─────────────────────────────────────────────────

drop table if exists public.catalog_cards;
drop table if exists public.catalog_sets;

commit;
