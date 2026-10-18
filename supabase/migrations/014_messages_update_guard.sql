-- Run this in Supabase SQL Editor. (Already applied to the live project on
-- 2026-09-12 — this file exists so the repo and the database don't drift.)
--
-- The "Participants can update messages in conversation (read receipts)"
-- policy from 005 decides WHICH rows a participant may update, but RLS cannot
-- say which COLUMNS. So either participant could rewrite any column of any
-- message in their conversation via the REST API:
--
--   * edit the other person's message text, or change who sent it
--   * change the amount on an offer after it was accepted
--   * accept (or decline) their OWN offer
--
-- For an app whose whole pitch is safe trades, that is the one table where a
-- tampered row is a dispute. The app itself only ever changes two columns:
--
--   * read_at      — the recipient marking a message read
--   * offer_status — the recipient accepting / declining / countering a
--                    pending offer
--
-- This trigger allows exactly that and rejects everything else. It only
-- applies to requests made as a signed-in user (auth.uid() is set); the
-- service role and the SQL editor are unaffected.

create or replace function public.guard_message_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
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
  end if;

  return new;
end;
$$;

drop trigger if exists guard_message_update on public.messages;
create trigger guard_message_update
before update on public.messages
for each row execute function public.guard_message_update();
