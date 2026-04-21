'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type PokemonSet = {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
};

type SetApiResponse = {
  data?: PokemonSet[];
};

type UserCardRow = {
  card_id: string;
  set_id: string | null;
  variant: string;
  owned: boolean;
};

type ProfilePageProps = {
  params: Promise<{
    user_id: string;
  }>;
};

const SETS_API_URL = 'https://api.pokemontcg.io/v2/sets';
const LEGACY_SET_ID = 'sv3pt5';
const LEGACY_SET_NAME = 'Scarlet & Violet 151';

function buildSetMap(sets: PokemonSet[]) {
  return sets.reduce<Record<string, PokemonSet>>((accumulator, set) => {
    accumulator[set.id] = set;
    return accumulator;
  }, {});
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const supabaseDisabled = !supabase;
  const [userId, setUserId] = useState('');
  const [rows, setRows] = useState<UserCardRow[]>([]);
  const [setMap, setSetMap] = useState<Record<string, PokemonSet>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params;
      setUserId(resolved.user_id);
    }

    resolveParams();
  }, [params]);

  useEffect(() => {
    async function loadProfile() {
      if (!userId) {
        return;
      }

      try {
        setLoading(true);
        setError('');

        const [setsResponse, cardsResponse] = await Promise.all([
          fetch(SETS_API_URL, {
            headers: {
              'X-Api-Key': process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY ?? '',
            },
          }),
          supabaseDisabled || !supabase
            ? Promise.resolve(null)
            : supabase
                .from('user_cards')
                .select('card_id, set_id, variant, owned')
                .eq('user_id', userId)
                .eq('owned', true),
        ]);

        if (!setsResponse.ok) {
          throw new Error('Failed to load set metadata.');
        }

        const setsJson = (await setsResponse.json()) as SetApiResponse;
        setSetMap(buildSetMap(setsJson.data ?? []));

        if (supabaseDisabled || !supabase) {
          setRows([]);
          return;
        }

        const result = cardsResponse;

        if (!result) {
          setRows([]);
          return;
        }

        if (result.error) {
          throw new Error(result.error.message);
        }

        setRows((result.data ?? []) as UserCardRow[]);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Something went wrong loading this profile.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [supabaseDisabled, userId]);

  const groupedRows = useMemo(() => {
    return rows.reduce<
      Array<{
        setId: string;
        setName: string;
        series: string;
        total: number;
        variants: Record<string, number>;
      }>
    >((accumulator, row) => {
      const effectiveSetId = row.set_id ?? LEGACY_SET_ID;
      const existing = accumulator.find((entry) => entry.setId === effectiveSetId);
      const setInfo = setMap[effectiveSetId];
      const setName = setInfo?.name ?? (effectiveSetId === LEGACY_SET_ID ? LEGACY_SET_NAME : effectiveSetId);
      const series = setInfo?.series ?? 'Unknown Series';

      if (existing) {
        existing.total += 1;
        existing.variants[row.variant] = (existing.variants[row.variant] ?? 0) + 1;
        return accumulator;
      }

      accumulator.push({
        setId: effectiveSetId,
        setName,
        series,
        total: 1,
        variants: {
          [row.variant]: 1,
        },
      });

      return accumulator;
    }, []);
  }, [rows, setMap]);

  const totalOwned = rows.length;

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300/80">
                Collection Profile
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                User Collection Summary
              </h1>
              <p className="text-sm text-stone-300">{userId || 'Loading user...'}</p>
            </div>

            <Link
              href="/"
              className="inline-block rounded-xl bg-stone-800 px-4 py-2 text-sm text-stone-100 hover:bg-stone-700"
            >
              Back to Tracker
            </Link>
          </div>
        </section>

        {loading ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-stone-300">
            Loading profile...
          </section>
        ) : error ? (
          <section className="rounded-[2rem] border border-rose-400/20 bg-rose-500/10 p-10 text-center text-rose-100">
            {error}
          </section>
        ) : (
          <>
            <section className="rounded-[2rem] border border-emerald-300/20 bg-emerald-400/10 p-6">
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-emerald-100/75">
                Total Owned Variants
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">{totalOwned}</p>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {groupedRows.map((group) => (
                <article
                  key={group.setId}
                  className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-stone-400">
                    {group.series}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">{group.setName}</h2>
                  <p className="mt-1 text-sm text-stone-300">Owned variants: {group.total}</p>
                  <p className="mt-2 text-sm text-stone-400">
                    Normal: {group.variants.Normal ?? 0} · Reverse Holo:{' '}
                    {group.variants['Reverse Holo'] ?? 0}
                  </p>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
