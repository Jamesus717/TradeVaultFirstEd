# Set progress (B36)

Problem: the binder showed a plain count for the set you were viewing, with no way to jump to what was left.

What it does (binder page, top right card):
- Owned / total for the selected set, a percentage and a progress bar (accessible `progressbar`).
- A "Show N missing cards" link. It applies the existing binder filter (B30) to Missing for that set. It is a real link, `/binder?set=<id>&own=unowned`, so it can be copied or opened in a new tab; a plain click filters in place.
- The percentage rounds down, so a set with one card missing never reads 100%.
- The link hides when the set is complete.

Data: the owned and total counts the binder already loads. No migrations, no DB changes. Works in `npm run demo` (example binder shows Base set partly owned) and `DEMO_EMPTY=1` (0 owned, link shows all cards missing).

Code: `lib/setProgress.ts` (pure logic), `app/binder/components/SetProgressCard.tsx`. Tests: `tests/setProgress.test.ts`.

Not done: a list of progress for every set at once. Real mode only loads owned cards for the selected set, and totals per set need card fetches. It would need a counts query (decision for Borty).
