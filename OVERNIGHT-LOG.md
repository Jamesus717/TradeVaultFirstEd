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

---

# Run 3 — Refactor: auth out of the navbar, and the inbox conversation page

**Status: done. `npx next build` passes (17 routes, same as runs 1 and 2).
`npx tsc --noEmit` clean. `npx eslint .` — 0 errors, 3 warnings (down from 5;
the two that went were dead code in the navbar, see below).**

Dependencies installed fine (`npm ci`, exit 0). Refactor only — no behaviour
change, no restyling. Nothing was renamed, reordered or "improved" on the way
through, and run 4 will find the UI exactly as it was.

## Priority: `app/navbar.tsx`, 831 lines → 385

Login, signup, password reset and the username picker all lived inside the
navbar component. They now live in `app/auth/`, and the navbar imports and
renders them.

### Where it went

It sits alongside the two things already called `auth`, rather than clashing
with them. `app/auth.tsx` (the `AuthProvider` context) and
`app/auth/callback/route.ts` are both untouched — the new files are the rest
of `app/auth/`. The layout follows `app/binder/` and `app/trade/`: `types.ts`
/ `utils.ts` at the top level, plus `components/` and `hooks/`.

| File | Lines | What it holds |
| --- | ---: | --- |
| `app/navbar.tsx` | 385 | Nav links, mobile menu, the unread-notifications subscription, Logout |
| `app/auth/hooks/useAuthForm.ts` | 193 | Every piece of modal state and all six handlers |
| `app/auth/components/AuthModal.tsx` | 69 | Overlay, card, header, and the three-way view switch |
| `app/auth/components/CredentialsView.tsx` | 149 | Login/Sign Up tabs, Google, the fields, submit |
| `app/auth/components/ForgotPasswordView.tsx` | 57 | Reset-link request and its two banners |
| `app/auth/components/VerifyEmailView.tsx` | 38 | "Check your email", resend, back to login |
| `app/auth/components/UsernameField.tsx` | 28 | The username picker and its three validation messages |
| `app/auth/components/GoogleSignInButton.tsx` | 19 | The button and its four-path SVG |
| `app/auth/utils.ts` | 59 | `classNames`, `isUnverifiedEmailError`, the username rules, the submit-disabled test |
| `app/auth/types.ts` | 3 | `AuthMode`, `AuthView` |

831 lines in one file → 1,000 across 10 files. The growth is imports and prop
type declarations; no logic was added.

### Two couplings worth knowing about

- **The Logout button shares `submitting` with the modal.** It always did —
  `handleLogout` sets the same flag the login form uses. So `handleLogout`
  stayed on `useAuthForm`, and the navbar reads `submitting` from the same
  hook instance it passes to `AuthModal`. Giving logout its own flag would
  have been tidier and would have been a behaviour change.
- **`useAuth()` is now called twice per render** — once by the navbar for
  `user` / `authLoading` / `supabaseDisabled`, once inside `useAuthForm`.
  That is two `useContext` reads of one memoised value, not two subscriptions.

### Three things I deduped, and why each is safe

Everything else is a verbatim move. These three are not, so they are listed
explicitly:

1. **`showView(view)`.** Five buttons each ran the same three setters
   (`setAuthView(x); setAuthError(''); setResetSuccess('')`). They now call
   one function that runs the same three in the same order. React batches
   them identically either way.
2. **`isCredentialsSubmitDisabled(...)`.** The submit button's `disabled` and
   its `className` each held a copy of the same long boolean expression,
   character for character. One function, called once, feeds both.
3. **`usernameValidationMessage(...)`.** The three-branch ternary in the JSX
   became a function returning the message string, with the same precedence.
   The `<p className="mt-1 pl-2 text-xs text-rose-400">` around it is
   unchanged, so the rendered DOM is identical.

## Secondary: `app/inbox/[conversationId]/page.tsx`, 962 lines → 134

Navbar was finished and building before I started this. Same shape again.

| File | Lines | What it holds |
| --- | ---: | --- |
| `page.tsx` | 134 | Composition root: the render gates and the two-column layout |
| `hooks/useConversation.ts` | 247 | Load, participant check, profiles, read receipts, the realtime channel, the scroll-to-bottom effect |
| `hooks/useConversationActions.ts` | 249 | Send message, send offer, offer decisions, mark completed, mark listing sold |
| `components/MessageComposer.tsx` | 118 | The textarea, the offer box, Send |
| `components/ListingSidebar.tsx` | 104 | Card image, badges, price, seller, Mark as Sold |
| `components/MessageItem.tsx` | 104 | One message: system line, offer card, or text bubble |
| `components/ConversationHeader.tsx` | 55 | Back link, thumbnail, status badge |
| `components/MessageList.tsx` | 36 | The scroll container and the map |
| `components/ClosedConversationNotice.tsx` | 30 | The non-active footer and Mark as Completed |
| `utils.ts` | 96 | `classNames`, `formatMoneyGBP`, `formatTimeAgo`, the three badge helpers, `shortId`, the two column lists |
| `types.ts` | 58 | `Conversation`, `Message`, `Listing`, `PublicProfile` and the status unions |

**Run 2's performance work is carried across intact** — the parallel
conversation/messages fetch, the fire-and-forget read receipts with their
`.catch`, and the comments explaining both. I did not "tidy" the load-bearing
`.then()` in `app/inbox/page.tsx`; that file is untouched.

One dedupe here: the Counter button's two setState calls became
`startCounterOffer(message)` on the actions hook, so the message list does
not need the composer's setters passed down through it.

## How I checked nothing changed

Build, typecheck and lint all pass, but those only prove it compiles. For
behaviour I diffed the old file against the new ones twice:

- **Every string literal**, counted. For the navbar the only differences are
  import paths, `'use client'`, the three username messages moving from JSX
  into `utils.ts`, and the exact reductions the three dedupes above predict
  (−8 empty strings from `showView`, +1 from the new function's fallback;
  −1 `'signup'` from the deduped disabled test; −2 of the shared rose-400
  className). For the inbox, import paths and `'use client'` and nothing
  else.
- **Every JSX text node**, counted. Identical on both files — no label,
  placeholder, button text or sentence of copy differs.

So: no className, copy, placeholder or `aria-label` changed anywhere, and
every form, validation message, error state and redirect goes through the
same code it did before.

## Noticed but deliberately left alone

1. **`app/auth.tsx` sits next to the `app/auth/` directory.** Importing
   `'../../auth'` from inside `app/auth/hooks/` resolves to the *file*,
   because TypeScript tries `auth.tsx` before `auth/index`. That is correct
   today and the build proves it, but it reads as ambiguous. If you ever want
   it unambiguous, moving the provider to `app/auth/AuthProvider.tsx` with a
   re-export is a five-minute job — I did not do it because it would touch
   the ten files that import `useAuth`, which is a wider blast radius than
   this run was for.
2. **The auth modal has no Escape handler and no focus trap.** Clicking the
   backdrop closes it; Escape does not. Pre-existing, and a behaviour change
   to fix, so not mine tonight. Run 4's territory if the UI pass wants it.
3. **`AuthMode` (`'login' | 'signup'`) is dead.** Declared in the old navbar
   and never used — `openAuthModal` takes an `AuthView`. Moved to
   `app/auth/types.ts` rather than deleted, so this run stays a move.
4. **`signUp` was being destructured from `useAuth()` and never called** —
   only `signUpWithUsername` is. I dropped the unused binding. That plus
   `AuthMode` becoming an export is why eslint went from 5 warnings to 3.
5. **The navbar's nav links are five copies of the same markup**, twice over
   (desktop and mobile), differing only in href, label and active class. A
   `NavLink` component would take ~120 lines out of the 385. I left it —
   the brief was auth, and run 4 is going to be editing exactly this markup,
   so a restructure tonight would collide with it.
6. **The read-receipt bug from run 2, note 1, is still there.** The bare
   `client.from('messages').update(...)` in the realtime INSERT handler still
   never issues its request; it is now at
   `hooks/useConversation.ts`, in the INSERT handler. Still a one-word fix
   (`.then(() => {})`), still a behaviour fix rather than a refactor, so
   still yours to call.
7. **`classNames` now exists in four places** — `app/trade/utils.ts`,
   `app/binder/utils.ts`, `app/auth/utils.ts` and
   `app/inbox/[conversationId]/utils.ts`. It was already duplicated before
   tonight; I matched the existing pattern rather than introducing a shared
   `lib/` helper, because that is a decision about the shape of the codebase
   and not a mechanical move. Worth doing deliberately at some point.
8. **`formatTimeAgo` and the badge helpers are duplicated** between
   `app/trade/utils.ts` and `app/inbox/[conversationId]/utils.ts`, and
   `app/inbox/page.tsx` has its own copies again. Same reasoning as above.
9. **`app/profile/page.tsx` (425) and `app/profile/ProfileView.tsx` (431)**
   are the next-largest files and split the same way if you want a run 5.
