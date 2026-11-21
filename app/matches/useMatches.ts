'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DEMO_ALLOWANCE, DEMO_LIMIT_MESSAGE, demoMatches, demoMode } from '../../lib/demo';
import { existingChatId, groupMatches, isNotMigrated, tradeAnchor, type MatchRow, type TraderMatch } from '../../lib/matching';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';

export type LoadState = 'loading' | 'ready' | 'not-migrated' | 'error';

export type Allowance = { daily_limit: number; used: number };

// Matches for the signed-in user, the daily allowance, and "Start trade".
export function useMatches(shopId = '') {
  const router = useRouter();
  const { user, authLoading } = useAuth();
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [allowance, setAllowance] = useState<Allowance | null>(demoMode ? DEMO_ALLOWANCE : null);
  const [startingId, setStartingId] = useState('');
  const [startError, setStartError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      if (demoMode) {
        setRows(demoMatches(shopId));
        setState('ready');
        return;
      }
      if (!user || !supabase) {
        return;
      }

      const [matches, limits] = await Promise.all([
        supabase.rpc('get_trade_matches', { p_shop_id: shopId || null }),
        supabase.rpc('get_match_allowance'),
      ]);
      if (!active) {
        return;
      }
      const limitRow = (limits.data as Allowance[] | null)?.[0];
      setAllowance(limits.error || !limitRow ? null : limitRow);
      if (matches.error) {
        setRows([]);
        setState(isNotMigrated(matches.error) ? 'not-migrated' : 'error');
        return;
      }
      setRows((matches.data ?? []) as MatchRow[]);
      setState('ready');
    }

    load();
    return () => {
      active = false;
    };
  }, [shopId, user]);

  const matches = useMemo(() => groupMatches(rows), [rows]);

  async function startTrade(match: TraderMatch) {
    const anchor = tradeAnchor(match);
    if (!anchor || !match.acceptsRequests) {
      return;
    }
    setStartError('');

    if (demoMode) {
      setStartError(DEMO_LIMIT_MESSAGE);
      return;
    }
    if (!supabase) {
      return;
    }

    setStartingId(match.traderId);
    const { data, error } = await supabase.rpc('start_match_conversation', { p_item_id: anchor.item_id });
    setStartingId('');

    const existing = existingChatId(error);
    if (existing) {
      router.push(`/inbox/${existing}`);
      return;
    }
    if (error) {
      setStartError(error.message);
      return;
    }
    setAllowance((current) => (current ? { ...current, used: current.used + 1 } : current));
    router.push(`/inbox/${data}`);
  }

  return {
    user,
    authLoading,
    signedOut: !demoMode && !authLoading && !user,
    matches,
    state,
    allowance,
    startingId,
    startError,
    startTrade,
  };
}
