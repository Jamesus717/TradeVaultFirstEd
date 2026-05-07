'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { UserCardRow } from '../binder/types';
import { LEGACY_SET_ID } from '../binder/utils';
import { useCollectionDashboard } from './useCollectionDashboard';
import { useCustomBinders } from './useCustomBinders';
import { useSetOwnedVariants } from './useSetOwnedVariants';

type SearchCard = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set?: { id: string; name: string; series: string };
  images?: { small?: string };
};

type CollectionTarget =
  | { kind: 'set'; id: string }
  | { kind: 'binder'; id: string };

function encodeTarget(target: CollectionTarget) {
  return `${target.kind}:${target.id}`;
}

function decodeTarget(value: string): CollectionTarget | null {
  const [kind, ...rest] = value.split(':');
  const id = rest.join(':');

  if (!id) {
    return null;
  }

  if (kind === 'set') {
    return { kind: 'set', id };
  }

  if (kind === 'binder') {
    return { kind: 'binder', id };
  }

  return null;
}

function getInitials(value: string) {
  return (value.trim()[0] ?? '?').toUpperCase();
}

export default function MyCollectionPage() {
  const {
    user,
    authLoading,
    rows,
    loading,
    error,
    stats,
    setMap,
    ownedBySet,
    setGroups,
    addOwnedRow,
  } = useCollectionDashboard();

  const {
    canUse,
    loading: bindersLoading,
    cardsLoading: binderCardsLoading,
    saving: bindersSaving,
    error: binderError,
    binders,
    selectedBinderId,
    setSelectedBinderId,
    selectedBinder,
    binderCards,
    binderCardIds,
    createBinder,
    renameBinder,
    deleteBinder,
    addCardToBinder,
    removeCardFromBinder,
  } = useCustomBinders();

  const [selected, setSelected] = useState<CollectionTarget | null>(null);
  const effectiveSelected = useMemo<CollectionTarget | null>(() => {
    if (!user) {
      return null;
    }

    if (selected) {
      if (selected.kind === 'set') {
        return setGroups.some((entry) => entry.setId === selected.id) ? selected : null;
      }

      return binders.some((binder) => binder.id === selected.id) ? selected : null;
    }

    const firstSet = setGroups[0]?.setId;
    if (firstSet) {
      return { kind: 'set', id: firstSet };
    }

    if (selectedBinderId) {
      return { kind: 'binder', id: selectedBinderId };
    }

    const firstBinder = binders[0]?.id;
    if (firstBinder) {
      return { kind: 'binder', id: firstBinder };
    }

    return null;
  }, [binders, selected, selectedBinderId, setGroups, user]);

  const selectedSetId = effectiveSelected?.kind === 'set' ? effectiveSelected.id : null;

  const { loading: setCardsLoading, error: setCardsError, cards: setOwnedCards } =
    useSetOwnedVariants({
      selectedSetId,
      ownedRows: (rows ?? []) as UserCardRow[],
    });

  const [createOpen, setCreateOpen] = useState(false);
  const [newBinderName, setNewBinderName] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchCard[]>([]);
  const [searchError, setSearchError] = useState('');

  const anyError = error || binderError || setCardsError;
  const totalBinders = binders.length;

  useEffect(() => {
    async function search() {
      if (!user) {
        setSearchResults([]);
        setSearching(false);
        setSearchError('');
        return;
      }

      const trimmed = searchQuery.trim();
      if (trimmed.length < 2) {
        setSearchResults([]);
        setSearching(false);
        setSearchError('');
        return;
      }

      setSearching(true);
      setSearchError('');

      try {
        const response = await fetch(
          `/api/pokemon/search/cards?name=${encodeURIComponent(trimmed)}&pageSize=20`
        );

        if (!response.ok) {
          throw new Error('Search failed.');
        }

        const json = (await response.json()) as { data?: SearchCard[] };
        setSearchResults(json.data ?? []);
      } catch {
        setSearchResults([]);
        setSearchError('Search is unavailable right now.');
      } finally {
        setSearching(false);
      }
    }

    const handle = setTimeout(search, 250);
    return () => clearTimeout(handle);
  }, [searchQuery, user]);

  const targets = useMemo(() => {
    const setTargets = setGroups.map((group) => ({
      target: { kind: 'set' as const, id: group.setId },
      label: group.setName,
      meta: 'Set',
    }));

    const binderTargets = binders.map((binder) => ({
      target: { kind: 'binder' as const, id: binder.id },
      label: binder.name,
      meta: 'Binder',
    }));

    return [...setTargets, ...binderTargets];
  }, [binders, setGroups]);

  const selectedLabel = useMemo(() => {
    if (!effectiveSelected) {
      return 'Select...';
    }

    if (effectiveSelected.kind === 'set') {
      return setMap[effectiveSelected.id]?.name ?? 'Set';
    }

    return binders.find((binder) => binder.id === effectiveSelected.id)?.name ?? 'Binder';
  }, [binders, effectiveSelected, setMap]);

  const selectedSetSummary = useMemo(() => {
    if (!effectiveSelected || effectiveSelected.kind !== 'set') {
      return null;
    }

    const setInfo = setMap[effectiveSelected.id];
    const owned = ownedBySet[effectiveSelected.id] ?? 0;
    const total = typeof setInfo?.total === 'number' ? setInfo.total * 2 : null;
    const right = `${owned} / ${total ?? '--'}`;
    return `${right} variants`;
  }, [effectiveSelected, ownedBySet, setMap]);

  const selectedBinderSummary =
    effectiveSelected?.kind === 'binder' ? `${binderCards.length} cards` : null;

  async function handleCreateBinder() {
    const created = await createBinder(newBinderName);

    if (created) {
      setCreateOpen(false);
      setNewBinderName('');
      setSelected({ kind: 'binder', id: created.id });
    }
  }

  async function markOwnedInSet(setId: string, card: SearchCard) {
    if (!user || !supabase) {
      return;
    }

    const payload = {
      user_id: user.id,
      card_id: card.id,
      set_id: setId,
      variant: 'Normal',
      owned: true,
    };

    await supabase.from('user_cards').upsert(payload as never, {
      onConflict: 'user_id,card_id,variant,set_id',
    });
  }

  const ownedNormalInSelectedSet = useMemo(() => {
    if (!effectiveSelected || effectiveSelected.kind !== 'set') {
      return new Set<string>();
    }

    const setId = effectiveSelected.id;

    return new Set(
      (rows ?? []).filter((row) => {
        if (setId === LEGACY_SET_ID) {
          return (row.set_id === LEGACY_SET_ID || row.set_id === null) && row.variant === 'Normal';
        }

        return row.set_id === setId && row.variant === 'Normal';
      }).map((row) => row.card_id)
    );
  }, [effectiveSelected, rows]);

  async function handleAddCard(card: SearchCard) {
    if (!effectiveSelected || !canUse) {
      return;
    }

    if (effectiveSelected.kind === 'binder') {
      if (binderCardIds.has(card.id)) {
        return;
      }

      await addCardToBinder(effectiveSelected.id, {
        card_id: card.id,
        set_id: card.set?.id ?? null,
        card_name: card.name,
        card_number: card.number,
        image_url: card.images?.small ?? null,
      });

      return;
    }

    if (!card.set?.id || card.set.id !== effectiveSelected.id) {
      return;
    }

    if (ownedNormalInSelectedSet.has(card.id)) {
      return;
    }

    await markOwnedInSet(card.set.id, card);
    addOwnedRow({
      card_id: card.id,
      set_id: card.set.id,
      variant: 'Normal',
      owned: true,
    });
  }

  const selectedSetTiles = useMemo(() => {
    return setOwnedCards.map((variant) => ({
      key: variant.id,
      image: variant.image,
      title: variant.name,
      meta: `${variant.setName} - #${variant.number}`,
      variant: variant.variant,
    }));
  }, [setOwnedCards]);

  const selectedBinderTiles = useMemo(() => {
    return binderCards.map((row) => ({
      key: row.id,
      image: row.image_url ?? '',
      title: row.card_name ?? row.card_id,
      meta: `${row.set_id ? setMap[row.set_id]?.name ?? row.set_id : 'Unknown set'} - #${row.card_number ?? '--'}`,
      removeId: row.id,
    }));
  }, [binderCards, setMap]);
  const statsPills = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-stone-300">
        Total Cards{' '}
        <span className="font-semibold text-white">{user ? stats.totalOwnedVariants : 0}</span>
      </div>
      <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-stone-300">
        Sets <span className="font-semibold text-white">{user ? stats.setsTracked : 0}</span>
      </div>
      <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-stone-300">
        Custom Binders <span className="font-semibold text-white">{user ? totalBinders : 0}</span>
      </div>
    </div>
  );

  const visibleSearchResults = useMemo(() => {
    if (!effectiveSelected || effectiveSelected.kind !== 'set') {
      return searchResults;
    }

    return searchResults.filter((card) => card.set?.id === effectiveSelected.id);
  }, [effectiveSelected, searchResults]);

  return (
    <main className="min-h-screen bg-transparent text-stone-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">My Collection</h1>
            <p className="mt-1 text-sm text-stone-400">Track sets, binders, and owned cards.</p>
          </div>
          {statsPills}
        </header>

        {authLoading ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 text-sm text-stone-300 backdrop-blur">
            Checking your session...
          </section>
        ) : !user ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">Login required</h2>
            <p className="mt-2 text-sm text-stone-400">
              Sign in to view your cross-set collection and manage custom binders.
            </p>
          </section>
        ) : anyError ? (
          <section className="rounded-[2rem] border border-rose-400/20 bg-rose-500/10 p-8 text-rose-100 backdrop-blur">
            {anyError}
          </section>
        ) : loading ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-sm text-stone-300 backdrop-blur">
            Loading your collection...
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px,minmax(0,1fr)] lg:items-start">
            <aside className="rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                <h2 className="text-base font-semibold text-white">Sets &amp; Binders</h2>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                  aria-label="Create binder"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 p-6">
                {createOpen ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">
                      New Binder
                    </p>
                    <input
                      value={newBinderName}
                      onChange={(event) => setNewBinderName(event.target.value)}
                      placeholder="Binder name"
                      className="mt-3 w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm text-white outline-none"
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCreateOpen(false);
                          setNewBinderName('');
                        }}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-stone-200 hover:bg-white/[0.06]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateBinder}
                        disabled={!newBinderName.trim() || !canUse || bindersSaving}
                        className="rounded-xl bg-emerald-400 px-3 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">
                    Official Sets
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
                    {setGroups.length === 0 ? (
                      <div className="text-sm text-stone-400">No sets tracked yet.</div>
                    ) : (
                      setGroups.map((group) => {
                        const isSelected =
                          effectiveSelected?.kind === 'set' && effectiveSelected.id === group.setId;
                        const right = `${group.ownedVariants}/${group.totalVariants ?? '--'}`;

                        return (
                          <button
                            key={`set-${group.setId}`}
                            type="button"
                            onClick={() => {
                              setSelected({ kind: 'set', id: group.setId });
                              setSelectedBinderId(null);
                            }}
                            className={`flex min-w-[240px] items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors lg:min-w-0 ${
                              isSelected
                                ? 'border-emerald-300/30 bg-emerald-400/10'
                                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                            }`}
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-sm font-semibold text-stone-200">
                              {getInitials(group.setName)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white">{group.setName}</p>
                              <p className="truncate text-xs text-stone-400">{group.series}</p>
                            </div>
                            <div className="text-xs font-medium text-stone-300">{right}</div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">
                    Custom Binders
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
                    {bindersLoading ? (
                      <div className="text-sm text-stone-400">Loading binders...</div>
                    ) : binders.length === 0 ? (
                      <div className="text-sm text-stone-400">No binders yet.</div>
                    ) : (
                      binders.map((binder) => {
                        const isSelected =
                          effectiveSelected?.kind === 'binder' && effectiveSelected.id === binder.id;

                        return (
                          <button
                            key={`binder-${binder.id}`}
                            type="button"
                            onClick={() => {
                              setSelected({ kind: 'binder', id: binder.id });
                              setSelectedBinderId(binder.id);
                            }}
                            className={`flex min-w-[240px] items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors lg:min-w-0 ${
                              isSelected
                                ? 'border-emerald-300/30 bg-emerald-400/10'
                                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                            }`}
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-sm font-semibold text-stone-200">
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M7 7h10v14H7z" />
                                <path d="M7 7V5h10v2" />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white">{binder.name}</p>
                              <p className="truncate text-xs text-stone-400">Custom binder</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </aside>

            <section className="min-w-0 space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur">
                <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedLabel}</h2>
                  <p className="mt-1 text-sm text-stone-400">
                    {effectiveSelected?.kind === 'set' ? selectedSetSummary : selectedBinderSummary}
                  </p>
                </div>

                {effectiveSelected?.kind === 'binder' && selectedBinder ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = window.prompt('Rename binder', selectedBinder.name);
                        if (next) {
                          renameBinder(selectedBinder.id, next);
                        }
                      }}
                      disabled={bindersSaving}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-stone-200 hover:bg-white/[0.06] disabled:opacity-60"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete this binder?')) {
                          deleteBinder(selectedBinder.id);
                        }
                      }}
                      disabled={bindersSaving}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 hover:bg-rose-500/15 disabled:opacity-60"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                      </svg>
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>

                <div className="space-y-4 p-6">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">
                          Add Cards
                        </p>
                        <p className="mt-1 text-sm text-stone-400">
                          Search by card name, then add to the selected destination.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search card name..."
                        className="w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm text-white outline-none"
                      />

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-stone-400">Add to</label>
                        <select
                          value={effectiveSelected ? encodeTarget(effectiveSelected) : ''}
                          onChange={(event) => {
                            const next = decodeTarget(event.target.value);
                            if (next) {
                              setSelected(next);
                              if (next.kind === 'binder') {
                                setSelectedBinderId(next.id);
                              } else {
                                setSelectedBinderId(null);
                              }
                            }
                          }}
                          className="w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm text-white outline-none"
                        >
                          {targets.map((entry) => (
                            <option key={encodeTarget(entry.target)} value={encodeTarget(entry.target)}>
                              {entry.meta}: {entry.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {searching ? (
                        <div className="space-y-2">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <div
                              key={`s-${index}`}
                              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                            >
                              <div className="h-[76px] w-14 animate-pulse rounded-xl bg-white/[0.06]" />
                              <div className="flex-1 space-y-2">
                                <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.06]" />
                                <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
                              </div>
                              <div className="h-9 w-16 animate-pulse rounded-xl bg-white/[0.06]" />
                            </div>
                          ))}
                        </div>
                      ) : searchError ? (
                        <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                          {searchError}
                        </div>
                      ) : searchQuery.trim().length >= 2 && visibleSearchResults.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-stone-300">
                          No results.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {visibleSearchResults.map((card) => {
                            const image = card.images?.small ?? '';
                            const setName = card.set?.name ?? 'Unknown set';
                            const alreadyAdded =
                              effectiveSelected?.kind === 'binder'
                                ? binderCardIds.has(card.id)
                                : effectiveSelected?.kind === 'set'
                                  ? ownedNormalInSelectedSet.has(card.id)
                                  : false;
                            const disabled = !effectiveSelected || bindersSaving || alreadyAdded;

                            return (
                              <article
                                key={card.id}
                                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                              >
                                <div className="h-[76px] w-14 shrink-0 overflow-hidden rounded-xl bg-stone-950/80 ring-1 ring-white/5">
                                  {image ? (
                                    <Image
                                      src={image}
                                      alt={card.name}
                                      width={112}
                                      height={152}
                                      sizes="56px"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-stone-500">
                                      No image
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-white">{card.name}</p>
                                  <p className="truncate text-xs text-stone-400">
                                    {setName} · #{card.number}
                                    {card.rarity ? ` · ${card.rarity}` : ''}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddCard(card)}
                                  disabled={disabled}
                                  className={`rounded-xl px-3 py-2 text-xs font-medium ${
                                    alreadyAdded
                                      ? 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-stone-400'
                                      : 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
                                  } ${disabled && !alreadyAdded ? 'cursor-not-allowed opacity-60' : ''}`}
                                >
                                  {alreadyAdded ? 'Added' : 'Add'}
                                </button>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                {effectiveSelected?.kind === 'set' ? (
                  setCardsLoading ? (
                    <div className="text-sm text-stone-300">Loading owned cards...</div>
                  ) : selectedSetTiles.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-stone-300">
                      No owned cards found in this set yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {selectedSetTiles.map((tile) => (
                        <article key={tile.key} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-3">
                          <div className="overflow-hidden rounded-[1rem] bg-stone-950/80 ring-1 ring-white/5">
                            {tile.image ? (
                              <Image
                                src={tile.image}
                                alt={tile.title}
                                width={245}
                                height={342}
                                sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 640px) 28vw, 46vw"
                                className="h-auto w-full object-cover"
                              />
                            ) : (
                              <div className="flex aspect-[5/7] items-center justify-center text-sm text-stone-500">
                                No image
                              </div>
                            )}
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm font-medium text-white">
                            {tile.title}
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs text-stone-400">{tile.meta}</p>
                          <p className="mt-1 text-xs text-stone-400">{tile.variant}</p>
                        </article>
                      ))}
                    </div>
                  )
                ) : effectiveSelected?.kind === 'binder' ? (
                  binderCardsLoading ? (
                    <div className="text-sm text-stone-300">Loading binder cards...</div>
                  ) : selectedBinderTiles.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-stone-300">
                      No cards added yet. Use the search panel to add cards.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {selectedBinderTiles.map((tile) => (
                        <article key={tile.key} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-3">
                          <div className="overflow-hidden rounded-[1rem] bg-stone-950/80 ring-1 ring-white/5">
                            {tile.image ? (
                              <Image
                                src={tile.image}
                                alt={tile.title}
                                width={245}
                                height={342}
                                sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 640px) 28vw, 46vw"
                                className="h-auto w-full object-cover"
                              />
                            ) : (
                              <div className="flex aspect-[5/7] items-center justify-center text-sm text-stone-500">
                                No image
                              </div>
                            )}
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm font-medium text-white">
                            {tile.title}
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs text-stone-400">{tile.meta}</p>
                          <button
                            type="button"
                            onClick={() => removeCardFromBinder(tile.removeId)}
                            disabled={bindersSaving}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-stone-200 hover:bg-white/[0.06] disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </article>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-stone-300">
                    Select a set or binder to view its contents.
                  </div>
                )}
              </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
