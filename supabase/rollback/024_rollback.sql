-- Rollback for migration 024. NOT a migration: run by hand, only if 024 has to
-- come out. Puts user_cards back to its shape before 024.
--
-- What is lost: every condition, qty and price saved on user_cards since 024.
-- Rows themselves stay. Safe to run twice: everything is "if exists".

begin;

alter table public.user_cards drop constraint if exists user_cards_condition_check;
alter table public.user_cards drop constraint if exists user_cards_qty_check;
alter table public.user_cards drop constraint if exists user_cards_price_check;

alter table public.user_cards drop column if exists condition;
alter table public.user_cards drop column if exists qty;
alter table public.user_cards drop column if exists price;

commit;
