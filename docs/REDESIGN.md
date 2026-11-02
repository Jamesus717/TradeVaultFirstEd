# Redesign for approval

Not deployed. To see it locally:

```bash
npm run demo
```

Then open http://localhost:3100 (matches), `/shops`, `/shops/example-cards-leeds`, `/preview` (the meet step), `/binder` and `/trade`. Demo mode uses made-up traders and shops, labels them as examples, and blanks the Supabase settings so it can't reach production. Screenshots are in `docs/redesign/`.

## What changed

- **Colour:** flat binder-vinyl navy instead of near-black with glows and a dot grid. The four accent themes still work.
- **Foil:** kept for owned cards and the Two-way tag, so it always means something.
- **Type:** Bricolage Grotesque stays for headings, and Instrument Sans replaces Inter. All-caps tracked labels are gone.
- **Shape:** smaller corners, flat panels, no blur.
- **Phones:** bottom nav with Matches, Binder, Trade and Shops; the menu holds the rest. Modals become full-screen sheets, and tap targets are at least 44px on the new screens.
- **Home:** `/` is now matches. The binder moved to `/binder`.

## Live without the migrations

- Home shows "Matching is on its way".
- `/shops` shows "No shops listed yet".
- The meet panel and shop filter stay hidden.
- Quick add writes to the existing `user_cards` and `wishlist_cards` tables, as Normal variant (Unlimited for vintage sets, matching the binder). The wishlist half needs migration 018.

## Not tested

- Matches, shops, meet step and quick add against a real database. The database functions are tested on PGlite only, and the new screens were only seen with demo data.
- Quick add needs a signed-in user, so its screen has not been run. Its save logic is tested with a fake client only.
- The meet panel refreshing when the other trader answers relies on realtime, so it has not been seen working.
