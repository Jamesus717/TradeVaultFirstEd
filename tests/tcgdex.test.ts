import { describe, expect, it } from 'vitest';
import {
  mapTcgdexSetCards,
  mapTcgdexSets,
  toPokemonCardNumber,
  toPokemonSetId,
  toTcgdexSetId,
  type TcgdexSet,
} from '../lib/cardData/tcgdex';

describe('TCGdex set ids', () => {
  it('maps differing ids both ways and leaves the rest alone', () => {
    expect(toTcgdexSetId('me1')).toBe('me01');
    expect(toPokemonSetId('me01')).toBe('me1');
    expect(toTcgdexSetId('swsh1')).toBe('swsh1');
    expect(toPokemonSetId('swsh1')).toBe('swsh1');
  });
});

describe('toPokemonCardNumber', () => {
  it('strips padding from plain numbers only', () => {
    expect(toPokemonCardNumber('001')).toBe('1');
    expect(toPokemonCardNumber('125')).toBe('125');
    expect(toPokemonCardNumber('TG01')).toBe('TG01');
    expect(toPokemonCardNumber('SWSH001')).toBe('SWSH001');
  });
});

describe('mapTcgdexSetCards', () => {
  const set: TcgdexSet = {
    id: 'me01',
    name: 'Mega Evolution',
    serie: { id: 'me', name: 'Mega Evolution' },
    cards: [
      { id: 'me01-001', localId: '001', name: 'Bulbasaur', image: 'https://assets.tcgdex.net/en/me/me01/001' },
      { id: 'me01-002', localId: '002', name: 'Ivysaur' },
    ],
  };

  it('uses the pokemontcg.io id, number and image shape', () => {
    const [first, second] = mapTcgdexSetCards(set);
    expect(first.id).toBe('me1-1');
    expect(first.number).toBe('1');
    expect(first.set).toEqual({ id: 'me1', name: 'Mega Evolution', series: 'Mega Evolution' });
    expect(first.images).toEqual({
      small: 'https://assets.tcgdex.net/en/me/me01/001/low.webp',
      large: 'https://assets.tcgdex.net/en/me/me01/001/high.webp',
    });
    expect(second.images).toBeUndefined();
  });
});

describe('mapTcgdexSets', () => {
  it('converts ids and dates, and fills a missing series and date', () => {
    const sets = mapTcgdexSets([
      { id: 'me01', name: 'Mega Evolution', releaseDate: '2025-09-26', serie: { id: 'me', name: 'Mega' }, cards: [] },
      { id: 'xx1', name: 'Odd set', cards: [] },
    ]);
    expect(sets[0]).toEqual({ id: 'me1', name: 'Mega Evolution', series: 'Mega', releaseDate: '2025/09/26' });
    expect(sets[1]).toEqual({ id: 'xx1', name: 'Odd set', series: 'Other', releaseDate: '' });
  });
});
