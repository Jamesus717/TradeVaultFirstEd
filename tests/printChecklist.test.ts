import { describe, expect, it } from 'vitest';
import { buildChecklist, printChecklistHref } from '../lib/printChecklist';

const c = (id: string, number: string, name: string, variant = 'Normal') => ({ id, number, name, variant });

describe('buildChecklist', () => {
  it('sorts by number and marks owned', () => {
    const rows = buildChecklist(
      [c('b', '10', 'B'), c('a', '2', 'A'), c('a-r', '2', 'A', 'Reverse Holo')],
      { a: true }
    );
    expect(rows.map((r) => r.id)).toEqual(['a', 'a-r', 'b']);
    expect(rows.map((r) => r.owned)).toEqual([true, false, false]);
  });
  it('handles an empty set and does not mutate input', () => {
    expect(buildChecklist([], {})).toEqual([]);
    const input = [c('b', '3', 'B'), c('a', '1', 'A')];
    buildChecklist(input, {});
    expect(input[0].id).toBe('b');
  });
});

describe('printChecklistHref', () => {
  it('builds the route', () => {
    expect(printChecklistHref('base1')).toBe('/binder/print?set=base1');
  });
});
