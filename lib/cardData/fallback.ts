import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { fetchTcgdexSeriesSets, fetchTcgdexSetCards } from './tcgdex';

// What the card routes serve when the Pokémon TCG API fails and there is no
// stale copy: our own catalog first, then TCGdex. Both come back in the
// pokemontcg.io shape, so callers cannot tell the difference. Returns null when
// neither has it, and the route reports the failure as it did before.

function catalogClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

async function catalogSets() {
  const { data, error } = await catalogClient()
    ?.from('catalog_sets')
    .select('id, name, series, release_date')
    .eq('game', 'pokemon')
    .order('release_date', { ascending: false }) ?? { data: null, error: null };

  if (error || !data?.length) return null;

  return data.map((set) => ({
    id: set.id,
    name: set.name,
    series: set.series ?? 'Other',
    releaseDate: (set.release_date ?? '').replaceAll('-', '/'),
  }));
}

async function catalogSetCards(setId: string) {
  const client = catalogClient();
  if (!client) return null;

  const [{ data: set }, { data: cards, error }] = await Promise.all([
    client.from('catalog_sets').select('name, series').eq('game', 'pokemon').eq('id', setId).maybeSingle(),
    client
      .from('catalog_cards')
      .select('id, name, number, rarity, image_small, image_large')
      .eq('game', 'pokemon')
      .eq('set_id', setId),
  ]);

  if (error || !cards?.length) return null;

  return cards.map((card) => ({
    id: card.id,
    name: card.name,
    number: card.number,
    rarity: card.rarity ?? undefined,
    set: { id: setId, name: set?.name ?? setId, series: set?.series ?? '' },
    images: { small: card.image_small ?? undefined, large: card.image_large ?? undefined },
  }));
}

export async function fallbackSets() {
  try {
    const sets = (await catalogSets()) ?? (await fetchTcgdexSeriesSets());
    return sets.length ? { data: sets } : null;
  } catch {
    return null;
  }
}

export async function fallbackSetCards(setId: string) {
  try {
    const cards = (await catalogSetCards(setId)) ?? (await fetchTcgdexSetCards(setId));
    return cards.length ? { data: cards } : null;
  } catch {
    return null;
  }
}
