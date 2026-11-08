'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { isFeatured, loadShops, shopPlace, sortShops, type Shop } from '../../lib/shops';
import { DemoBanner } from '../components/DemoBanner';
import { EmptyState } from '../components/EmptyState';

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [now] = useState(() => Date.now());

  useEffect(() => {
    loadShops()
      .then(setShops)
      .catch(() => setFailed(true));
  }, []);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matching = (shops ?? []).filter((shop) =>
      [shop.name, shop.town].some((value) => value?.toLowerCase().includes(needle))
    );
    return sortShops(matching, now);
  }, [now, search, shops]);

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
        <DemoBanner />

        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Trade at a local shop</h1>
          <p className="max-w-xl text-sm leading-6 text-stone-300 sm:text-base">
            Meet in a real shop with staff around, so you can check each card in person before you swap.
          </p>
        </header>

        {failed ? (
          <EmptyState
            title="Shops didn't load"
            body="Check your connection, then reload the page."
            action={{ label: 'Reload', onClick: () => window.location.reload() }}
          />
        ) : shops === null ? (
          <div className="panel h-40 animate-pulse" />
        ) : shops.length === 0 ? (
          <EmptyState title="No shops listed yet" body="Registered shops will appear here as they join." />
        ) : (
          <>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or town"
              aria-label="Search shops"
              className="w-full rounded-xl border border-white/10 bg-stone-900 px-4 py-3 text-base text-white outline-none focus:border-primary-300/50 sm:text-sm"
            />

            {visible.length === 0 ? (
              <EmptyState compact title="No shops match that search" body="Try a nearby town." />
            ) : (
              <ul className="space-y-3">
                {visible.map((shop) => (
                  <li key={shop.id}>
                    <Link
                      href={`/shops/${shop.slug}`}
                      className="panel block p-4 transition-colors hover:border-white/20 sm:p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">{shop.name}</h2>
                        {isFeatured(shop, now) ? (
                          <span className="rounded-full border border-primary-300/30 px-2 py-0.5 text-xs text-primary-200">
                            Featured
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-stone-400">{shopPlace(shop)}</p>
                      {shop.description ? (
                        <p className="mt-2 text-sm leading-6 text-stone-300">{shop.description}</p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
