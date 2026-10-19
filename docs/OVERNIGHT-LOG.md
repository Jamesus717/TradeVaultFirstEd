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

---

# Run 4 — Responsiveness pass ("feels clunky")

**Status: done. `npx next build` passes (17 routes, same as runs 1–3).
`npx tsc --noEmit` clean. `npx eslint .` — 0 errors, 3 warnings, the same 3
run 3 reported.**

Dependencies installed fine (`npm ci`, exit 0). I took a baseline build before
touching anything so I could tell my own breakage from inherited breakage; it
passed, so everything below is measured against a green start.

**No colour, font, layout or overall look was changed.** Every edit is either
invisible until something is loading, invisible until a button is mid-flight,
or provably identical in rendered output. The look-changing ideas are in
"Suggested but not done" below for you to approve or reject.

---

## 1. No feedback on actions

This was the biggest single cause. Several buttons ran **three to five
sequential network writes** and showed nothing at all while doing it — no
disable, no label change. You click "Accept", the button looks untouched for a
second or two, and a second click starts the whole thing again.

Every fix below is the same shape: a flag that drives `disabled` plus an
in-flight label, using the `'Submitting…'` / `'Saving...'` wording already
used elsewhere in the app. **No write order changed anywhere.**

| Button | Where | Writes it was running silently | Now |
| --- | --- | ---: | --- |
| **Accept** / **Decline** | offer in a conversation | 4 | disabled + "Accepting…" / "Declining…" |
| **Counter** | offer in a conversation | 0 (opens the composer) | disabled while a decision is in flight |
| **Mark as Completed** | closed-conversation footer | 3 | disabled + "Marking…" |
| **Mark as Sold** | conversation listing sidebar | up to 5 | disabled + "Marking…", then "Marked as Sold" |
| **I'm Interested** | trade board card | up to 5, then navigates | disabled + "Opening…" |
| **Mark as sold** / **Delete listing** | trade board Manage menu | 1 each | disabled + "Working…" |
| **Send password reset email** | profile | 1 | disabled + "Sending…" |

Four details worth knowing:

- **A decision anywhere in a thread locks every offer's buttons**, not just
  the one clicked. The writes are sequential and they touch the shared
  conversation status, so a second decision landing mid-flight is exactly
  what wants preventing.
- **"I'm Interested" deliberately stays in its in-flight state through the
  navigation.** Clearing it on success would snap the button back to
  "I'm Interested" for the frame before the route changes. Only a path that
  gives up without navigating hands control back. To do that cleanly I split
  the body into an inner function returning "did it navigate"; the six return
  paths are otherwise untouched and the write order is identical.
- **"Mark as Sold" gave no feedback of any kind, ever** — it wrote and then
  changed nothing on screen, so there was no way to tell whether it had
  worked. It now latches to "Marked as Sold".
- ⚠️ **One real behaviour change, flagged deliberately.** `markListingSold`
  now checks the error on its first write (`trade_listings.is_active = false`)
  and stops if it failed. Previously that error was ignored and the code went
  on to cancel every conversation on the listing and post "Listing marked as
  sold" into each — for a listing that was in fact still active. On the normal
  path nothing differs. I judged "don't cascade off a failed write" the safer
  side, but it is the one thing in this run that is not purely cosmetic, so
  it is the one thing to look at first if something seems off.

## 2. `prefers-reduced-motion` was not handled at all

There was no `prefers-reduced-motion` block anywhere in the app. Added one to
`app/globals.css`. It collapses animation and transition durations **only for
users whose OS already asks for reduced motion** — if you have not turned that
on, nothing about the app changes.

One detail: it sets `animation-iteration-count: 1` alongside the near-zero
duration, so animations land on their *final* keyframe instead of freezing
part-way. For Tailwind's `animate-pulse` (`0%,100% { opacity: 1 }`) that end
state is fully opaque, so loading skeletons stay clearly visible rather than
stalling half-faded. Getting this wrong is the usual way a reduced-motion
block makes skeletons look broken.

Also added `button:disabled { cursor: not-allowed }`, so the many buttons that
now disable mid-flight say so on hover without each needing the class.

## 3. Layout shift

**The inbox list skeleton was the wrong height — a measurable 180px jump.**
Rows were `h-[92px]` placeholders, but a real row is **122px**: `p-5` top and
bottom (40) + the `h-20` thumbnail that sets the row height (80) + 1px border
each edge. Every one of the six rows was 30px short, so the list shifted
~180px upward as it loaded. Now `h-[122px]`, with the arithmetic in a comment
so it does not silently rot.

**Three text-only loading states replaced with skeletons that match the real
geometry.** Each was a small centred line of text that then snapped to a full
page layout, moving everything:

| Page | Was | Now |
| --- | --- | --- |
| Binder (`/`) | a 10-rem "Loading set data..." card | `BinderGridSkeleton` — same grid columns and gap as `BinderGrid`, same `p-3` / `aspect-[5/7]` / footer-button geometry per card, plus the filter panel above it |
| Conversation (`/inbox/[id]`) | "Loading conversation..." in a small box | `ConversationSkeleton` — the 72px header bar, the `h-[60vh]` message panel, the 320px sidebar column |
| Collection (`/collection`) | a vertically-centred "Loading collection..." | hero + four-up stats row + 106px set rows, top-aligned like the real page |

**Expanded set cards on the collection page** showed "Loading cards..." and
then filled with a 3/4/6-column grid, resizing the card. Now placeholder tiles
in that same grid at the same `aspect-[5/7]`.

All the skeletons reuse the existing `border-white/10` / `bg-white/[0.03]` /
`bg-white/[0.06]` tokens. No new colours, no new spacing values, and the
106px / 122px / 72px numbers are derived from the real markup, not eyeballed.

**Images: checked, nothing to fix.** Every image in the app already goes
through `next/image` with either `fill` inside an `aspect-[…]` box or an
explicit `width`/`height`, so none of them can shift as they load.

**Price badges: checked, nothing to fix.** `CardPriceBadge` already renders a
`shrink-0` "..." placeholder inline while loading, so the card name does not
reflow when a price arrives.

## 4. Inconsistent spacing

**Trade board: the sign-in notice was `mt-4` where its three siblings are
`mt-6`.** The filter bar, the error panel and the grid all sit at `mt-6` in
the same stack; the notice was the only `mt-4` of the four. Now `mt-6`.

This is the one change in the run that moves a pixel of the signed-out view —
8px — and I made it because "inconsistent spacing between components that
should match" cannot be fixed without changing spacing. If you would rather
it stayed, it is a one-word revert.

## 5. Janky transitions

**Narrowed three `transition-all` declarations to the properties that
actually change.** `transition-all` makes the browser diff every animatable
property on every style recalculation of the element. The rendered animation
is identical in all three cases — same properties, same durations:

| Element | Was | Now | Why it is identical |
| --- | --- | --- | --- |
| Binder card (`BinderGrid`) | `transition-all duration-200` | `transition-[background-color,border-color,box-shadow] duration-200` | those three are the only differences between the owned and unowned states |
| Trade listing card | `transition-all duration-200` | `transition-colors duration-200` | hover only changes border-color and background-color |
| Inbox list row | `transition-all` | `transition-colors` | hover only changes background-color |

The binder card is the one that matters: a set can be ~500 cards, so this is
~500 elements that stop diffing every property. The other two are tidiness by
the same argument.

I left the remaining `transition-all`s alone — they are on progress bars and
theme swatches, a handful of elements each, where there is nothing measurable
to win.

## How I checked I did not change the look

- Build, typecheck and lint: all clean, same 17 routes, no new lint warnings.
- The three narrowed transitions were each checked property-by-property
  against the classes that actually toggle on that element, which is why two
  became `transition-colors` and one needed an explicit list including
  `box-shadow` — `transition-colors` alone would have dropped the owned
  card's shadow animation.
- Every skeleton's dimensions are derived from the real component's padding,
  border and content box rather than guessed, and each carries the arithmetic
  in a comment.
- Nothing outside a loading branch or a mid-flight branch had its classes
  touched, with the single deliberate exception of the `mt-4` → `mt-6` in
  section 4.

### What I could not measure

Still no browser and no real Supabase credentials here, same as run 2. The
round-trip counts and the 30px-per-row skeleton error are read off the code
and the box model and are certain. "Feels faster" I cannot put a number on —
the fixes are the ones the brief named, but you are the one who can tell me
whether it stopped feeling clunky.

---

## SUGGESTED BUT NOT DONE

All of these change how something looks or behaves, so they are yours to
approve or reject. Roughly most-worth-doing first.

1. **Escape key does not close the auth modal or the listing modal.**
   `CardDetailModal` already closes on Escape and locks background scroll;
   the other two modals do neither, so the app is inconsistent about it.
   I did not add it because both are *forms* — an Escape press meant for a
   dropdown would bin a part-filled listing, and losing a form to a stray
   keypress is worse than the missing shortcut. Needs a decision from you:
   Escape always, Escape only when the form is untouched, or a confirm.

2. **Background scroll-lock on those same two modals.** Same inconsistency
   with `CardDetailModal`. The catch: `overflow: hidden` on `body` removes
   the scrollbar, which shifts the page sideways on any platform with classic
   scrollbars — i.e. fixing one shift by adding another. `scrollbar-gutter:
   stable` on `html` would fix it properly *and* fix the existing shift that
   `CardDetailModal` already causes, but it reserves gutter space, which is a
   real (small) look change on pages that do not scroll.

3. **🐛 The collection page's expandable set card clips its own contents.**
   It animates `max-height` to a hard-coded `max-h-[800px]`, the panel has no
   `overflow-y-auto`, and the `<article>` around it is `overflow-hidden` — so
   anything past 800px is cut off with **no way to scroll to it**.

   I worked the numbers rather than guessing: at desktop width the sets
   column is ~800px, so the 6-column grid gives ~116px tiles, ~163px tall at
   `aspect-[5/7]`, ~175px per row with the gap. After the panel's `p-5` and
   the "View in Binder" footer there is room for about **4 rows — roughly 24
   cards**. Own more than that in one set and the rest are invisible. That is
   a low enough bar that I would expect you to hit it, so check your biggest
   set first.

   I did not fix it because every fix is visible: `overflow-y-auto` adds a
   scrollbar inside the card, a bigger `max-h` is still an arbitrary cutoff,
   and the clean fix (`grid-template-rows: 0fr → 1fr`, or measuring the
   content height) changes how the expand animates. Your call which.

   Related and cosmetic: because the range is fixed at 800px, a set with few
   cards animates across the full 800px and so appears to rush and stop
   early. The `grid-template-rows` fix solves both at once.

4. **Profile page uses `py-10` where every other page uses `py-8`.** An 8px
   inconsistency in the top-level page padding. One word to change, but it
   moves the whole profile page, which is why it is here and not above.

5. **The binder hero renders `0 / --` and `0%` before data arrives, then
   jumps to the real numbers.** It sits outside the loading gate, so it
   always flashes zeros first. No layout shift (the box is fixed height), just
   a value jump. A skeleton in the three hero fields would fix it, at the cost
   of changing what you see for the first moment of every load.

6. **The profile edit form renders empty inputs and then populates them.**
   The drafts start as `''` and are filled from a `setTimeout(…, 0)` once the
   profile arrives, so the fields visibly fill in. Fixing it means either a
   skeleton or disabling the fields until loaded — both change the first
   moment of the page.

7. **Trade listing cards use `aspect-[3/4]` where binder cards use
   `aspect-[5/7]`.** Real cards are 5:7, so trade board images are very
   slightly cropped by `object-cover`. Aligning them is a visible change to
   every card on the board.

8. **Skeleton counts are fixed** — 8 trade cards, 12 binder cards, 6 inbox
   rows, 5 set rows. If your real counts are usually much larger or smaller
   there is still a small shift when the data lands. Remembering the last
   count per view would remove it, but it needs somewhere to persist.

9. **The trade board's Manage dropdown still has no outside-click or Escape
   handler, and "Delete listing" still fires with no confirmation** (run 1,
   note 7). The missing confirmation is the one I would take: deleting a
   listing on a single mis-click is unrecoverable. It adds a dialog, so it is
   a look change.

10. **🐛 The read-receipt bug is still there** (run 2 note 1, run 3 note 6).
    In `hooks/useConversation.ts` the realtime INSERT handler's
    `client.from('messages').update({read_at: …})` is a bare statement, so
    **the request is never issued** and a message arriving while you have the
    conversation open is never marked read. Still a one-word fix
    (`.then(() => {})`). Three runs have now declined to touch it because it
    is a behaviour fix rather than the thing that run was for — but it is a
    genuine bug and it is the one I would do first tomorrow.

---

# All four runs — summary

| Run | Brief | Result |
| --- | --- | --- |
| 1 | Split `app/trade/page.tsx` | 1,419-line file → 64-line composition root + 12 focused modules. Pure move, no behaviour change. |
| 2 | Performance | One shared set-cards cache (collection page went from 2N requests to N); inbox conversation page 4 sequential round trips → 2; API cache headers made consistent; a duplicated `card_prices` query removed; binder grid memoised. |
| 3 | Refactor navbar + inbox conversation page | `navbar.tsx` 831 → 385 lines with auth lifted into `app/auth/`; conversation page 962 → 134 lines. Pure move, run 2's perf work carried across intact. |
| 4 | "Feels clunky" | 7 button groups now show in-flight state; `prefers-reduced-motion` handled; a 180px inbox skeleton error fixed; 4 text-only loading states replaced with geometry-matched skeletons; one spacing inconsistency; 3 `transition-all` narrowed. |

Every run ended with `npx next build` passing, `npx tsc --noEmit` clean, and
eslint at 0 errors. Lint warnings went 5 → 5 → 3 → 3. Route count stayed at 17
throughout, so nothing was added or lost at the routing level.

**The one thing no run did:** any of it in a browser against a real database.
There were no Supabase credentials in this environment on any of the four
runs, so all four are verified by build, typecheck, lint and reading the code
— not by using the app. That is the gap your morning fills.

## Suggested order to test in the morning

Fastest way to find a problem, worst-case first. Runs 1 and 3 were pure
refactors of exactly these screens, so a smoke test doubles as their check.

1. **Trade board loads and lists** (`/trade`). Run 1 rebuilt this page from
   one file into thirteen, so start here. Filters, the set/condition/type
   dropdowns, "Clear filters".
2. **Create a listing.** The full modal: collection-vs-all search, pick a
   card, variant/condition/type, price, photo, submit. Most moving parts of
   any single flow in the app.
3. **"I'm Interested" on someone else's listing.** ← *the change I would
   most want confirmed.* The button should grey out and read "Opening…"
   immediately, stay that way, and land you in the conversation. It should be
   impossible to double-click into two conversations.
4. **Send a message, then send an offer.** Check the conversation opens and
   both send.
5. **Accept an offer.** ← *second most important.* "Accepting…" on the button
   you clicked, all three buttons greyed, then the conversation closes to the
   accepted state. Then **Mark as Completed** ("Marking…").
6. **Mark as Sold from the conversation sidebar.** ← *this is where my one
   real behaviour change is* (section 1, last bullet). It should read
   "Marking…" then latch to "Marked as Sold", and the other buyers'
   conversations on that listing should be cancelled with a system message.
   If anything in this run misbehaves, I would expect it here.
7. **Log in / sign up / password reset / username picker.** Run 3 moved all
   of this out of the navbar. Also click **Send password reset email** and
   watch for "Sending…".
8. **Binder** (`/`). Pick a set — you should get a skeleton grid, not a
   "Loading set data..." box. Then search, sort, the owned filters, mark a
   card owned, "Mark all as owned".
9. **Collection** (`/collection`). Should come up as a skeleton dashboard,
   not a centred line of text. Expand a set card — and if you have a set big
   enough to overflow, check whether its cards are clipped (suggestion 3).
10. **Inbox list** (`/inbox`). Watch the skeleton rows: they should be the
    same height as the real rows, with no jump as it loads.
11. **Profile** (`/profile`). Display name, username, bio, avatar, theme
    swatches.
12. **Optional, if you use "reduce motion"** (macOS: Accessibility → Display
    → Reduce motion; Windows: Settings → Accessibility → Visual effects).
    Animations should go instant and skeletons should stay solid, not
    half-faded. If you do not use that setting, nothing should look different
    from before — that is the point.

If something is broken, `git log --oneline` on this branch gives you four
commits to bisect, one per run, each self-contained.

---

# Review — 2026-09-12 (interactive session, real browser + real database)

All four runs verified: `npm ci`, `tsc`, `eslint` (0 errors), `next build` pass.
Dev server run against the live Supabase project; every API route exercised.

## Fixed on this branch

| What | Detail |
| --- | --- |
| **Read receipts** | The bare `.update()` in `useConversation.ts` now has a `.then()`, so the request is actually sent. |
| **Prices were fake in production** | eBay shut the Finding API down on 2025-02-05 (every call is now an empty HTTP 418), and `NEXT_PUBLIC_DEV_PRICES=true` in `.env.local` was baked into the deployed build — the live site showed £7.50 for every card. The route now uses TCGplayer market prices (Cardmarket fallback) from the Pokémon TCG API, converted to GBP at the ECB rate. Mock mode is compiled out of production builds (verified: built with the flag on, the mock branch is absent). |
| **Reverse holos shared the base card's price** | Client dedupe and the route's memory cache are now keyed by variant. `card_prices` stores the base print only. |
| **Pokémon TCG API flakiness** | ~65% of single-card requests returned 500/502 on 2026-09-12. `pokemonFetch` retries GET 5xx up to 4 times (failures return in ~200ms). 19/20 price lookups succeeded vs ~7/20 without. The price route also falls back to a stale `card_prices` row if upstream fails. |
| **Security advisories** | `npm audit fix`: next 16.2.5 → 16.3.5 (critical), plus sharp, postcss, nanoid. `npm audit`: 0 vulnerabilities. |
| **Migration order** | `006_card_prices_policies` / `007_rls_performance` collided with existing 006/007 and the policies file ran before `010_card_prices` creates the table. Renamed to 012 / 013. |

## Written but NOT applied — needs James

`supabase/migrations/014_messages_update_guard.sql`. The messages UPDATE
policy lets either participant rewrite any column: edit the other person's
text, change an offer amount after acceptance, or accept their own offer. The
trigger allows only what the app does (recipient sets `read_at`; recipient
decides a pending offer). Applying it to the live DB was blocked by the
permission classifier, so run it in the SQL editor.

## ⚠️ Strategic: the card catalogue has an expiry date

The Pokémon TCG API is deprecated. Per dev.pokemontcg.io: *new registrations
closed, existing keys work through 2027-03-01.* Successor is Scrydex (paid,
credit-metered). Every set, card, image URL and now price in this app comes
from it.
