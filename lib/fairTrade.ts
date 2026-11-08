// Fair-trade meter: compares what each side of a trade is worth, so two
// strangers can see at a glance whether a swap is even. Pure, no I/O.
//
// Money is added up in whole pence so 0.1 + 0.2 style float drift never shows
// up as "£0.30000000004" or flips a label at a threshold.

export type TradeItem = {
  name: string;
  // GBP for one copy. null means no price is known yet.
  value: number | null;
  quantity?: number;
};

export type FairnessLabel = 'fair' | 'slightly_uneven' | 'uneven' | 'unknown';

export type Favours = 'you' | 'them' | 'even';

export type FairnessThresholds = {
  // Gap as a % of the bigger side, at or under which a trade is fair.
  fairPct: number;
  // At or under this it is slightly uneven; above it, uneven.
  slightlyUnevenPct: number;
  // A gap of this many £ or less is always fair: £1 on a £3 swap is 33%, but
  // nobody should be told a trade of two commons is uneven.
  fairBelowGBP: number;
};

export const DEFAULT_THRESHOLDS: FairnessThresholds = {
  fairPct: 10,
  slightlyUnevenPct: 25,
  fairBelowGBP: 2,
};

export type TradeComparison = {
  getTotal: number;
  giveTotal: number;
  // getTotal - giveTotal: positive means you come out ahead.
  gap: number;
  gapAbs: number;
  // gapAbs as a % of the bigger side, one decimal place. 0 when both are 0.
  gapPct: number;
  favours: Favours;
  label: FairnessLabel;
  // Cards on each side with no price, counted by copies.
  unpriced: { get: number; give: number };
  // Every card on both sides has a price and both sides have something.
  complete: boolean;
};

function copies(item: TradeItem) {
  const quantity = item.quantity ?? 1;
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
}

function pence(value: number) {
  return Math.round(value * 100);
}

function sideTotals(items: TradeItem[]) {
  let totalPence = 0;
  let unpriced = 0;
  let count = 0;

  for (const item of items) {
    const n = copies(item);
    count += n;
    if (item.value === null || !Number.isFinite(item.value) || item.value < 0) {
      unpriced += n;
    } else {
      totalPence += pence(item.value) * n;
    }
  }

  return { totalPence, unpriced, count };
}

export function labelFor(
  gapAbs: number,
  gapPct: number,
  thresholds: FairnessThresholds = DEFAULT_THRESHOLDS
): Exclude<FairnessLabel, 'unknown'> {
  if (gapAbs <= thresholds.fairBelowGBP || gapPct <= thresholds.fairPct) return 'fair';
  if (gapPct <= thresholds.slightlyUnevenPct) return 'slightly_uneven';
  return 'uneven';
}

export function compareTrade(
  sides: { get: TradeItem[]; give: TradeItem[] },
  thresholds: FairnessThresholds = DEFAULT_THRESHOLDS
): TradeComparison {
  const get = sideTotals(sides.get);
  const give = sideTotals(sides.give);

  const gapPence = get.totalPence - give.totalPence;
  const bigger = Math.max(get.totalPence, give.totalPence);
  const gapAbs = Math.abs(gapPence) / 100;
  const gapPct = bigger === 0 ? 0 : Math.round((Math.abs(gapPence) / bigger) * 1000) / 10;

  // A side with nothing on it, or nothing priced, can't be judged: saying
  // "uneven" about a trade where one side is all unknown would be a guess.
  const comparable =
    get.count > 0 && give.count > 0 && get.count > get.unpriced && give.count > give.unpriced;

  return {
    getTotal: get.totalPence / 100,
    giveTotal: give.totalPence / 100,
    gap: gapPence / 100,
    gapAbs,
    gapPct,
    favours: gapPence > 0 ? 'you' : gapPence < 0 ? 'them' : 'even',
    label: comparable ? labelFor(gapAbs, gapPct, thresholds) : 'unknown',
    unpriced: { get: get.unpriced, give: give.unpriced },
    complete: comparable && get.unpriced === 0 && give.unpriced === 0,
  };
}

export const LABEL_TEXT: Record<FairnessLabel, string> = {
  fair: 'Fair',
  slightly_uneven: 'Slightly uneven',
  uneven: 'Uneven',
  unknown: "Can't compare yet",
};

// ── Trade chat: one listed card against money ──────────────────────────
// A chat is about one listing. The other side is the latest live cash offer,
// or for a sale listing with no offer yet, the asking price.

export type ListingForMeter = {
  card_id?: string | null;
  card_name: string;
  listing_type: 'trade' | 'sale' | 'either';
  price: number | null;
};

export function listingTradeSides({
  listing,
  cardValue,
  isSeller,
  latestOffer,
}: {
  listing: ListingForMeter;
  cardValue: number | null;
  isSeller: boolean;
  latestOffer: number | null;
}): { get: TradeItem[]; give: TradeItem[]; money: 'offer' | 'asking' | null } {
  const card: TradeItem = { name: listing.card_name, value: cardValue };
  const asking = listing.listing_type !== 'trade' && listing.price && listing.price > 0 ? listing.price : null;
  const amount = latestOffer && latestOffer > 0 ? latestOffer : asking;
  const money: TradeItem[] = amount ? [{ name: latestOffer ? 'Cash offer' : 'Asking price', value: amount }] : [];

  return {
    get: isSeller ? money : [card],
    give: isSeller ? [card] : money,
    money: latestOffer && latestOffer > 0 ? 'offer' : asking ? 'asking' : null,
  };
}

type OfferMessage = {
  message_type: string;
  offer_amount: number | null;
  offer_status: string | null;
  created_at: string;
};

// The newest offer still on the table (pending or accepted).
export function latestOfferAmount(messages: OfferMessage[]): number | null {
  let latest: OfferMessage | null = null;
  for (const message of messages) {
    if (message.message_type !== 'offer' || !message.offer_amount) continue;
    if (message.offer_status !== 'pending' && message.offer_status !== 'accepted') continue;
    if (!latest || message.created_at >= latest.created_at) latest = message;
  }
  return latest ? Number(latest.offer_amount) : null;
}
