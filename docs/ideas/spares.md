# Spares to trade (B54)

Problem: no quick way to see which cards you hold extra copies of.

What it does (binder page, under the CSV tool):
- A "Spares to trade (N)" panel. Open it to see cards with qty > 1, grouped by set. Spares = qty - 1, because one copy is kept.
- "Copy as text" reuses the B45 helper. It copies name, set and spare count only. No notes.
- Empty state is a plain sentence, not zeros.

Data: existing quantities only. Quantity lives in the demo binder store; real mode has no qty column on `user_cards` yet, so real accounts see "no quantities yet". `npm run demo` shows Pikachu x1 spare; `DEMO_EMPTY=1` shows the empty state. Importing a CSV with qty > 1 in demo adds spares.

Code: `lib/spares.ts` (pure), `app/binder/components/SparesPanel.tsx`. Tests: `tests/spares.test.ts`.

No migrations or DB changes.
