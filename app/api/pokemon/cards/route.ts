import { NextResponse } from 'next/server';
import { pokemonFetch } from '../../../../lib/pokemonServer';

export const revalidate = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const setId = url.searchParams.get('setId');
  const pageSize = url.searchParams.get('pageSize') ?? '250';

  if (!setId) {
    return NextResponse.json({ error: { message: 'Missing setId' } }, { status: 400 });
  }

  const q = `set.id:${setId}`;
  const query = new URLSearchParams({ q, pageSize });

  const response = await pokemonFetch(`/cards?${query.toString()}`, {
    next: { revalidate },
  });

  const json = await response.json();
  return NextResponse.json(json, { status: response.status });
}
