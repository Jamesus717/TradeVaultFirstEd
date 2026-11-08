# Binder fields: condition, qty, price

Problem: binder CSV validates condition, qty and price, then drops them because `user_cards` has no columns for them.

Proposal (NOT applied anywhere):
- `supabase/migrations/024_binder_fields.sql` adds to `user_cards`: `condition` (NM/LP/MP/HP/DMG or null), `qty` (1 to 999, default 1), `price` (null, or above 0 and under 1,000,000, 2 decimals).
- Additive. Existing rows become qty 1. Old upserts keep working. Same values as `inventory_items` (020).
- `supabase/rollback/024_rollback.sql` drops the checks and columns. Rows stay; saved condition, qty and price are lost.
- No 023 exists on this branch, so numbering skips it.

In the app:
- `npm run demo`: import keeps the fields, replaces a card imported twice, and shows them in a table in the CSV panel.
- Real mode is unchanged. `saveImport(..., { includeFields: true })` is ready for after 024 is applied.

Tests: `tests/binderCsv.test.ts` (validation edges), `tests/db/binder-fields.test.ts` (checks, rollback).

Left (needs Borty):
- Review and apply 024, then pass `includeFields` and load the fields on export.
- One row per card variant, so one condition per variant. Per-condition stacks need `inventory_items`.
