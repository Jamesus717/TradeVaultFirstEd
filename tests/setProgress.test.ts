import { describe, expect, it } from 'vitest';
import { missingCardsHref, setProgress } from '../lib/setProgress';
import { parseFilters } from '../lib/binderFilters';

describe('setProgress', () => {
  it('counts owned, missing and percent', () => {
    expect(setProgress(25, 100)).toEqual({ owned: 25, total: 100, missing: 75, pct: 25, complete: false });
  });
  it('handles an empty set and an empty binder', () => {
    expect(setProgress(0, 0)).toMatchObject({ pct: 0, missing: 0, complete: false });
    expect(setProgress(0, 50)).toMatchObject({ pct: 0, missing: 50 });
  });
  it('never shows 100% until complete', () => {
    expect(setProgress(199, 200).pct).toBe(99);
    expect(setProgress(200, 200)).toMatchObject({ pct: 100, complete: true, missing: 0 });
  });
  it('clamps bad input', () => {
    expect(setProgress(9, 5).owned).toBe(5);
    expect(setProgress(-3, 5).owned).toBe(0);
    expect(setProgress(NaN, NaN)).toMatchObject({ owned: 0, total: 0 });
  });
});

describe('missingCardsHref', () => {
  it('opens the binder filter for the set', () => {
    const href = missingCardsHref('base1');
    expect(href).toBe('/binder?set=base1&own=unowned');
    const params = new URL(href, 'http://x').searchParams;
    expect(parseFilters(params).own).toBe('unowned');
    expect(params.get('set')).toBe('base1');
  });
});
