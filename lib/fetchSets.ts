// Client helpers: the card API routes sit on a flaky upstream, so retry a few
// times with backoff before giving up. Returns the last Response either way.
const DELAYS_MS = [400, 1000, 2000];

export async function fetchWithRetry(url: string): Promise<Response> {
  let last: Response | undefined;

  for (let attempt = 0; attempt <= DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, DELAYS_MS[attempt - 1]));
    }
    try {
      last = await fetch(url);
      // 4xx is a real answer; only server errors are worth another go.
      if (last.ok || last.status < 500) return last;
    } catch (err) {
      if (attempt === DELAYS_MS.length) throw err;
    }
  }

  return last as Response;
}

export function fetchSets(): Promise<Response> {
  return fetchWithRetry('/api/pokemon/sets');
}
