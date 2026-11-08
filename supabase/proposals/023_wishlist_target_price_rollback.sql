-- Rollback for the 023 proposal (wishlist target prices). Run by hand, only if
-- 023 was applied and has to come out. Every target price is lost; the rest of
-- each wishlist row stays. Safe to run twice.

begin;

alter table public.wishlist_cards
  drop constraint if exists wishlist_cards_target_price_check;
alter table public.wishlist_cards
  drop column if exists target_price;

commit;
