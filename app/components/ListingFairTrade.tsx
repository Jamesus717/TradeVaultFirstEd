'use client';

import { useCardPrices } from '../../lib/cardPrices';
import { listingTradeSides, type ListingForMeter } from '../../lib/fairTrade';
import { FairTradeMeter } from './FairTradeMeter';

// The meter in the trade chat sidebar: the listed card against the latest cash
// offer, or the asking price when nobody has offered yet.
export function ListingFairTrade({
  listing,
  isSeller,
  latestOffer,
}: {
  listing: ListingForMeter;
  isSeller: boolean;
  latestOffer: number | null;
}) {
  const { prices, loading } = useCardPrices(listing.card_id ? [listing.card_id] : []);
  const sides = listingTradeSides({
    listing,
    cardValue: listing.card_id ? prices[listing.card_id] ?? null : null,
    isSeller,
    latestOffer,
  });

  const moneyLabel =
    sides.money === 'asking'
      ? 'Asking price'
      : sides.money === 'offer'
        ? isSeller
          ? 'You get (offer)'
          : 'You pay (offer)'
        : 'No offer yet';

  return (
    <FairTradeMeter
      get={sides.get}
      give={sides.give}
      getLabel={isSeller ? moneyLabel : 'You get the card'}
      giveLabel={isSeller ? 'You give the card' : moneyLabel}
      loading={loading}
      emptyHint="Make an offer to see how fair it is."
    />
  );
}
