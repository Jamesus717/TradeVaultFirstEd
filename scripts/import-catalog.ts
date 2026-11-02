// Fills catalog_sets and catalog_cards (migration 019). Prototype.
//
//   node --experimental-strip-types scripts/import-catalog.ts --sets=sv6,sv9 --out=catalog.json
//   node --experimental-strip-types scripts/import-catalog.ts --sets=all --apply
//
// Reads every set from the Pokémon TCG API, the only free source with rarity,
// which the binder needs to pick variants, and cross-checks each one against
// TCGdex. Prints a coverage report. Writes to Supabase only with --apply, which
// needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.

import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import setIdMap from '../lib/cardData/tcgdexSetIds.json' with { type: 'json' };

const POKEMON_API = 'https://api.pokemontcg.io/v2';
const TCGDEX_API = 'https://api.tcgdex.net/v2/en';
const BATCH_SIZE = 500;

type ApiSet = { id: string; name: string; series: string; releaseDate: string; total: number; printedTotal: number; images?: { logo?: string } };
type ApiCard = { id: string; name: string; number: string; rarity?: string; images?: { small?: string; large?: string } };

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? 'true'] as const;
  })
);

async function getJson<T>(url: string, attempts = 8): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    try {
      const key = process.env.POKEMON_TCG_API_KEY;
      const response = await fetch(url, {
        headers: url.startsWith(POKEMON_API) && key ? { 'X-Api-Key': key } : undefined,
        signal: AbortSignal.timeout(30000),
      });
      if (response.ok) return (await response.json()) as T;
      last = new Error(`${response.status} ${url}`);
      if (response.status < 500) break;
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

async function pokemonSetCards(setId: string) {
  const cards: ApiCard[] = [];
  for (let page = 1; ; page++) {
    const { data, totalCount } = await getJson<{ data: ApiCard[]; totalCount: number }>(
      `${POKEMON_API}/cards?q=set.id:${setId}&pageSize=250&page=${page}&select=id,name,number,rarity,images`
    );
    cards.push(...data);
    if (cards.length >= totalCount || data.length === 0) return cards;
  }
}

function tcgdexSetId(setId: string) {
  return (setIdMap as Record<string, string>)[setId] ?? setId;
}

async function coverage(set: ApiSet, cards: ApiCard[]) {
  try {
    const twin = await getJson<{ cards: Array<{ localId: string; name: string }> }>(
      `${TCGDEX_API}/sets/${tcgdexSetId(set.id)}`,
      2
    );
    const numbers = new Set(twin.cards.map((card) => card.localId.replace(/^0+(?=\d)/, '')));
    const matched = cards.filter((card) => numbers.has(card.number)).length;
    return { tcgdex: twin.cards.length, matched };
  } catch {
    return { tcgdex: 0, matched: 0 };
  }
}

async function main() {
  const { data: allSets } = await getJson<{ data: ApiSet[] }>(`${POKEMON_API}/sets?pageSize=250`);
  const wanted = (args.get('sets') ?? '').split(',').filter(Boolean);
  const sets = wanted[0] === 'all' ? allSets : allSets.filter((set) => wanted.includes(set.id));

  if (sets.length === 0) {
    console.error('No sets picked. Use --sets=sv6,sv9 or --sets=all.');
    process.exitCode = 1;
    return;
  }

  const catalogSets = [];
  const catalogCards = [];
  const updatedAt = new Date().toISOString();

  for (const set of sets) {
    const cards = await pokemonSetCards(set.id);
    const { tcgdex, matched } = await coverage(set, cards);
    console.log(`${set.id.padEnd(12)} ${String(cards.length).padStart(4)} cards, TCGdex ${String(tcgdex).padStart(4)}, matched ${matched}/${cards.length}`);

    catalogSets.push({
      game: 'pokemon',
      id: set.id,
      name: set.name,
      series: set.series,
      release_date: set.releaseDate.replaceAll('/', '-'),
      printed_total: set.printedTotal,
      total: set.total,
      logo_url: set.images?.logo ?? null,
      source: 'pokemontcg',
      source_ids: { tcgdex: tcgdexSetId(set.id) },
      updated_at: updatedAt,
    });

    for (const card of cards) {
      catalogCards.push({
        game: 'pokemon',
        id: card.id,
        set_id: set.id,
        name: card.name,
        number: card.number,
        rarity: card.rarity ?? null,
        image_small: card.images?.small ?? null,
        image_large: card.images?.large ?? null,
        source: 'pokemontcg',
        updated_at: updatedAt,
      });
    }
  }

  console.log(`\n${catalogSets.length} sets, ${catalogCards.length} cards.`);

  if (args.has('out')) {
    writeFileSync(args.get('out') as string, JSON.stringify({ sets: catalogSets, cards: catalogCards }));
  }

  if (!args.has('apply')) {
    console.log('Dry run. Nothing written to Supabase.');
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('--apply needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await client.from('catalog_sets').upsert(catalogSets);
  if (error) throw error;

  for (let start = 0; start < catalogCards.length; start += BATCH_SIZE) {
    const { error: cardError } = await client.from('catalog_cards').upsert(catalogCards.slice(start, start + BATCH_SIZE));
    if (cardError) throw cardError;
  }

  console.log('Written to Supabase.');
}

await main();
