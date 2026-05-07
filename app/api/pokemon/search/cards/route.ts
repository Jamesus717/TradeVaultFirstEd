import { NextResponse } from 'next/server';
import { pokemonFetch } from '../../../../../lib/pokemonServer';

export const revalidate = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = (url.searchParams.get('name') ?? '').trim();
  const pageSize = url.searchParams.get('pageSize') ?? '20';

  if (!name) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  if (name.length > 60) {
    return NextResponse.json({ error: { message: 'Search term too long.' } }, { status: 400 });
  }

  const escaped = name.replace(/([+\-!(){}\[\]^"~*?:\\/]|&&|\|\|)/g, '\\$1');
  const q = `name:*${escaped}*`;
  const search = new URLSearchParams({ q, pageSize, orderBy: 'set.releaseDate' });

  const response = await pokemonFetch(`/cards?${search.toString()}`, {
    next: { revalidate },
  });

  const json = await response.json();
  return NextResponse.json(json, { status: response.status });
}
