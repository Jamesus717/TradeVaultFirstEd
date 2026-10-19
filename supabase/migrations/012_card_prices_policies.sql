-- Run this in Supabase SQL Editor. (Already applied to the live project on
-- 2026-09-10 — this file exists so the repo and the database don't drift.)
--
-- `card_prices` had row level security ENABLED with NO policies at all, which
-- denies everything. The price cache was therefore silently dead:
--
--   * app/api/pokemon/price/route.ts reads it (STEP A) and upserts it (STEP E)
--   * app/collection/useCollection.ts reads it from the browser, twice
--
-- All of those used the anon key, so every read returned nothing and every
-- write was rejected. The upsert's error was deliberately ignored ("Check if
-- table exists implicitly by trying to upsert and ignoring errors"), so nothing
-- ever surfaced — the cache just never hit, and every price lookup fell through
-- to the eBay API instead.

-- Read: open. These are public eBay sale prices, not user data, and both the
-- API route and the collection page read them unauthenticated.
drop policy if exists "Anyone can read cached prices" on public.card_prices;
create policy "Anyone can read cached prices"
on public.card_prices for select
using (true);

-- Write: open, because the price route upserts with the anon key.
--
-- FOLLOW-UP worth doing: this lets anyone with the publishable key write
-- arbitrary prices into the cache via the REST API. Low severity (public price
-- data, and the worst case is a wrong price shown until the 7-day window
-- expires) but not ideal. The proper fix is to give the price route a
-- SUPABASE_SERVICE_ROLE_KEY of its own — it is a server-side route, so it
-- never needed the anon key — and then narrow these two policies to
-- `to service_role`. That needs a new env var, so it is left for James.
drop policy if exists "Price cache can be written" on public.card_prices;
create policy "Price cache can be written"
on public.card_prices for insert
with check (true);

drop policy if exists "Price cache can be refreshed" on public.card_prices;
create policy "Price cache can be refreshed"
on public.card_prices for update
using (true) with check (true);

-- ── Function hardening ──────────────────────────────────────────
-- Without an explicit search_path, name resolution inside these functions
-- depends on the calling role's setting. Pinning it removes that variable.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.validate_message_insert() set search_path = public, pg_temp;
alter function public.bump_conversation_updated_at() set search_path = public, pg_temp;
