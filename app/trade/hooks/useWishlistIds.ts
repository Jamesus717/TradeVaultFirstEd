'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

/*
 * Card ids on the signed-in user's wishlist, so the board can flag listings
 * they are hunting for. Fails quietly to an empty set (signed out, or the
 * wishlist table not migrated yet): matching is a bonus, not core.
 */
export function useWishlistIds(userId: string | null) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase || !userId) {
        setIds(new Set());
        return;
      }
      const { data, error } = await supabase
        .from('wishlist_cards')
        .select('card_id')
        .eq('user_id', userId);
      if (cancelled) return;
      setIds(error || !data ? new Set() : new Set(data.map((row) => row.card_id as string)));
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return ids;
}
