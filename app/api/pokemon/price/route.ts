import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We create a server-only Supabase client just for querying the cache
// using the anon key (or service role if needed, but anon is fine for reading public.card_prices)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// In-memory cache: cardId -> { data, expiresAt }
const memoryCache = new Map<string, {
  data: object;
  expiresAt: number;
}>();

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_PRICES === 'true';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cardId = url.searchParams.get('cardId');
  const cardName = url.searchParams.get('cardName');
  const setName = url.searchParams.get('setName') ?? '';
  const variant = url.searchParams.get('variant') ?? '';

  if (!cardId || !cardName) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
  }

  // Check in-memory cache first (fastest, no DB round trip)
  const memoryCached = memoryCache.get(cardId);
  if (memoryCached && memoryCached.expiresAt > Date.now()) {
    return NextResponse.json(memoryCached.data);
  }

  if (DEV_MODE) {
    // Return realistic mock data without calling eBay
    return NextResponse.json({
      cardId,
      cardName,
      priceLow: 4.99,
      priceMid: 7.50,
      priceHigh: 12.00,
      currency: 'GBP',
      sampleSize: 23,
      source: 'mock',
      fetchedAt: new Date().toISOString(),
      lowConfidence: false,
    });
  }

  try {
    // STEP A — Check Supabase for a cached price first
    if (supabase) {
      const { data: cachedPrice, error: cacheError } = await supabase
        .from('card_prices')
        .select('*')
        .eq('card_id', cardId)
        .gte('fetched_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (cachedPrice && !cacheError) {
        const responseData = {
          cardId: cachedPrice.card_id,
          cardName: cachedPrice.card_name,
          priceLow: cachedPrice.price_low,
          priceMid: cachedPrice.price_mid,
          priceHigh: cachedPrice.price_high,
          currency: cachedPrice.currency,
          sampleSize: cachedPrice.sample_size,
          source: cachedPrice.source,
          fetchedAt: cachedPrice.fetched_at,
          lowConfidence: cachedPrice.sample_size < 3,
        };
        memoryCache.set(cardId, {
          data: responseData,
          expiresAt: new Date(cachedPrice.fetched_at).getTime() + CACHE_TTL_MS,
        });
        return NextResponse.json(responseData);
      }
    }

    // STEP B — Call eBay Finding API
    if (!process.env.EBAY_APP_ID) {
      return NextResponse.json({ error: 'eBay App ID not configured' }, { status: 503 });
    }

    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.0.0',
      'SECURITY-APPNAME': process.env.EBAY_APP_ID,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      'keywords': `${cardName} ${setName} ${variant} pokemon card`.trim(),
      'categoryId': '183454',
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true',
      'itemFilter(1).name': 'Currency',
      'itemFilter(1).value': 'GBP',
      'itemFilter(2).name': 'ListedIn',
      'itemFilter(2).value': 'EBAY-GB',
      'itemFilter(3).name': 'Condition',
      'itemFilter(3).value(0)': 'Used',
      'sortOrder': 'EndTimeSoonest',
      'paginationInput.entriesPerPage': '50',
    });

    const ebayUrl = `https://svcs.ebay.com/services/search/FindingService/v1?${params}`;

    const response = await fetch(ebayUrl, {
      headers: {
        'X-EBAY-SOA-GLOBAL-ID': 'EBAY-GB',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Price data temporarily unavailable' }, { status: 503 });
    }

    const data = await response.json();

    // Check for eBay API errors in the response body
    const ebayErrors = data
      ?.errorMessage?.[0]
      ?.error ?? [];

    if (ebayErrors.length > 0) {
      const errorMsg = ebayErrors[0]?.message?.[0] ?? 'Unknown eBay error';
      const errorId = ebayErrors[0]?.errorId?.[0] ?? '';
      
      console.error('eBay API error:', errorId, errorMsg);
      
      // Rate limit error - return specific message
      if (errorId === '10001') {
        return NextResponse.json(
          { error: 'eBay rate limit reached. Try again tomorrow.' },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: `eBay error: ${errorMsg}` },
        { status: 503 }
      );
    }

    const items = data
      ?.findCompletedItemsResponse?.[0]
      ?.searchResult?.[0]
      ?.item ?? [];

    // STEP C — Parse prices
    const prices = items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) =>
        parseFloat(
          item?.sellingStatus?.[0]
            ?.currentPrice?.[0]
            ?.__value__ ?? '0'
        )
      )
      .filter((p: number) => p > 0 && !isNaN(p));

    // STEP D — Calculate statistics
    if (prices.length === 0) {
      return NextResponse.json({ error: 'No price data found', cardId }, { status: 404 });
    }

    const lowConfidence = prices.length < 3;
    let filtered = [...prices].sort((a, b) => a - b);
    
    // Remove top 10% and bottom 10% outliers if we have enough data
    if (filtered.length >= 10) {
      const trimCount = Math.floor(filtered.length * 0.1);
      filtered = filtered.slice(trimCount, filtered.length - trimCount);
    }

    const priceLow = Math.min(...filtered);
    const priceMid = median(filtered);
    const priceHigh = Math.max(...filtered);
    const sampleSize = filtered.length;

    // STEP E — Upsert into Supabase
    if (supabase) {
      // Check if table exists implicitly by trying to upsert and ignoring errors
      await supabase
        .from('card_prices')
        .upsert({
          card_id: cardId,
          card_name: cardName,
          set_name: setName,
          price_low: priceLow,
          price_mid: priceMid,
          price_high: priceHigh,
          currency: 'GBP',
          sample_size: sampleSize,
          source: 'ebay_uk',
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'card_id' });
    }

    const responseData = {
      cardId,
      cardName,
      priceLow,
      priceMid,
      priceHigh,
      currency: 'GBP',
      sampleSize,
      source: 'ebay_uk',
      fetchedAt: new Date().toISOString(),
      lowConfidence
    };

    memoryCache.set(cardId, {
      data: responseData,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    // STEP F — Return response
    return NextResponse.json(responseData);

  } catch (err) {
    console.error('eBay API route error:', err);
    return NextResponse.json({ error: 'Price data temporarily unavailable' }, { status: 503 });
  }
}