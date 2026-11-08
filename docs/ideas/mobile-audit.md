# Mobile audit (375x812)

Run `npm run audit:mobile` (starts the demo on :3100 if it is down; set `AUDIT_BASE=http://localhost:3111` to use another port, the demo takes `DEMO_PORT`). Report and screenshots land in `reports/mobile-audit/`; a copy of the screenshots is in `docs/mobile-audit/`.

**Fixed (CSS only)**
- Wishlist: priority select, quantity buttons, note input and Remove were under 44 px. Now 44 px.
- Meet panel "Suggest a different shop" was 20 px tall. Now 44 px.

- Text under 14 px (idea/text-size, 2026-11-09): on phones (under 640 px) `text-xs`, `text-2xs`/`3xs`/`4xs` (the old 9-11 px) and `.holo-tag` all render at 14 px. Desktop unchanged. Allowed small: bottom tab bar labels and unread count badges (`data-small-text-ok`, skipped by the audit). Screens in `docs/redesign/2026-11-09/`.

**Found, not fixed**
- No sideways scroll on any route. Nothing overlaps the tab bar at the end of a page.
- `/inbox/[id]`, `/profile/[id]`, `/shops/[slug]`, `/u/[slug]` return HTTP 500 in demo with made-up ids, so they are not really audited. Needs real demo ids.
- Demo banner slides under the sticky top bar in the full-page shot (probably a screenshot artifact, check on a phone).
- The dev server is slow; the audit takes about 5 minutes.
