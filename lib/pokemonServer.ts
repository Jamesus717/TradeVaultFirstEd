import 'server-only';

const POKEMON_API_BASE_URL = 'https://api.pokemontcg.io/v2';

function getPokemonApiKey() {
  return process.env.POKEMON_TCG_API_KEY ?? process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY ?? '';
}

export async function pokemonFetch(path: string, init?: RequestInit) {
  const apiKey = getPokemonApiKey();
  const headers = new Headers(init?.headers);

  if (apiKey) {
    headers.set('X-Api-Key', apiKey);
  }

  return fetch(`${POKEMON_API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
}

