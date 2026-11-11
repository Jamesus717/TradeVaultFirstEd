import { describe, expect, it } from 'vitest';
import { findSpares, groupSparesBySet, sparesToTextItems } from '../lib/spares';
import { formatListText } from '../lib/listText';

const rows = [
  { cardId: 'a', cardName: 'Pikachu', setName: 'Base', qty: 3 },
  { cardId: 'b', cardName: 'Charizard', setName: 'Base', qty: 1 },
  { cardId: 'c', cardName: 'Abra', setName: 'Base', qty: 2 },
  { cardId: 'd', cardName: 'Pineco', setName: 'SV', qty: null },
  { cardId: 'e', cardName: 'Odd', setName: null, qty: 2 },
];

describe('spares', () => {
  it('keeps one and counts the rest', () => {
    const s = findSpares(rows);
    expect(s.map((i) => [i.cardId, i.spares])).toEqual([['a', 2], ['c', 1], ['e', 1]]);
  });
  it('groups by set, sorted, Other last', () => {
    const g = groupSparesBySet(findSpares(rows));
    expect(g.map((x) => x.setName)).toEqual(['Base', 'Other']);
    expect(g[0].items.map((i) => i.name)).toEqual(['Abra', 'Pikachu']);
    expect(g[0].total).toBe(3);
  });
  it('copies name, set and spare count only', () => {
    const text = formatListText('Spares', sparesToTextItems(findSpares(rows)));
    expect(text).toBe('Spares (3 cards)\n\nBase\n- Abra\n- Pikachu x2\n\nOther\n- Odd');
  });
  it('handles empty', () => {
    expect(findSpares([])).toEqual([]);
    expect(groupSparesBySet([])).toEqual([]);
  });
});
