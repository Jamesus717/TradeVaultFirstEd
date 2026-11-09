# Share cards

Public pages `/u/[slug]` and `/shops/[slug]` now carry Open Graph and Twitter tags plus a generated 1200x630 image, so a shared link previews well.

## How
- `lib/shareCards.ts` picks what a card may say from an allow-list: display name, card count, up to 3 top cards (highest cached price, names from `catalog_cards`). Shops: name, town, games.
- `postcode_prefix`, address, user ids and emails are never selected, so they cannot leak.
- `generateMetadata` in each page, plus `opengraph-image.tsx` and `twitter-image.tsx` using `next/og` `ImageResponse` (`lib/shareImage.tsx`). Default font only, no fetches, so it suits the Cloudflare Workers build.
- Unknown slug, bad slug or lookup error gives the generic site card, never a 500. The page itself still 404s for unknown slugs.

## Limits
- Top card names need `catalog_cards` (migration 019, not yet applied). Until then the card shows the count only.
- Shops have no card count, so the card shows town and games.

## Try it
`DEMO_PORT=3114 npm run demo`, then open `/u/sam/opengraph-image` and `/shops/example-cards-leeds/opengraph-image`.
