# Card data plan (2026-11-02)

Pokémon TCG API keys die 2027-03-01, and the API is unreliable today. Goal: pages read our own Supabase catalog, not a live third party.

## Sources compared

| Source | Cost | Card data | Prices | Notes |
| --- | --- | --- | --- | --- |
| Pokémon TCG API (today) | Free | Full, with rarity | TCGplayer, Cardmarket | 6/12 test requests failed with 500/502 on 2026-11-02 (no key sent). Ends 2027-03-01. |
| TCGdex | Free, no key seen | Full, but no rarity in set listings | Cardmarket EUR seen; TCGplayer null on the cards checked | 12/12 test requests worked. Set ids differ, mapped in `lib/cardData/tcgdexSetIds.json`. Licence not confirmed. |
| Scrydex | $29 / $99 / $399 a month (5k / 50k / 250k credits) | Official successor, old ids still work | Raw and graded, refreshed daily | Cardmarket not supported yet, so weaker for a UK site. Terms on long-term storage not stated. Caching is encouraged. |
| JustTCG, PokeWallet, PokemonPriceTracker | Free tiers reported | Not tested | Not tested | From third-party articles only, some by competitors. |

Prices above came from each vendor's page on 2026-11-02, except the last row.

## Recommendation
1. **Now, free:** apply `019_card_catalog.sql`, then run `scripts/import-catalog.ts --sets=all --apply` while the old API still works. It needs `SUPABASE_SERVICE_ROLE_KEY`, which only Borty should set.
2. **Before 2027-03-01:** new sets come from TCGdex, or Scrydex Starter if rarity is needed and TCGdex can't supply it cheaply.
3. **Prices:** try TCGdex's Cardmarket prices. EUR needs converting to GBP, and the licence needs checking first.
4. **Images:** the catalog stores `images.pokemontcg.io` URLs. Confirm those survive the shutdown. TCGdex and Scrydex images are the fallback, and both hosts are allowed in `next.config.ts`.

## Built (prototype)
- `019_card_catalog.sql`: `catalog_sets` and `catalog_cards`, with `game` in every key. Not applied.
- `scripts/import-catalog.ts`: dry run by default. Tested as a dry run only, `--apply` has never run.
- `lib/cardData/`: when the old API fails and no stale copy exists, the sets and cards routes try our catalog, then TCGdex. The fallback path has not been run end to end.

## Coverage test
On the 11 sets users own, 10 matched TCGdex 100% by card number (1,753 of 1,753 cards). `me55c` has no TCGdex twin (0 of 30), and one user owns a card from it, so that set must come from the catalog.

## Known gaps
- 2 of 176 sets have no TCGdex match: `fut20`, `me55c`.
- TCGdex fallback cards have no rarity. `buildVariants` then shows Normal only, so Reverse Holo ticks are hidden during a fallback, not lost.
- `fetchTcgdexSeriesSets` uses the series date for each set, so release dates are approximate during a fallback.
