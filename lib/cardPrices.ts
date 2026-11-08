'use client';

// Reads card market prices for the fair-trade meter from the card_prices cache
// (public read, filled by /api/pokemon/price), the same table the collection
// page totals from. Only the base print is stored there, so a reverse holo is
// valued as its base print: good enough for "is this swap roughly even".
// Many meters mount at once (one per match card), so lookups are batched.

import { useEffect, useMemo, useState } from 'react';
import { DEMO_PRICES } from './demoPrices';
import { demoMode } from './demo';
import { createPriceLoader, type PriceMap, type PriceRow } from './priceLoader';
import { supabase } from './supabaseClient';

const loadPrices = createPriceLoader(async (ids) => {
  if (!supabase) return [];
  const { data } = await supabase.from('card_prices').select('card_id, price_mid').in('card_id', ids);
  return (data ?? []) as PriceRow[];
});

export function useCardPrices(cardIds: string[]) {
  const key = useMemo(() => [...new Set(cardIds.filter(Boolean))].sort().join('|'), [cardIds]);
  const [state, setState] = useState<{ key: string; prices: PriceMap } | null>(null);

  useEffect(() => {
    if (demoMode || !key) return;
    let active = true;
    loadPrices(key.split('|')).then((prices) => {
      if (active) setState({ key, prices });
    });
    return () => {
      active = false;
    };
  }, [key]);

  if (demoMode) {
    const ids = key ? key.split('|') : [];
    return { prices: Object.fromEntries(ids.map((id) => [id, DEMO_PRICES[id] ?? null])), loading: false };
  }

  if (!key) return { prices: {}, loading: false };
  return state?.key === key ? { prices: state.prices, loading: false } : { prices: {}, loading: true };
}
