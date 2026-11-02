'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { demoMode } from '../../../lib/demo';
import { loadShops, shopPlace, type Shop } from '../../../lib/shops';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { DemoBanner } from '../../components/DemoBanner';
import { EmptyState } from '../../components/EmptyState';

export default function ShopPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null | undefined>(undefined);
  const [isHome, setIsHome] = useState(false);
  const [traders, setTraders] = useState(demoMode ? 12 : 0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    loadShops()
      .then((shops) => setShop(shops.find((entry) => entry.slug === slug) ?? null))
      .catch(() => setShop(null));
  }, [slug]);

  useEffect(() => {
    async function loadHome() {
      if (!shop || demoMode || !supabase) {
        return;
      }

      const { count } = await supabase
        .from('user_shops')
        .select('user_id', { count: 'exact', head: true })
        .eq('shop_id', shop.id);
      setTraders(count ?? 0);

      if (user) {
        const { data } = await supabase
          .from('user_shops')
          .select('shop_id')
          .eq('shop_id', shop.id)
          .eq('user_id', user.id)
          .maybeSingle();
        setIsHome(Boolean(data));
      }
    }

    loadHome();
  }, [shop, user]);

  async function toggleHome() {
    if (!shop || !user || !supabase) {
      return;
    }

    setSaving(true);
    setSaveError('');
    const { error } = isHome
      ? await supabase.from('user_shops').delete().eq('shop_id', shop.id).eq('user_id', user.id)
      : await supabase.from('user_shops').insert({ shop_id: shop.id, user_id: user.id });
    setSaving(false);

    if (error) {
      setSaveError(error.message);
      return;
    }
    setIsHome(!isHome);
    setTraders((current) => current + (isHome ? -1 : 1));
  }

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
        <DemoBanner />

        <Link href="/shops" className="text-sm text-stone-400 hover:text-white">
          All shops
        </Link>

        {shop === undefined ? (
          <div className="panel h-48 animate-pulse" />
        ) : shop === null ? (
          <EmptyState
            title="Shop not found"
            body="It may have left the list."
            action={{ label: 'See all shops', href: '/shops' }}
          />
        ) : (
          <>
            <header className="space-y-2">
              <h1 className="text-3xl font-bold text-white sm:text-4xl">{shop.name}</h1>
              <p className="text-sm text-stone-400">{shopPlace(shop)}</p>
              {shop.description ? <p className="leading-7 text-stone-200">{shop.description}</p> : null}
            </header>

            <dl className="panel divide-y divide-white/10 text-sm">
              {[
                ['Address', shop.address],
                ['Opening hours', shop.opening_hours],
                ['Traders here', traders === 1 ? '1 trader' : `${traders} traders`],
              ].map(([label, value]) =>
                value ? (
                  <div key={label} className="flex justify-between gap-6 p-4">
                    <dt className="shrink-0 text-stone-400">{label}</dt>
                    <dd className="text-right text-stone-100">{value}</dd>
                  </div>
                ) : null
              )}
            </dl>

            {user || demoMode ? (
              <button
                type="button"
                onClick={toggleHome}
                disabled={saving || demoMode}
                className="min-h-11 rounded-xl bg-primary-400 px-4 py-3 text-sm font-semibold text-primary-950 hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? 'Saving...' : isHome ? 'Stop trading here' : 'I trade here'}
              </button>
            ) : (
              <p className="text-sm text-stone-400">Sign in to add this as your shop.</p>
            )}

            {saveError ? (
              <p role="alert" className="text-sm text-rose-200">
                {saveError}
              </p>
            ) : null}

            {shop.website ? (
              <a href={shop.website} rel="noreferrer" target="_blank" className="text-sm text-primary-300 hover:underline">
                Visit their website
              </a>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
