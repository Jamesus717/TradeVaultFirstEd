'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

type PokemonSet = {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
};

type SetApiResponse = {
  data?: PokemonSet[];
};

type PokemonCard = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set?: {
    id: string;
    name: string;
    series: string;
  };
  images?: {
    small?: string;
  };
};

type CardApiResponse = {
  data?: PokemonCard[];
};

type CardVariantType = 'Normal' | 'Reverse Holo';

type CardVariant = {
  id: string;
  baseCardId: string;
  setId: string;
  setName: string;
  name: string;
  number: string;
  image: string;
  variant: CardVariantType;
};

type UserCardRow = {
  card_id: string;
  set_id: string | null;
  variant: CardVariantType;
  owned: boolean;
};

const SETS_API_URL = 'https://api.pokemontcg.io/v2/sets';
const CARDS_API_BASE_URL = 'https://api.pokemontcg.io/v2/cards';
const LEGACY_SET_ID = 'sv3pt5';
const reverseHoloRarities = new Set(['Common', 'Uncommon', 'Rare']);

const preferredSets = [
  { id: 'sv1' },
  { id: 'sv3' },
  { id: 'sv6' },
  { id: 'sv7' },
  { id: 'swsh12' },
  { id: 'sm115' },
  { name: 'Mega Evolution' },
  { name: 'Phantasmal Flames' },
  { name: 'Ascended Heroes' },
  { name: 'Perfect Order' },
  { id: LEGACY_SET_ID },
] as const;

function getPokemonHeaders() {
  return {
    'X-Api-Key': process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY ?? '',
  };
}

function compareCardNumbers(a: string, b: string) {
  const matchA = a.match(/^(\d+)(.*)$/);
  const matchB = b.match(/^(\d+)(.*)$/);

  const numberA = matchA ? Number(matchA[1]) : Number.MAX_SAFE_INTEGER;
  const numberB = matchB ? Number(matchB[1]) : Number.MAX_SAFE_INTEGER;

  if (numberA !== numberB) {
    return numberA - numberB;
  }

  const suffixA = matchA?.[2] ?? a;
  const suffixB = matchB?.[2] ?? b;

  return suffixA.localeCompare(suffixB);
}

function buildVariants(cards: PokemonCard[]): CardVariant[] {
  return cards
    .slice()
    .sort((left, right) => compareCardNumbers(left.number, right.number))
    .flatMap((card) => {
      const variants: CardVariantType[] = ['Normal'];

      if (card.rarity && reverseHoloRarities.has(card.rarity)) {
        variants.push('Reverse Holo');
      }

      return variants.map((variant) => ({
        id: `${card.id}-${variant === 'Normal' ? 'normal' : 'reverse'}`,
        baseCardId: card.id,
        setId: card.set?.id ?? '',
        setName: card.set?.name ?? '',
        name: card.name,
        number: card.number,
        image: card.images?.small ?? '',
        variant,
      }));
    });
}

function variantSuffix(variant: CardVariantType) {
  return variant === 'Reverse Holo' ? 'reverse' : 'normal';
}

function buildSetList(allSets: PokemonSet[]) {
  const seen = new Set<string>();
  const byId = new Map(allSets.map((set) => [set.id, set]));
  const byName = new Map(allSets.map((set) => [set.name, set]));

  const preferred = preferredSets
    .map((entry) => ('id' in entry ? byId.get(entry.id) : byName.get(entry.name)))
    .filter((set): set is PokemonSet => Boolean(set))
    .filter((set) => {
      if (seen.has(set.id)) {
        return false;
      }

      seen.add(set.id);
      return true;
    });

  const newest = allSets
    .slice()
    .sort(
      (left, right) =>
        new Date(right.releaseDate).getTime() - new Date(left.releaseDate).getTime()
    )
    .filter((set) => {
      if (seen.has(set.id)) {
        return false;
      }

      seen.add(set.id);
      return true;
    });

  return [...preferred, ...newest];
}

function groupSetsBySeries(sets: PokemonSet[]) {
  return sets.reduce<Record<string, PokemonSet[]>>((accumulator, set) => {
    const key = set.series || 'Other';

    if (!accumulator[key]) {
      accumulator[key] = [];
    }

    accumulator[key].push(set);
    return accumulator;
  }, {});
}

export default function Page() {
  const supabaseDisabled = !supabase;
  const [sets, setSets] = useState<PokemonSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [cards, setCards] = useState<CardVariant[]>([]);
  const [owned, setOwned] = useState<Record<string, boolean>>({});
  const [user, setUser] = useState<User | null>(null);
  const [loadingSets, setLoadingSets] = useState(true);
  const [loadingCards, setLoadingCards] = useState(true);
  const [authLoading, setAuthLoading] = useState(!supabaseDisabled);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const selectedSet = useMemo(
    () => sets.find((set) => set.id === selectedSetId) ?? null,
    [selectedSetId, sets]
  );
  const groupedSets = useMemo(() => groupSetsBySeries(sets), [sets]);
  const missingCards = useMemo(
    () => cards.filter((card) => !owned[card.id]),
    [cards, owned]
  );

  useEffect(() => {
    async function loadSets() {
      try {
        setLoadingSets(true);
        setError('');

        const response = await fetch(SETS_API_URL, {
          headers: getPokemonHeaders(),
        });

        if (!response.ok) {
          throw new Error('Failed to load sets from the Pokemon TCG API.');
        }

        const json = (await response.json()) as SetApiResponse;
        const nextSets = buildSetList(json.data ?? []);

        setSets(nextSets);
        setSelectedSetId((current) => current || nextSets[0]?.id || '');
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Something went wrong loading sets.'
        );
      } finally {
        setLoadingSets(false);
      }
    }

    loadSets();
  }, []);

  useEffect(() => {
    if (!selectedSetId) {
      return;
    }

    async function loadCards() {
      try {
        setLoadingCards(true);
        setError('');

        const response = await fetch(
          `${CARDS_API_BASE_URL}?q=set.id:${selectedSetId}&pageSize=250`,
          {
            headers: getPokemonHeaders(),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to load cards from the Pokemon TCG API.');
        }

        const json = (await response.json()) as CardApiResponse;
        setCards(buildVariants(json.data ?? []));
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Something went wrong loading cards.'
        );
      } finally {
        setLoadingCards(false);
      }
    }

    loadCards();
  }, [selectedSetId]);

  useEffect(() => {
    if (supabaseDisabled || !supabase) {
      return;
    }

    const client = supabase;

    async function loadUser() {
      const { data, error: userError } = await client.auth.getUser();

      if (userError) {
        setAuthError(userError.message);
      } else {
        setUser(data.user);
      }

      setAuthLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthError('');
      setSavingId(null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabaseDisabled]);

  useEffect(() => {
    async function loadOwnedCards() {
      if (supabaseDisabled || !supabase || !selectedSetId) {
        setOwned({});
        return;
      }

      if (!user) {
        setOwned({});
        return;
      }

      let query = supabase
        .from('user_cards')
        .select('card_id, set_id, variant, owned')
        .eq('user_id', user.id);

      if (selectedSetId === LEGACY_SET_ID) {
        query = query.or(`set_id.eq.${LEGACY_SET_ID},set_id.is.null`);
      } else {
        query = query.eq('set_id', selectedSetId);
      }

      const { data, error: ownedError } = await query;

      if (ownedError) {
        setError(ownedError.message);
        return;
      }

      const nextOwned = (data ?? []).reduce<Record<string, boolean>>((accumulator, row) => {
        const entry = row as UserCardRow;

        if (entry.owned) {
          accumulator[`${entry.card_id}-${variantSuffix(entry.variant)}`] = true;
        }

        return accumulator;
      }, {});

      setOwned(nextOwned);
    }

    loadOwnedCards();
  }, [selectedSetId, supabaseDisabled, user]);

  const total = cards.length;
  const ownedCount = cards.filter((card) => owned[card.id]).length;
  const completion = total === 0 ? 0 : Math.round((ownedCount / total) * 100);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setAuthError('Supabase environment variables are missing.');
      return;
    }

    setAuthError('');

    const credentials = { email, password };
    const { error: requestError } =
      authMode === 'signup'
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

    if (requestError) {
      setAuthError(requestError.message);
      return;
    }

    setEmail('');
    setPassword('');
  }

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setAuthError(signOutError.message);
    }
  }

  async function toggleOwned(card: CardVariant) {
    if (!supabase || !user || !selectedSetId) {
      setAuthError('Log in to track your collection across devices.');
      return;
    }

    const nextOwned = !owned[card.id];
    setSavingId(card.id);
    setError('');

    if (nextOwned) {
      setOwned((current) => ({
        ...current,
        [card.id]: true,
      }));

      const { error: upsertError } = await supabase.from('user_cards').upsert(
        {
          user_id: user.id,
          card_id: card.baseCardId,
          set_id: selectedSetId,
          variant: card.variant,
          owned: true,
        },
        {
          onConflict: 'user_id,card_id,variant,set_id',
        }
      );

      if (upsertError) {
        setOwned((current) => {
          const nextState = { ...current };
          delete nextState[card.id];
          return nextState;
        });
        setError(upsertError.message);
      }
    } else {
      setOwned((current) => {
        const nextState = { ...current };
        delete nextState[card.id];
        return nextState;
      });

      let deleteQuery = supabase
        .from('user_cards')
        .delete()
        .eq('user_id', user.id)
        .eq('card_id', card.baseCardId)
        .eq('variant', card.variant);

      if (selectedSetId === LEGACY_SET_ID) {
        deleteQuery = deleteQuery.or(`set_id.eq.${LEGACY_SET_ID},set_id.is.null`);
      } else {
        deleteQuery = deleteQuery.eq('set_id', selectedSetId);
      }

      const { error: deleteError } = await deleteQuery;

      if (deleteError) {
        setOwned((current) => ({
          ...current,
          [card.id]: true,
        }));
        setError(deleteError.message);
      }
    }

    setSavingId(null);
  }

  const isLoading = loadingSets || (!!selectedSetId && loadingCards);

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.16),transparent_30%),linear-gradient(135deg,rgba(28,25,23,0.96),rgba(10,10,10,0.96))] p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300/80">
                    Pokemon TCG Master Set Tracker
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                    TradeVault
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-stone-300 sm:text-base">
                    Track Normal and Reverse Holo variants across multiple eras and
                    sets, with reverse holo variants generated in code only.
                  </p>
                </div>

                <div className="max-w-xl">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.25em] text-stone-400">
                    Select Set
                  </label>
                  <select
                    value={selectedSetId}
                    onChange={(event) => setSelectedSetId(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-stone-900 px-4 py-3 text-sm text-white outline-none"
                    disabled={loadingSets || sets.length === 0}
                  >
                    {Object.entries(groupedSets).map(([series, seriesSets]) => (
                      <optgroup key={series} label={series}>
                        {seriesSets.map((set) => (
                          <option key={set.id} value={set.id}>
                            {set.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-stone-400">
                    {selectedSet
                      ? `${selectedSet.series} · ${selectedSet.releaseDate}`
                      : 'Choose a set to load cards.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:items-end">
                <div className="min-w-[240px] rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/10 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.28em] text-emerald-100/75">
                    Collection Progress
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {ownedCount} / {total || '--'}
                  </p>
                  <p className="mt-1 text-sm text-emerald-50/75">{completion}% complete</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>

                <div className="w-full max-w-sm rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm">
                  {authLoading ? (
                    <p className="text-stone-300">Checking session...</p>
                  ) : supabaseDisabled ? (
                    <p className="text-stone-300">
                      Add `NEXT_PUBLIC_SUPABASE_URL` and
                      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to enable login.
                    </p>
                  ) : user ? (
                    <div className="space-y-3">
                      <p className="text-stone-200">{user.email}</p>
                      <Link
                        href={`/profile/${user.id}`}
                        className="inline-block rounded-xl bg-stone-800 px-4 py-2 text-stone-100 hover:bg-stone-700"
                      >
                        View Profile
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="rounded-xl bg-stone-800 px-4 py-2 text-stone-100 hover:bg-stone-700"
                      >
                        Logout
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleAuthSubmit} className="space-y-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAuthMode('login')}
                          className={`rounded-xl px-3 py-2 ${
                            authMode === 'login'
                              ? 'bg-emerald-400 text-emerald-950'
                              : 'bg-stone-800 text-stone-200'
                          }`}
                        >
                          Login
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthMode('signup')}
                          className={`rounded-xl px-3 py-2 ${
                            authMode === 'signup'
                              ? 'bg-emerald-400 text-emerald-950'
                              : 'bg-stone-800 text-stone-200'
                          }`}
                        >
                          Sign Up
                        </button>
                      </div>

                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Email"
                        className="w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-white outline-none"
                        required
                      />
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Password"
                        className="w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-white outline-none"
                        required
                      />
                      <button
                        type="submit"
                        className="w-full rounded-xl bg-emerald-400 px-4 py-2 font-medium text-emerald-950 hover:bg-emerald-300"
                      >
                        {authMode === 'signup' ? 'Create account' : 'Login'}
                      </button>
                    </form>
                  )}

                  {authError ? <p className="mt-3 text-rose-200">{authError}</p> : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-stone-300">
            Loading set data...
          </section>
        ) : error ? (
          <section className="rounded-[2rem] border border-rose-400/20 bg-rose-500/10 p-10 text-center text-rose-100">
            {error}
          </section>
        ) : (
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300/80">
                  Set Binder
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {selectedSet?.name ?? 'Selected Set'}
                </h2>
                <p className="mt-1 text-sm text-stone-400">
                  Sorted by card number with generated variants shown in binder order.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {cards.map((card) => {
                  const isOwned = Boolean(owned[card.id]);
                  const isSaving = savingId === card.id;

                  return (
                    <article
                      key={card.id}
                      className={`group overflow-hidden rounded-[1.5rem] border transition-all duration-200 ${
                        isOwned
                          ? 'border-emerald-400/40 bg-emerald-500/10 shadow-lg shadow-emerald-950/30'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="p-3">
                        <div className="overflow-hidden rounded-[1rem] bg-stone-950/80 ring-1 ring-white/5">
                          {card.image ? (
                            <Image
                              src={card.image}
                              alt={`${card.name} ${card.variant}`}
                              width={245}
                              height={342}
                              sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw"
                              className="h-auto w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div className="flex aspect-[5/7] items-center justify-center text-sm text-stone-500">
                              No image
                            </div>
                          )}
                        </div>

                        <div className="mt-3 space-y-1">
                          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-400">
                            #{card.number}
                          </p>
                          <h2 className="line-clamp-2 text-sm font-semibold text-white">
                            {card.name}
                          </h2>
                          <p className="text-xs text-stone-300">{card.variant}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleOwned(card)}
                          disabled={!user || isSaving}
                          className={`mt-3 w-full rounded-[0.9rem] px-3 py-2 text-xs font-medium transition-colors ${
                            isOwned
                              ? 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
                              : 'bg-stone-800 text-stone-100 hover:bg-stone-700'
                          } ${!user || isSaving ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          {isSaving ? 'Saving...' : isOwned ? 'Owned' : 'Mark as Owned'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-[1.5rem] border border-amber-300/15 bg-amber-400/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/75">
                  Missing Cards
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {missingCards.length} still needed in {selectedSet?.name ?? 'this set'}
                </h2>
                <p className="mt-1 text-sm text-stone-400">
                  This want list is automatically derived from the selected set minus your
                  owned variants.
                </p>
              </div>

              {missingCards.length === 0 ? (
                <div className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/10 p-6 text-sm text-emerald-50">
                  Complete set for the currently loaded variants.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {missingCards.map((card) => (
                    <article
                      key={`missing-${card.id}`}
                      className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4"
                    >
                      <p className="text-xs font-medium uppercase tracking-[0.22em] text-stone-400">
                        #{card.number}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-white">{card.name}</h3>
                      <p className="mt-1 text-sm text-stone-300">{card.variant}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
