import type { SupabaseClient } from '@supabase/supabase-js';
import type { CachedPrice } from './priceAlerts';

const CHUNK = 100;

// Reads the public price cache for a set of cards. Missing cards are simply
// absent; a read error returns what was read so far (alerts are a nice-to-have,
// so they never block the wishlist).
export async function fetchCachedPrices(client: SupabaseClient, cardIds: string[]): Promise<CachedPrice[]> {
  const ids = [...new Set(cardIds.filter(Boolean))];
  const out: CachedPrice[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await client
      .from('card_prices')
      .select('card_id, price_mid, currency, fetched_at')
      .in('card_id', ids.slice(i, i + CHUNK));
    if (error) break;
    out.push(...((data ?? []) as CachedPrice[]));
  }
  return out;
}

// True when the wishlist read failed only because the 023 proposal is not
// applied (Postgres "undefined column", or PostgREST's schema cache miss).
export function missingTargetColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === '42703' || error.code === 'PGRST204' || /target_price/.test(error.message ?? '');
}
