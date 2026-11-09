// Wishlist filters + sort: pure logic, no React. Round-trips through the URL, e.g.
//   /wishlist?q=char&set=base1&priority=high&sort=name-asc
// Reuses the binder pieces: same text compare, same query limit, same
// "write only non-default values" URL rule (lib/binderFilters, lib/binderSort).

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type WantPriority = (typeof PRIORITIES)[number];

export const WANT_SORT_FIELDS = ['priority', 'name', 'added'] as const;
export type WantSortField = (typeof WANT_SORT_FIELDS)[number];
export type WantSortDir = 'asc' | 'desc';
export type WantSort = `${WantSortField}-${WantSortDir}`;

// Default: high priority first (what the page always did).
export const DEFAULT_WANT_SORT: WantSort = 'priority-desc';

export type WantFilters = { q: string; set: string; priority: WantPriority | 'all' };
export const EMPTY_WANT_FILTERS: WantFilters = { q: '', set: '', priority: 'all' };

export type WantLike = {
  id: string;
  card_name: string;
  set_id: string | null;
  set_name: string | null;
  priority: WantPriority;
  created_at?: string | null;
};

const MAX_Q = 80;
const SET_RE = /^[\w .&'-]{1,60}$/;

export function isWantSort(value: string | null | undefined): value is WantSort {
  const [field, dir, ...rest] = (value ?? '').split('-');
  return rest.length === 0 && (WANT_SORT_FIELDS as readonly string[]).includes(field) && (dir === 'asc' || dir === 'desc');
}

export function splitWantSort(mode: WantSort): { field: WantSortField; dir: WantSortDir } {
  const [field, dir] = mode.split('-') as [WantSortField, WantSortDir];
  return { field, dir };
}

export function joinWantSort(field: WantSortField, dir: WantSortDir): WantSort {
  return `${field}-${dir}`;
}

export function parseWantFilters(params: URLSearchParams): WantFilters {
  const p = params.get('priority');
  const set = (params.get('set') ?? '').trim();
  return {
    q: (params.get('q') ?? '').slice(0, MAX_Q),
    set: SET_RE.test(set) ? set : '',
    priority: (PRIORITIES as readonly string[]).includes(p ?? '') ? (p as WantPriority) : 'all',
  };
}

export function parseWantSort(params: URLSearchParams): WantSort {
  const s = params.get('sort');
  return isWantSort(s) ? s : DEFAULT_WANT_SORT;
}

export function serializeWantFilters(filters: WantFilters, sort: WantSort = DEFAULT_WANT_SORT): string {
  const p = new URLSearchParams();
  if (filters.q.trim()) p.set('q', filters.q.slice(0, MAX_Q));
  if (filters.set) p.set('set', filters.set);
  if (filters.priority !== 'all') p.set('priority', filters.priority);
  if (sort !== DEFAULT_WANT_SORT) p.set('sort', sort);
  return p.toString();
}

export function activeWantFilterCount(f: WantFilters): number {
  return (f.q.trim() ? 1 : 0) + (f.set ? 1 : 0) + (f.priority !== 'all' ? 1 : 0);
}

// The value the set filter matches on: the set id, else the set name.
export const setKey = (w: Pick<WantLike, 'set_id' | 'set_name'>): string => w.set_id ?? w.set_name ?? '';

// Sets on the list, for the picker. Sorted by label.
export function wantSets(rows: Pick<WantLike, 'set_id' | 'set_name'>[]): { key: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    const key = setKey(r);
    if (key && !seen.has(key)) seen.set(key, r.set_name ?? key);
  }
  return [...seen].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
}

export function applyWantFilters<T extends WantLike>(rows: T[], f: WantFilters): T[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !r.card_name.toLowerCase().includes(q)) return false;
    if (f.set && setKey(r) !== f.set) return false;
    if (f.priority !== 'all' && r.priority !== f.priority) return false;
    return true;
  });
}

const RANK: Record<WantPriority, number> = { high: 3, medium: 2, low: 1 };
const text = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

function addedTime(r: WantLike): number | null {
  if (!r.created_at) return null;
  const t = Date.parse(r.created_at);
  return Number.isNaN(t) ? null : t;
}

// Does any row carry a date added? Without one, "Date added" is hidden.
export function hasAddedDates(rows: WantLike[]): boolean {
  return rows.some((r) => addedTime(r) !== null);
}

// Returns a new array. Ties go by name, then the list order (newest first from the
// database), so equal cards never jump around. Rows with no date sort last.
export function sortWants<T extends WantLike>(rows: T[], mode: WantSort): T[] {
  const { field, dir } = splitWantSort(mode);
  const sign = dir === 'desc' ? -1 : 1;
  const indexed = rows.map((r, i) => ({ r, i }));
  indexed.sort((a, b) => {
    let c = 0;
    if (field === 'priority') c = (RANK[a.r.priority] - RANK[b.r.priority]) * sign;
    else if (field === 'name') c = text(a.r.card_name, b.r.card_name) * sign;
    else {
      const x = addedTime(a.r);
      const y = addedTime(b.r);
      if (x === null && y === null) c = 0;
      else if (x === null) return 1;
      else if (y === null) return -1;
      else c = (x - y) * sign;
    }
    return c || text(a.r.card_name, b.r.card_name) || a.i - b.i;
  });
  return indexed.map((x) => x.r);
}
