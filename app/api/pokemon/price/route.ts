import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pokemonFetch } from '../../../../lib/pokemonServer';

// ── Where prices come from ─────────────────────────────────────────
//
// This route used eBay's Finding API (`findCompletedItems`). eBay shut the
// whole Finding API down on 2025-02-05 — it now answers every call with an
// empty HTTP 418 — and the only sold-listings replacement (Marketplace
// Insights) is not granted to independent developers. Meanwhile
// NEXT_PUBLIC_DEV_PRICES=true in .env.local was being baked into production
// builds, so the live site served the same £7.50 mock price for every card.
//
// The Pokémon TCG API we already use returns market prices on every card:
//
//   * tcgplayer  — USD, refreshed daily. Primary source.
//   * cardmarket — EUR, the European market, but the data behind the API is
//                  months stale on most cards (checked 2026-09-12). Fallback
//                  only, for cards TCGplayer has no price for.
//
// Both are converted to GBP at the day's ECB rate (frankfurter.dev, no key).
// The response shape is unchanged, so the binder and collection pages needed
// no change beyond showing the real source.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// TCGplayer refreshes daily, so a day is the most a price should be reused.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FX_TTL_MS = 12 * 60 * 60 * 1000;

// Mock prices are for local development only. NODE_ENV is 'production' in
// every `next build`, so this can no longer leak into a deploy even when the
// flag is left on in .env.local.
const DEV_MODE =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_PRICES === 'true';

// A price is public, slow-moving data keyed entirely by the query string —
// nothing user-specific in the response — so the browser and CDN can serve
// repeats. Applied to successful responses only; errors must not stick around.
const PRICE_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

const PRICE_COLUMNS =
  'card_id, card_name, price_low, price_mid, price_high, currency, sample_size, source, fetched_at';

type PriceSource = 'tcgplayer' | 'cardmarket';

type PriceResponse = {
  cardId: string;
  cardName: string;
  priceLow: number | null;
  priceMid: number;
  priceHigh: number | null;
  currency: 'GBP';
  sampleSize: null;
  source: PriceSource;
  fetchedAt: string;
  lowConfidence: false;
};

type TcgplayerEntry = { low?: number | null; mid?: number | null; high?: number | null; market?: number | null };
type UpstreamCard = {
  tcgplayer?: { updatedAt?: string; prices?: Record<string, TcgplayerEntry> };
  cardmarket?: { updatedAt?: string; prices?: Record<string, number | null> };
};

const memoryCache = new Map<string, { data: PriceResponse; expiresAt: number }>();
const upstreamCache = new Map<string, { card: UpstreamCard; expiresAt: number }>();
let fxCache: { usdPerGbp: number; eurPerGbp: number; expiresAt: number } | null = null;

// The binder's variant names, mapped to TCGplayer's price keys in the order
// worth trying. The base print of a holo rare only has `holofoil`, so the
// base list falls through to it.
function tcgplayerKeysFor(variant: string): string[] {
  if (variant === 'Reverse Holo') return ['reverseHolofoil'];
  if (variant === '1st Edition') return ['1stEditionHolofoil', '1stEditionNormal', '1stEdition'];
  return ['normal', 'holofoil', 'unlimitedHolofoil', 'unlimited', 'unlimitedNormal'];
}

// Only the base print is written to card_prices: it has one row per card, and
// the collection page reads it as "what this card is worth".
function isBaseVariant(variant: string) {
  return variant !== 'Reverse Holo';
}

// Cardmarket and TCGplayer both use 0 for "no data".
function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}

function toIsoDate(apiDate: string | undefined): string {
  // The API writes dates as "2026/09/12".
  const parsed = apiDate ? new Date(apiDate.replace(/\//g, '-') + 'T00:00:00Z') : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

async function getFxRates() {
  if (fxCache && fxCache.expiresAt > Date.now()) return fxCache;

  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=GBP&symbols=USD,EUR');
    if (!response.ok) throw new Error(`FX ${response.status}`);
    const body = (await response.json()) as { rates?: { USD?: number; EUR?: number } };
    const usdPerGbp = positive(body.rates?.USD);
    const eurPerGbp = positive(body.rates?.EUR);
    if (!usdPerGbp || !eurPerGbp) throw new Error('FX response missing rates');
    fxCache = { usdPerGbp, eurPerGbp, expiresAt: Date.now() + FX_TTL_MS };
  } catch (err) {
    // A stale rate is fine; an invented one is not. If there has never been
    // a rate, the caller returns 503 rather than guessing.
    console.error('[price route] FX lookup failed:', err);
  }

  return fxCache;
}

async function getUpstreamCard(cardId: string): Promise<UpstreamCard | null> {
  const cached = upstreamCache.get(cardId);
  if (cached && cached.expiresAt > Date.now()) return cached.card;

  const response = await pokemonFetch(
    `/cards/${encodeURIComponent(cardId)}?select=id,tcgplayer,cardmarket`
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Pokémon TCG API ${response.status}`);

  const body = (await response.json()) as { data?: UpstreamCard };
  const card = body.data ?? {};
  upstreamCache.set(cardId, { card, expiresAt: Date.now() + CACHE_TTL_MS });
  return card;
}

function priceFromCard(
  card: UpstreamCard,
  variant: string,
  fx: { usdPerGbp: number; eurPerGbp: number }
): { low: number | null; mid: number; high: number | null; source: PriceSource; updatedAt: string } | null {
  const tcgPrices = card.tcgplayer?.prices ?? {};
  for (const key of tcgplayerKeysFor(variant)) {
    const entry = tcgPrices[key];
    const mid = positive(entry?.market) ?? positive(entry?.mid);
    if (entry && mid) {
      const low = positive(entry.low);
      const high = positive(entry.high);
      return {
        low: low !== null ? round2(low / fx.usdPerGbp) : null,
        mid: round2(mid / fx.usdPerGbp),
        high: high !== null ? round2(high / fx.usdPerGbp) : null,
        source: 'tcgplayer',
        updatedAt: toIsoDate(card.tcgplayer?.updatedAt),
      };
    }
  }

  const cm = card.cardmarket?.prices ?? {};
  const reverse = variant === 'Reverse Holo';
  const mid = reverse
    ? positive(cm.reverseHoloTrend) ?? positive(cm.reverseHoloSell)
    : positive(cm.trendPrice) ?? positive(cm.averageSellPrice);
  if (mid) {
    const low = reverse ? positive(cm.reverseHoloLow) : positive(cm.lowPrice);
    return {
      low: low !== null ? round2(low / fx.eurPerGbp) : null,
      mid: round2(mid / fx.eurPerGbp),
      high: null,
      source: 'cardmarket',
      updatedAt: toIsoDate(card.cardmarket?.updatedAt),
    };
  }

  return null;
}

// Any stored price for the base print, however old. Returned without cache
// headers so the CDN doesn't hold on to it once upstream recovers.
async function readStalePrice(cardId: string, variant: string): Promise<PriceResponse | null> {
  if (!supabase || !isBaseVariant(variant)) return null;
  const { data } = await supabase
    .from('card_prices')
    .select(PRICE_COLUMNS)
    .eq('card_id', cardId)
    .in('source', ['tcgplayer', 'cardmarket'])
    .maybeSingle();
  if (!data || data.price_mid === null) return null;
  return {
    cardId: data.card_id,
    cardName: data.card_name,
    priceLow: data.price_low !== null ? Number(data.price_low) : null,
    priceMid: Number(data.price_mid),
    priceHigh: data.price_high !== null ? Number(data.price_high) : null,
    currency: 'GBP',
    sampleSize: null,
    source: data.source as PriceSource,
    fetchedAt: data.fetched_at,
    lowConfidence: false,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cardId = url.searchParams.get('cardId');
  const cardName = url.searchParams.get('cardName');
  const setName = url.searchParams.get('setName') ?? '';
  const variant = url.searchParams.get('variant') ?? '';

  if (!cardId || !cardName) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
  }

  const memoryKey = `${cardId}|${isBaseVariant(variant) ? 'base' : variant}`;
  const memoryCached = memoryCache.get(memoryKey);
  if (memoryCached && memoryCached.expiresAt > Date.now()) {
    return NextResponse.json(memoryCached.data, { headers: PRICE_CACHE_HEADERS });
  }

  if (DEV_MODE) {
    return NextResponse.json({
      cardId,
      cardName,
      priceLow: 4.99,
      priceMid: 7.5,
      priceHigh: 12.0,
      currency: 'GBP',
      sampleSize: null,
      source: 'mock',
      fetchedAt: new Date().toISOString(),
      lowConfidence: false,
    });
  }

  try {
    // STEP A — Reuse a price another visitor already fetched today. Only the
    // base print is stored, so reverse holos always go upstream (and are then
    // served from memory).
    if (supabase && isBaseVariant(variant)) {
      const { data: cachedPrice, error: cacheError } = await supabase
        .from('card_prices')
        .select(PRICE_COLUMNS)
        .eq('card_id', cardId)
        .in('source', ['tcgplayer', 'cardmarket'])
        .gte('fetched_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
        .limit(1)
        .maybeSingle();

      if (cachedPrice && !cacheError && cachedPrice.price_mid !== null) {
        const responseData: PriceResponse = {
          cardId: cachedPrice.card_id,
          cardName: cachedPrice.card_name,
          priceLow: cachedPrice.price_low !== null ? Number(cachedPrice.price_low) : null,
          priceMid: Number(cachedPrice.price_mid),
          priceHigh: cachedPrice.price_high !== null ? Number(cachedPrice.price_high) : null,
          currency: 'GBP',
          sampleSize: null,
          source: cachedPrice.source as PriceSource,
          fetchedAt: cachedPrice.fetched_at,
          lowConfidence: false,
        };
        memoryCache.set(memoryKey, {
          data: responseData,
          expiresAt: new Date(cachedPrice.fetched_at).getTime() + CACHE_TTL_MS,
        });
        return NextResponse.json(responseData, { headers: PRICE_CACHE_HEADERS });
      }
    }

    // STEP B — Market prices from the Pokémon TCG API, converted to GBP.
    let card: UpstreamCard | null;
    let fx: Awaited<ReturnType<typeof getFxRates>>;
    try {
      [card, fx] = await Promise.all([getUpstreamCard(cardId), getFxRates()]);
    } catch (upstreamErr) {
      // Upstream is flaky (see lib/pokemonServer.ts). An out-of-date price
      // beats no price, so fall back to whatever card_prices last held.
      const stale = await readStalePrice(cardId, variant);
      if (stale) return NextResponse.json(stale);
      throw upstreamErr;
    }

    if (!fx) {
      return NextResponse.json({ error: 'Price data temporarily unavailable' }, { status: 503 });
    }

    const price = card ? priceFromCard(card, variant, fx) : null;
    if (!price) {
      return NextResponse.json({ error: 'No price data found', cardId }, { status: 404 });
    }

    const responseData: PriceResponse = {
      cardId,
      cardName,
      priceLow: price.low,
      priceMid: price.mid,
      priceHigh: price.high,
      currency: 'GBP',
      sampleSize: null,
      source: price.source,
      fetchedAt: price.updatedAt,
      lowConfidence: false,
    };

    // STEP C — Store the base print so the collection page can total it.
    if (supabase && isBaseVariant(variant)) {
      const { error: upsertError } = await supabase.from('card_prices').upsert(
        {
          card_id: cardId,
          card_name: cardName,
          set_name: setName,
          price_low: price.low,
          price_mid: price.mid,
          price_high: price.high,
          currency: 'GBP',
          sample_size: null,
          source: price.source,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'card_id' }
      );
      if (upsertError) {
        console.error('[price route] card_prices upsert failed:', upsertError.message);
      }
    }

    memoryCache.set(memoryKey, { data: responseData, expiresAt: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(responseData, { headers: PRICE_CACHE_HEADERS });
  } catch (err) {
    console.error('[price route] error:', err);
    return NextResponse.json({ error: 'Price data temporarily unavailable' }, { status: 503 });
  }
}
