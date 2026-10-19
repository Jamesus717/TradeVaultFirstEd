// Client helper: the sets API sits on a flaky upstream, so retry a few times
// with backoff before giving up. Returns the last Response either way.
const DELAYS_MS = [400, 1000, 2000];

export async function fetchSets(): Promise<Response> {
  let last: Response | undefined;

  for (let attempt = 0; attempt <= DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, DELAYS_MS[attempt - 1]));
    }
    try {
      last = await fetch('/api/pokemon/sets');
      if (last.ok) return last;
    } catch (err) {
      if (attempt === DELAYS_MS.length) throw err;
    }
  }

  return last as Response;
}
