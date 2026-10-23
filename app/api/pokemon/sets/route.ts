import { pokemonCachedJson } from '../../../../lib/pokemonServer';

export const dynamic = 'force-dynamic';

export async function GET() {
  return pokemonCachedJson('/sets', 60 * 60 * 1000);
}
