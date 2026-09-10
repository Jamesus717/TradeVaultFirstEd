# Overnight log — 2026-09-11

## Run 1 — Split `app/trade/page.tsx`

**Status: done. `npx next build` passes. `npx tsc --noEmit` clean. `npx eslint app/trade` clean.**

Behaviour-preserving refactor only. Nothing was renamed, restyled, reordered or
"improved" on the way through.

### What was split out

`app/trade/page.tsx` was 1,419 lines holding the board, the filter bar, the
listing-create modal and the card search. It is now a 64-line composition root.
The layout follows `app/binder/` — `types.ts` / `utils.ts` at the top level,
plus `components/` and `hooks/` subdirectories.

| File | Lines | What it holds |
| --- | ---: | --- |
| `app/trade/page.tsx` | 64 | Composition root: calls the three hooks, lays out header / filter bar / grid / modal |
| `app/trade/types.ts` | 49 | `TradeListing`, `CardSearchResult`, the variant/condition/type unions, `TradeBoardStats` |
| `app/trade/utils.ts` | 77 | `classNames`, `formatMoneyGBP`, `formatTimeAgo`, `conditionBadgeClass`, `listingTypeBadge`, `canReverseHolo`, `normalizePostcodePrefix`, `LISTING_COLUMNS` |
| `app/trade/hooks/useTradeListings.ts` | 297 | Listings fetch, interests, conversations, the `nowMs` ticker, `stats`, `setOptions`, and the express-interest / mark-sold / delete actions |
| `app/trade/hooks/useTradeFilters.ts` | 87 | The five filter fields, `filtersActive`, `filteredListings`, `clearFilters` |
| `app/trade/hooks/useListingForm.ts` | 305 | Modal open/close, owned-cards load, all form fields, upload preview, submit |
| `app/trade/hooks/useCardSearch.ts` | 98 | Debounced card-name search, abort handling, collection-vs-all filtering |
| `app/trade/components/TradeBoardHeader.tsx` | 59 | Hero panel, the three stat pills, "List a Card" |
| `app/trade/components/TradeFilterBar.tsx` | 102 | Search / set / condition / type / postcode controls, "Clear filters" |
| `app/trade/components/TradeBoardGrid.tsx` | 98 | Loading skeletons, empty state, the responsive grid |
| `app/trade/components/TradeListingCard.tsx` | 173 | One listing card: image, badges, price/description, manage menu, interest button |
| `app/trade/components/ListingModal.tsx` | 237 | Modal shell and Step 2 (variant, condition, type, price, description, postcode, photo, submit) |
| `app/trade/components/CardSearchStep.tsx` | 187 | Step 1: collection/all toggle, search box, result rows, selected-card summary |

1,419 lines in one file → 1,833 lines across 13 files. The growth is import
statements and prop type declarations; no logic was added.

### How the pieces talk to each other

- `useTradeListings` owns `manageOpenFor` even though it is board UI state,
  because `handleMarkSold` / `handleDeleteListing` close the menu *after* their
  await. Hoisting it into the grid would have closed the menu a network
  round-trip earlier, which is a behaviour change.
- `useListingForm` takes an `onListingCreated` callback rather than reaching
  into the listings state, and `useCardSearch` is composed inside it, so the
  modal only ever talks to one hook.
- Board components take explicit props. `ListingModal` takes the whole
  `ListingFormState` object — it needs ~30 fields and a flat prop list that
  long is worse than the coupling. `CardSearchStep` kept explicit props since
  it is small enough to be reusable.

### Verification

- String-literal diff between the old file and the 13 new ones: the only
  differences are import paths and the deduped `LISTING_COLUMNS` constant. No
  className, label, placeholder or copy string changed.
- `npx tsc --noEmit` — clean.
- `npx eslint .` — 0 errors, 5 warnings, all pre-existing and outside `app/trade`.
- `npx next build` — passes, same 17 routes as before the change.

### Noticed but deliberately left alone

1. **`searchAbortRef` is dead code.** It is declared and `.abort()`ed in
   `closeModal`, but never assigned an `AbortController`. Carried across
   verbatim into `useListingForm` rather than removed, so this run stays a pure
   move.
2. **"My Collection" search is name-blind.** `openModal` maps `user_cards` rows
   to `{ id: card_id, name: card_id, number: '' }`, so owned cards carry a card
   ID where their name should be. The mode works only because results are
   matched by ID.
3. **Collection mode over-fetches then under-matches.** It always hits
   `/api/pokemon/search/cards?pageSize=12` and filters client-side against owned
   IDs, so a card you own is invisible unless it lands in the API's first 12
   results.
4. **No memoisation anywhere on the board.** Every keystroke in the filter bar
   re-renders every listing card. Left for the performance run.
5. **The condition list is duplicated** between `TradeFilterBar` and
   `ListingModal`, exactly as it was duplicated in the original file. Not
   hoisted to a shared constant — that is a judgement call about the shape of
   the module, not a mechanical move.
6. **`setOptions` builds a `Map` whose keys and values are both `set_name`.** A
   `Set` would do. Left as-is.
7. **The Manage dropdown has no outside-click or Escape handler**, and "Delete
   listing" fires immediately with no confirmation.
