import { NextResponse } from 'next/server';
import { pokemonFetch } from '../../../../lib/pokemonServer';

let setsCache: { data: unknown; cachedAt: number } | null = null;
const SETS_TTL = 60 * 60 * 1000;

export const revalidate = 3600;

export async function GET() {
  if (setsCache && Date.now() - setsCache.cachedAt < SETS_TTL) {
    return NextResponse.json(setsCache.data, {
      headers: {
        'Cache-Control':
          'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }

  const response = await pokemonFetch('/sets', {
    next: { revalidate },
  });

  const text = await response.text();

  try {
    const json = JSON.parse(text);
    setsCache = { data: json, cachedAt: Date.now() };
    return NextResponse.json(json, {
      status: response.status,
      headers: {
        'Cache-Control':
          'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          message: 'Upstream response was not valid JSON.',
          status: response.status,
        },
      },
      { status: 502 }
    );
  }
}