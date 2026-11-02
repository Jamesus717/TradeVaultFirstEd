-- One inventory instead of three lists. NOT yet applied to production.
-- See docs/INVENTORY-MIGRATION.md for the run order, checks and rollback.
--
-- Each row is a stack: the copies of one card a user holds in one variant,
-- condition and status. A user owning a Normal and a Reverse Holo has two
-- rows, as `user_cards` does today, so the key is the whole stack rather than
-- user + card.
--
-- Safe by design:
--   * user_cards, wishlist_cards and trade_listings are not changed or
--     emptied, except that trade_listings.condition also accepts two new
--     values. Conversations stay anchored to trade_listings.
--   * Triggers keep old and new in step both ways, so the live site keeps
--     working before and after this runs, and pages can move one at a time.
--   * The whole file is one transaction when applied, and the check at the
--     end raises (rolling everything back) if any row failed to carry over.
--
-- Prod differs from 000_user_cards.sql: it has no created_at column and 6 rows
-- have a null set_id, so nothing here reads created_at and set_id falls back
-- to the id prefix. That prefix equals set_id on every prod row (checked
-- 2026-11-02).

-- ── Table ───────────────────────────────────────────────────────

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null default 'pokemon',
  card_id text not null,
  set_id text,
  -- Free text so other games can bring their own printings. 'Any' is only for
  -- wants: wishlists have never recorded a variant.
  variant text not null,
  -- Null means not graded yet (every card carried over from user_cards has no
  -- recorded condition, and we will not guess one). On a want, the worst
  -- condition the user will accept; null means any.
  condition text check (condition in ('NM', 'LP', 'MP', 'HP', 'DMG')),
  status text not null check (status in ('keep', 'for_trade', 'want')),
  quantity integer not null default 1 check (quantity between 1 and 999),
  -- Display copies, so pages work before the catalog is filled.
  card_name text,
  set_name text,
  card_number text,
  image_url text,
  -- Wants.
  priority text check (priority in ('low', 'medium', 'high')),
  note text check (note is null or char_length(note) <= 200),
  -- For trade. Selling is decided but not built: listing_type and price are
  -- what a sale needs, and no payment columns exist on purpose.
  listing_type text check (listing_type in ('trade', 'sale', 'either')),
  price numeric(10,2) check (price is null or price > 0),
  currency text not null default 'GBP',
  trade_description text,
  postcode_prefix text,
  photo_url text,
  -- The condition as written on the old listing, when mapping lost detail.
  legacy_condition text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_stack_key
    unique nulls not distinct (user_id, game, card_id, variant, condition, status)
);

create index if not exists inventory_items_user_status_idx on public.inventory_items (user_id, status);
create index if not exists inventory_items_match_idx on public.inventory_items (game, card_id, status);

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

-- Which stack each listing draws from. Several listings can share a stack.
create table if not exists public.inventory_listing_links (
  listing_id uuid primary key references public.trade_listings (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade
);

create index if not exists inventory_listing_links_item_idx on public.inventory_listing_links (item_id);

alter table public.inventory_items enable row level security;
alter table public.inventory_listing_links enable row level security;

-- Same exposure as today: user_cards and wishlist_cards are both public read.
drop policy if exists "Inventory is publicly viewable" on public.inventory_items;
create policy "Inventory is publicly viewable"
on public.inventory_items
for select
using (true);

drop policy if exists "Inventory is insertable by owner" on public.inventory_items;
create policy "Inventory is insertable by owner"
on public.inventory_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Inventory is updatable by owner" on public.inventory_items;
create policy "Inventory is updatable by owner"
on public.inventory_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Inventory is deletable by owner" on public.inventory_items;
create policy "Inventory is deletable by owner"
on public.inventory_items
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Listing links are publicly viewable" on public.inventory_listing_links;
create policy "Listing links are publicly viewable"
on public.inventory_listing_links
for select
using (true);

-- Listings can now say Damaged, and spares with no recorded condition can be
-- listed honestly as Ungraded.
alter table public.trade_listings drop constraint if exists trade_listings_condition_check;
alter table public.trade_listings add constraint trade_listings_condition_check
  check (condition in ('Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged', 'Ungraded'));

-- ── Helpers ─────────────────────────────────────────────────────

create or replace function public.tb_condition_code(p_condition text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_condition
    when 'Mint' then 'NM'
    when 'Near Mint' then 'NM'
    when 'Lightly Played' then 'LP'
    when 'Moderately Played' then 'MP'
    when 'Heavily Played' then 'HP'
    when 'Damaged' then 'DMG'
  end;
$$;

create or replace function public.tb_condition_label(p_code text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_code
    when 'NM' then 'Near Mint'
    when 'LP' then 'Lightly Played'
    when 'MP' then 'Moderately Played'
    when 'HP' then 'Heavily Played'
    when 'DMG' then 'Damaged'
    else 'Ungraded'
  end;
$$;

create or replace function public.tb_set_from_card(p_card_id text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(split_part(p_card_id, '-', 1), '');
$$;

-- Set while a trigger is mirroring a change, so the mirror does not bounce back.
create or replace function public.tb_syncing()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(current_setting('tradebinder.sync', true), '') = 'on';
$$;

create or replace function public.tb_mark_syncing(p_on boolean default true)
returns void
language sql
set search_path = public, pg_temp
as $$
  select set_config('tradebinder.sync', case when p_on then 'on' else 'off' end, true);
$$;

revoke execute on function public.tb_mark_syncing(boolean) from anon, authenticated, public;

-- Adds a listing's copy to for_trade stock, taking it out of keep stock when
-- the seller already has it there, so one card is not counted as two.
create or replace function public.tb_stock_listing(l public.trade_listings)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  code text := public.tb_condition_code(l.condition);
  taken uuid;
  item uuid;
begin
  select id into taken
  from public.inventory_items
  where user_id = l.user_id and game = 'pokemon' and card_id = l.card_id
    and variant = l.variant and status = 'keep'
  order by (condition is null) desc, created_at
  limit 1
  for update;

  if taken is not null then
    update public.inventory_items set quantity = quantity - 1 where id = taken and quantity > 1;
    if not found then
      delete from public.inventory_items where id = taken;
    end if;
  end if;

  insert into public.inventory_items (
    user_id, card_id, set_id, variant, condition, status, quantity,
    card_name, set_name, card_number, image_url, listing_type, price,
    trade_description, postcode_prefix, photo_url, legacy_condition
  )
  values (
    l.user_id, l.card_id, coalesce(l.set_id, public.tb_set_from_card(l.card_id)), l.variant, code, 'for_trade', 1,
    l.card_name, l.set_name, l.card_number, l.card_image_url, l.listing_type, l.price,
    l.trade_description, l.postcode_prefix, l.image_url,
    case when l.condition = 'Mint' then l.condition end
  )
  on conflict on constraint inventory_items_stack_key
  do update set quantity = least(public.inventory_items.quantity + 1, 999)
  returning id into item;

  insert into public.inventory_listing_links (listing_id, item_id)
  values (l.id, item)
  on conflict (listing_id) do update set item_id = excluded.item_id;

  return item;
end;
$$;

revoke execute on function public.tb_stock_listing(public.trade_listings) from anon, authenticated, public;

-- ── Carry existing data over ────────────────────────────────────
-- Triggers are created after this, so the backfill mirrors nothing.

insert into public.inventory_items (user_id, card_id, set_id, variant, status, quantity)
select user_id, card_id, coalesce(set_id, public.tb_set_from_card(card_id)), variant, 'keep', 1
from public.user_cards
where owned
on conflict on constraint inventory_items_stack_key do nothing;

insert into public.inventory_items (
  user_id, card_id, set_id, variant, status, quantity,
  card_name, set_name, card_number, image_url, priority, note
)
select
  user_id, card_id, coalesce(set_id, public.tb_set_from_card(card_id)), 'Any', 'want', quantity,
  card_name, set_name, card_number, image_url, priority, note
from public.wishlist_cards
on conflict on constraint inventory_items_stack_key do nothing;

-- Sold listings are history, not stock.
do $$
declare
  l public.trade_listings;
begin
  for l in select * from public.trade_listings where is_active order by created_at loop
    perform public.tb_stock_listing(l);
  end loop;
end $$;

-- ── Old tables → inventory ──────────────────────────────────────

create or replace function public.on_user_card_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.tb_syncing() then
    return coalesce(new, old);
  end if;

  perform public.tb_mark_syncing();

  if tg_op <> 'INSERT' and (tg_op = 'DELETE' or (old.owned and not new.owned)) then
    delete from public.inventory_items
    where user_id = old.user_id and game = 'pokemon' and card_id = old.card_id
      and variant = old.variant and status = 'keep';
  end if;

  if tg_op <> 'DELETE' and new.owned and (tg_op = 'INSERT' or not old.owned) then
    insert into public.inventory_items (user_id, card_id, set_id, variant, status)
    select new.user_id, new.card_id, coalesce(new.set_id, public.tb_set_from_card(new.card_id)), new.variant, 'keep'
    where not exists (
      select 1 from public.inventory_items i
      where i.user_id = new.user_id and i.game = 'pokemon' and i.card_id = new.card_id
        and i.variant = new.variant and i.status in ('keep', 'for_trade')
    )
    on conflict on constraint inventory_items_stack_key do nothing;
  end if;

  perform public.tb_mark_syncing(false);
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_user_card_changed on public.user_cards;
create trigger on_user_card_changed
after insert or update or delete on public.user_cards
for each row execute function public.on_user_card_changed();

create or replace function public.on_wishlist_card_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.tb_syncing() then
    return coalesce(new, old);
  end if;

  perform public.tb_mark_syncing();

  if tg_op = 'DELETE' then
    delete from public.inventory_items
    where user_id = old.user_id and game = 'pokemon' and card_id = old.card_id and status = 'want';
  else
    insert into public.inventory_items (
      user_id, card_id, set_id, variant, status, quantity,
      card_name, set_name, card_number, image_url, priority, note
    )
    values (
      new.user_id, new.card_id, coalesce(new.set_id, public.tb_set_from_card(new.card_id)), 'Any', 'want', new.quantity,
      new.card_name, new.set_name, new.card_number, new.image_url, new.priority, new.note
    )
    on conflict on constraint inventory_items_stack_key
    do update set quantity = excluded.quantity, priority = excluded.priority, note = excluded.note;
  end if;

  perform public.tb_mark_syncing(false);
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_wishlist_card_changed on public.wishlist_cards;
create trigger on_wishlist_card_changed
after insert or update or delete on public.wishlist_cards
for each row execute function public.on_wishlist_card_changed();

-- Takes one copy out of the stack behind a listing. Sold: the copy has left.
-- Withdrawn (listing deleted): the copy goes back to keep. Sync stays on so a
-- sale never unticks anything in the old binder by itself.
create or replace function public.tb_unstock_listing(p_listing_id uuid, p_sold boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item public.inventory_items;
begin
  select i.* into item
  from public.inventory_listing_links k
  join public.inventory_items i on i.id = k.item_id
  where k.listing_id = p_listing_id
  for update of i;

  if item.id is null then
    return;
  end if;

  delete from public.inventory_listing_links where listing_id = p_listing_id;

  update public.inventory_items set quantity = quantity - 1 where id = item.id and quantity > 1;
  if not found then
    delete from public.inventory_items where id = item.id;
  end if;

  -- The user is already gone when this runs from an account delete's cascade.
  if not p_sold and exists (select 1 from auth.users u where u.id = item.user_id) then
    insert into public.inventory_items (
      user_id, game, card_id, set_id, variant, condition, status, card_name, set_name, card_number, image_url
    )
    values (
      item.user_id, item.game, item.card_id, item.set_id, item.variant, item.condition, 'keep',
      item.card_name, item.set_name, item.card_number, item.image_url
    )
    on conflict on constraint inventory_items_stack_key
    do update set quantity = least(public.inventory_items.quantity + 1, 999);
  end if;
end;
$$;

revoke execute on function public.tb_unstock_listing(uuid, boolean) from anon, authenticated, public;

create or replace function public.on_listing_stock_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.tb_syncing() then
    return coalesce(new, old);
  end if;

  perform public.tb_mark_syncing();

  if tg_op = 'INSERT' and coalesce(new.is_active, false) then
    perform public.tb_stock_listing(new);
  elsif tg_op = 'UPDATE' and coalesce(old.is_active, false) and not coalesce(new.is_active, false) then
    perform public.tb_unstock_listing(new.id, true);
  elsif tg_op = 'DELETE' then
    perform public.tb_unstock_listing(old.id, false);
  end if;

  perform public.tb_mark_syncing(false);
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_listing_stock_changed on public.trade_listings;
create trigger on_listing_stock_changed
after insert or update of is_active on public.trade_listings
for each row execute function public.on_listing_stock_changed();

-- Before delete: the link row cascades away with the listing.
drop trigger if exists on_listing_stock_removed on public.trade_listings;
create trigger on_listing_stock_removed
before delete on public.trade_listings
for each row execute function public.on_listing_stock_changed();

-- ── Inventory → old tables ──────────────────────────────────────

create or replace function public.on_inventory_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  was_owned boolean := tg_op <> 'INSERT' and old.status in ('keep', 'for_trade');
  is_owned boolean := tg_op <> 'DELETE' and new.status in ('keep', 'for_trade');
begin
  if public.tb_syncing() then
    return coalesce(new, old);
  end if;

  perform public.tb_mark_syncing();

  if is_owned and not exists (
    select 1 from public.user_cards u
    where u.user_id = new.user_id and u.card_id = new.card_id and u.variant = new.variant
  ) then
    insert into public.user_cards (user_id, card_id, set_id, variant, owned)
    values (new.user_id, new.card_id, new.set_id, new.variant, true);
  end if;

  if was_owned and not exists (
    select 1 from public.inventory_items i
    where i.user_id = old.user_id and i.game = old.game and i.card_id = old.card_id
      and i.variant = old.variant and i.status in ('keep', 'for_trade')
  ) then
    delete from public.user_cards
    where user_id = old.user_id and card_id = old.card_id and variant = old.variant;
  end if;

  if tg_op <> 'DELETE' and new.status = 'want' then
    insert into public.wishlist_cards (
      user_id, card_id, set_id, card_name, card_number, image_url, set_name, quantity, priority, note
    )
    values (
      new.user_id, new.card_id, new.set_id, coalesce(new.card_name, new.card_id), new.card_number,
      new.image_url, new.set_name, least(new.quantity, 99), coalesce(new.priority, 'medium'), new.note
    )
    on conflict (user_id, card_id) do update
    set quantity = excluded.quantity, priority = excluded.priority, note = excluded.note;
  end if;

  if tg_op <> 'INSERT' and old.status = 'want' and not exists (
    select 1 from public.inventory_items i
    where i.user_id = old.user_id and i.game = old.game and i.card_id = old.card_id and i.status = 'want'
  ) then
    delete from public.wishlist_cards where user_id = old.user_id and card_id = old.card_id;
  end if;

  perform public.tb_mark_syncing(false);
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_inventory_changed on public.inventory_items;
create trigger on_inventory_changed
after insert or update or delete on public.inventory_items
for each row execute function public.on_inventory_changed();

revoke execute on function
  public.on_user_card_changed(),
  public.on_wishlist_card_changed(),
  public.on_listing_stock_changed(),
  public.on_inventory_changed()
from anon, authenticated, public;

-- ── What the app calls ──────────────────────────────────────────

-- Quick add: adds to a stack, creating it if needed. Returns the stack.
create or replace function public.inventory_add(
  p_card_id text,
  p_status text,
  p_variant text,
  p_condition text default null,
  p_quantity integer default 1,
  p_set_id text default null,
  p_card_name text default null,
  p_set_name text default null,
  p_card_number text default null,
  p_image_url text default null
)
returns public.inventory_items
language plpgsql
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
  result public.inventory_items;
begin
  if actor is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity must be at least 1' using errcode = '22023';
  end if;

  insert into public.inventory_items (
    user_id, card_id, set_id, variant, condition, status, quantity,
    card_name, set_name, card_number, image_url
  )
  values (
    actor, p_card_id, coalesce(p_set_id, public.tb_set_from_card(p_card_id)), p_variant, p_condition,
    p_status, least(p_quantity, 999), p_card_name, p_set_name, p_card_number, p_image_url
  )
  on conflict on constraint inventory_items_stack_key
  do update set quantity = least(public.inventory_items.quantity + excluded.quantity, 999)
  returning * into result;

  return result;
end;
$$;

-- Moves copies between keep and for trade, splitting or merging stacks. Listing
-- something needs a condition, so a stack with none must be given one here.
create or replace function public.inventory_move(
  p_item_id uuid,
  p_status text,
  p_quantity integer default null,
  p_condition text default null
)
returns public.inventory_items
language plpgsql
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
  source public.inventory_items;
  moving integer;
  target_condition text;
  result public.inventory_items;
begin
  if p_status not in ('keep', 'for_trade') then
    raise exception 'can only move between keep and for trade' using errcode = '22023';
  end if;

  select * into source from public.inventory_items where id = p_item_id for update;

  if source.id is null or source.user_id is distinct from actor then
    raise exception 'that card is not yours' using errcode = '42501';
  end if;
  if source.status = 'want' then
    raise exception 'wants are not stock' using errcode = '22023';
  end if;
  if exists (select 1 from public.inventory_listing_links k where k.item_id = source.id) then
    raise exception 'this stack has a live listing; close the listing first' using errcode = '22023';
  end if;

  target_condition := coalesce(p_condition, source.condition);
  if p_status = 'for_trade' and target_condition is null then
    raise exception 'set a condition before offering this for trade' using errcode = '22023';
  end if;

  moving := coalesce(p_quantity, source.quantity);
  if moving < 1 or moving > source.quantity then
    raise exception 'you have % of this card', source.quantity using errcode = '22023';
  end if;

  if source.status = p_status and target_condition is not distinct from source.condition then
    return source;
  end if;

  if moving = source.quantity then
    delete from public.inventory_items where id = source.id;
  else
    update public.inventory_items set quantity = quantity - moving where id = source.id;
  end if;

  insert into public.inventory_items (
    user_id, game, card_id, set_id, variant, condition, status, quantity,
    card_name, set_name, card_number, image_url
  )
  values (
    source.user_id, source.game, source.card_id, source.set_id, source.variant, target_condition,
    p_status, moving, source.card_name, source.set_name, source.card_number, source.image_url
  )
  on conflict on constraint inventory_items_stack_key
  do update set quantity = least(public.inventory_items.quantity + excluded.quantity, 999)
  returning * into result;

  return result;
end;
$$;

grant execute on function public.inventory_add(text, text, text, text, integer, text, text, text, text, text) to authenticated;
grant execute on function public.inventory_move(uuid, text, integer, text) to authenticated;
revoke execute on function public.inventory_add(text, text, text, text, integer, text, text, text, text, text) from anon, public;
revoke execute on function public.inventory_move(uuid, text, integer, text) from anon, public;

-- ── Nothing left behind ─────────────────────────────────────────
-- Raises, undoing this whole file, if any old row has no inventory home.

do $$
declare
  missing_owned integer;
  missing_wants integer;
  missing_listings integer;
begin
  select count(*) into missing_owned
  from public.user_cards u
  where u.owned and not exists (
    select 1 from public.inventory_items i
    where i.user_id = u.user_id and i.card_id = u.card_id and i.variant = u.variant
      and i.status in ('keep', 'for_trade')
  );

  select count(*) into missing_wants
  from public.wishlist_cards w
  where not exists (
    select 1 from public.inventory_items i
    where i.user_id = w.user_id and i.card_id = w.card_id and i.status = 'want'
  );

  select count(*) into missing_listings
  from public.trade_listings l
  where l.is_active and not exists (
    select 1 from public.inventory_listing_links k where k.listing_id = l.id
  );

  if missing_owned + missing_wants + missing_listings > 0 then
    raise exception 'inventory backfill incomplete: % owned, % wants, % listings missing',
      missing_owned, missing_wants, missing_listings;
  end if;
end $$;
