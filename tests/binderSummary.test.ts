import { describe, expect, it } from 'vitest';
import { formatGbp, summarizeBinder, summaryScope, unpricedLine } from '../lib/binderSummary';
import type { DetailsById } from '../lib/binderFilters';

const card = (baseCardId: string, setId = baseCardId.split('-')[0]) => ({
  id: `${baseCardId}-normal`,
  baseCardId,
  name: baseCardId,
  setId,
});
const owned = { 'base1-4-normal': true, 'base1-58-normal': true, 'sv1-1-normal': true };
const details: DetailsById = {
  'base1-4': { price: 250 },
  'base1-58': { price: 12.5 },
  'sv1-1': { price: null },
};

describe('summarizeBinder', () => {
  it('counts owned cards, sets, value and unpriced', () => {
    const s = summarizeBinder([card('base1-4'), card('base1-58'), card('sv1-1'), card('base1-9')], owned, details);
    expect(s).toEqual({ cards: 3, sets: 2, value: 262.5, priced: 2, unpriced: 1 });
  });
  it('summarises only what is passed in', () => {
    expect(summarizeBinder([card('base1-58')], owned, details)).toMatchObject({ cards: 1, sets: 1, value: 12.5, unpriced: 0 });
  });
  it('is empty with nothing owned', () => {
    expect(summarizeBinder([card('base1-4')], {}, details)).toEqual({ cards: 0, sets: 0, value: 0, priced: 0, unpriced: 0 });
  });
  it('treats missing details as no price and avoids float drift', () => {
    const s = summarizeBinder([card('base1-4'), card('base1-58')], owned, { 'base1-4': { price: 0.1 }, 'base1-58': { price: 0.2 } });
    expect(s.value).toBe(0.3);
    expect(summarizeBinder([card('base1-4')], owned, {}).unpriced).toBe(1);
  });
  it('derives the set from the card id when setId is absent', () => {
    const c = { id: 'sv3pt5-12-normal', baseCardId: 'sv3pt5-12', name: 'x' };
    expect(summarizeBinder([c], { [c.id]: true }, {}).sets).toBe(1);
  });
});

describe('wording', () => {
  it('formats', () => {
    expect(formatGbp(1234.5)).toBe('£1,234.50');
    expect(unpricedLine(1)).toBe('1 card has no price');
    expect(unpricedLine(3)).toBe('3 cards have no price');
  });
  it('says what it covers', () => {
    expect(summaryScope(0, 10, 10, 'Base')).toBe('Everything you own in Base');
    expect(summaryScope(2, 3, 102, 'Base')).toContain('3 of 102 cards shown');
  });
});
