'use client';

import { useCardPrices } from '../../lib/cardPrices';
import type { TraderMatch } from '../../lib/matching';
import { FairTradeMeter } from './FairTradeMeter';

// The meter for a match card: everything they have that you want against
// everything you have that they want.
export function MatchFairTrade({ match }: { match: TraderMatch }) {
  const { prices, loading } = useCardPrices([...match.theyHave, ...match.iHave].map((row) => row.card_id));
  const toItem = (row: TraderMatch['theyHave'][number]) => ({
    name: row.card_name ?? row.card_id,
    value: prices[row.card_id] ?? null,
    variant: row.variant,
  });

  return (
    <FairTradeMeter
      get={match.theyHave.map(toItem)}
      give={match.iHave.map(toItem)}
      loading={loading}
      emptyHint={match.iHave.length === 0 ? 'They want nothing of yours yet, so there is nothing to compare.' : undefined}
    />
  );
}
