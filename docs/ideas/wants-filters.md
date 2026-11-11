# Wishlist filters (B57)

Problem: a long wishlist could not be searched or reordered. It was always priority order.

What it does (wishlist page):
- Search by card name.
- Filter by set (picker shows when the list has 2+ sets) and by priority (High, Medium, Low).
- Sort by priority, name or date added, each ascending or descending. Default is high priority first.
- Everything is in the URL, e.g. `/wishlist?set=sv1&priority=low&sort=name-desc`. Bad values are ignored; the clean URL is just `/wishlist`.
- "Showing 2 of 7 cards" line, and a "No cards match" state with a Clear all filters button.
- An empty wishlist (`DEMO_EMPTY=1`) shows the normal empty state and no filter bar.

Reuse from the binder (B30, B48): same chip and select styles, same text compare, same URL rules, same direction-button pattern. Wants have their own modes (priority, no price or set sort), so the logic is `lib/wantsFilters.ts`.

Data: existing columns only. Date added reads `created_at`, already stored on `wishlist_cards`. Rows with no date sort last, and the option hides if none have one. Demo list gained two example cards in a second set.

Code: `lib/wantsFilters.ts`, `app/wishlist/WantsFilters.tsx`, `tests/wantsFilters.test.ts`.

No migrations or DB changes.
