import { describe, expect, it } from 'vitest';
import { DEMO_SHOPS } from '../lib/demo';
import { isFeatured, shopPlace, sortShops } from '../lib/shops';

const now = Date.parse('2026-11-02T12:00:00Z');

describe('sortShops', () => {
  it('puts live paying shops first, then sorts by name', () => {
    const sorted = sortShops(
      [
        { name: 'Aardvark', featured_until: null },
        { name: 'Zebra', featured_until: '2027-01-01T00:00:00Z' },
        { name: 'Lapsed', featured_until: '2026-01-01T00:00:00Z' },
      ],
      now
    );
    expect(sorted.map((s) => s.name)).toEqual(['Zebra', 'Aardvark', 'Lapsed']);
  });
});

describe('isFeatured', () => {
  it('ends when the paid period ends', () => {
    expect(isFeatured({ featured_until: null }, now)).toBe(false);
    expect(isFeatured({ featured_until: '2026-11-02T11:59:59Z' }, now)).toBe(false);
  });
});

describe('shopPlace', () => {
  it('skips missing parts', () => {
    expect(shopPlace({ town: 'Leeds' })).toBe('Leeds');
    expect(shopPlace({ town: null })).toBe('');
  });
});

describe('demo shops', () => {
  it('are all marked as examples, with valid slugs', () => {
    for (const shop of DEMO_SHOPS) {
      expect(shop.description).toMatch(/^Example shop/);
      expect(shop.slug).toMatch(/^[a-z0-9-]{2,60}$/);
    }
  });
});
