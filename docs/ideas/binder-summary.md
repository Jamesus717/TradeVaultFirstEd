# Binder summary (B51)

Problem: no quick answer to "how much do I have, and what is it worth?"

What it does (binder page, under the search and filters):
- A card shows owned cards, sets started, total value of cards that have a price, and "N cards have no price".
- It summarises what is shown. With a search or filter on, it says "Only the 3 of 102 cards shown by your search and filters". With none, "Everything you own in <set>".
- Empty state: no owned cards (or none match) gives a plain sentence, not zeros. Value shows `--` when no card has a price.

Data: owned ticks plus the binder-field price (proposal 024). Real mode has no price column yet, so every owned card reads "no price" and value is `--`. Demo shows example prices; `DEMO_EMPTY=1` shows the empty state.

Note: the binder page is one set at a time, so "sets started" is 0 or 1 here. It counts distinct sets, ready for a multi-set view.

Code: `lib/binderSummary.ts` (pure), `app/binder/components/BinderSummaryCard.tsx`, wired in `useBinder.ts`. Tests: `tests/binderSummary.test.ts`.

No migrations or DB changes.
