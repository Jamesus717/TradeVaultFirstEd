# Copy as text

Problem: sharing a wants list on Discord or a forum meant retyping it.

What changed:
- `/wishlist` and `/binder` have a "Copy as text" button (`app/components/CopyAsText.tsx`).
- Output is short and grouped by set, one card per line:
  ```
  Wants (2 cards)

  Base
  - Charizard x2 (high priority)
  ```
- Only card name, set, qty and high-priority flag are read. Notes and every other field (such as `postcode_prefix`) are never copied.
- If the browser blocks the clipboard, a read-only textarea appears with the text selected, plus a message.
- Empty lists show a message instead of copying.
- Works in `npm run demo` and `DEMO_EMPTY=1`. No migration.
- Logic is in `lib/listText.ts`; tests in `tests/listText.test.ts`.

Left:
- Binder text has no price or condition.
- No "copy only high priority" option.
