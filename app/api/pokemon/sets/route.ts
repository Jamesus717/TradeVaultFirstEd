import { NextResponse } from 'next/server';
import { pokemonFetch } from '../../../../lib/pokemonServer';
import { withWorkerCache } from '../../../../lib/workerCache';

export const revalidate = 3600;

export async function GET(request: Request) {
  return withWorkerCache(request, 60 * 60 * 24, async () => {
    const select = 'id,name,series,releaseDate';
    const query = new URLSearchParams({ select });
    const response = await pokemonFetch(`/sets?${query.toString()}`, {
      next: { revalidate },
    });

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  });
}
