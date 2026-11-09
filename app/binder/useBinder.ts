'use client';

import { fetchSets } from '../../lib/fetchSets';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';
import type { CardVariant, PokemonSet, SetApiResponse, SortMode, UserCardRow } from './types';
import { buildSetList, groupSetsBySeries, LEGACY_SET_ID } from './utils';
import {
  NO_REVERSE_HOLO_SETS,
  normalizeVariantForSet,
  variantToSlug,
  type CardVariantType,
} from '../../lib/constants/cardVariants';
import { fetchSetVariants, SetCardsRequestError } from '../../lib/setCardsCache';

import { useBinderDetails } from '../../lib/binderDetails';
import { demoEmpty, demoMode } from '../../lib/demo';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyFilters,
  availableFilters,
  parseFilters,
  parseSort,
  serializeFilters,
  type BinderFilters,
  type OwnershipFilter,
} from '../../lib/binderFilters';

export function useBinder() {
  const { user, supabaseDisabled } = useAuth();
  const [sets, setSets] = useState<PokemonSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [cards, setCards] = useState<CardVariant[]>([]);
  const [owned, setOwned] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<BinderFilters>(EMPTY_FILTERS);
  const [sortMode, setSortMode] = useState<SortMode>('binder');
  const [urlReady, setUrlReady] = useState(false);
  const details = useBinderDetails();
  const available = useMemo(() => availableFilters(details), [details]);
  const searchQuery = filters.q;
  const ownershipFilter = filters.own;
  const setSearchQuery = useCallback((q: string) => setFilters((f) => ({ ...f, q })), []);
  const setOwnershipFilter = useCallback(
    (own: OwnershipFilter) => setFilters((f) => ({ ...f, own })),
    []
  );
  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);
  const [loadingSets, setLoadingSets] = useState(true);
  const [loadingCards, setLoadingCards] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedSet = useMemo(
    () => sets.find((set) => set.id === selectedSetId) ?? null,
    [selectedSetId, sets]
  );
  const groupedSets = useMemo(() => groupSetsBySeries(sets), [sets]);

  // Demo has no database: the example binder rows stand in for owned cards.
  const ownedForView = useMemo(() => {
    if (!demoMode || demoEmpty) return owned;
    const next = { ...owned };
    for (const card of cards) {
      if (details[card.baseCardId.toLowerCase()]) next[card.id] = true;
    }
    return next;
  }, [owned, cards, details]);

  const visibleCards = useMemo(() => {
    if (!cards || cards.length === 0) return [];

    const ownershipFiltered = applyFilters(cards, ownedForView, details, filters);

    return [...ownershipFiltered].sort((a, b) => {
      if (sortMode === 'binder') {
        const numA = Number.parseInt(a.number.replace(/\D/g, ''), 10) || 0;
        const numB = Number.parseInt(b.number.replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numA - numB;
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return a.variant.localeCompare(b.variant);
      }

      if (sortMode === 'number-desc') {
        const numA = Number.parseInt(a.number.replace(/\D/g, ''), 10) || 0;
        const numB = Number.parseInt(b.number.replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numB - numA;
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return a.variant.localeCompare(b.variant);
      }

      if (sortMode === 'name-asc') {
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return a.variant.localeCompare(b.variant);
      }

      if (sortMode === 'owned-first') {
        const aOwned = Boolean(ownedForView[a.id]);
        const bOwned = Boolean(ownedForView[b.id]);
        if (aOwned && !bOwned) return -1;
        if (!aOwned && bOwned) return 1;
        const numA = Number.parseInt(a.number.replace(/\D/g, ''), 10) || 0;
        const numB = Number.parseInt(b.number.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      }

      return 0;
    });
  }, [cards, filters, sortMode, ownedForView, details]);

  const missingCards = useMemo(
    () => visibleCards.filter((card) => !ownedForView[card.id]),
    [ownedForView, visibleCards]
  );

  // Read the filters from the URL once, after mount (avoids a hydration mismatch).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const set = params.get('set');
    const timer = setTimeout(() => {
      setFilters(parseFilters(params));
      setSortMode(parseSort(params));
      if (set && /^[\w.-]{1,40}$/.test(set)) setSelectedSetId(set);
      setUrlReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // A link can name a set that does not exist (or load before the sets): fall back to the first.
  useEffect(() => {
    if (!urlReady || sets.length === 0) return;
    if (!sets.some((set) => set.id === selectedSetId)) {
      const timer = setTimeout(() => setSelectedSetId(sets[0].id), 0);
      return () => clearTimeout(timer);
    }
  }, [urlReady, sets, selectedSetId]);

  // Keep the URL in step with the filters, without piling up history entries.
  useEffect(() => {
    if (!urlReady) return;
    const query = serializeFilters(filters, { set: selectedSetId, sort: sortMode });
    const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, [urlReady, filters, selectedSetId, sortMode]);

  const binderSummary = useMemo(() => {
    if (!cards || cards.length === 0) {
      return '';
    }

    const filterLabel =
      ownershipFilter === 'owned'
        ? ' owned'
        : ownershipFilter === 'unowned'
          ? ' missing'
          : '';

    const shownPart =
      visibleCards.length === cards.length
        ? `${cards.length}${filterLabel} cards`
        : `${visibleCards.length} of ${cards.length}${filterLabel} cards`;

    const searchQueryPart = searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : '';

    return `Showing ${shownPart}${searchQueryPart}`;
  }, [cards, visibleCards.length, searchQuery, ownershipFilter]);

  useEffect(() => {
    async function loadSets() {
      try {
        setLoadingSets(true);
        setError('');

        const response = await fetchSets();

        if (!response.ok) {
          throw new Error('Failed to load sets from the Pokemon TCG API.');
        }

        const json = (await response.json()) as SetApiResponse;
        const nextSets = buildSetList(json.data ?? []);

        setSets(nextSets);
        // A shared link can name a set that no longer exists: fall back to the first.
        setSelectedSetId((current) =>
          current && nextSets.some((set) => set.id === current) ? current : nextSets[0]?.id || ''
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Something went wrong loading sets.');
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

    // Guards against an earlier, slower set landing after a later one. Now
    // that cached sets resolve immediately, switching from an uncached set
    // to a cached one would otherwise let the stale response win.
    let active = true;

    async function loadCards() {
      try {
        setLoadingCards(true);
        setError('');

        const variants = await fetchSetVariants(selectedSetId);

        if (!active) {
          return;
        }

        setCards(variants);
      } catch (cause) {
        if (!active) {
          return;
        }

        if (cause instanceof SetCardsRequestError) {
          setError('Failed to load cards from the Pokemon TCG API.');
        } else {
          setError(cause instanceof Error ? cause.message : 'Something went wrong loading cards.');
        }
      } finally {
        if (active) {
          setLoadingCards(false);
        }
      }
    }

    loadCards();

    return () => {
      active = false;
    };
  }, [selectedSetId]);

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
          const setId = entry.set_id ?? selectedSetId;
          const normalized = normalizeVariantForSet(setId, entry.variant);
          accumulator[`${entry.card_id}-${variantToSlug(normalized)}`] = true;
        }

        return accumulator;
      }, {});

      setOwned(nextOwned);
    }

    loadOwnedCards();
  }, [selectedSetId, supabaseDisabled, user]);

  const total = cards.length;

  // One pass instead of two full scans of the set on every render — a set is
  // up to ~500 variants and this ran on each keystroke in the search box.
  const ownedCount = useMemo(
    () => cards.reduce((count, card) => (ownedForView[card.id] ? count + 1 : count), 0),
    [cards, ownedForView]
  );
  const completion = total === 0 ? 0 : Math.round((ownedCount / total) * 100);
  const allOwned = total > 0 && ownedCount === total;

  // Stable across renders that do not change ownership, so the memoised
  // binder cards can skip re-rendering while you type.
  const toggleOwned = useCallback(async function toggleOwned(card: CardVariant) {
    if (!supabase || !user || !selectedSetId) {
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

      if (card.variant === 'Unlimited' && NO_REVERSE_HOLO_SETS.has(selectedSetId)) {
        deleteQuery = deleteQuery.in('variant', ['Unlimited', 'Normal', 'Reverse Holo']);
      } else {
        deleteQuery = deleteQuery.eq('variant', card.variant);
      }

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
  }, [owned, selectedSetId, user]);

  async function markAllAsOwned() {
    if (!supabase || !user || !selectedSetId) {
      return;
    }

    if (cards.length === 0) {
      return;
    }

    setBulkSaving(true);
    setError('');

    const previousOwned = owned;
    const nextOwned = cards.reduce<Record<string, boolean>>((accumulator, card) => {
      accumulator[card.id] = true;
      return accumulator;
    }, {});

    setOwned(nextOwned);

    try {
      const rows = cards.map((card) => ({
        user_id: user.id,
        card_id: card.baseCardId,
        set_id: selectedSetId,
        variant: card.variant,
        owned: true,
      }));

      const chunkSize = 200;

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error: upsertError } = await supabase.from('user_cards').upsert(chunk, {
          onConflict: 'user_id,card_id,variant,set_id',
        });

        if (upsertError) {
          throw upsertError;
        }
      }
    } catch (cause) {
      setOwned(previousOwned);
      const message =
        typeof cause === 'object' && cause && 'message' in cause
          ? String((cause as { message: unknown }).message)
          : 'Failed to mark all cards as owned.';
      setError(message);
    } finally {
      setBulkSaving(false);
    }
  }

  async function unmarkAllAsOwned() {
    if (!supabase || !user || !selectedSetId) {
      return;
    }

    if (cards.length === 0) {
      return;
    }

    setBulkSaving(true);
    setError('');

    const previousOwned = owned;
    setOwned({});

    try {
      let deleteQuery = supabase.from('user_cards').delete().eq('user_id', user.id);

      if (selectedSetId === LEGACY_SET_ID) {
        deleteQuery = deleteQuery.or(`set_id.eq.${LEGACY_SET_ID},set_id.is.null`);
      } else {
        deleteQuery = deleteQuery.eq('set_id', selectedSetId);
      }

      const { error: deleteError } = await deleteQuery;

      if (deleteError) {
        throw deleteError;
      }
    } catch (cause) {
      setOwned(previousOwned);
      const message =
        typeof cause === 'object' && cause && 'message' in cause
          ? String((cause as { message: unknown }).message)
          : 'Failed to unmark all cards as owned.';
      setError(message);
    } finally {
      setBulkSaving(false);
    }
  }

  async function toggleAllOwned() {
    if (allOwned) {
      await unmarkAllAsOwned();
      return;
    }

    await markAllAsOwned();
  }

  // Quick add saves on its own; this ticks the card if its set is on screen.
  const noteOwned = useCallback(
    (setId: string, cardId: string, variant: CardVariantType) => {
      if (setId === selectedSetId) {
        setOwned((current) => ({ ...current, [`${cardId}-${variantToSlug(variant)}`]: true }));
      }
    },
    [selectedSetId]
  );

  const isLoading = loadingSets || (!!selectedSetId && loadingCards);

  return {
    user,
    sets,
    groupedSets,
    selectedSet,
    selectedSetId,
    setSelectedSetId,
    owned: ownedForView,
    filters,
    setFilters,
    clearFilters,
    available,
    activeFilters: activeFilterCount(filters),
    searchQuery,
    setSearchQuery,
    sortMode,
    setSortMode,
    visibleCards,
    missingCards,
    binderSummary,
    loadingSets,
    error,
    isLoading,
    cards,
    total,
    ownedCount,
    completion,
    allOwned,
    savingId,
    bulkSaving,
    toggleOwned,
    toggleAllOwned,
    noteOwned,
    ownershipFilter,
    setOwnershipFilter,
  };
}
