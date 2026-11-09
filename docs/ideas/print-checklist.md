# Print checklist (B39)

Problem: no way to take a set's progress to a card show or tick it off on paper.

What it does:
- `/binder/print?set=<id>` lists every card of the set in binder order: tick box (filled with a check for owned), number, name, variant when not Normal.
- Heading shows the set name and owned / total.
- Print button calls the browser print dialog; the buttons are hidden in print. Two columns when printed.
- Linked from the Set Progress card ("Print checklist"), a plain link so it opens in a new tab too.
- Ignores binder filters: the sheet is always the whole set.

Data: what the binder already loads (cards + owned). No migrations. Works in `npm run demo` (Base set partly owned) and `DEMO_EMPTY=1` (all boxes empty). Route added to the mobile audit list.

Code: `lib/printChecklist.ts`, `app/binder/print/page.tsx`. Tests: `tests/printChecklist.test.ts`.

Not done: paper-size options, grouping by rarity, a Missing-only sheet (decision for Borty).
