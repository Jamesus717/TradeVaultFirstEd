'use client';

import { useCardPrices } from '../../lib/cardPrices';
import { listingTradeSides, type Deal, type ListingForMeter, type PricedCardOffer } from '../../lib/fairTrade';
import { FairTradeMeter } from './FairTradeMeter';

// The meter in the trade chat sidebar: the listed card against the offer on
// the table. That is the newest card offer or live cash offer, or the asking
// price when nobody has offered yet.
export function ListingFairTrade({
  listing,
  isSeller,
  sellerId,
  latestOffer = null,
  deal,
}: {
  listing: ListingForMeter;
  isSeller: boolean;
  // Needed to tell whose cards a card offer holds.
  sellerId?: string | null;
  latestOffer?: number | null;
  // When passed, wins over latestOffer.
  deal?: Deal | null;
}) {
  const offeredCards = deal?.kind === 'cards' ? deal.offer.cards : [];
  const { prices, loading } = useCardPrices([
    ...(listing.card_id ? [listing.card_id] : []),
    ...offeredCards.map((card) => card.id),
  ]);

  const cardOffer: PricedCardOffer | null =
    deal?.kind === 'cards'
      ? {
          items: deal.offer.cards.map((card) => ({
            name: card.name,
            value: prices[card.id] ?? null,
            variant: card.variant,
          })),
          cash: deal.offer.cash,
          fromSeller: Boolean(sellerId) && deal.senderId === sellerId,
        }
      : null;

  const cash = deal === undefined ? latestOffer : deal?.kind === 'cash' ? deal.amount : null;

  const sides = listingTradeSides({
    listing,
    cardValue: listing.card_id ? prices[listing.card_id] ?? null : null,
    isSeller,
    latestOffer: cash,
    cardOffer,
  });

  const moneyLabel =
    sides.money === 'asking'
      ? 'Asking price'
      : sides.money === 'offer'
        ? isSeller
          ? 'You get (offer)'
          : 'You pay (offer)'
        : sides.money === 'cards'
          ? isSeller
            ? 'You get (cards)'
            : 'You give (cards)'
          : 'No offer yet';

  const sellerAddsCards = cardOffer?.fromSeller ?? false;

  return (
    <FairTradeMeter
      get={sides.get}
      give={sides.give}
      getLabel={isSeller ? moneyLabel : sellerAddsCards ? 'You get the cards' : 'You get the card'}
      giveLabel={isSeller ? (sellerAddsCards ? 'You give the cards' : 'You give the card') : moneyLabel}
      loading={loading}
      emptyHint={sellerAddsCards ? 'Offer cards or cash back to compare.' : 'Make an offer to see how fair it is.'}
    />
  );
}
