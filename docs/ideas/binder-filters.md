# Binder filters

Problem: the binder could only search by name and tick owned or missing. Finding "my Near Mint cards under 20 pounds" meant scrolling.

What it does (binder page):
- Search by card name.
- Set (the existing set picker), owned or missing, condition (NM to DMG, pick several), min and max price.
- All of it lives in the URL, for example `/binder?set=base1&own=owned&cond=NM,LP&max=300`, so a link shares the filtered view. Bad values in a link are ignored; an unknown set falls back to the first.
- "Clear all filters" button, and a "No cards match" state with the same button.

Data:
- Condition and price come from the binder fields in proposal 024. In `npm run demo` they come from the example binder and CSV import.
- Real mode has no such columns yet, so the condition and price filters hide themselves. Nothing breaks.
- Condition and price only match cards you own.

Code: `lib/binderFilters.ts` (pure logic), `lib/binderDetails.ts` (demo store), `app/binder/components/BinderFilters.tsx`. Tests: `tests/binderFilters.test.ts`.

No migrations or DB changes.

Left (needs Borty): apply 024, then load condition and price into the details map in `useBinder`.
