-- PROPOSAL, not a migration. Never applied anywhere. Kept out of
-- supabase/migrations on purpose so no `db push` or CI step picks it up.
-- Needs 018 (wishlist_cards). Rollback: 023_wishlist_target_price_rollback.sql.
-- See docs/ideas/price-alerts.md.
--
-- Adds a target price to a wishlist card. The app compares it with the cached
-- market price in card_prices (lib/priceAlerts.ts) and lists the cards that
-- are now at or under it.
--
-- Nothing else changes: wishlist_cards already has owner-only update and
-- public read, so a target is visible to other traders like the rest of the
-- list. That is a choice for Borty (see the doc): a target tells a seller the
-- most you'd pay.

begin;

alter table public.wishlist_cards
  add column if not exists target_price numeric(10,2);

alter table public.wishlist_cards
  drop constraint if exists wishlist_cards_target_price_check;
alter table public.wishlist_cards
  add constraint wishlist_cards_target_price_check
  check (target_price is null or (target_price > 0 and target_price <= 100000));

comment on column public.wishlist_cards.target_price is
  'Alert when the card_prices market price (GBP) is at or under this. Null means no alert.';

commit;
