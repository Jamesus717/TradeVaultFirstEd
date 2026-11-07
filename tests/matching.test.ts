import { describe, expect, it } from 'vitest';
import { groupMatches, isNotMigrated, tradeAnchor, type MatchRow } from '../lib/matching';
import { DEMO_MATCHES } from '../lib/demo';

function row(trader: string, direction: MatchRow['direction'], item: string, priority: MatchRow['want_priority'] = null): MatchRow {
  return {
    trader_id: trader,
    username: trader,
    display_name: null,
    direction,
    item_id: item,
    card_id: item,
    set_id: null,
    card_name: item,
    set_name: null,
    card_number: null,
    image_url: null,
    variant: 'Normal',
    condition: null,
    tradable: 1,
    is_spare: false,
    want_priority: priority,
  };
}

describe('groupMatches', () => {
  it('returns nothing for no rows', () => {
    expect(groupMatches([])).toEqual([]);
  });

  it('puts a two-way trade above a bigger one-way trade', () => {
    const ranked = groupMatches([
      row('big', 'they_have', 'a'),
      row('big', 'they_have', 'b'),
      row('big', 'they_have', 'c'),
      row('both', 'they_have', 'd'),
      row('both', 'i_have', 'e'),
    ]);
    expect(ranked.map((t) => [t.traderId, t.twoWay])).toEqual([['both', true], ['big', false]]);
  });

  it('breaks ties on high priority wants, then card count, then name', () => {
    const ranked = groupMatches([
      row('zed', 'they_have', 'a', 'high'),
      row('amy', 'they_have', 'b'),
      row('amy', 'they_have', 'c'),
      row('bob', 'they_have', 'd'),
      row('cat', 'they_have', 'e'),
    ]);
    expect(ranked.map((t) => t.traderId)).toEqual(['zed', 'amy', 'bob', 'cat']);
  });

  it('shows a stack once when it answers two wants, at the higher priority', () => {
    const [trader] = groupMatches([row('t', 'they_have', 'a', 'low'), row('t', 'they_have', 'a', 'high')]);
    expect(trader.theyHave).toHaveLength(1);
    expect(trader.theyHave[0].want_priority).toBe('high');
    expect(trader.highPriority).toBe(1);
  });

  it('keeps one item in both directions apart', () => {
    const [trader] = groupMatches([row('t', 'they_have', 'a'), row('t', 'i_have', 'a')]);
    expect(trader.theyHave).toHaveLength(1);
    expect(trader.iHave).toHaveLength(1);
  });

  it('lists the most wanted card first', () => {
    const [trader] = groupMatches([row('t', 'they_have', 'a', 'low'), row('t', 'they_have', 'b', 'high')]);
    expect(trader.theyHave.map((r) => r.item_id)).toEqual(['b', 'a']);
  });

  it('falls back from display name to username to Trader', () => {
    const named = { ...row('a', 'they_have', 'x'), display_name: 'Ash' };
    const anon = { ...row('b', 'they_have', 'y'), username: null };
    const names = groupMatches([named, anon]).map((t) => t.name);
    expect(names).toEqual(['Ash', 'Trader']);
  });

  it('counts only your own high priority wants, not theirs', () => {
    const [trader] = groupMatches([row('t', 'i_have', 'a', 'high'), row('t', 'i_have', 'b', 'high')]);
    expect(trader.twoWay).toBe(false);
    expect(trader.highPriority).toBe(0);
  });

  it('groups rows for one trader that arrive out of order', () => {
    const ranked = groupMatches([
      row('a', 'they_have', 'x'),
      row('b', 'they_have', 'y'),
      row('a', 'i_have', 'z'),
    ]);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]).toMatchObject({ traderId: 'a', twoWay: true });
  });

  it('leaves the rows it was given untouched', () => {
    const rows = [row('t', 'they_have', 'a', 'low'), row('t', 'they_have', 'b', 'high')];
    const before = rows.map((r) => r.item_id);
    groupMatches(rows);
    expect(rows.map((r) => r.item_id)).toEqual(before);
  });

  it('ranks the demo data with two-way trades first', () => {
    const ranked = groupMatches(DEMO_MATCHES);
    expect(ranked[0].name).toContain('Sam');
    expect(ranked.at(-1)?.twoWay).toBe(false);
  });
});

describe('tradeAnchor', () => {
  it('opens on the card you want, never on your own', () => {
    const [both] = groupMatches([row('t', 'i_have', 'mine'), row('t', 'they_have', 'theirs')]);
    expect(tradeAnchor(both)?.item_id).toBe('theirs');
    const [oneWay] = groupMatches([row('t', 'i_have', 'mine')]);
    expect(tradeAnchor(oneWay)).toBeNull();
  });
});

describe('isNotMigrated', () => {
  it('spots missing tables and functions only', () => {
    expect(isNotMigrated({ code: 'PGRST202' })).toBe(true);
    expect(isNotMigrated({ code: '42P01' })).toBe(true);
    expect(isNotMigrated({ code: '42501' })).toBe(false);
    expect(isNotMigrated(null)).toBe(false);
  });
});
