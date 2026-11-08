import { describe, expect, it, vi } from 'vitest';
import {
  compareTrade,
  labelFor,
  latestOfferAmount,
  listingTradeSides,
  type TradeItem,
} from '../lib/fairTrade';
import { createPriceLoader } from '../lib/priceLoader';
import { DEMO_MATCHES } from '../lib/demo';
import { DEMO_PRICES } from '../lib/demoPrices';
import { groupMatches } from '../lib/matching';

const card = (value: number | null, quantity?: number): TradeItem => ({ name: 'Card', value, quantity });

describe('compareTrade', () => {
  it('totals both sides and reports the gap in £ and % of the bigger side', () => {
    const result = compareTrade({ get: [card(60), card(40)], give: [card(80)] });
    expect(result.getTotal).toBe(100);
    expect(result.giveTotal).toBe(80);
    expect(result.gap).toBe(20);
    expect(result.gapAbs).toBe(20);
    expect(result.gapPct).toBe(20);
    expect(result.favours).toBe('you');
    expect(result.label).toBe('slightly_uneven');
    expect(result.complete).toBe(true);
  });

  it('says who the gap favours', () => {
    expect(compareTrade({ get: [card(10)], give: [card(50)] }).favours).toBe('them');
    expect(compareTrade({ get: [card(10)], give: [card(50)] }).gap).toBe(-40);
    expect(compareTrade({ get: [card(25)], give: [card(25)] }).favours).toBe('even');
  });

  it('labels fair, slightly uneven and uneven at the thresholds', () => {
    expect(compareTrade({ get: [card(100)], give: [card(90)] }).label).toBe('fair'); // 10%
    expect(compareTrade({ get: [card(100)], give: [card(89)] }).label).toBe('slightly_uneven'); // 11%
    expect(compareTrade({ get: [card(100)], give: [card(75)] }).label).toBe('slightly_uneven'); // 25%
    expect(compareTrade({ get: [card(100)], give: [card(74)] }).label).toBe('uneven'); // 26%
  });

  it('calls a small £ gap fair even when the % is big', () => {
    const result = compareTrade({ get: [card(3)], give: [card(1.5)] });
    expect(result.gapPct).toBe(50);
    expect(result.label).toBe('fair');
    expect(compareTrade({ get: [card(5)], give: [card(2.99)] }).label).toBe('uneven');
  });

  it('adds money in pence, so float drift never shows', () => {
    const result = compareTrade({ get: [card(0.1), card(0.2)], give: [card(0.3)] });
    expect(result.getTotal).toBe(0.3);
    expect(result.gap).toBe(0);
    expect(result.favours).toBe('even');
  });

  it('counts quantities and ignores nonsense ones', () => {
    const result = compareTrade({ get: [card(2.5, 4)], give: [card(10), card(99, 0), card(99, -1)] });
    expect(result.getTotal).toBe(10);
    expect(result.giveTotal).toBe(10);
    expect(result.label).toBe('fair');
  });

  it('counts unpriced cards and only marks complete when every card has a price', () => {
    const result = compareTrade({ get: [card(50), card(null, 2)], give: [card(48)] });
    expect(result.unpriced).toEqual({ get: 2, give: 0 });
    expect(result.getTotal).toBe(50);
    expect(result.label).toBe('fair');
    expect(result.complete).toBe(false);
  });

  it('treats negative and non-finite prices as unpriced', () => {
    const result = compareTrade({ get: [card(-5), card(Number.NaN)], give: [card(10)] });
    expect(result.unpriced.get).toBe(2);
    expect(result.label).toBe('unknown');
  });

  it('will not judge a trade with an empty or all-unpriced side', () => {
    expect(compareTrade({ get: [card(20)], give: [] }).label).toBe('unknown');
    expect(compareTrade({ get: [], give: [] }).label).toBe('unknown');
    expect(compareTrade({ get: [], give: [] }).gapPct).toBe(0);
    expect(compareTrade({ get: [card(20)], give: [card(null)] }).label).toBe('unknown');
  });

  it('takes custom thresholds', () => {
    const strict = { fairPct: 5, slightlyUnevenPct: 10, fairBelowGBP: 0 };
    expect(compareTrade({ get: [card(100)], give: [card(92)] }, strict).label).toBe('slightly_uneven');
    expect(labelFor(1, 50, strict)).toBe('uneven');
  });
});

describe('listingTradeSides', () => {
  const listing = { card_id: 'base1-4', card_name: 'Charizard', listing_type: 'either' as const, price: 150 };

  it('puts the card on the buyer get side and the latest offer on the give side', () => {
    const sides = listingTradeSides({ listing, cardValue: 180, isSeller: false, latestOffer: 160 });
    expect(sides.money).toBe('offer');
    expect(sides.get).toEqual([{ name: 'Charizard', value: 180 }]);
    expect(sides.give).toEqual([{ name: 'Cash offer', value: 160 }]);
  });

  it('flips the sides for the seller', () => {
    const sides = listingTradeSides({ listing, cardValue: 180, isSeller: true, latestOffer: 160 });
    expect(sides.get[0].value).toBe(160);
    expect(sides.give[0].value).toBe(180);
  });

  it('falls back to the asking price, but never for a trade-only listing', () => {
    expect(listingTradeSides({ listing, cardValue: 180, isSeller: false, latestOffer: null }).money).toBe('asking');
    const tradeOnly = listingTradeSides({
      listing: { ...listing, listing_type: 'trade' },
      cardValue: 180,
      isSeller: false,
      latestOffer: null,
    });
    expect(tradeOnly.money).toBe(null);
    expect(tradeOnly.give).toEqual([]);
    expect(compareTrade(tradeOnly).label).toBe('unknown');
  });
});

describe('latestOfferAmount', () => {
  const offer = (amount: number, status: string, at: string) => ({
    message_type: 'offer',
    offer_amount: amount,
    offer_status: status,
    created_at: at,
  });

  it('picks the newest offer that is still on the table', () => {
    expect(
      latestOfferAmount([
        offer(100, 'countered', '2026-11-01T10:00:00Z'),
        offer(120, 'pending', '2026-11-01T11:00:00Z'),
        offer(140, 'declined', '2026-11-01T12:00:00Z'),
        { message_type: 'message', offer_amount: null, offer_status: null, created_at: '2026-11-01T13:00:00Z' },
      ])
    ).toBe(120);
  });

  it('is null with no live offer', () => {
    expect(latestOfferAmount([])).toBe(null);
    expect(latestOfferAmount([offer(50, 'declined', '2026-11-01T10:00:00Z')])).toBe(null);
  });
});

describe('createPriceLoader', () => {
  it('batches lookups from the same tick into one query and remembers answers', async () => {
    const fetchRows = vi.fn(async (ids: string[]) =>
      ids.filter((id) => id !== 'none').map((id) => ({ card_id: id, price_mid: id === 'a' ? '12.5' : 3 }))
    );
    const load = createPriceLoader(fetchRows);

    const [first, second] = await Promise.all([load(['a', 'b']), load(['b', 'none'])]);
    expect(fetchRows).toHaveBeenCalledTimes(1);
    expect(fetchRows.mock.calls[0][0].sort()).toEqual(['a', 'b', 'none']);
    expect(first).toEqual({ a: 12.5, b: 3 });
    expect(second).toEqual({ b: 3, none: null });

    expect(await load(['a', 'none'])).toEqual({ a: 12.5, none: null });
    expect(fetchRows).toHaveBeenCalledTimes(1);
  });

  it('splits big lookups into chunks of 100', async () => {
    const fetchRows = vi.fn(async () => []);
    const load = createPriceLoader(fetchRows);
    await load(Array.from({ length: 250 }, (_, i) => `c${i}`));
    expect(fetchRows.mock.calls.map((call) => (call as unknown as [string[]])[0].length)).toEqual([100, 100, 50]);
  });

  it('turns a failed query into "no price" instead of throwing', async () => {
    const load = createPriceLoader(async () => {
      throw new Error('offline');
    });
    expect(await load(['a'])).toEqual({ a: null });
  });

  it('ignores zero and junk prices', async () => {
    const load = createPriceLoader(async () => [
      { card_id: 'a', price_mid: 0 },
      { card_id: 'b', price_mid: 'abc' },
      { card_id: null, price_mid: 5 },
    ]);
    expect(await load(['a', 'b'])).toEqual({ a: null, b: null });
  });
});

describe('demo prices', () => {
  it('price every demo match card, so the demo shows all three labels', () => {
    for (const row of DEMO_MATCHES) expect(DEMO_PRICES[row.card_id]).toBeGreaterThan(0);

    const labels = groupMatches(DEMO_MATCHES).map(
      (match) =>
        compareTrade({
          get: match.theyHave.map((row) => ({ name: row.card_id, value: DEMO_PRICES[row.card_id] })),
          give: match.iHave.map((row) => ({ name: row.card_id, value: DEMO_PRICES[row.card_id] })),
        }).label
    );
    expect(new Set(labels)).toEqual(new Set(['fair', 'slightly_uneven', 'uneven', 'unknown']));
  });
});
