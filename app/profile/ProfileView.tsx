'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';
import { buildVariants } from '../binder/utils';

type PokemonSet = {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
};

type SetApiResponse = {
  data?: PokemonSet[];
};

type SetDetailResponse = {
  data?: {
    id: string;
    totalCount?: number;
  };
};

type UserCardRow = {
  card_id: string;
  set_id: string | null;
  variant: string;
  owned: boolean;
};

type PublicProfileRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  profile_slug: string;
  bio: string | null;
  created_at: string;
};

const LEGACY_SET_ID = 'sv3pt5';
const LEGACY_SET_NAME = 'Scarlet & Violet 151';

function buildSetMap(sets: PokemonSet[]) {
  return sets.reduce<Record<string, PokemonSet>>((accumulator, set) => {
    accumulator[set.id] = set;
    return accumulator;
  }, {});
}

function formatMemberSince(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
}

function getEmailPrefix(email: string) {
  return email.split('@')[0] ?? email;
}

type Props = {
  userId: string;
};

export default function ProfileView({ userId }: Props) {
  const { user: viewer } = useAuth();
  const supabaseDisabled = !supabase;
  const [rows, setRows] = useState<UserCardRow[]>([]);
  const [setMap, setSetMap] = useState<Record<string, PokemonSet>>({});
  const [setTotals, setSetTotals] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<PublicProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [totalsLoading, setTotalsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isOwnProfile = Boolean(viewer && viewer.id === userId);

  useEffect(() => {
    async function loadPublicProfile() {
      if (!userId) {
        return;
      }

      if (supabaseDisabled || !supabase) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      const { data } = await supabase
        .from('public_profiles')
        .select('user_id, username, display_name, profile_slug, bio, created_at')
        .eq('user_id', userId)
        .maybeSingle();

      setProfile((data ?? null) as PublicProfileRow | null);
      setProfileLoading(false);
    }

    loadPublicProfile();
  }, [supabaseDisabled, userId]);

  useEffect(() => {
    async function loadProfile() {
      if (!userId) {
        return;
      }

      try {
        setLoading(true);
        setTotalsLoading(true);
        setError('');

        const [setsResponse, cardsResponse] = await Promise.all([
          fetch('/api/pokemon/sets'),
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
          setSetTotals({});
          return;
        }

        const result = cardsResponse;

        if (!result) {
          setRows([]);
          setSetTotals({});
          return;
        }

        if (result.error) {
          throw new Error(result.error.message);
        }

        const nextRows = (result.data ?? []) as UserCardRow[];
        setRows(nextRows);

        const nextSetIds = Array.from(new Set(nextRows.map((row) => row.set_id ?? LEGACY_SET_ID)));

        if (nextSetIds.length === 0) {
          setSetTotals({});
          return;
        }

        const totalsResults = await Promise.all(
          nextSetIds.map(async (setId) => {
            try {
              const response = await fetch(`/api/pokemon/cards?setId=${encodeURIComponent(setId)}&pageSize=250`);

              if (!response.ok) {
                return [setId, null] as const;
              }

              const json = await response.json();
              const cards = json.data ?? [];
              const variants = buildVariants(cards);
              return [setId, variants.length] as const;
            } catch {
              return [setId, null] as const;
            }
          })
        );

        setSetTotals(
          totalsResults.reduce<Record<string, number>>((accumulator, [setId, totalCount]) => {
            if (typeof totalCount === 'number') {
              accumulator[setId] = totalCount;
            }

            return accumulator;
          }, {})
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Something went wrong loading this profile.');
      } finally {
        setLoading(false);
        setTotalsLoading(false);
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
      const setName =
        setInfo?.name ?? (effectiveSetId === LEGACY_SET_ID ? LEGACY_SET_NAME : effectiveSetId);
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
  const normalOwned = rows.filter((row) => row.variant === 'Normal').length;
  const reverseOwned = rows.filter((row) => row.variant === 'Reverse Holo').length;
  const totalVariantsOwned = totalOwned;
  const setsTracked = groupedRows.length;
  const completeSets = groupedRows.filter((group) => {
    const totalVariants = setTotals[group.setId];

    if (!totalVariants) {
      return false;
    }

    return group.total >= totalVariants;
  }).length;

  const publicName = profile?.display_name || profile?.username || 'Collector';
  const displayName = isOwnProfile && viewer?.email ? getEmailPrefix(viewer.email) : publicName;
  const avatarInitial = (isOwnProfile && viewer?.email ? viewer.email[0] : publicName[0] ?? '?').toUpperCase();
  const memberSince =
    (isOwnProfile && viewer?.created_at ? formatMemberSince(viewer.created_at) : null) ??
    (profile?.created_at ? formatMemberSince(profile.created_at) : null);

  const variantTotal = normalOwned + reverseOwned;
  const normalPercent = variantTotal === 0 ? 0 : (normalOwned / variantTotal) * 100;
  const reversePercent = variantTotal === 0 ? 0 : (reverseOwned / variantTotal) * 100;

  const shareHref = profile?.profile_slug ? `/u/${profile.profile_slug}` : null;

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-[radial-gradient(circle_at_top_right,var(--hero-gradient-color),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.96),rgba(10,10,10,0.96))] p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary-400/40 bg-primary-400/20 text-3xl font-semibold text-primary-300">
                  {avatarInitial}
                </div>
                <div className="space-y-2">
                  <div>
                    <h1 className="text-2xl font-semibold text-white">{displayName}</h1>
                    {memberSince ? (
                      <p className="mt-1 text-sm text-stone-400">Member since {memberSince}</p>
                    ) : null}
                    {shareHref && !profileLoading ? (
                      <p className="mt-1 text-sm text-stone-500">
                        Public profile:{' '}
                        <Link href={shareHref} className="text-stone-300 hover:text-white">
                          {shareHref}
                        </Link>
                      </p>
                    ) : null}
                    {isOwnProfile ? (
                      <p className="mt-2 text-xs text-stone-500">This is your public profile</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm shadow-lg shadow-primary-950/50">
                      <span className="text-stone-400">Total Variants Owned:</span>{' '}
                      <span className="font-semibold text-white">{totalVariantsOwned}</span>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm">
                      <span className="text-stone-400">Sets Tracked:</span>{' '}
                      <span className="font-semibold text-white">{setsTracked}</span>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm">
                      <span className="text-stone-400">Complete Sets:</span>{' '}
                      <span className="font-semibold text-white">{completeSets}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-300/80">
                Variant Breakdown
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-300">
                <span>
                  Normal <span className="font-semibold text-white">{normalOwned}</span>
                </span>
                <span className="text-stone-600">·</span>
                <span>
                  Reverse Holo <span className="font-semibold text-white">{reverseOwned}</span>
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="flex h-full w-full">
                  <div
                    className="h-full bg-primary-400 transition-all duration-300"
                    style={{ width: `${normalPercent}%` }}
                  />
                  <div
                    className="h-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${reversePercent}%` }}
                  />
                </div>
              </div>
            </section>

            {totalsLoading ? (
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="h-36 animate-pulse rounded-[1.5rem] border border-white/10 bg-white/[0.04]"
                  />
                ))}
              </section>
            ) : groupedRows.length === 0 ? (
              <section className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4">
                <div className="w-full rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center backdrop-blur">
                  <div className="mb-6 text-5xl">📭</div>
                  <h2 className="text-2xl font-semibold text-white">No cards tracked yet</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-400">
                    Head back to the Binder to start marking variants as owned.
                  </p>
                  <Link
                    href="/"
                    className="mt-6 inline-block rounded-xl bg-primary-400 px-5 py-2.5 text-sm font-medium text-primary-950 hover:bg-primary-300"
                  >
                    Go to Binder
                  </Link>
                </div>
              </section>
            ) : (
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupedRows.map((group) => {
                  const totalVariants = setTotals[group.setId];
                  const completionRatio =
                    totalVariants && totalVariants > 0 ? group.total / totalVariants : null;
                  const completionPercent = completionRatio
                    ? Math.min(100, Math.max(0, Math.round(completionRatio * 100)))
                    : 0;

                  return (
                    <article
                      key={group.setId}
                      className={`relative rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 transition-all hover:bg-white/[0.05] ${
                        completionRatio && completionRatio > 0.5 ? 'border-l-2 border-l-primary-400/40' : ''
                      }`}
                    >
                      {completionPercent === 100 ? (
                        <div className="absolute right-4 top-4 rounded-full border border-primary-300/20 bg-primary-400/10 px-3 py-1 text-xs font-medium text-primary-200">
                          ✦ Complete
                        </div>
                      ) : null}

                      <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-400">
                        {group.series}
                      </p>
                      <h2 className="mt-1 text-base font-semibold text-white">{group.setName}</h2>

                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-primary-400 transition-all duration-300"
                          style={{ width: `${completionPercent}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-stone-400">
                        {group.total} / {totalVariants ?? '--'} variants
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-stone-200">
                          Normal: {group.variants.Normal ?? 0}
                        </div>
                        <div className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
                          Reverse Holo: {group.variants['Reverse Holo'] ?? 0}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
