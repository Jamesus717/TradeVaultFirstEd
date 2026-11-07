# Inventory migration: how to run it

**Nothing here has been applied to prod.** Files: `supabase/migrations/019` to `022`.

## Order
Apply 019, 020, 021, 022 in that order. Each file opens and closes its own transaction (`begin;` ... `commit;`), so a failure anywhere in a file undoes that whole file, however it is run. Take a backup first. Merge any app code that reads these tables only after they are applied.

## Pre-checks on prod (read-only)
Run these before 020 and note the answers:

```sql
-- Listings with a zero or negative price. 020 carries them over with no price.
select id, listing_type, price from public.trade_listings where price <= 0;

-- The condition check's real name. 020 finds and replaces it whatever it is called.
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.trade_listings'::regclass and contype = 'c';

-- user_cards rows with no set_id (6 on 2026-11-02). 020 fills set_id from the card id.
select count(*) from public.user_cards where set_id is null;
```

## What 020 does
- Creates `inventory_items` (one row per stack: card + variant + condition + status) and `inventory_listing_links`.
- Copies `user_cards` to `keep`, `wishlist_cards` to `want` (variant `Any`), and active `trade_listings` to `for_trade`.
- Leaves the old tables' data alone. Only `trade_listings.condition` is widened, to also allow `Damaged` and `Ungraded`. The old check is found by its column, not its name, so a differently named prod check can't survive.
- A listing price of 0 or less carries over as no price (`trade_listings` never checked price; `inventory_items` requires it to be above 0). The old listing keeps its price.
- Triggers keep old and new in step both ways, so the live site works before and after.
- Ends with a check that raises and undoes the migration if any row was left behind.

## Decisions worth a look
- **Key is the stack, not user + card.** Users hold Normal and Reverse Holo as separate rows today, so one row per card per user would lose data.
- **Condition is null for carried-over collection cards.** `user_cards` never recorded one, and we won't guess NM.
- **Spares:** copies of a `keep` stack beyond the first count as trade stock in matching. `start_match_conversation` can create a plain listing on the owner's behalf for one. This is the "duplicates become trade stock" idea; check you're happy with it.
- **Mint becomes NM**, with the original kept in `legacy_condition`.
- **Sold listings** are not carried over. Selling takes the copy out of stock but never unticks the binder.

## Not handled
- Completing a trade does not change inventory yet.
- Listing price or description edits are not mirrored (the app has no edit feature today).

## Rollback
Script: `supabase/rollback/019-022_rollback.sql`. It is not a migration; run it by hand, in one go, only if 019 to 022 have to come out. It undoes 022, 021, 020 and 019 in that order, as one transaction, and is safe to run twice.

- **Kept:** every row in `user_cards`, `wishlist_cards`, `trade_listings` and `conversations`. Row level security on `card_prices` stays on (prod already runs that way).
- **Lost:** anything only in the new model (inventory copies, conditions, statuses, the catalog, shops, home shops), plus the shop on a listing and the meet step on a conversation.
- **Stops instead of changing data** if any listing says `Damaged` or `Ungraded`, because the old condition check rejects them. Decide what they become, update them, then run it again.
- `guard_conversation_update` goes back to its 016 version.

Tested on PGlite (`tests/db/rollback.test.ts`): apply 019 to 022 on a copy with data, use the new tables, roll back, then compare tables, columns, constraints, indexes, triggers, functions (body and grants), policies and RLS with the pre-019 state. They match, and the old tables' rows are unchanged.

## Testing
`npm test` runs on PGlite (embedded Postgres): 73 database tests, on synthetic data shaped like prod's counts, with prod's drift (`user_cards` has no `created_at`, 6 null `set_id` rows). Not tested on real Supabase, real PostgREST or a copy of real data.
