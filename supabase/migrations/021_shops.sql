-- Shops: the money product. Shop table, home shops, listing at a shop and the
-- "meet at shop" step in a trade. NOT yet applied to production.
--
-- No shops are seeded: none have been spoken to. Rows are added by hand with
-- status 'active' once a shop agrees. Only `active` shops are public. There are
-- no client write policies.

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null,
  description text,
  address text,
  town text,
  postcode_prefix text,
  lat numeric(8,5),
  lng numeric(8,5),
  website text,
  opening_hours text,
  games text[] not null default array['pokemon'],
  status text not null default 'draft' check (status in ('draft', 'active', 'hidden')),
  -- Shops pay to be registered. Billing is not built; this is what it will set.
  featured_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shops_town_idx on public.shops (lower(town));
create index if not exists shops_postcode_idx on public.shops (postcode_prefix);

drop trigger if exists set_shops_updated_at on public.shops;
create trigger set_shops_updated_at
before update on public.shops
for each row execute function public.set_updated_at();

alter table public.shops enable row level security;

drop policy if exists "Active shops are public" on public.shops;
create policy "Active shops are public"
on public.shops
for select
using (status = 'active');

-- The shops a trader uses, for "traders at this shop" and the home filter.
create table if not exists public.user_shops (
  user_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

create index if not exists user_shops_shop_idx on public.user_shops (shop_id);

alter table public.user_shops enable row level security;

drop policy if exists "Home shops are publicly viewable" on public.user_shops;
create policy "Home shops are publicly viewable"
on public.user_shops
for select
using (true);

drop policy if exists "Users add their own home shops" on public.user_shops;
create policy "Users add their own home shops"
on public.user_shops
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users remove their own home shops" on public.user_shops;
create policy "Users remove their own home shops"
on public.user_shops
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- A listing can name the shop the seller will meet at.
alter table public.trade_listings
  add column if not exists shop_id uuid references public.shops (id) on delete set null;

create index if not exists trade_listings_shop_id_idx on public.trade_listings (shop_id);

-- ── Meet at shop ────────────────────────────────────────────────

alter table public.conversations
  add column if not exists meet_shop_id uuid references public.shops (id) on delete set null,
  add column if not exists meet_at timestamptz,
  add column if not exists meet_proposed_by uuid references auth.users (id) on delete set null,
  add column if not exists meet_status text not null default 'none';

alter table public.conversations drop constraint if exists conversations_meet_status_check;
alter table public.conversations add constraint conversations_meet_status_check
  check (meet_status in ('none', 'proposed', 'agreed', 'declined'));

-- Same as 016, plus: the meet columns only change through the functions below.
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

  if new.meet_shop_id is distinct from old.meet_shop_id
     or new.meet_at is distinct from old.meet_at
     or new.meet_proposed_by is distinct from old.meet_proposed_by
     or new.meet_status is distinct from old.meet_status then
    raise exception 'use the meet at shop step' using errcode = '42501';
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

-- The insert policy does not look at these columns, so start them clean.
create or replace function public.reset_conversation_meet()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.meet_shop_id := null;
  new.meet_at := null;
  new.meet_proposed_by := null;
  new.meet_status := 'none';
  return new;
end;
$$;

drop trigger if exists reset_conversation_meet on public.conversations;
create trigger reset_conversation_meet
before insert on public.conversations
for each row execute function public.reset_conversation_meet();

revoke execute on function public.reset_conversation_meet() from anon, authenticated, public;

create or replace function public.tb_open_conversation_for(p_conversation_id uuid)
returns public.conversations
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  c public.conversations;
begin
  select * into c from public.conversations where id = p_conversation_id;

  if c.id is null or (select auth.uid()) is null or (select auth.uid()) not in (c.buyer_id, c.seller_id) then
    raise exception 'conversation unavailable' using errcode = '42501';
  end if;
  if c.status not in ('active', 'accepted') then
    raise exception 'this conversation is closed' using errcode = '42501';
  end if;

  return c;
end;
$$;

revoke execute on function public.tb_open_conversation_for(uuid) from anon, authenticated, public;

-- Either side suggests a shop and, optionally, a time. Replaces any earlier
-- suggestion, including an agreed one, because plans change.
create or replace function public.propose_meet(
  p_conversation_id uuid,
  p_shop_id uuid,
  p_meet_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
  c public.conversations := public.tb_open_conversation_for(p_conversation_id);
  shop_name text;
begin
  select name into shop_name from public.shops where id = p_shop_id and status = 'active';
  if shop_name is null then
    raise exception 'that shop is not available' using errcode = '22023';
  end if;
  if p_meet_at is not null and p_meet_at < now() then
    raise exception 'pick a time in the future' using errcode = '22023';
  end if;

  perform public.tb_mark_internal();

  update public.conversations
  set meet_shop_id = p_shop_id, meet_at = p_meet_at, meet_proposed_by = actor, meet_status = 'proposed'
  where id = c.id;

  insert into public.messages (conversation_id, sender_id, content, message_type)
  values (c.id, null, 'Suggested meeting at ' || shop_name, 'system');

  insert into public.notifications (user_id, type, conversation_id, message)
  values (
    case when actor = c.buyer_id then c.seller_id else c.buyer_id end,
    'new_message', c.id, 'Suggested meeting at ' || shop_name
  );
end;
$$;

-- Only the person who did not suggest it can answer. p_shop_id and p_meet_at are
-- the suggestion the page showed, so an answer never lands on a newer one.
create or replace function public.respond_meet(
  p_conversation_id uuid,
  p_agree boolean,
  p_shop_id uuid default null,
  p_meet_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
  c public.conversations := public.tb_open_conversation_for(p_conversation_id);
  shop_name text;
  label text;
begin
  if c.meet_status <> 'proposed' then
    raise exception 'there is no meeting to answer' using errcode = '22023';
  end if;
  if c.meet_proposed_by is not distinct from actor then
    raise exception 'the other trader has to answer this' using errcode = '42501';
  end if;
  if p_shop_id is not null
     and (p_shop_id is distinct from c.meet_shop_id or p_meet_at is distinct from c.meet_at) then
    raise exception 'that suggestion has changed' using errcode = '22023';
  end if;
  if p_agree and not exists (select 1 from public.shops where id = c.meet_shop_id and status = 'active') then
    raise exception 'that shop is not available' using errcode = '22023';
  end if;

  select name into shop_name from public.shops where id = c.meet_shop_id;
  label := case when p_agree then 'Meeting agreed at ' else 'Meeting declined at ' end
    || coalesce(shop_name, 'the shop');

  perform public.tb_mark_internal();

  update public.conversations
  set meet_status = case when p_agree then 'agreed' else 'declined' end
  where id = c.id and meet_status = 'proposed'
    and meet_shop_id is not distinct from c.meet_shop_id and meet_at is not distinct from c.meet_at;

  if not found then
    raise exception 'that suggestion has changed' using errcode = '22023';
  end if;

  insert into public.messages (conversation_id, sender_id, content, message_type)
  values (c.id, null, label, 'system');

  insert into public.notifications (user_id, type, conversation_id, message)
  values (c.meet_proposed_by, 'new_message', c.id, label);
end;
$$;

revoke execute on function public.propose_meet(uuid, uuid, timestamptz) from anon, public;
revoke execute on function public.respond_meet(uuid, boolean, uuid, timestamptz) from anon, public;
grant execute on function public.propose_meet(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.respond_meet(uuid, boolean, uuid, timestamptz) to authenticated;
