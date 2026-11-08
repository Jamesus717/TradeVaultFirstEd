'use client';

import { useEffect, useState } from 'react';
import { loadShops, sortShops, type Shop } from '../../lib/shops';
import { DemoBanner } from '../components/DemoBanner';
import { AllowanceNote, LimitAlert, MatchList } from './MatchList';
import { useMatches } from './useMatches';

export default function MatchesPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState('');
  const result = useMatches(shopId);
  const { matches, allowance, startError } = result;
  const twoWayCount = matches.filter((match) => match.twoWay).length;

  useEffect(() => {
    loadShops()
      .then((loaded) => setShops(sortShops(loaded, Date.now())))
      .catch(() => setShops([]));
  }, []);

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
        <DemoBanner />

        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Who can trade with you</h1>
          <p className="max-w-xl text-sm leading-6 text-stone-300 sm:text-base">
            {matches.length > 0
              ? `${matches.length === 1 ? '1 trader has a card you want or wants' : `${matches.length} traders have a card you want or want`} one you have. ${twoWayCount} of these ${twoWayCount === 1 ? 'works' : 'work'} both ways.`
              : 'See who has the cards you want, and who wants your spares.'}
          </p>
          <AllowanceNote allowance={allowance} />
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

        <LimitAlert message={startError} />
        <MatchList {...result} />
      </div>
    </main>
  );
}
