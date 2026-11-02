// Turns get_trade_matches rows into one entry per trader, best trades first.

export type MatchDirection = 'they_have' | 'i_have';

export type MatchRow = {
  trader_id: string;
  username: string | null;
  display_name: string | null;
  direction: MatchDirection;
  item_id: string;
  card_id: string;
  set_id: string | null;
  card_name: string | null;
  set_name: string | null;
  card_number: string | null;
  image_url: string | null;
  variant: string;
  condition: string | null;
  tradable: number;
  is_spare: boolean;
  want_priority: 'low' | 'medium' | 'high' | null;
};

export type TraderMatch = {
  traderId: string;
  name: string;
  theyHave: MatchRow[];
  iHave: MatchRow[];
  twoWay: boolean;
  highPriority: number;
};

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 } as const;

function priorityRank(row: MatchRow) {
  return row.want_priority ? PRIORITY_RANK[row.want_priority] : 0;
}

// A stack can answer several wants; keep it once, at its most wanted.
function addOnce(rows: MatchRow[], row: MatchRow) {
  const index = rows.findIndex((entry) => entry.item_id === row.item_id);
  if (index === -1) {
    rows.push(row);
  } else if (priorityRank(row) > priorityRank(rows[index])) {
    rows[index] = row;
  }
}

function byPriority(a: MatchRow, b: MatchRow) {
  return priorityRank(b) - priorityRank(a);
}

export function groupMatches(rows: MatchRow[]): TraderMatch[] {
  const traders = new Map<string, TraderMatch>();

  for (const row of rows) {
    let trader = traders.get(row.trader_id);
    if (!trader) {
      trader = {
        traderId: row.trader_id,
        name: row.display_name || row.username || 'Trader',
        theyHave: [],
        iHave: [],
        twoWay: false,
        highPriority: 0,
      };
      traders.set(row.trader_id, trader);
    }
    addOnce(row.direction === 'they_have' ? trader.theyHave : trader.iHave, row);
  }

  const grouped = [...traders.values()].map((trader) => ({
    ...trader,
    theyHave: [...trader.theyHave].sort(byPriority),
    iHave: [...trader.iHave].sort(byPriority),
    twoWay: trader.theyHave.length > 0 && trader.iHave.length > 0,
    highPriority: trader.theyHave.filter((row) => row.want_priority === 'high').length,
  }));

  return grouped.sort(
    (a, b) =>
      Number(b.twoWay) - Number(a.twoWay) ||
      b.highPriority - a.highPriority ||
      b.theyHave.length + b.iHave.length - (a.theyHave.length + a.iHave.length) ||
      a.name.localeCompare(b.name)
  );
}

// The card a "Start trade" press opens the conversation on: what you came for
// if they have it, otherwise your own card is not theirs to list, so null.
export function tradeAnchor(match: TraderMatch): MatchRow | null {
  return match.theyHave[0] ?? null;
}

// PostgREST says this when a table or function has not been migrated yet.
export function isNotMigrated(error: { code?: string } | null | undefined) {
  return ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code ?? '');
}
