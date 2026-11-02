# Inventory migration: how to run it

**Nothing here has been applied to prod.** Files: `supabase/migrations/019` to `022`.

## Order
Apply 019, 020, 021, 022 in that order, each as one transaction. Take a backup first. Merge any app code that reads these tables only after they are applied.

## What 020 does
- Creates `inventory_items` (one row per stack: card + variant + condition + status) and `inventory_listing_links`.
- Copies `user_cards` to `keep`, `wishlist_cards` to `want` (variant `Any`), and active `trade_listings` to `for_trade`.
- Leaves the old tables' data alone. Only `trade_listings.condition` is widened, to also allow `Damaged` and `Ungraded`.
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
Old tables keep their data, so rollback means dropping the 020 triggers and the two new tables. Copies, conditions or statuses entered only in the new model would be lost. No rollback script is written yet.

## Testing
`npm test` runs on PGlite (embedded Postgres): 64 database tests, on synthetic data shaped like prod's counts, with prod's drift (`user_cards` has no `created_at`, 6 null `set_id` rows). Not tested on real Supabase, real PostgREST or a copy of real data.
