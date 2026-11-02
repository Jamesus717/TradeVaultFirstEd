'use client';

import { useEffect, useState } from 'react';
import { demoMode } from '../../../lib/demo';
import { loadShops, type Shop } from '../../../lib/shops';
import { supabase } from '../../../lib/supabaseClient';

// Listing id to shop id. Separate from LISTING_COLUMNS so the board still loads
// on a database without migration 021; the filter just stays hidden.
export function useShopFilter() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopByListing, setShopByListing] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const loaded = await loadShops().catch(() => []);
      setShops(loaded);

      if (demoMode || !supabase || loaded.length === 0) {
        return;
      }

      const { data } = await supabase
        .from('trade_listings')
        .select('id, shop_id')
        .eq('is_active', true)
        .not('shop_id', 'is', null);

      const rows = (data ?? []) as { id: string; shop_id: string }[];
      setShopByListing(Object.fromEntries(rows.map((row) => [row.id, row.shop_id])));
    }

    load();
  }, []);

  return { shops, shopByListing };
}
