# Mobile audit (375x812)

Run `npm run audit:mobile` (starts the demo on :3100 if it is down). Report and screenshots land in `reports/mobile-audit/`; a copy of the screenshots is in `docs/mobile-audit/`.

**Fixed (CSS only)**
- Wishlist: priority select, quantity buttons, note input and Remove were under 44 px. Now 44 px.
- Meet panel "Suggest a different shop" was 20 px tall. Now 44 px.

**Found, not fixed**
- No sideways scroll on any route. Nothing overlaps the tab bar at the end of a page.
- Text under 14 px (12 px `text-xs`) is a design choice used everywhere: home tile subtitles, binder "Select Set", profile "Trading", trade filter chips, card captions. Raising it needs a design call.
- `/inbox/[id]`, `/profile/[id]`, `/shops/[slug]`, `/u/[slug]` return HTTP 500 in demo with made-up ids, so they are not really audited. Needs real demo ids.
- Demo banner slides under the sticky top bar in the full-page shot (probably a screenshot artifact, check on a phone).
- The dev server is slow; the audit takes about 5 minutes.
