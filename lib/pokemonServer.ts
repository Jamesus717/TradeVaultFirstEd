import 'server-only';

const POKEMON_API_BASE_URL = 'https://api.pokemontcg.io/v2';

// The Pokémon TCG API is deprecated (successor: Scrydex) and existing keys
// stop working on 2027-03-01. Until then it is flaky: on 2026-09-12 roughly
// two in three requests came back 500/502, and the same URL succeeded on a
// retry. Failures return in ~200ms, so a few quick retries cost little and
// turn most of them into successes. Only GETs, only 5xx and network errors —
// a 4xx is a real answer and is returned as-is.
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [150, 300, 600];

function getPokemonApiKey() {
  return process.env.POKEMON_TCG_API_KEY ?? process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY ?? '';
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pokemonFetch(path: string, init?: RequestInit) {
  const apiKey = getPokemonApiKey();
  const headers = new Headers(init?.headers);

  if (apiKey) {
    headers.set('X-Api-Key', apiKey);
  }

  const method = (init?.method ?? 'GET').toUpperCase();
  const attempts = method === 'GET' ? MAX_ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 600);
    }

    try {
      const response = await fetch(`${POKEMON_API_BASE_URL}${path}`, {
        ...init,
        headers,
      });
      if (response.status < 500 || attempt === attempts - 1) {
        return response;
      }
      lastError = new Error(`Pokémon TCG API ${response.status}`);
    } catch (err) {
      lastError = err;
      if (attempt === attempts - 1) {
        throw err;
      }
    }
  }

  throw lastError;
}
