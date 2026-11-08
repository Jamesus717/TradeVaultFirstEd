-- PROPOSAL, not a migration. Never applied anywhere. Kept out of
-- supabase/migrations on purpose so no `db push` or CI step picks it up.
-- Needs 000 (user_cards). Rollback: 024_binder_fields_rollback.sql.
-- See docs/ideas/binder-fields.md.
--
-- Binder CSV (docs/ideas/binder-csv.md) validates condition, qty and price but
-- user_cards could not hold them. This adds the three columns to user_cards,
-- the table the binder reads and writes today.
--
-- Note: 023 is the price-alerts proposal (wishlist_cards); this one is independent of it.
-- Apply order: 023 then 024. tests/db/proposals-order.test.ts checks that.
--
-- Safe by design:
--   * Additive only. Existing rows get qty 1, no condition, no price.
--   * Existing upserts (which never send these columns) keep working.
--   * One row is still one card variant (unique key unchanged), so condition,
--     qty and price describe that variant as a whole.
--   * Condition values match inventory_items.condition (020). Price rule
--     matches inventory_items.price: null, or above 0.
--   * Safe to run twice.

begin;

alter table public.user_cards add column if not exists condition text;
alter table public.user_cards add column if not exists qty integer not null default 1;
alter table public.user_cards add column if not exists price numeric(10,2);

alter table public.user_cards drop constraint if exists user_cards_condition_check;
alter table public.user_cards add constraint user_cards_condition_check
  check (condition is null or condition in ('NM', 'LP', 'MP', 'HP', 'DMG'));

alter table public.user_cards drop constraint if exists user_cards_qty_check;
alter table public.user_cards add constraint user_cards_qty_check
  check (qty between 1 and 999);

alter table public.user_cards drop constraint if exists user_cards_price_check;
alter table public.user_cards add constraint user_cards_price_check
  check (price is null or (price > 0 and price < 1000000));

commit;
