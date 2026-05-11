import { NextResponse } from 'next/server';
import { pokemonFetch } from '../../../../../lib/pokemonServer';
import { withWorkerCache } from '../../../../../lib/workerCache';

export const revalidate = 3600;

type Params = { params: Promise<{ setId: string }> };

export async function GET(request: Request, context: Params) {
  return withWorkerCache(request, 60 * 60 * 24, async () => {
    const { setId } = await context.params;
    const select = 'id,name,series,releaseDate';
    const query = new URLSearchParams({ select });
    const response = await pokemonFetch(`/sets/${encodeURIComponent(setId)}?${query.toString()}`, {
      next: { revalidate },
    });

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  });
}
