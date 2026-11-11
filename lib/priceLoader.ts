// Batches card price lookups: calls made in the same tick share one query, and
// answers (including "no price") are remembered for the page's lifetime. Pure
// apart from the injected fetcher, so it is unit-tested without a database.

export type PriceMap = Record<string, number | null>;
export type PriceRow = { card_id: string | null; price_mid: number | string | null };
export type FetchPriceRows = (cardIds: string[]) => Promise<PriceRow[]>;

const CHUNK = 100;

export function createPriceLoader(fetchRows: FetchPriceRows) {
  const known = new Map<string, number | null>();
  const inFlight = new Map<string, Promise<void>>();
  let queued = new Set<string>();
  let flush: Promise<void> | null = null;

  async function run(ids: string[]) {
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const rows = await fetchRows(ids.slice(i, i + CHUNK));
        for (const row of rows) {
          const mid = row.price_mid === null ? NaN : Number(row.price_mid);
          if (row.card_id && Number.isFinite(mid) && mid > 0) known.set(row.card_id, mid);
        }
      }
    } catch {
      // A failed lookup shows as "no price yet", not a broken page.
    }
    for (const id of ids) {
      if (!known.has(id)) known.set(id, null);
      inFlight.delete(id);
    }
  }

  return async function load(cardIds: string[]): Promise<PriceMap> {
    const wanted = [...new Set(cardIds.filter(Boolean))];

    for (const id of wanted) {
      if (!known.has(id) && !inFlight.has(id)) queued.add(id);
    }

    if (queued.size > 0 && !flush) {
      flush = Promise.resolve().then(() => {
        const ids = [...queued];
        queued = new Set();
        flush = null;
        const done = run(ids);
        for (const id of ids) inFlight.set(id, done);
        return done;
      });
    }

    const pending = flush;
    await Promise.all([pending, ...wanted.map((id) => inFlight.get(id))]);

    return Object.fromEntries(wanted.map((id) => [id, known.get(id) ?? null]));
  };
}
