import { describe, expect, it } from 'vitest';
import {
  CARD_OFFER_TAG,
  MAX_OFFER_CARDS,
  cardOfferSummary,
  encodeCardOffer,
  parseCardOffer,
  type CardOffer,
} from '../lib/cardOffer';
import { DEMO_MY_CARDS, DEMO_PRICES } from '../lib/demoPrices';
import {
  badgeText,
  compareTrade,
  isReverseHolo,
  latestDeal,
  listingTradeSides,
  type PricedCardOffer,
} from '../lib/fairTrade';
import { filterPickable, setsToName, splitCardId, toPickable } from '../lib/myCards';

const SWAP: CardOffer = {
  cards: [
    { id: 'base1-2', name: 'Blastoise', variant: 'Normal' },
    { id: 'base1-7', name: 'Hitmonchan', variant: 'Normal' },
  ],
  cash: 50,
};

describe('card offer messages', () => {
  it('round-trips through the message content', () => {
    const content = encodeCardOffer(SWAP);
    expect(content.split('\n')[0]).toBe('Card offer: Blastoise, Hitmonchan + £50.00');
    expect(content).toContain(CARD_OFFER_TAG);
    expect(parseCardOffer(content)).toEqual(SWAP);
  });

  it('leaves ordinary messages alone', () => {
    expect(parseCardOffer('Hi, still got the Charizard?')).toBe(null);
    expect(parseCardOffer(null)).toBe(null);
    expect(parseCardOffer('')).toBe(null);
  });

  it('treats a broken or hand-typed payload as a normal message', () => {
    expect(parseCardOffer(`${CARD_OFFER_TAG} {not json`)).toBe(null);
    expect(parseCardOffer(`${CARD_OFFER_TAG} {"cards":[]}`)).toBe(null);
    expect(parseCardOffer(`${CARD_OFFER_TAG} {"cards":"base1-2"}`)).toBe(null);
    expect(parseCardOffer(`${CARD_OFFER_TAG} {"cards":[{"id":"../etc"}]}`)).toBe(null);
    expect(parseCardOffer(`${CARD_OFFER_TAG} null`)).toBe(null);
  });

  it('drops a bad cash amount but keeps the cards', () => {
    for (const cash of [-5, 0, '20', 1e9, null]) {
      const content = `${CARD_OFFER_TAG} ${JSON.stringify({ cards: [{ id: 'base1-2' }], cash })}`;
      expect(parseCardOffer(content)).toEqual({ cards: [{ id: 'base1-2', name: 'base1-2', variant: null }], cash: null });
    }
  });

  it('rounds cash to pence and trims names', () => {
    const content = encodeCardOffer({ cards: [{ id: 'base1-2', name: '  Blastoise\n', variant: null }], cash: 10.005 });
    expect(parseCardOffer(content)).toEqual({ cards: [{ id: 'base1-2', name: 'Blastoise', variant: null }], cash: 10.01 });
  });

  it(`refuses to build an empty offer or one over ${MAX_OFFER_CARDS} cards`, () => {
    expect(() => encodeCardOffer({ cards: [], cash: 10 })).toThrow();
    const many = Array.from({ length: MAX_OFFER_CARDS + 1 }, (_, i) => ({ id: `base1-${i + 1}`, name: 'X', variant: null }));
    expect(() => encodeCardOffer({ cards: many, cash: null })).toThrow();
    expect(() => encodeCardOffer({ cards: many.slice(0, MAX_OFFER_CARDS), cash: null })).not.toThrow();
  });

  it('summarises without cash when there is none', () => {
    expect(cardOfferSummary({ cards: [SWAP.cards[0]], cash: null })).toBe('Card offer: Blastoise');
  });
});

describe('latestDeal', () => {
  const cashOffer = (amount: number, status: string, at: string) => ({
    message_type: 'offer',
    sender_id: 'buyer',
    content: '',
    offer_amount: amount,
    offer_status: status,
    created_at: at,
  });
  const cardMessage = (offer: CardOffer, at: string, sender = 'buyer') => ({
    message_type: 'message',
    sender_id: sender,
    content: encodeCardOffer(offer),
    offer_amount: null,
    offer_status: null,
    created_at: at,
  });
  const chat = (text: string, at: string) => ({
    message_type: 'message',
    sender_id: 'buyer',
    content: text,
    offer_amount: null,
    offer_status: null,
    created_at: at,
  });

  it('takes the newest of cash and card offers', () => {
    const messages = [
      cashOffer(20, 'pending', '2026-11-08T10:00:00Z'),
      cardMessage(SWAP, '2026-11-08T11:00:00Z'),
      chat('what do you think?', '2026-11-08T12:00:00Z'),
    ];
    expect(latestDeal(messages)).toEqual({ kind: 'cards', offer: SWAP, senderId: 'buyer' });
    expect(latestDeal([...messages, cashOffer(30, 'pending', '2026-11-08T13:00:00Z')])).toEqual({
      kind: 'cash',
      amount: 30,
      senderId: 'buyer',
    });
  });

  it('skips declined cash offers but keeps the card offer before them', () => {
    expect(
      latestDeal([cardMessage(SWAP, '2026-11-08T10:00:00Z'), cashOffer(30, 'declined', '2026-11-08T11:00:00Z')])?.kind
    ).toBe('cards');
  });

  it('is null with no offer at all', () => {
    expect(latestDeal([chat('hi', '2026-11-08T10:00:00Z')])).toBe(null);
    expect(latestDeal([])).toBe(null);
  });
});

describe('listingTradeSides with a card offer', () => {
  const listing = { card_id: 'base1-4', card_name: 'Charizard', listing_type: 'trade' as const, price: null };
  const priced = (fromSeller: boolean): PricedCardOffer => ({
    items: [
      { name: 'Blastoise', value: 70 },
      { name: 'Hitmonchan', value: 40 },
    ],
    cash: 50,
    fromSeller,
  });

  it("puts the buyer's cards and cash against the listed card", () => {
    const sides = listingTradeSides({ listing, cardValue: 180, isSeller: false, latestOffer: null, cardOffer: priced(false) });
    expect(sides.money).toBe('cards');
    expect(sides.get.map((item) => item.name)).toEqual(['Charizard']);
    expect(sides.give.map((item) => item.name)).toEqual(['Blastoise', 'Hitmonchan', 'Cash top-up']);
    const result = compareTrade(sides);
    expect([result.getTotal, result.giveTotal, result.label]).toEqual([180, 160, 'slightly_uneven']);
  });

  it('shows the seller the same deal from their side', () => {
    const sides = listingTradeSides({ listing, cardValue: 180, isSeller: true, latestOffer: null, cardOffer: priced(false) });
    expect(compareTrade(sides)).toMatchObject({ getTotal: 160, giveTotal: 180, favours: 'them' });
  });

  it("adds a seller's cards to the seller's side", () => {
    const sides = listingTradeSides({ listing, cardValue: 180, isSeller: false, latestOffer: 100, cardOffer: priced(true) });
    expect(sides.get.map((item) => item.name)).toEqual(['Charizard', 'Blastoise', 'Hitmonchan', 'Cash top-up']);
    expect(sides.give).toEqual([]);
    expect(compareTrade(sides).reason).toBe('empty');
  });

  it('ignores the cash offer while a card offer is on the table', () => {
    const sides = listingTradeSides({ listing, cardValue: 180, isSeller: false, latestOffer: 999, cardOffer: priced(false) });
    expect(compareTrade(sides).giveTotal).toBe(160);
  });
});

describe('no price yet', () => {
  it('says why a trade cannot be judged', () => {
    expect(compareTrade({ get: [{ name: 'A', value: 20 }], give: [] }).reason).toBe('empty');
    expect(compareTrade({ get: [{ name: 'A', value: 20 }], give: [{ name: 'B', value: null }] }).reason).toBe('no_price');
    expect(compareTrade({ get: [{ name: 'A', value: 20 }], give: [{ name: 'B', value: 18 }] }).reason).toBe(null);
  });

  it('puts "No price yet" on the badge only when a price is what is missing', () => {
    expect(badgeText(compareTrade({ get: [{ name: 'A', value: null }], give: [{ name: 'B', value: 5 }] }))).toBe(
      'No price yet'
    );
    expect(badgeText(compareTrade({ get: [{ name: 'A', value: 5 }], give: [] }))).toBe("Can't compare yet");
    expect(badgeText(compareTrade({ get: [{ name: 'A', value: 5 }], give: [{ name: 'B', value: 5 }] }))).toBe('Fair');
  });

  it('still judges a part-priced trade on what is priced', () => {
    const result = compareTrade({
      get: [{ name: 'Venusaur', value: 60 }],
      give: [
        { name: 'Electabuzz', value: null },
        { name: 'Hitmonchan', value: 40 },
      ],
    });
    expect(result).toMatchObject({ label: 'uneven', reason: null, complete: false, unpriced: { get: 0, give: 1 } });
  });

  it('keeps Electabuzz unpriced in the demo, so the state shows', () => {
    expect(DEMO_PRICES['base1-20']).toBeUndefined();
    expect(DEMO_MY_CARDS.some((card) => card.card_id === 'base1-20')).toBe(true);
  });
});

describe('reverse holos', () => {
  it('spots the usual ways of writing it', () => {
    for (const v of ['Reverse Holo', 'reverse-holo', 'Reverse Holofoil', 'reverseHolofoil', 'RH']) {
      expect(isReverseHolo(v)).toBe(true);
    }
    for (const v of ['Holo', 'Normal', '1st Edition', '', null, undefined]) expect(isReverseHolo(v)).toBe(false);
  });

  it('counts reverse holo copies on both sides', () => {
    const result = compareTrade({
      get: [{ name: 'Pikachu', value: 3 }],
      give: [{ name: 'Pikachu', value: 2, variant: 'Reverse Holo', quantity: 2 }],
    });
    expect(result.reverseHolos).toBe(2);
    expect(result.label).toBe('fair');
  });
});

describe('picking cards from your collection', () => {
  it('splits ids whose set has dashes', () => {
    expect(splitCardId('base1-4')).toEqual({ set: 'base1', number: '4' });
    expect(splitCardId('sv3pt5-25')).toEqual({ set: 'sv3pt5', number: '25' });
    expect(splitCardId('swsh12pt5-GG01')).toEqual({ set: 'swsh12pt5', number: 'GG01' });
    expect(splitCardId('promo')).toEqual({ set: 'promo', number: '' });
  });

  it('keeps one row per card and printing, named where it can, sorted by name', () => {
    const rows = [
      { card_id: 'base1-4', variant: 'Holo' },
      { card_id: 'base1-4', variant: 'Holo' },
      { card_id: 'base1-4', variant: 'Reverse Holo' },
      { card_id: 'base1-2', variant: 'Holo' },
    ];
    const cards = toPickable(rows, { 'base1-4': { name: 'Charizard', number: '4' } });
    expect(cards.map((card) => [card.name, card.variant])).toEqual([
      ['base1 #2', 'Holo'],
      ['Charizard', 'Holo'],
      ['Charizard', 'Reverse Holo'],
    ]);
    expect(cards[0].image).toBe('https://images.pokemontcg.io/base1/2.png');
  });

  it('filters by name, id or printing', () => {
    const cards = toPickable(
      DEMO_MY_CARDS,
      Object.fromEntries(DEMO_MY_CARDS.map((card) => [card.card_id, card]))
    );
    expect(filterPickable(cards, 'blast').map((card) => card.name)).toEqual(['Blastoise']);
    expect(filterPickable(cards, 'reverse').map((card) => card.id)).toEqual(['sv3pt5-25']);
    expect(filterPickable(cards, '  ')).toHaveLength(cards.length);
  });

  it('fetches names for the most-owned sets first, capped', () => {
    const rows = [
      { card_id: 'sv1-1', variant: null },
      { card_id: 'base1-1', variant: null },
      { card_id: 'base1-2', variant: null },
      { card_id: 'x-1', variant: null, set_id: 'base1' },
    ];
    expect(setsToName(rows)).toEqual(['base1', 'sv1']);
    expect(setsToName(rows, 1)).toEqual(['base1']);
  });
});
