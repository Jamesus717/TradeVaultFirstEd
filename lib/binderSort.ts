// Binder sort: pure logic, no React. One URL value per mode, e.g. ?sort=price-desc.
// Fields: binder (card number), name, set (set name, then card number), price,
// added (date added). Each has asc and desc. "owned-first" has no direction.
// Older links (number-desc, name-asc, owned-first) keep working.
import type { CardDetails, DetailsById } from './binderFilters';

export const SORT_FIELDS = ['binder', 'name', 'set', 'price', 'added'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDir = 'asc' | 'desc';
export type BinderSort =
  | 'binder'
  | 'number-desc'
  | 'owned-first'
  | `${Exclude<SortField, 'binder'>}-${SortDir}`;

export const SORT_MODES: readonly BinderSort[] = [
  'binder',
  'number-desc',
  'owned-first',
  ...(['name', 'set', 'price', 'added'] as const).flatMap(
    (f) => [`${f}-asc`, `${f}-desc`] as BinderSort[]
  ),
];

export function isSortMode(value: string | null | undefined): value is BinderSort {
  return (SORT_MODES as readonly string[]).includes(value ?? '');
}

// Split a mode into the field + direction the controls show. owned-first -> null.
export function splitSort(mode: BinderSort): { field: SortField; dir: SortDir } | null {
  if (mode === 'owned-first') return null;
  if (mode === 'binder') return { field: 'binder', dir: 'asc' };
  if (mode === 'number-desc') return { field: 'binder', dir: 'desc' };
  const [field, dir] = mode.split('-') as [SortField, SortDir];
  return { field, dir };
}

export function joinSort(field: SortField, dir: SortDir): BinderSort {
  if (field === 'binder') return dir === 'asc' ? 'binder' : 'number-desc';
  return `${field}-${dir}` as BinderSort;
}

// Which optional fields have data behind them. A hidden option is not an error.
export function availableSorts(details: DetailsById) {
  const rows = Object.values(details);
  return {
    price: rows.some((d) => typeof d.price === 'number'),
    added: rows.some((d) => Boolean(addedTime(d))),
  };
}

export type SortableCard = {
  id: string;
  baseCardId: string;
  name: string;
  number: string;
  setName?: string;
  variant: string;
};

function addedTime(d: CardDetails | undefined): number | null {
  if (!d?.addedAt) return null;
  const t = Date.parse(d.addedAt);
  return Number.isNaN(t) ? null : t;
}

const text = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const num = (n: string) => Number.parseInt(n.replace(/\D/g, ''), 10) || 0;
const byNumber = (a: SortableCard, b: SortableCard) => num(a.number) - num(b.number) || text(a.number, b.number);

// Last-resort order so equal cards never jump around.
function tie(a: SortableCard, b: SortableCard): number {
  return text(a.setName ?? '', b.setName ?? '') || byNumber(a, b) || text(a.name, b.name) || text(a.variant, b.variant);
}

// Returns a new array. Cards with no value (no price, no date) sort last in both
// directions, so "highest price first" never opens on blanks.
export function sortCards<T extends SortableCard>(
  cards: T[],
  mode: BinderSort,
  owned: Record<string, boolean>,
  details: DetailsById
): T[] {
  const parts = splitSort(mode);
  const sign = parts?.dir === 'desc' ? -1 : 1;
  const valued = (pick: (c: T) => number | null) => (a: T, b: T) => {
    const x = pick(a);
    const y = pick(b);
    if (x === null && y === null) return tie(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * sign || tie(a, b);
  };
  const detail = (c: T) => details[c.baseCardId.toLowerCase()];
  let cmp: (a: T, b: T) => number;
  if (!parts) {
    cmp = (a, b) => Number(Boolean(owned[b.id])) - Number(Boolean(owned[a.id])) || byNumber(a, b) || tie(a, b);
  } else if (parts.field === 'binder') {
    cmp = (a, b) => byNumber(a, b) * sign || text(a.name, b.name) || text(a.variant, b.variant);
  } else if (parts.field === 'name') {
    cmp = (a, b) => text(a.name, b.name) * sign || tie(a, b);
  } else if (parts.field === 'set') {
    cmp = (a, b) => (text(a.setName ?? '', b.setName ?? '') || byNumber(a, b)) * sign || tie(a, b);
  } else if (parts.field === 'price') {
    cmp = valued((c) => {
      const p = detail(c)?.price;
      return typeof p === 'number' ? p : null;
    });
  } else {
    cmp = valued((c) => addedTime(detail(c)));
  }
  return [...cards].sort(cmp);
}
