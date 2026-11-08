// Price alerts: a wishlist card with a target price, and the cached market
// price from card_prices. Pure, so the wishlist page, the home page and the
// tests all agree on what "under your target" means.
//
// The rules:
//   * The market price is card_prices.price_mid, in GBP (the price route
//     converts TCGplayer and Cardmarket to GBP before it caches).
//   * A price counts when it is at or under the target. Equal counts: "alert
//     me at £10" should fire at £10.00.
//   * Stale prices don't count. The cache is refreshed when someone views the
//     card, so a row can sit untouched for months. Default: 7 days.
//   * Rows in another currency are skipped rather than guessed at.

export type WishlistTarget = {
  id: string;
  card_id: string;
  card_name: string;
  set_name: string | null;
  card_number: string | null;
  image_url: string | null;
  target_price: number | string | null;
};

export type CachedPrice = {
  card_id: string;
  price_mid: number | string | null;
  currency: string | null;
  fetched_at: string | null;
};

export type PriceAlert = {
  wishlistId: string;
  cardId: string;
  cardName: string;
  setName: string | null;
  cardNumber: string | null;
  imageUrl: string | null;
  target: number;
  price: number;
  saving: number;
  percentUnder: number;
  fetchedAt: string;
};

export const DEFAULT_MAX_PRICE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_TARGET_PRICE = 100_000;

// Postgres numeric arrives from PostgREST as a string or a number.
function toAmount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function findUnderTarget(
  wishlist: WishlistTarget[],
  prices: CachedPrice[],
  options: { nowMs: number; maxAgeMs?: number }
): PriceAlert[] {
  const maxAge = options.maxAgeMs ?? DEFAULT_MAX_PRICE_AGE_MS;
  const byCard = new Map<string, CachedPrice>();
  for (const row of prices) byCard.set(row.card_id, row);

  const alerts: PriceAlert[] = [];
  for (const item of wishlist) {
    const target = toAmount(item.target_price);
    if (target === null || target <= 0) continue;
    const cached = byCard.get(item.card_id);
    if (!cached || !cached.fetched_at) continue;
    if ((cached.currency ?? 'GBP').toUpperCase() !== 'GBP') continue;
    const price = toAmount(cached.price_mid);
    if (price === null || price <= 0) continue;
    const fetchedMs = Date.parse(cached.fetched_at);
    if (!Number.isFinite(fetchedMs) || options.nowMs - fetchedMs > maxAge) continue;
    if (price > target) continue;

    alerts.push({
      wishlistId: item.id,
      cardId: item.card_id,
      cardName: item.card_name,
      setName: item.set_name,
      cardNumber: item.card_number,
      imageUrl: item.image_url,
      target,
      price,
      saving: round2(target - price),
      percentUnder: Math.round(((target - price) / target) * 100),
      fetchedAt: cached.fetched_at,
    });
  }

  // Biggest drop first; ties by name so the order is stable.
  return alerts.sort((a, b) => b.percentUnder - a.percentUnder || a.cardName.localeCompare(b.cardName));
}

// What the target box accepts: blank (no alert), or pounds with up to 2 decimal
// places, optionally with a £. Mirrors the check in the 023 proposal.
export function parseTargetPrice(input: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = input.trim().replace(/^£\s*/, '').replace(/,/g, '');
  if (text === '') return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { ok: false, error: 'Use pounds and pence, e.g. 12.50' };
  const value = Number(text);
  if (value <= 0) return { ok: false, error: 'Target must be more than £0' };
  if (value > MAX_TARGET_PRICE) return { ok: false, error: 'Target is too high' };
  return { ok: true, value };
}

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
export function formatGbp(amount: number) {
  return GBP.format(amount);
}
