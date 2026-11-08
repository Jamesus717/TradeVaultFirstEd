import { describe, expect, it } from 'vitest';
import { DEMO_WISHLIST, demoPrices } from '../lib/demo';
import {
  DEFAULT_MAX_PRICE_AGE_MS,
  findUnderTarget,
  formatGbp,
  parseTargetPrice,
  type CachedPrice,
  type WishlistTarget,
} from '../lib/priceAlerts';
import { missingTargetColumn } from '../lib/priceAlertsData';

const NOW = Date.parse('2026-11-08T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

function want(cardId: string, target: number | string | null, name = cardId): WishlistTarget {
  return { id: `w-${cardId}`, card_id: cardId, card_name: name, set_name: 'Base', card_number: '1', image_url: null, target_price: target };
}
function price(cardId: string, mid: number | string | null, fetched = hoursAgo(1), currency: string | null = 'GBP'): CachedPrice {
  return { card_id: cardId, price_mid: mid, currency, fetched_at: fetched };
}

describe('findUnderTarget', () => {
  it('lists a card whose market price is under the target, with the saving', () => {
    const [alert, ...rest] = findUnderTarget([want('a', 20)], [price('a', 15.5)], { nowMs: NOW });
    expect(rest).toHaveLength(0);
    expect(alert).toMatchObject({ wishlistId: 'w-a', target: 20, price: 15.5, saving: 4.5, percentUnder: 23 });
  });

  it('counts a price equal to the target', () => {
    const alerts = findUnderTarget([want('a', 10)], [price('a', 10)], { nowMs: NOW });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].percentUnder).toBe(0);
  });

  it('skips cards over target, with no target, or with no cached price', () => {
    const alerts = findUnderTarget(
      [want('over', 10), want('none', null), want('uncached', 50), want('zero', 0)],
      [price('over', 10.01), price('none', 1), price('zero', 1)],
      { nowMs: NOW }
    );
    expect(alerts).toEqual([]);
  });

  it('accepts Postgres numerics as strings', () => {
    const alerts = findUnderTarget([want('a', '12.50')], [price('a', '9.99')], { nowMs: NOW });
    expect(alerts[0]).toMatchObject({ target: 12.5, price: 9.99, saving: 2.51 });
  });

  it('ignores stale prices, using 7 days unless told otherwise', () => {
    const wishlist = [want('fresh', 10), want('edge', 10), want('stale', 10)];
    const prices = [
      price('fresh', 5, hoursAgo(24)),
      price('edge', 5, new Date(NOW - DEFAULT_MAX_PRICE_AGE_MS).toISOString()),
      price('stale', 5, hoursAgo(24 * 8)),
    ];
    expect(findUnderTarget(wishlist, prices, { nowMs: NOW }).map((a) => a.cardId)).toEqual(['edge', 'fresh']);
    expect(findUnderTarget(wishlist, prices, { nowMs: NOW, maxAgeMs: 36 * 3_600_000 }).map((a) => a.cardId)).toEqual([
      'fresh',
    ]);
  });

  it('skips other currencies, missing or bad dates, and zero prices', () => {
    const alerts = findUnderTarget(
      [want('usd', 10), want('nodate', 10), want('baddate', 10), want('free', 10), want('nullcur', 10)],
      [
        price('usd', 5, hoursAgo(1), 'USD'),
        { ...price('nodate', 5), fetched_at: null },
        price('baddate', 5, 'yesterday'),
        price('free', 0),
        price('nullcur', 5, hoursAgo(1), null),
      ],
      { nowMs: NOW }
    );
    // A null currency is the table default, GBP.
    expect(alerts.map((a) => a.cardId)).toEqual(['nullcur']);
  });

  it('puts the biggest drop first, then sorts by name', () => {
    const alerts = findUnderTarget(
      [want('a', 10, 'Zapdos'), want('b', 10, 'Abra'), want('c', 100, 'Mew')],
      [price('a', 5), price('b', 5), price('c', 10)],
      { nowMs: NOW }
    );
    expect(alerts.map((a) => a.cardName)).toEqual(['Mew', 'Abra', 'Zapdos']);
  });

  it('gives the demo a mix of cards under and over target', () => {
    const alerts = findUnderTarget(DEMO_WISHLIST, demoPrices(NOW), { nowMs: NOW });
    expect(alerts.map((a) => a.cardName)).toEqual(['Venusaur', 'Zapdos', 'Charizard']);
  });
});

describe('parseTargetPrice', () => {
  it('reads pounds and pence, with or without a £ sign', () => {
    expect(parseTargetPrice('12.5')).toEqual({ ok: true, value: 12.5 });
    expect(parseTargetPrice(' £ 1,250.00 ')).toEqual({ ok: true, value: 1250 });
    expect(parseTargetPrice('7')).toEqual({ ok: true, value: 7 });
  });

  it('treats blank as "no alert"', () => {
    expect(parseTargetPrice('   ')).toEqual({ ok: true, value: null });
  });

  it('rejects zero, too many decimals, words and huge numbers', () => {
    for (const bad of ['0', '0.00', '1.999', 'ten', '-5', '100000.01']) {
      expect(parseTargetPrice(bad).ok, bad).toBe(false);
    }
    expect(parseTargetPrice('100000')).toEqual({ ok: true, value: 100000 });
  });
});

describe('helpers', () => {
  it('formats pounds', () => {
    expect(formatGbp(1234.5)).toBe('£1,234.50');
  });

  it('spots the missing column error from Postgres and PostgREST only', () => {
    expect(missingTargetColumn({ code: '42703', message: 'column wishlist_cards.target_price does not exist' })).toBe(true);
    expect(missingTargetColumn({ code: 'PGRST204', message: "Could not find the 'target_price' column" })).toBe(true);
    expect(missingTargetColumn({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(missingTargetColumn(null)).toBe(false);
  });
});
