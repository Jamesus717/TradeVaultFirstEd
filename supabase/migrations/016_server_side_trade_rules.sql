-- Server-side trade rules. Applied to the live project on 2026-10-18.
--
-- Until now every step of a trade (system messages, notifications, offer
-- outcomes, conversation status) was written by the browser, and RLS only
-- checked "are you a participant". Anyone calling the REST API directly could:
--
--   * post fake system messages ("Offer accepted") into their conversation
--   * set a conversation to accepted / completed without any offer
--   * start a conversation naming any user as the seller, then send that
--     user notifications with any text
--   * rewrite the price cache with the public key
--
-- Now the database does those writes itself, in triggers, and clients can only
-- do the user-level actions: start a conversation on a real active listing,
-- send a message or offer, decide an offer sent to them, mark an accepted
-- trade completed, and deactivate their own listing.
--
-- Trigger functions that write on the user's behalf set the transaction-local
-- flag `tradebinder.internal`, which the guard triggers below let through.
--
-- Live note: the Supabase MCP holds any statement containing DROP for a
-- confirmation, so live this was applied with ALTER POLICY (the dropped
-- notification / card_prices write policies were set to `false` instead of
-- dropped) and CREATE OR REPLACE TRIGGER. Same effect.

-- ── Helpers ──────────────────────────────────────────────────────

create or replace function public.tb_internal()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(current_setting('tradebinder.internal', true), '') = 'on';
$$;

create or replace function public.tb_mark_internal()
returns void
language sql
set search_path = public, pg_temp
as $$
  select set_config('tradebinder.internal', 'on', true);
$$;

revoke execute on function public.tb_mark_internal() from anon, authenticated, public;

-- ── Messages: users send messages and offers, never system rows ──

drop policy if exists "Participants can insert messages into active conversations" on public.messages;
create policy "Participants can insert messages into active conversations"
on public.messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and message_type in ('message', 'offer')
  and (message_type <> 'offer' or (offer_status = 'pending' and offer_amount > 0))
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.status = 'active'
      and (select auth.uid()) in (c.buyer_id, c.seller_id)
  )
);

-- Column guard for updates (014 in the repo, never applied live until now).
create or replace function public.guard_message_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or public.tb_internal() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.message_type is distinct from old.message_type
     or new.content is distinct from old.content
     or new.offer_amount is distinct from old.offer_amount
     or new.created_at is distinct from old.created_at then
    raise exception 'messages cannot be edited' using errcode = '42501';
  end if;

  if new.read_at is distinct from old.read_at
     and old.sender_id is not distinct from actor then
    raise exception 'only the recipient can mark a message read' using errcode = '42501';
  end if;

  if new.offer_status is distinct from old.offer_status then
    if old.message_type <> 'offer'
       or old.offer_status is distinct from 'pending'
       or new.offer_status not in ('accepted', 'declined', 'countered') then
      raise exception 'only a pending offer can be decided' using errcode = '42501';
    end if;
    if old.sender_id is not distinct from actor then
      raise exception 'you cannot decide your own offer' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.conversations c
      where c.id = old.conversation_id and c.status = 'active'
    ) then
      raise exception 'this conversation is closed' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_message_update on public.messages;
create trigger guard_message_update
before update on public.messages
for each row execute function public.guard_message_update();

-- New message / offer → notify the other participant.
create or replace function public.on_message_inserted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.conversations%rowtype;
  recipient uuid;
begin
  if new.sender_id is null or new.message_type not in ('message', 'offer') then
    return new;
  end if;

  select * into c from public.conversations where id = new.conversation_id;
  recipient := case when new.sender_id = c.buyer_id then c.seller_id else c.buyer_id end;

  insert into public.notifications (user_id, type, conversation_id, message)
  values (
    recipient,
    case when new.message_type = 'offer' then 'new_offer' else 'new_message' end,
    c.id,
    case when new.message_type = 'offer' then 'New offer' else 'New message' end
  );

  return new;
end;
$$;

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
after insert on public.messages
for each row execute function public.on_message_inserted();

-- Offer decided → system message, notify the offer's sender, and close the
-- conversation on accept / decline.
create or replace function public.on_offer_decided()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  label text;
begin
  if new.message_type <> 'offer' or new.offer_status is not distinct from old.offer_status then
    return new;
  end if;

  perform public.tb_mark_internal();

  label := case new.offer_status
    when 'accepted' then 'Offer accepted'
    when 'declined' then 'Offer declined'
    else 'Offer countered'
  end;

  if new.offer_status in ('accepted', 'declined') then
    update public.conversations
    set status = new.offer_status
    where id = new.conversation_id;
  end if;

  insert into public.messages (conversation_id, sender_id, content, message_type)
  values (new.conversation_id, null, label, 'system');

  if new.sender_id is not null then
    insert into public.notifications (user_id, type, conversation_id, message)
    values (new.sender_id, 'offer_' || new.offer_status, new.conversation_id, label);
  end if;

  return new;
end;
$$;

drop trigger if exists on_offer_decided on public.messages;
create trigger on_offer_decided
after update of offer_status on public.messages
for each row execute function public.on_offer_decided();

-- ── Conversations ───────────────────────────────────────────────

-- Only the buyer can start one, only on someone else's active listing, and
-- the seller must be that listing's owner.
drop policy if exists "Buyers can start conversations" on public.conversations;
create policy "Buyers can start conversations"
on public.conversations
for insert
to authenticated
with check (
  buyer_id = (select auth.uid())
  and status = 'active'
  and exists (
    select 1
    from public.trade_listings l
    where l.id = listing_id
      and l.user_id = seller_id
      and l.user_id <> (select auth.uid())
      and l.is_active
  )
);

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

drop trigger if exists guard_conversation_update on public.conversations;
create trigger guard_conversation_update
before update on public.conversations
for each row execute function public.guard_conversation_update();

create or replace function public.on_conversation_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  card text;
begin
  select card_name into card from public.trade_listings where id = new.listing_id;

  insert into public.messages (conversation_id, sender_id, content, message_type)
  values (new.id, null, 'Conversation started', 'system');

  insert into public.notifications (user_id, type, conversation_id, message)
  values (new.seller_id, 'new_message', new.id, 'New conversation about ' || coalesce(card, 'your listing'));

  return new;
end;
$$;

drop trigger if exists on_conversation_created on public.conversations;
create trigger on_conversation_created
after insert on public.conversations
for each row execute function public.on_conversation_created();

create or replace function public.on_conversation_completed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  insert into public.messages (conversation_id, sender_id, content, message_type)
  values (new.id, null, 'Trade marked as completed', 'system');

  insert into public.notifications (user_id, type, conversation_id, message)
  select p, 'trade_completed', new.id, 'Trade completed'
  from unnest(array[new.buyer_id, new.seller_id]) as p
  where p is distinct from actor;

  return new;
end;
$$;

drop trigger if exists on_conversation_completed on public.conversations;
create trigger on_conversation_completed
after update of status on public.conversations
for each row execute function public.on_conversation_completed();

-- ── Listings: deactivating one cancels its open conversations ───

create or replace function public.on_listing_deactivated()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c record;
begin
  if not (coalesce(old.is_active, false) and not coalesce(new.is_active, false)) then
    return new;
  end if;

  perform public.tb_mark_internal();

  for c in
    update public.conversations
    set status = 'cancelled'
    where listing_id = new.id and status = 'active'
    returning id, buyer_id
  loop
    insert into public.messages (conversation_id, sender_id, content, message_type)
    values (c.id, null, 'Listing marked as sold', 'system');

    insert into public.notifications (user_id, type, conversation_id, message)
    values (c.buyer_id, 'trade_completed', c.id, 'Listing marked as sold');
  end loop;

  return new;
end;
$$;

drop trigger if exists on_listing_deactivated on public.trade_listings;
create trigger on_listing_deactivated
after update of is_active on public.trade_listings
for each row execute function public.on_listing_deactivated();

-- Participants keep seeing the listing their conversation is about after it
-- is sold (the active-only policy hid it from the buyer). The check runs in a
-- SECURITY DEFINER helper: the conversations insert policy reads
-- trade_listings, so a policy here that read conversations directly would
-- recurse.
create or replace function public.tb_is_conversation_participant(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversations c
    where c.listing_id = p_listing_id
      and (select auth.uid()) in (c.buyer_id, c.seller_id)
  );
$$;

revoke execute on function public.tb_is_conversation_participant(uuid) from anon, public;
grant execute on function public.tb_is_conversation_participant(uuid) to authenticated;

drop policy if exists "Conversation participants can view the listing" on public.trade_listings;
create policy "Conversation participants can view the listing"
on public.trade_listings
for select
to authenticated
using (public.tb_is_conversation_participant(id));

-- ── Notifications: written by the triggers above only ──────────

drop policy if exists "Participants can notify other participant" on public.notifications;

-- ── Price cache: server writes only (service role bypasses RLS) ─

drop policy if exists "Price cache can be written" on public.card_prices;
drop policy if exists "Price cache can be refreshed" on public.card_prices;

-- ── Public profiles show the owner's collection ────────────────

drop policy if exists "Owned cards are publicly viewable" on public.user_cards;
create policy "Owned cards are publicly viewable"
on public.user_cards
for select
using (owned = true);

-- Trigger functions are not API endpoints.
revoke execute on function
  public.on_message_inserted(),
  public.on_offer_decided(),
  public.on_conversation_created(),
  public.on_conversation_completed(),
  public.on_listing_deactivated()
from anon, authenticated, public;
