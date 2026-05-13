import { NextResponse } from 'next/server';
import { pokemonFetch } from '../../../../lib/pokemonServer';

export const revalidate = 3600;

export async function GET() {
  const response = await pokemonFetch('/sets', {
    next: { revalidate },
  });

  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: response.status });
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
