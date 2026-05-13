import { NextResponse } from 'next/server';
import { pokemonFetch } from '../../../../lib/pokemonServer';

const cardsCache = new Map<string, {
  data: unknown;
  cachedAt: number
}>();
const CARDS_TTL = 24 * 60 * 60 * 1000;

export const revalidate = 86400;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const setId = url.searchParams.get('setId');
  const pageSize = url.searchParams.get('pageSize') ?? '250';

  if (!setId) {
    return NextResponse.json(
      { error: { message: 'Missing setId' } },
      { status: 400 }
    );
  }

  const cacheKey = `${setId}-${pageSize}`;
  const cached = cardsCache.get(cacheKey);

  if (cached && Date.now() - cached.cachedAt < CARDS_TTL) {
    return NextResponse.json(cached.data, {
      headers: {
        'Cache-Control':
          'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  }

  const q = `set.id:${setId}`;
  const query = new URLSearchParams({ q, pageSize });

  const response = await pokemonFetch(
    `/cards?${query.toString()}`,
    { next: { revalidate } }
  );

  const json = await response.json();
  cardsCache.set(cacheKey, { data: json, cachedAt: Date.now() });

  return NextResponse.json(json, {
    status: response.status,
    headers: {
      'Cache-Control':
        'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}