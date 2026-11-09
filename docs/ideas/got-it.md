# Got it (B42)

A "Got it" button on each want on `/wishlist`. One tap moves the card to the binder and removes the want. A toast with Undo shows for 8 seconds.

## How it works
- `lib/gotIt.ts` uses existing tables only: `user_cards` upsert (same key as Quick add), then `wishlist_cards` delete. No migrations.
- Already owned: the binder is left alone, so Undo never removes a card you had before.
- If the want delete fails, the binder add is rolled back, an error shows and the want stays.
- Undo re-inserts the want, then removes the binder add. If that second step fails, the want is removed again and the error shows.
- Demo and `DEMO_EMPTY=1`: in memory only, nothing saved. Undo restores the card.
- Button and Undo are 44 px tall, text 14 px or more.

## Limits
- Undo restores the want with a new `created_at`.
- Only one Undo is held at a time.

## Tests
`tests/gotIt.test.ts` covers the move, already owned, both failure paths and undo.
