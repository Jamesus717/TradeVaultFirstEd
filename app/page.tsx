'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DEMO_MATCHES, demoMode } from '../lib/demo';
import { groupMatches, isNotMigrated, tradeAnchor, type MatchRow, type TraderMatch } from '../lib/matching';
import { loadShops, sortShops, type Shop } from '../lib/shops';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './auth';
import { DemoBanner } from './components/DemoBanner';
import { EmptyState } from './components/EmptyState';
import { MatchCard } from './components/MatchCard';

type LoadState = 'loading' | 'ready' | 'not-migrated' | 'error';

export default function HomePage() {
  const router = useRouter();
  const { user, authLoading } = useAuth();
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState('');
  const [state, setState] = useState<LoadState>('loading');
  const [startingId, setStartingId] = useState('');
  const [startError, setStartError] = useState('');

  useEffect(() => {
    loadShops()
      .then((loaded) => setShops(sortShops(loaded, Date.now())))
      .catch(() => setShops([]));
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (demoMode) {
        setRows(DEMO_MATCHES);
        setState('ready');
        return;
      }
      if (!user || !supabase) {
        return;
      }

      const { data, error } = await supabase.rpc('get_trade_matches', { p_shop_id: shopId || null });
      if (!active) {
        return;
      }
      if (error) {
        setRows([]);
        setState(isNotMigrated(error) ? 'not-migrated' : 'error');
        return;
      }
      setRows((data ?? []) as MatchRow[]);
      setState('ready');
    }

    load();
    return () => {
      active = false;
    };
  }, [shopId, user]);

  const matches = useMemo(() => groupMatches(rows), [rows]);
  const twoWayCount = matches.filter((match) => match.twoWay).length;

  async function startTrade(match: TraderMatch) {
    const anchor = tradeAnchor(match);
    if (!anchor || demoMode || !supabase) {
      return;
    }

    setStartingId(match.traderId);
    setStartError('');
    const { data, error } = await supabase.rpc('start_match_conversation', { p_item_id: anchor.item_id });
    setStartingId('');

    if (error) {
      setStartError(error.message);
      return;
    }
    router.push(`/inbox/${data}`);
  }

  const signedOut = !demoMode && !authLoading && !user;

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
        <DemoBanner />

        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Who can trade with you</h1>
          <p className="max-w-xl text-sm leading-6 text-stone-300 sm:text-base">
            {matches.length > 0
              ? `${matches.length} ${matches.length === 1 ? 'trader has' : 'traders have'} a card you want or want one you have. ${twoWayCount} of these work both ways.`
              : 'See who has the cards you want, and who wants your spares.'}
          </p>
        </header>

        {shops.length > 0 ? (
          <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {[{ id: '', name: 'All traders' }, ...shops].map((shop) => (
              <button
                key={shop.id}
                type="button"
                aria-pressed={shopId === shop.id}
                onClick={() => setShopId(shop.id)}
                className={`min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  shopId === shop.id
                    ? 'border-primary-300/30 bg-primary-400/15 text-primary-100'
                    : 'border-white/10 text-stone-300 hover:text-white'
                }`}
              >
                {shop.name}
              </button>
            ))}
          </div>
        ) : null}

        {startError ? (
          <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {startError}
          </p>
        ) : null}

        {signedOut ? (
          <EmptyState
            title="Sign in to see your matches"
            body="Add your cards and your wishlist, and we'll find who you can trade with."
            action={{ label: 'Open the binder', href: '/binder' }}
          />
        ) : authLoading || state === 'loading' ? (
          <div className="panel h-64 animate-pulse" />
        ) : state === 'error' ? (
          <EmptyState
            title="Matches didn't load"
            body="Check your connection, then reload the page."
            action={{ label: 'Reload', onClick: () => window.location.reload() }}
          />
        ) : state === 'not-migrated' ? (
          <EmptyState
            title="Matching is on its way"
            body="Keep your binder and wishlist up to date and your matches will be ready when it starts."
            action={{ label: 'Open the binder', href: '/binder' }}
          />
        ) : matches.length === 0 ? (
          <EmptyState
            title="No matches yet"
            body="Add cards to your wishlist and mark spares for trade to find people to swap with."
            action={{ label: 'Add to your wishlist', href: '/wishlist' }}
          />
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <MatchCard
                key={match.traderId}
                match={match}
                starting={startingId === match.traderId}
                onStart={() => startTrade(match)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
