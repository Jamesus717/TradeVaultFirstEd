import { fallbackSets } from '../../../../lib/cardData/fallback';
import { OK_CACHE_CONTROL, pokemonCachedJson } from '../../../../lib/pokemonServer';

export const dynamic = 'force-dynamic';

export async function GET() {
  return pokemonCachedJson('/sets', 60 * 60 * 1000, OK_CACHE_CONTROL, fallbackSets);
}
