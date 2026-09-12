-- Run this in Supabase SQL Editor. (Already applied to the live project on
-- 2026-09-10 — this file exists so the repo and the database don't drift.)
--
-- PROBLEM: 26 RLS policies called auth.uid() once PER ROW rather than once per
-- query. On user_cards (1,861 rows) a single read evaluated it 1,861 times.
-- Postgres can hoist it into an InitPlan — evaluated once, reused — but only if
-- it is written as a subquery.
--
-- The rewrite is semantically identical. Verified after applying: a user still
-- sees exactly their own 1,155 cards and zero rows belonging to anyone else.

do $$
declare
  r record;
  new_qual text;
  new_check text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
      and coalesce(qual, '') not like '%( SELECT auth.uid()%'
      and coalesce(with_check, '') not like '%( SELECT auth.uid()%'
  loop
    new_qual  := replace(r.qual,       'auth.uid()', '(select auth.uid())');
    new_check := replace(r.with_check, 'auth.uid()', '(select auth.uid())');

    if r.qual is not null and r.with_check is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)',
                     r.policyname, r.schemaname, r.tablename, new_qual, new_check);
    elsif r.qual is not null then
      execute format('alter policy %I on %I.%I using (%s)',
                     r.policyname, r.schemaname, r.tablename, new_qual);
    elsif r.with_check is not null then
      execute format('alter policy %I on %I.%I with check (%s)',
                     r.policyname, r.schemaname, r.tablename, new_check);
    end if;
  end loop;
end $$;

-- Two foreign keys had no covering index, so deleting or joining on the parent
-- meant scanning the child table.
create index if not exists messages_sender_id_idx
  on public.messages (sender_id);
create index if not exists notifications_conversation_id_idx
  on public.notifications (conversation_id);

-- ── Known, deliberately NOT changed ─────────────────────────────
-- `trade_listings` and `trade_interests` each have two permissive SELECT
-- policies, which means both run on every read. They could be merged into one
-- policy with an OR, but the two express different intents ("anyone can view
-- active listings" vs "users manage own listings") and merging them makes the
-- rule harder to reason about. Not worth the clarity cost at this scale.
--
-- Ten indexes are reported as unused. That is expected — the app has barely
-- been run. Do NOT drop them based on that; recheck once there is real traffic.
