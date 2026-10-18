# TradeBinder

TradeBinder is a full-stack web app for Pokémon TCG collecting and trading.

I built this project to get hands-on, end-to-end experience shipping a real product: authentication, database design with RLS, API integration, realtime updates, and a consistent UI system.

Live site: https://tradevaultfirstedition1.jamesfburt69.workers.dev/

## Tech Stack

- Next.js App Router + React + TypeScript
- Tailwind CSS (dark glassmorphic UI)
- Supabase (Auth, Postgres, RLS policies, Realtime, Storage)
- Cloudflare Workers deployment (OpenNext adapter)

## What Works So Far

### Collection

- **Binder**: browse sets, search within a set, sort, and track owned variants.
- **Bulk actions**: mark/unmark all cards as owned (with safe chunking).
- **My Collection**: shows only tracked sets, keeps custom binders, and uses a split layout to reduce scrolling.
- **Server-side Pokémon API layer**: client pages call internal `/api/pokemon/...` routes instead of hitting Pokémon TCG directly.

### Public Profiles

- Public identity model via `public_profiles` (slug-based route supported).

### Trade Board

- Create and browse trade/sale listings.
- Listing modal includes card search + optional image upload (Supabase Storage).
- Express interest on a listing.

### Inbox + Messaging + Offers

- Inbox list + conversation view.
- Offers inside chat with accept/decline/counter flows.
- Notification bell in navbar with unread badge.
- Realtime updates for notifications/messages.

## Project Structure (high level)

- `app/` — Next.js App Router pages and UI
  - `app/api/` — internal route handlers (server-side)
  - `app/inbox/` — inbox and conversation pages
  - `app/trade/` — trade board
- `lib/` — shared clients + server helpers
  - `lib/supabaseClient.ts` — Supabase browser client (may be null if env vars missing)
  - `lib/pokemonServer.ts` — server-only fetch helper for Pokémon TCG
- `supabase/migrations/` — schema + RLS + triggers

## Environment Variables

### Local

Create `.env.local` with:

- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase Project URL (looks like `https://<ref>.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/publishable key
- `POKEMON_TCG_API_KEY` — Pokémon TCG API key (server-side)
- `SUPABASE_SERVICE_ROLE_KEY` — optional locally; lets the price route write the `card_prices` cache

Do not commit secrets.

### Cloudflare

Set the same variables in your Worker’s dashboard (no backticks/quotes/spaces/newlines in values).
`SUPABASE_SERVICE_ROLE_KEY` must be a **secret**, never a `NEXT_PUBLIC_` variable:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Without it prices still show, but are not cached in `card_prices`.

## Database Setup (Supabase)

Apply migrations in order:

- `supabase/migrations/000_user_cards.sql`
- `supabase/migrations/001_public_profiles.sql`
- `supabase/migrations/002_public_profiles_backfill.sql`
- `supabase/migrations/003_custom_binders.sql`
- `supabase/migrations/004_trade_board.sql`
- `supabase/migrations/005_messaging_offers.sql`
- …and every later file in `supabase/migrations/` in filename order

If you ever see errors like:

> Could not find the table 'public.X' in the schema cache

it usually means the migration wasn’t applied to the correct Supabase project yet, or PostgREST needs a schema cache reload.

### How trades are enforced

The browser only does user-level writes: start a conversation, send a message
or offer, decide an offer sent to you, mark an accepted trade completed, and
deactivate your own listing. System messages, notifications, offer outcomes
and cancelling a sold listing's other conversations are written by database
triggers (`016_server_side_trade_rules.sql`), and RLS plus guard triggers
reject anything else. Don't add client-side inserts into `notifications` or
system `messages`; they will be refused.

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Deploy (Cloudflare Workers)

This repo is set up for the OpenNext adapter:

- `wrangler.jsonc`
- `open-next.config.ts`

Common commands:

```bash
npm run preview
npm run deploy
```

## About Me

I’m James Burt — a Computer Science graduate (UWE, 2025 expected 2:1) focused on junior full-stack roles.
TradeBinder is one of my main portfolio projects alongside other personal builds like SecretShop Dota and my dissertation project (full-stack scraping + local LLM recommendations).

## Notes / Next Improvements

- **The Pokémon TCG API is deprecated and keys stop working on 2027-03-01.** Move to its successor (Scrydex) before then. All card data goes through `lib/pokemonServer.ts`, so that is the one place to change.
- Add caching configuration for OpenNext (optional performance boost).
- Add moderation/abuse controls for messaging (report / block).
- Price history: `card_prices` keeps one row per card, so there is no value-over-time chart yet. A daily snapshot table would enable one.
