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

---

# Run 2 — Performance

**Status: done. `npx next build` passes (17 routes, same as before). `npx tsc
--noEmit` clean. `npx eslint .` — 0 errors, 5 warnings, the same 5 run 1
reported as pre-existing.**

Dependencies installed fine (`npm ci`, exit 0) — the run 1 problem did not
recur. No restyling: no className, copy or layout was touched anywhere.

### Build size

Turbopack's route table does not print per-route byte columns in this Next
version, so there is no before/after table to give. Total client JS:

| | Bytes |
| --- | ---: |
| Before | 1,405,240 |
| After | 1,406,975 |

+1,735 bytes (+0.12%), which is the new cache module and the `memo` wrapper.
The wins here are round trips and main-thread work, not bundle size.

---

## The main problem: the same set payload was fetched over and over

Four separate places each fetched `/api/pokemon/cards?setId=…&pageSize=250`
and ran `buildVariants` on the result, with no sharing between them:

- `useBinder` — the binder grid
- `useCollection` (`loadVariantTotals`) — the collection progress bars
- `useSetOwnedVariants` — **once per expandable set card** on the collection page
- `ProfileView` — the profile set totals

So opening the collection page with cards in 20 sets issued **40 requests**
for 20 distinct payloads — one round from the totals effect, another from the
20 set cards — and parsed ~250 cards forty times. Switching sets in the
binder refetched a set every single time, even one you had just been looking
at.

**Change:** new `lib/setCardsCache.ts`. One module-level cache keyed by set
id, with in-flight de-duplication so simultaneous callers share a single
request. It caches the *derived* `CardVariant[]` rather than the raw JSON —
all four callers wanted exactly that, it is far smaller than the API
response, and it means `buildVariants` runs once per set instead of once per
caller. Bounded to 40 sets with insertion-order eviction.

**Expected impact:** the largest single win. Collection page goes from 2N
requests to N; the binder serves a revisited set from memory with no network
at all. This is most of what "clunky" will have felt like.

Two supporting details:
- Both consuming effects gained an `active` guard. Cached sets now resolve
  immediately, so switching from a slow uncached set to a cached one could
  otherwise let the stale response overwrite the new one. This race existed
  before but was much harder to hit.
- The cache throws a typed `SetCardsRequestError` so the binder and the
  collection page keep their own different error copy.

## Request waterfalls

**`app/inbox/[conversationId]` — 4 sequential round trips before first paint.**
It ran conversation → messages → profiles → mark-everything-read, and only
then dropped the loading state.

- The messages query is keyed on the conversation id from the URL. It never
  needed the conversation row first, so the two now run in one `Promise.all`.
  The client-side participant check still runs before anything renders, and
  the `Participants can view messages` RLS policy (005) is the actual
  boundary either way.
- Marking messages and notifications read is housekeeping — nothing on
  screen reads the result — so it no longer blocks. Fired off with a
  `.catch`, since nothing awaits it now.

**Down from 4 round trips to 2.**

**`app/inbox` (list)** — same idea: the notification-clearing update sat in
front of the query that actually fills the page. Now fired off first and not
awaited.

⚠️ **Worth knowing:** a Postgrest builder only issues its HTTP request when
it is awaited or `.then()`ed. A bare `supabase.from(…).update(…)` statement
never runs at all. I hit this making the change above and the `.then()` in
`app/inbox/page.tsx` is load-bearing — please do not "tidy" it away. See the
pre-existing bug this causes, listed below.

**`app/trade` — checked, nothing to fix.** `useTradeListings` already runs
listings and interests in parallel; the conversations query genuinely needs
the listing ids first. `LISTING_COLUMNS` is already an explicit column list.
`useCardSearch` already debounces at 400ms and aborts in-flight requests, and
`ownedCardIdSet` is properly memoised so the debounce is not reset on every
render.

## API route caching

`app/api/pokemon/cards` already had the good pattern — a process-level cache
plus `Cache-Control` with `stale-while-revalidate`. Applied consistently:

| Route | Before | After |
| --- | --- | --- |
| `sets/[setId]` | `revalidate` only, no cache, no headers | process cache (1h) + `s-maxage=3600, swr=86400` |
| `search/cards` | `revalidate` only, no headers | `s-maxage=300, swr=86400` |
| `price` | no headers | `s-maxage=3600, swr=604800` |

- `sets/[setId]` only caches successful lookups — a 404 or 5xx cached for an
  hour would outlive the problem that caused it.
- The price route is public, slow-moving data keyed entirely by its query
  string, with nothing user-specific in the body, so it is safe to cache
  publicly. Headers go on successful responses only: eBay errors and the 429
  rate-limit response are deliberately left uncacheable.
- Nothing user-specific was cached anywhere.

## Over-fetching from Supabase

**`useCollection` was querying `card_prices` twice for the same rows.** One
effect fetched `card_id, price_mid` for prices; a second fetched
`card_id, price_mid, fetched_at` for the sparkline. Worse, the sparkline
effect listed `totalValue` in its dependencies — and `totalValue` is derived
from the prices the *other* effect loads, so it always changed once prices
arrived and the sparkline refetched every single load. Its query was also
unchunked, so a large collection built an `.in()` list long enough to risk
the URL length limit.

Merged into one chunked pass that derives both. **Two effects and at least
three queries become one.** The flat-line fallback now computes its value
from the rows just fetched instead of reading `totalValue` a render late, so
it no longer renders at £0 first and then corrects itself.

**`app/api/pokemon/price` — `select('*')` → explicit columns.** It was
pulling `id` and `set_name`, which nothing in the response uses.

**Indexes: checked, nothing needed.** The queries that matter are already
covered — `messages_conversation_created_at_idx`,
`conversations_buyer_id_idx`/`seller_id_idx`,
`notifications_user_read_created_at_desc_idx`, the `trade_listings` set, and
`card_prices.card_id`. `user_cards` is not created by any migration, but its
`onConflict: 'user_id,card_id,variant,set_id'` upsert proves a unique index
on those four columns exists, and it leads with `user_id`, which is what
every hot query filters on first. At 1,861 rows (per the note in migration
007) it is not the bottleneck. I did not add a speculative index migration
you would have to go and apply.

## Unnecessary client work

**The binder grid re-rendered every card on every keystroke.** A set is up to
~500 variants, each card carrying its own `IntersectionObserver` and price
subscription. Typing in the search box reconciled all of them.

- Extracted the card body into a memoised `BinderCard`.
- `toggleOwned` is now a `useCallback`, so the memo actually holds. Its deps
  include `owned`, which only changes when ownership changes — not while you
  type. `onCardClick` was already stable (a setState function).
- Card object identity is stable (they come straight from the set cache), so
  filtering the list no longer touches the cards that survive the filter.

**Expected impact:** typing in the binder search should stop dropping frames.

**`ownedCount` / `allOwned`** were two full scans of the set on every render.
Now one memoised pass, with `allOwned` derived from the count.

---

## Spotted but deliberately not touched

1. **🐛 Read receipts silently never send.** In
   `app/inbox/[conversationId]/page.tsx`, the realtime INSERT handler calls
   `client.from('messages').update({read_at: …}).eq('id', next.id)` as a bare
   statement — never awaited, never `.then()`ed. Per the Postgrest note
   above, **that request is never issued.** So a message that arrives while
   you have the conversation open is never marked read, and the sender's
   unread dot stays lit. One-word fix (add `.then(() => {})`), but it is a
   behaviour fix and not a performance one, so it is yours to call.

2. **`useCollectionDashboard`, `useCustomBinder`, `useCustomBinders` are dead
   code** — 896 lines, imported by nothing. Tree-shaken out, so no runtime
   cost. Related: `useCollectionDashboard` is the *only* caller of
   `/api/pokemon/sets/[setId]`, so the cache I added to that route is
   currently defensive rather than load-bearing. I added it anyway because
   the brief asked for consistency and the route is publicly reachable, but
   you should know it is not moving the needle today.

3. **Lazy-loading the collection page's expandable set cards.** I built this,
   then backed it out. Once the shared cache landed, expanding a card costs
   no extra network at all, so deferring it would only have traded an instant
   expand for a "Loading cards…" flash. Not worth it.

4. **`lib/useProfile.ts` uses `select('*')` twice.** `public_profiles` has
   roughly eight columns and the `Profile` type uses seven of them, so
   narrowing saves almost nothing — and if I named a column that does not
   exist in your database, the profile page 500s. Left alone deliberately.

5. **The binder search box has no debounce.** With the memo above, each
   keystroke now only re-renders the cards that actually changed, so a
   debounce would mostly add input lag. Worth revisiting only if it still
   feels heavy on a phone.

6. **`idx_card_prices_card_id` (migration 010) is redundant** — `card_id` is
   already `UNIQUE`, which creates its own index. Harmless, just costs a
   little on write. Dropping it is a migration you would have to apply, so I
   did not.

7. **`app/navbar.tsx` is 831 lines** and `app/inbox/[conversationId]` is 951.
   Both are splitting candidates in the shape of run 1's trade refactor, but
   that is a refactor, not a performance change.

8. **`searchAbortRef` in `useListingForm` is still dead** (run 1, note 1) and
   collection-mode card search is still name-blind and matches only the API's
   first 12 results (run 1, notes 2 and 3). Untouched — those are
   correctness, not speed.

### What I could not measure

No browser or real Supabase credentials in this environment, so everything
above is reasoned from the code and verified by build, typecheck and lint —
not by a profiler. The request-count reductions are structural and certain.
The rendering win is sound in principle but I could not put a number on it;
if you want one, React DevTools' profiler on the binder search box is the
place to look.
