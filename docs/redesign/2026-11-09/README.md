# Screens, 2026-11-09 (idea/text-size: 14 px minimum on phones)

Full-page shots at 375x812 from `npm run audit:mobile` against `npm run demo` on port 3111
(`DEMO_PORT=3111 npm run demo`, then `AUDIT_BASE=http://localhost:3111 npm run audit:mobile`).
`*-before.png` is `review/all-ideas` at 9a53032; `*-after.png` is this branch.

| Pair | Route |
| --- | --- |
| `home-phone-*` | `/`: tile subtitles, price-alert rows, fair-trade meter |
| `trade-phone-*` | `/trade`: filter chips, condition and listing-type badges, card captions |
| `matches-phone-*` | `/matches` |
| `wishlist-phone-*` | `/wishlist`: priority badges, price alerts |
| `chat-phone-*` | `/inbox/demo-chat-1`: message timestamps, status badge, listing sidebar |
| `binder-phone-*` | `/binder`: "Select Set" label |

What changed (phones only, under 640 px; desktop and tablet are unchanged):
- `text-xs` (12 px) becomes 14 px / 20 px line height by overriding `--text-xs` in `app/globals.css`.
- The arbitrary `text-[9px]`, `text-[10px]` and `text-[11px]` became theme sizes `text-4xs`, `text-3xs`
  and `text-2xs` (same 9/10/11 px on desktop), which also become 14 px on phones.
- `.holo-tag` goes from 12 px to 14 px on phones.

Audit result: 0 small-text issues on all 15 routes, no sideways scroll, nothing overlaps the tab bar.

Allowed small text (the audit skips these on purpose):
- Bottom tab bar labels (11 px). The audit has always left the fixed tab bar out; the five-tab design stays as it is.
- Unread count badges (`UnreadBadge`, 11 px in a 20 px circle), marked `data-small-text-ok`.
  Any element inside `[data-small-text-ok]` is left out of the text check in `scripts/audit-mobile.mjs`.

The sticky "TradeBinder" bar showing halfway down the full-page shots is how full-page screenshots
draw a sticky header. It is not in the page layout.
