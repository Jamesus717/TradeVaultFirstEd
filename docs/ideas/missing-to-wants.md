# Add missing to wishlist (B60)

On the Set Progress card in `/binder`, an "Add N missing to wishlist" button. It asks to confirm ("Yes, add" / "Cancel"). After adding, a toast with Undo shows for 8 seconds, like "Got it" (B42).

## How it works
- `lib/missingToWants.ts` uses the existing `wishlist_cards` insert, `select` and `delete`. No migrations.
- Skipped: cards owned in any printing, cards already wanted, and repeat printings (the wishlist holds one row per card).
- N is the number that will really be added, so it can be lower than "to go".
- It re-checks the wishlist before writing and inserts only new rows, 100 at a time.
- If a chunk fails, earlier chunks are removed and an error shows.
- Undo deletes only the rows this tap added. Wants you already had stay.
- Demo and `DEMO_EMPTY=1`: in memory only, nothing saved. The demo wishlist's example cards are skipped. Undo works.
- Hidden when signed out (outside demo) or nothing is left to add.
- Buttons are 44 px tall.

## Limits
- Added wants use default quantity and priority.

## Tests
`tests/missingToWants.test.ts`: skip rules, chunking, rollback, undo.
