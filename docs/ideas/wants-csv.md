# Wants CSV import/export

Problem: no way to get a wishlist out, or a spreadsheet of wants in.

What changed:
- `/wishlist` has an "Import or export CSV" panel (`app/wishlist/WantsCsv.tsx`).
- Columns: `card, set, priority, qty, note`. Only card and set are required. Card is `Name [card-id]` (a bare id works); set is a name or id; priority is high/medium/low or blank (medium); qty 1-99; note up to 200 characters.
- Export: the current list. Text cells starting with `= + - @` get a leading `'` so spreadsheets never run them. Import undoes that.
- Import: pick a file, see a preview with per-row errors (line number, reason), then confirm. Bad rows are skipped, never saved. Same 256 KB / 2000 row limits as the binder, checked before parsing.
- Save upserts `wishlist_cards` on its existing `(user_id, card_id)` key, in chunks of 200. A card already listed is updated. No migration.
- `npm run demo`: imports show in the example list, in memory only.
- Logic is in `lib/wantsCsv.ts` (reuses the binder CSV parser); tests in `tests/wantsCsv.test.ts`.

Left:
- Target prices (proposal 023) are not in the CSV.
- Import never deletes: cards missing from the file stay on the list.
