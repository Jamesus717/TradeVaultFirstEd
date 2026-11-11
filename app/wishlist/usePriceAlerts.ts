'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { supabase } from '../../lib/supabaseClient';
import { DEMO_WISHLIST, demoEmpty, demoMode, demoPrices } from '../../lib/demo';
import { findUnderTarget, type PriceAlert, type WishlistTarget } from '../../lib/priceAlerts';
import { fetchCachedPrices } from '../../lib/priceAlertsData';

// Alerts for the signed-in user, for the home page. The wishlist page works
// them out from the rows it already has.
export function usePriceAlerts(): PriceAlert[] {
  const { user, authLoading } = useAuth();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  useEffect(() => {
    if (demoMode) {
      const now = Date.now();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlerts(findUnderTarget(demoEmpty ? [] : DEMO_WISHLIST, demoPrices(now), { nowMs: now }));
      return;
    }
    if (authLoading || !user || !supabase) return;
    const client = supabase;
    let cancelled = false;
    (async () => {
      const { data, error } = await client
        .from('wishlist_cards')
        .select('id, card_id, card_name, set_name, card_number, image_url, target_price')
        .eq('user_id', user.id)
        .not('target_price', 'is', null);
      // Before the 023 proposal is applied this errors; no alerts, no fuss.
      if (error || !data || data.length === 0 || cancelled) return;
      const rows = data as WishlistTarget[];
      const prices = await fetchCachedPrices(client, rows.map((row) => row.card_id));
      if (!cancelled) setAlerts(findUnderTarget(rows, prices, { nowMs: Date.now() }));
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  return alerts;
}
