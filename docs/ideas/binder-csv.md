# Binder CSV import/export

Problem: no way to get a binder out, or a spreadsheet in.

What changed:
- `/binder` has an "Import or export CSV" panel (`app/binder/components/BinderCsv.tsx`).
- Columns: `card, set, condition, qty, price`. Card is `Name [card-id]` (a bare id works); set is a name or id; condition is NM/LP/MP/HP/DMG or blank.
- Export: owned cards, price from the `card_prices` cache. Text cells starting with `= + - @` or tab/CR get a leading `'` so spreadsheets never run them. Import undoes that.
- Import: pick a file, see a preview with per-row errors (line number, reason), then confirm. Bad rows are skipped, never saved.
- Limits: 256 KB, 2000 rows, checked before parsing.
- Save uses the binder's existing `user_cards` upsert, in chunks of 200. No migration.
- `npm run demo`: example binder in memory, no database.
- Logic is in `lib/binderCsv.ts`; tests in `tests/binderCsv.test.ts`.

Left:
- `user_cards` only stores "owned". Condition, qty and price are validated and previewed but not stored. Export writes qty 1 and a blank condition.
- Variant is not a column; import uses the set's default variant.
- Once the inventory migration is applied, write these fields to `inventory_items`.
