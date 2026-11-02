import { NextResponse } from 'next/server';
import { pokemonCachedJson } from '../../../../lib/pokemonServer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const setId = url.searchParams.get('setId');
  const pageSize = url.searchParams.get('pageSize') ?? '250';

  if (!setId) {
    return NextResponse.json({ error: { message: 'Missing setId' } }, { status: 400 });
  }

  const query = new URLSearchParams({ q: `set.id:${setId}`, pageSize });

  return pokemonCachedJson(
    `/cards?${query.toString()}`,
    24 * 60 * 60 * 1000,
    'public, s-maxage=86400, stale-while-revalidate=604800'
  );
}
