import { NextResponse } from 'next/server';
import { pokemonFetch } from '../../../../lib/pokemonServer';

export const revalidate = 3600;

export async function GET() {
  const response = await pokemonFetch('/sets', {
    next: { revalidate },
  });

  const json = await response.json();
  return NextResponse.json(json, { status: response.status });
}
