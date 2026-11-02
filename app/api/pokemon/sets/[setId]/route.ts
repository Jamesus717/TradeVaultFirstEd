import { pokemonCachedJson } from '../../../../../lib/pokemonServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ setId: string }> };

export async function GET(_request: Request, context: Params) {
  const { setId } = await context.params;
  return pokemonCachedJson(`/sets/${encodeURIComponent(setId)}`, 60 * 60 * 1000);
}
