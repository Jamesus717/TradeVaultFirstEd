import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WANT_SORT,
  EMPTY_WANT_FILTERS,
  activeWantFilterCount,
  applyWantFilters,
  hasAddedDates,
  isWantSort,
  parseWantFilters,
  parseWantSort,
  serializeWantFilters,
  sortWants,
  wantSets,
  type WantLike,
} from '../lib/wantsFilters';

const row = (id: string, name: string, priority: WantLike['priority'], set: string | null, created_at?: string): WantLike => ({
  id,
  card_name: name,
  priority,
  set_id: set,
  set_name: set ? set.toUpperCase() : null,
  created_at,
});

const rows = [
  row('a', 'Charizard', 'high', 'base1', '2026-11-04T10:00:00Z'),
  row('b', 'Pikachu', 'low', 'base1', '2026-11-07T10:00:00Z'),
  row('c', 'Pineco', 'low', 'sv1', '2026-11-06T10:00:00Z'),
  row('d', 'Zapdos', 'medium', 'base1'),
];
const ids = (r: WantLike[]) => r.map((x) => x.id).join('');

describe('wants filters', () => {
  it('searches by name, case-insensitive', () => {
    expect(ids(applyWantFilters(rows, { ...EMPTY_WANT_FILTERS, q: 'PI' }))).toBe('bc');
  });
  it('filters by set and priority together', () => {
    expect(ids(applyWantFilters(rows, { q: '', set: 'base1', priority: 'low' }))).toBe('b');
    expect(ids(applyWantFilters(rows, { q: '', set: 'sv1', priority: 'high' }))).toBe('');
  });
  it('lists sets once, falling back to set name', () => {
    const sets = wantSets([...rows, row('e', 'X', 'low', null)]);
    expect(sets.map((s) => s.key)).toEqual(['base1', 'sv1']);
  });
});

describe('wants sort', () => {
  it('default is high priority first, ties by name', () => {
    expect(ids(sortWants(rows, DEFAULT_WANT_SORT))).toBe('adbc');
  });
  it('priority asc puts low first', () => {
    expect(ids(sortWants(rows, 'priority-asc'))).toBe('bcda');
  });
  it('name asc and desc', () => {
    expect(ids(sortWants(rows, 'name-asc'))).toBe('abcd');
    expect(ids(sortWants(rows, 'name-desc'))).toBe('dcba');
  });
  it('date added: undated rows last both ways', () => {
    expect(ids(sortWants(rows, 'added-desc'))).toBe('bcad');
    expect(ids(sortWants(rows, 'added-asc'))).toBe('acbd');
  });
  it('does not mutate input', () => {
    const copy = [...rows];
    sortWants(rows, 'name-desc');
    expect(rows).toEqual(copy);
  });
  it('detects dates', () => {
    expect(hasAddedDates(rows)).toBe(true);
    expect(hasAddedDates([rows[3]])).toBe(false);
  });
});

describe('wants URL', () => {
  it('round-trips', () => {
    const f = { q: 'char', set: 'base1', priority: 'high' as const };
    const qs = serializeWantFilters(f, 'name-desc');
    const p = new URLSearchParams(qs);
    expect(parseWantFilters(p)).toEqual(f);
    expect(parseWantSort(p)).toBe('name-desc');
  });
  it('clean URL when default', () => {
    expect(serializeWantFilters(EMPTY_WANT_FILTERS, DEFAULT_WANT_SORT)).toBe('');
  });
  it('ignores bad values', () => {
    const p = new URLSearchParams('priority=urgent&sort=price-asc&set=<script>');
    expect(parseWantFilters(p)).toEqual(EMPTY_WANT_FILTERS);
    expect(parseWantSort(p)).toBe(DEFAULT_WANT_SORT);
    expect(isWantSort('name-asc-x')).toBe(false);
  });
  it('counts active filters', () => {
    expect(activeWantFilterCount({ q: ' ', set: '', priority: 'all' })).toBe(0);
    expect(activeWantFilterCount({ q: 'a', set: 'x', priority: 'low' })).toBe(3);
  });
});
