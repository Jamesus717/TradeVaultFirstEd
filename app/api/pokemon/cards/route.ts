import { NextResponse } from 'next/server';
import { pokemonFetch } from '../../../../lib/pokemonServer';
import { withWorkerCache } from '../../../../lib/workerCache';

export const revalidate = 300;

export async function GET(request: Request) {
  return withWorkerCache(request, 60 * 60 * 24, async () => {
    const url = new URL(request.url);
    const setId = url.searchParams.get('setId');
    const pageSize = url.searchParams.get('pageSize') ?? '250';

    if (!setId) {
      return NextResponse.json({ error: { message: 'Missing setId' } }, { status: 400 });
    }

    const q = `set.id:${setId}`;
    const select = 'id,name,number,rarity,set.id,set.name,set.series,images.small';
    const query = new URLSearchParams({ q, pageSize, select });

    const response = await pokemonFetch(`/cards?${query.toString()}`, {
      next: { revalidate },
    });

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  });
}
