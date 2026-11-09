import { describe, expect, it } from 'vitest';
import { availableSorts, isSortMode, joinSort, sortCards, splitSort, SORT_MODES } from '../lib/binderSort';
import { EMPTY_FILTERS, parseFilters, parseSort, serializeFilters, type DetailsById } from '../lib/binderFilters';

const card = (baseCardId: string, name: string, number: string, setName = 'Base') => ({
  id: `${baseCardId}-normal`,
  baseCardId,
  name,
  number,
  setName,
  variant: 'Normal',
});
const cards = [
  card('base1-4', 'Charizard', '4'),
  card('base1-58', 'Pikachu', '58'),
  card('base1-2', 'Blastoise', '2'),
  card('jungle-1', 'Vaporeon', '12', 'Jungle'),
  card('base1-9', 'Charmander', '9'),
];
const details: DetailsById = {
  'base1-4': { price: 250, addedAt: '2026-10-02T10:00:00Z' },
  'base1-58': { price: 12.5, addedAt: '2026-10-20T10:00:00Z' },
  'base1-2': { price: null, addedAt: null },
  'jungle-1': { price: 40, addedAt: '2026-09-01T00:00:00Z' },
};
const order = (mode: Parameters<typeof sortCards>[1], owned = {}) =>
  sortCards(cards, mode, owned, details).map((c) => c.name);

describe('sortCards', () => {
  it('sorts by binder number both ways, numerically', () => {
    expect(order('binder')).toEqual(['Blastoise', 'Charizard', 'Charmander', 'Vaporeon', 'Pikachu']);
    expect(order('number-desc')).toEqual(['Pikachu', 'Vaporeon', 'Charmander', 'Charizard', 'Blastoise']);
  });
  it('sorts by name', () => {
    expect(order('name-asc')[0]).toBe('Blastoise');
    expect(order('name-desc')[0]).toBe('Vaporeon');
  });
  it('sorts by set then number', () => {
    expect(order('set-asc')).toEqual(['Blastoise', 'Charizard', 'Charmander', 'Pikachu', 'Vaporeon']);
    expect(order('set-desc')).toEqual(['Vaporeon', 'Pikachu', 'Charmander', 'Charizard', 'Blastoise']);
  });
  it('sorts by price and keeps cards with no price last either way', () => {
    expect(order('price-asc').slice(0, 3)).toEqual(['Pikachu', 'Vaporeon', 'Charizard']);
    expect(order('price-desc').slice(0, 3)).toEqual(['Charizard', 'Vaporeon', 'Pikachu']);
    expect(order('price-asc').slice(3)).toEqual(['Blastoise', 'Charmander']);
    expect(order('price-desc').slice(3)).toEqual(['Blastoise', 'Charmander']);
  });
  it('sorts by date added, undated last', () => {
    expect(order('added-asc').slice(0, 3)).toEqual(['Vaporeon', 'Charizard', 'Pikachu']);
    expect(order('added-desc').slice(0, 3)).toEqual(['Pikachu', 'Charizard', 'Vaporeon']);
    expect(order('added-desc').slice(3)).toEqual(['Blastoise', 'Charmander']);
  });
  it('puts owned first', () => {
    expect(order('owned-first', { 'base1-58-normal': true })[0]).toBe('Pikachu');
  });
  it('does not change the input list', () => {
    const copy = [...cards];
    sortCards(cards, 'name-desc', {}, details);
    expect(cards).toEqual(copy);
  });
  it('handles an empty list and empty details', () => {
    expect(sortCards([], 'price-asc', {}, {})).toEqual([]);
    expect(sortCards(cards, 'price-desc', {}, {})).toHaveLength(5);
  });
});

describe('sort modes', () => {
  it('splits and joins every mode', () => {
    for (const mode of SORT_MODES) {
      const parts = splitSort(mode);
      if (parts) expect(joinSort(parts.field, parts.dir)).toBe(mode);
    }
    expect(splitSort('owned-first')).toBeNull();
  });
  it('rejects unknown modes', () => {
    expect(isSortMode('price-sideways')).toBe(false);
    expect(isSortMode(null)).toBe(false);
  });
  it('reports which optional sorts have data', () => {
    expect(availableSorts({})).toEqual({ price: false, added: false });
    expect(availableSorts(details)).toEqual({ price: true, added: true });
  });
});

describe('sort in the URL', () => {
  it('round-trips every mode next to the filters', () => {
    for (const mode of SORT_MODES) {
      const qs = serializeFilters({ ...EMPTY_FILTERS, own: 'owned', max: 20 }, { set: 'base1', sort: mode });
      const params = new URLSearchParams(qs);
      expect(parseSort(params)).toBe(mode);
      expect(parseFilters(params)).toMatchObject({ own: 'owned', max: 20 });
      expect(params.get('set')).toBe('base1');
    }
  });
  it('leaves the default sort out of the URL', () => {
    expect(serializeFilters(EMPTY_FILTERS, { sort: 'binder' })).toBe('');
    expect(serializeFilters(EMPTY_FILTERS, { sort: 'added-desc' })).toBe('sort=added-desc');
  });
  it('falls back to binder order on a bad value', () => {
    expect(parseSort(new URLSearchParams('sort=price-up'))).toBe('binder');
  });
});
