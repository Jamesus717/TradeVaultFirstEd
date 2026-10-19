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
// A hung upstream must not hang the page; a timeout counts as a network error and is retried.
const REQUEST_TIMEOUT_MS = 8000;

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
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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


type CachedEntry = { data: unknown; cachedAt: number };

const memoryCache = new Map<string, CachedEntry>();

export const OK_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400';

// GET + JSON with a per-isolate cache. Rules that fix the "Failed to load sets"
// bug: only successes are cached, errors are never marked cacheable (so the CDN
// can't pin a failure for an hour), and when upstream fails we serve the last
// good copy, however old, instead of an error.
export async function pokemonCachedJson(
  path: string,
  ttlMs: number,
  cacheControl: string = OK_CACHE_CONTROL
): Promise<Response> {
  const cached = memoryCache.get(path);

  if (cached && Date.now() - cached.cachedAt < ttlMs) {
    return Response.json(cached.data, { headers: { 'Cache-Control': cacheControl } });
  }

  try {
    const response = await pokemonFetch(path);

    if (response.ok) {
      const data = await response.json();
      memoryCache.set(path, { data, cachedAt: Date.now() });
      return Response.json(data, { headers: { 'Cache-Control': cacheControl } });
    }

    if (cached) {
      return Response.json(cached.data, {
        headers: { 'Cache-Control': 'no-store', 'X-Stale': '1' },
      });
    }

    // 4xx is a real answer (e.g. unknown set): pass it through, uncached.
    const status = response.status >= 500 ? 502 : response.status;
    return Response.json(
      { error: { message: `Pokémon TCG API returned ${response.status}.`, status: response.status } },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    if (cached) {
      return Response.json(cached.data, {
        headers: { 'Cache-Control': 'no-store', 'X-Stale': '1' },
      });
    }
    return Response.json(
      { error: { message: 'Pokémon TCG API is unreachable.', status: 502 } },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
