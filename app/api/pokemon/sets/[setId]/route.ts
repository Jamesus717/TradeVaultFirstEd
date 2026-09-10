import { NextResponse } from 'next/server';
import { pokemonFetch } from '../../../../../lib/pokemonServer';

// Same shape as ../route.ts and ../../cards/route.ts: a process-level cache
// in front of the upstream call, plus Cache-Control so the browser and CDN
// can answer repeats without reaching us at all.
//
// This route is the hottest of the three: the collection dashboard asks for
// one set per set the user owns cards in, so a 20-set collection made 20
// uncached upstream calls on every page load.
const setCache = new Map<string, { data: unknown; status: number; cachedAt: number }>();
const SET_TTL = 60 * 60 * 1000;

export const revalidate = 3600;

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

type Params = { params: Promise<{ setId: string }> };

export async function GET(_request: Request, context: Params) {
  const { setId } = await context.params;

  const cached = setCache.get(setId);

  if (cached && Date.now() - cached.cachedAt < SET_TTL) {
    return NextResponse.json(cached.data, {
      status: cached.status,
      headers: CACHE_HEADERS,
    });
  }

  const response = await pokemonFetch(`/sets/${encodeURIComponent(setId)}`, {
    next: { revalidate },
  });

  const json = await response.json();

  // Only remember successful lookups — caching a 404 or a 5xx for an hour
  // would outlast the problem that caused it.
  if (response.ok) {
    setCache.set(setId, { data: json, status: response.status, cachedAt: Date.now() });
  }

  return NextResponse.json(json, {
    status: response.status,
    headers: response.ok ? CACHE_HEADERS : undefined,
  });
}
