import setIdMap from './tcgdexSetIds.json';

// TCGdex: free, no key, and its uptime has been far better than the Pokémon TCG
// API's (12/12 vs 6/12 on 2026-11-02). Its ids differ, so this turns everything
// into the pokemontcg.io shape the rest of the app and every saved row use.
// tcgdexSetIds.json holds only the sets whose ids differ; a set with no known
// TCGdex twin (e.g. me55c) has to come from the catalog instead.

const TCGDEX_BASE_URL = 'https://api.tcgdex.net/v2/en';
const REQUEST_TIMEOUT_MS = 15000;

const toTcgdexMap: Record<string, string> = setIdMap;
const toPokemonMap: Record<string, string> = Object.fromEntries(
  Object.entries(toTcgdexMap).map(([pokemonId, tcgdexId]) => [tcgdexId, pokemonId])
);

export function toTcgdexSetId(pokemonSetId: string) {
  return toTcgdexMap[pokemonSetId] ?? pokemonSetId;
}

export function toPokemonSetId(tcgdexSetId: string) {
  return toPokemonMap[tcgdexSetId] ?? tcgdexSetId;
}

// TCGdex pads numbers ("001"); the Pokémon TCG API does not ("1"). Numbers with
// letters ("TG01", "SWSH001") are left alone.
export function toPokemonCardNumber(localId: string) {
  return /^\d+$/.test(localId) ? String(Number(localId)) : localId;
}

export type TcgdexSetBrief = {
  id: string;
  name: string;
  logo?: string;
  cardCount?: { official?: number; total?: number };
};

export type TcgdexSet = TcgdexSetBrief & {
  releaseDate?: string;
  serie?: { id: string; name: string };
  cards: Array<{ id: string; localId: string; name: string; image?: string }>;
};

async function tcgdexJson<T>(path: string): Promise<T> {
  const response = await fetch(`${TCGDEX_BASE_URL}${path}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`TCGdex ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function mapTcgdexSetCards(set: TcgdexSet) {
  const setId = toPokemonSetId(set.id);
  return set.cards.map((card) => {
    const number = toPokemonCardNumber(card.localId);
    return {
      id: `${setId}-${number}`,
      name: card.name,
      number,
      set: { id: setId, name: set.name, series: set.serie?.name ?? '' },
      images: card.image
        ? { small: `${card.image}/low.webp`, large: `${card.image}/high.webp` }
        : undefined,
    };
  });
}

export async function fetchTcgdexSetCards(pokemonSetId: string) {
  const set = await tcgdexJson<TcgdexSet>(`/sets/${encodeURIComponent(toTcgdexSetId(pokemonSetId))}`);
  return mapTcgdexSetCards(set);
}

export function mapTcgdexSets(sets: TcgdexSet[]) {
  return sets.map((set) => ({
    id: toPokemonSetId(set.id),
    name: set.name,
    series: set.serie?.name ?? 'Other',
    releaseDate: (set.releaseDate ?? '').replaceAll('-', '/'),
  }));
}

export async function fetchTcgdexSeriesSets() {
  // /series/{id} is the only listing that carries release dates and series
  // names, and there are few enough series to fetch in one go.
  const series = await tcgdexJson<Array<{ id: string; name: string }>>('/series');
  const details = await Promise.all(
    series.map((serie) => tcgdexJson<{ sets: TcgdexSetBrief[]; releaseDate?: string; name: string }>(`/series/${serie.id}`))
  );
  return details.flatMap((detail) =>
    detail.sets.map((set) => ({
      id: toPokemonSetId(set.id),
      name: set.name,
      series: detail.name,
      releaseDate: (detail.releaseDate ?? '').replaceAll('-', '/'),
    }))
  );
}
