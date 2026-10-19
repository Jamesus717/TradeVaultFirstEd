'use client';

import type { CardApiResponse, CardVariant } from '../app/binder/types';
import { buildVariants } from '../app/binder/utils';

/**
 * Client-side cache for `/api/pokemon/cards?setId=...`.
 *
 * Three separate places load the same set payloads: the binder
 * (`useBinder`), the collection dashboard's variant totals
 * (`useCollection`) and each expandable set card
 * (`useSetOwnedVariants`). Without this they each fetch and re-parse a
 * ~250-card response for the same set, so the collection page issued two
 * full rounds of requests per owned set on every load, and the binder
 * refetched a set every time you switched back to it.
 *
 * We cache the *derived* `CardVariant[]` rather than the raw JSON: it is
 * what all three callers actually want, it is a fraction of the size, and
 * it means `buildVariants` runs once per set instead of once per caller.
 *
 * Card and set data is effectively static, so a session-lifetime cache is
 * safe. The route itself is still the source of truth and stays cached
 * server-side; this only removes duplicate work inside one page session.
 */

/**
 * Thrown when the route responds with a non-OK status. Callers keep their
 * own copy for this case, so the shared cache does not flatten the two
 * different messages the binder and the collection page show.
 */
export class SetCardsRequestError extends Error {}

// Cached sets are small (a flat object per variant) but not free, so keep a
// bound. Insertion-ordered eviction is enough — the collection page warms
// every owned set once and then reads them back.
const MAX_CACHED_SETS = 40;

const resolved = new Map<string, CardVariant[]>();
const inFlight = new Map<string, Promise<CardVariant[]>>();

function remember(setId: string, variants: CardVariant[]) {
  resolved.set(setId, variants);

  while (resolved.size > MAX_CACHED_SETS) {
    const oldest = resolved.keys().next();

    if (oldest.done) {
      break;
    }

    resolved.delete(oldest.value);
  }
}

/**
 * Load the card variants for a set, reusing an in-flight or completed
 * request when one exists. Rejects the same way a failed `fetch` would, so
 * callers keep their existing error handling.
 */
export function fetchSetVariants(setId: string): Promise<CardVariant[]> {
  const cached = resolved.get(setId);

  if (cached) {
    return Promise.resolve(cached);
  }

  const existing = inFlight.get(setId);

  if (existing) {
    return existing;
  }

  const request = fetch(
    `/api/pokemon/cards?setId=${encodeURIComponent(setId)}&pageSize=250`
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new SetCardsRequestError('Failed to load cards for this set.');
      }

      const json = (await response.json()) as CardApiResponse;
      const variants = buildVariants(json.data ?? []);
      remember(setId, variants);

      return variants;
    })
    .finally(() => {
      inFlight.delete(setId);
    });

  inFlight.set(setId, request);

  return request;
}
