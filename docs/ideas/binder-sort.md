# Binder sort (B48)

Problem: the binder could not show the priciest or newest cards first.

What it does (binder page):
- Sort by binder number, name, set + card number, price, or date added.
- Each has a direction button (A to Z / Z to A, low to high, newest first, and so on). Owned first stays as a mode.
- Cards with no price or date always sit last, in both directions.
- Lives in the URL next to the B30 filters, for example `/binder?set=base1&own=owned&sort=price-desc`. Old links still work; a bad value falls back to binder order.
- Keyboard: a native select plus a button.

Data:
- Price comes from the binder fields (proposal 024). Date added is a new optional `addedAt` on the demo rows and CSV imports (new cards get today; re-imports keep the old date).
- Real mode has neither yet, so the Price and Date added options hide themselves. Nothing breaks. Works in `npm run demo` and `DEMO_EMPTY=1`.

Code: `lib/binderSort.ts` (pure), `app/binder/components/BinderSort.tsx`. Tests: `tests/binderSort.test.ts`.

No migrations or DB changes.

Left (needs Borty): once 024 is applied, add a created-at column and load `addedAt` into the details map.
