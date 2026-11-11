# Export CSV (filtered)

Problem: no quick way to take what you are looking at into a spreadsheet.

What changed:
- "Export CSV" button on `/binder` (above the summary) and `/wishlist` (above the import/export panel).
- Columns: `card, set, number, condition, qty, price`. No notes, no user ids.
- Follows the current filters and search. The text beside the button says so, e.g. "Exports the 2 of 9 owned cards in Base Set that match your 1 current filter."
- Binder exports owned cards of the open set. Wishlist exports the filtered, sorted list.
- Client-side only. No migration. Works in demo, including `DEMO_EMPTY=1` (empty gives a message, no file).
- Safety: quotes/commas/newlines escaped; text cells starting with `= + - @`, tab or CR get a leading `'`. Numbers are written as plain numbers.
- Code: `lib/exportCsv.ts`, `app/components/ExportCsvButton.tsx`, `app/binder/components/BinderExport.tsx`. Tests: `tests/exportCsv.test.ts`.

Limits:
- Real binder has no condition/qty/price stored yet (qty 1, others blank) until the inventory migration is applied.
- Wishlist `price` is your target price, if set. There is no market price on wishlist rows.
- The older import/export panel is unchanged (it ignores filters).
