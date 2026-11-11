// Binder filters: pure logic, no React. State round-trips through a URL query
// string so a link shares a filtered view.
//   ?set=sv1&q=char&own=owned&cond=NM,LP&min=5&max=100&sort=name-asc
// Condition and price come from the binder fields (proposal 024). Where the
// real data has none yet, `availableFilters` says so and the page hides them.

export const FILTER_CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const;
export type FilterCondition = (typeof FILTER_CONDITIONS)[number];
export type OwnershipFilter = 'all' | 'owned' | 'unowned';
import { isSortMode, type BinderSort } from './binderSort';

export type FilterSort = BinderSort;

export type BinderFilters = {
  q: string;
  own: OwnershipFilter;
  cond: FilterCondition[];
  min: number | null;
  max: number | null;
};

// addedAt is an ISO date string; only demo data and CSV imports carry it today.
export type CardDetails = { condition?: string | null; price?: number | null; addedAt?: string | null };
// Keyed by lowercase base card id (e.g. "base1-4").
export type DetailsById = Record<string, CardDetails>;

export type FilterableCard = { name: string; baseCardId: string; id: string };

export const EMPTY_FILTERS: BinderFilters = { q: '', own: 'all', cond: [], min: null, max: null };

const MAX_Q = 80;
const MAX_PRICE = 1_000_000;

function parsePrice(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n >= MAX_PRICE) return null;
  return Math.round(n * 100) / 100;
}

export function parseFilters(params: URLSearchParams): BinderFilters {
  const own = params.get('own');
  const cond = (params.get('cond') ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c): c is FilterCondition => (FILTER_CONDITIONS as readonly string[]).includes(c));
  let min = parsePrice(params.get('min'));
  let max = parsePrice(params.get('max'));
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return {
    q: (params.get('q') ?? '').slice(0, MAX_Q),
    own: own === 'owned' || own === 'unowned' ? own : 'all',
    cond: [...new Set(cond)],
    min,
    max,
  };
}

export function parseSort(params: URLSearchParams): FilterSort {
  const s = params.get('sort');
  return isSortMode(s) ? s : 'binder';
}

// Writes only non-default values, so the clean URL is just /binder.
export function serializeFilters(
  filters: BinderFilters,
  extra: { set?: string; sort?: FilterSort } = {}
): string {
  const p = new URLSearchParams();
  if (extra.set) p.set('set', extra.set);
  if (filters.q.trim()) p.set('q', filters.q.slice(0, MAX_Q));
  if (filters.own !== 'all') p.set('own', filters.own);
  if (filters.cond.length) {
    p.set('cond', FILTER_CONDITIONS.filter((c) => filters.cond.includes(c)).join(','));
  }
  if (filters.min !== null) p.set('min', String(filters.min));
  if (filters.max !== null) p.set('max', String(filters.max));
  if (extra.sort && extra.sort !== 'binder') p.set('sort', extra.sort);
  return p.toString();
}

export function activeFilterCount(filters: BinderFilters): number {
  return (
    (filters.q.trim() ? 1 : 0) +
    (filters.own !== 'all' ? 1 : 0) +
    (filters.cond.length ? 1 : 0) +
    (filters.min !== null || filters.max !== null ? 1 : 0)
  );
}

export function hasActiveFilters(filters: BinderFilters): boolean {
  return activeFilterCount(filters) > 0;
}

// Which optional filters have data behind them. Cards the user owns with no
// condition or price stored do not count.
export function availableFilters(details: DetailsById) {
  const rows = Object.values(details);
  return {
    condition: rows.some((d) => Boolean(d.condition)),
    price: rows.some((d) => typeof d.price === 'number'),
  };
}

export function applyFilters<T extends FilterableCard>(
  cards: T[],
  owned: Record<string, boolean>,
  details: DetailsById,
  filters: BinderFilters
): T[] {
  const query = filters.q.trim().toLowerCase();
  const wantCond = filters.cond.length > 0;
  const wantPrice = filters.min !== null || filters.max !== null;
  return cards.filter((card) => {
    if (query && !card.name.toLowerCase().includes(query)) return false;
    const isOwned = Boolean(owned[card.id]);
    if (filters.own === 'owned' && !isOwned) return false;
    if (filters.own === 'unowned' && isOwned) return false;
    if (wantCond || wantPrice) {
      // Condition and price belong to a card you own. A missing card has none,
      // so it drops out as soon as either filter is on.
      const d = details[card.baseCardId.toLowerCase()];
      if (!isOwned || !d) return false;
      if (wantCond && !(d.condition && (filters.cond as string[]).includes(d.condition))) return false;
      if (wantPrice) {
        if (typeof d.price !== 'number') return false;
        if (filters.min !== null && d.price < filters.min) return false;
        if (filters.max !== null && d.price > filters.max) return false;
      }
    }
    return true;
  });
}
