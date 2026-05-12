# TradeBinder

TradeBinder is a full-stack web app for Pokémon TCG collecting and trading.

I built this project to get hands-on, end-to-end experience shipping a real product: authentication, database design with RLS, API integration, realtime updates, and a consistent UI system.

Live site: https://tradevault.jamesfburt69.workers.dev/

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

Do not commit secrets.

### Cloudflare

Set the same variables in your Worker’s dashboard (no backticks/quotes/spaces/newlines in values).

## Database Setup (Supabase)

Apply migrations in order:

- `supabase/migrations/001_public_profiles.sql`
- `supabase/migrations/002_public_profiles_backfill.sql`
- `supabase/migrations/003_custom_binders.sql`
- `supabase/migrations/004_trade_board.sql`
- `supabase/migrations/005_messaging_offers.sql`

If you ever see errors like:

> Could not find the table 'public.X' in the schema cache

it usually means the migration wasn’t applied to the correct Supabase project yet, or PostgREST needs a schema cache reload.

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

- Add caching configuration for OpenNext (optional performance boost).
- Add small “Settings” screen for username/display name/avatar.
- Add moderation/abuse controls for messaging.
- Expand trade flow (mark sold, completed trades, richer offer history).
