import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyFilters,
  availableFilters,
  parseFilters,
  parseSort,
  serializeFilters,
  type BinderFilters,
  type DetailsById,
} from '../lib/binderFilters';

const card = (baseCardId: string, name: string) => ({ id: `${baseCardId}-normal`, baseCardId, name });
const cards = [
  card('base1-4', 'Charizard'),
  card('base1-58', 'Pikachu'),
  card('base1-2', 'Blastoise'),
  card('base1-9', 'Charmander'),
];
const owned = { 'base1-4-normal': true, 'base1-58-normal': true, 'base1-2-normal': true };
const details: DetailsById = {
  'base1-4': { condition: 'LP', price: 250 },
  'base1-58': { condition: 'NM', price: 12.5 },
  'base1-2': { condition: null, price: null },
};
const f = (over: Partial<BinderFilters>): BinderFilters => ({ ...EMPTY_FILTERS, ...over });
const names = (list: { name: string }[]) => list.map((c) => c.name);

describe('applyFilters', () => {
  it('returns everything with no filters', () => {
    expect(applyFilters(cards, owned, details, EMPTY_FILTERS)).toHaveLength(4);
  });
  it('searches by name, ignoring case and spaces at the ends', () => {
    expect(names(applyFilters(cards, owned, details, f({ q: ' CHAR ' })))).toEqual(['Charizard', 'Charmander']);
  });
  it('splits owned and missing', () => {
    expect(names(applyFilters(cards, owned, details, f({ own: 'owned' })))).toEqual(['Charizard', 'Pikachu', 'Blastoise']);
    expect(names(applyFilters(cards, owned, details, f({ own: 'unowned' })))).toEqual(['Charmander']);
  });
  it('filters by condition, any of several', () => {
    expect(names(applyFilters(cards, owned, details, f({ cond: ['NM'] })))).toEqual(['Pikachu']);
    expect(names(applyFilters(cards, owned, details, f({ cond: ['NM', 'LP'] })))).toEqual(['Charizard', 'Pikachu']);
  });
  it('filters by price range, inclusive, and drops cards with no price', () => {
    expect(names(applyFilters(cards, owned, details, f({ min: 12.5, max: 250 })))).toEqual(['Charizard', 'Pikachu']);
    expect(names(applyFilters(cards, owned, details, f({ min: 100 })))).toEqual(['Charizard']);
    expect(names(applyFilters(cards, owned, details, f({ max: 20 })))).toEqual(['Pikachu']);
  });
  it('drops missing cards once condition or price is on, even if details exist', () => {
    const odd = { ...details, 'base1-9': { condition: 'NM', price: 5 } };
    expect(applyFilters(cards, owned, odd, f({ cond: ['NM'] })).map((c) => c.baseCardId)).toEqual(['base1-58']);
  });
  it('combines filters with AND', () => {
    expect(names(applyFilters(cards, owned, details, f({ q: 'pika', own: 'owned', cond: ['NM'], max: 20 })))).toEqual(['Pikachu']);
    expect(applyFilters(cards, owned, details, f({ q: 'pika', cond: ['LP'] }))).toEqual([]);
  });
});

describe('availableFilters', () => {
  it('hides condition and price when real data has none', () => {
    expect(availableFilters({})).toEqual({ condition: false, price: false });
    expect(availableFilters({ a: { condition: null, price: null } })).toEqual({ condition: false, price: false });
  });
  it('shows what has data', () => {
    expect(availableFilters({ a: { condition: 'NM', price: null } })).toEqual({ condition: true, price: false });
    expect(availableFilters(details)).toEqual({ condition: true, price: true });
  });
});

describe('URL state', () => {
  it('round-trips', () => {
    const filters = f({ q: 'char', own: 'owned', cond: ['LP', 'NM'], min: 5, max: 100.5 });
    const qs = serializeFilters(filters, { set: 'base1', sort: 'name-asc' });
    expect(qs).toBe('set=base1&q=char&own=owned&cond=NM%2CLP&min=5&max=100.5&sort=name-asc');
    const params = new URLSearchParams(qs);
    expect(parseFilters(params)).toEqual({ ...filters, cond: ['NM', 'LP'] });
    expect(parseSort(params)).toBe('name-asc');
  });
  it('leaves defaults out', () => {
    expect(serializeFilters(EMPTY_FILTERS, { set: '', sort: 'binder' })).toBe('');
  });
  it('ignores junk values', () => {
    const p = new URLSearchParams('own=bogus&cond=XX,nm,nm&min=abc&max=-3&sort=zzz&q=' + 'a'.repeat(200));
    const parsed = parseFilters(p);
    expect(parsed.own).toBe('all');
    expect(parsed.cond).toEqual(['NM']);
    expect(parsed.min).toBeNull();
    expect(parsed.max).toBeNull();
    expect(parsed.q).toHaveLength(80);
    expect(parseSort(p)).toBe('binder');
  });
  it('swaps a reversed range', () => {
    const parsed = parseFilters(new URLSearchParams('min=50&max=10'));
    expect([parsed.min, parsed.max]).toEqual([10, 50]);
  });
});

describe('activeFilterCount', () => {
  it('counts a price range once', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount(f({ q: 'a', own: 'owned', cond: ['NM'], min: 1, max: 2 }))).toBe(4);
  });
});
