'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';
import type { CardApiResponse, CardVariant, PokemonSet, SetApiResponse, SortMode, UserCardRow } from './types';
import { buildSetList, buildVariants, compareCardNumbers, groupSetsBySeries, LEGACY_SET_ID } from './utils';
import { NO_REVERSE_HOLO_SETS, normalizeVariantForSet, variantToSlug } from '../../lib/constants/cardVariants';

type OwnershipFilter = 'all' | 'owned' | 'unowned';

export function useBinder() {
  const { user, supabaseDisabled } = useAuth();
  const [sets, setSets] = useState<PokemonSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [cards, setCards] = useState<CardVariant[]>([]);
  const [owned, setOwned] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('binder');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('all');
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

  const visibleCards = useMemo(() => {
    if (!cards || cards.length === 0) return [];

    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? cards.filter((card) => card.name.toLowerCase().includes(query))
      : cards;

    const ownershipFiltered =
      ownershipFilter === 'owned'
        ? filtered.filter((card) => Boolean(owned[card.id]))
        : ownershipFilter === 'unowned'
          ? filtered.filter((card) => !owned[card.id])
          : filtered;

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
        const aOwned = Boolean(owned[a.id]);
        const bOwned = Boolean(owned[b.id]);
        if (aOwned && !bOwned) return -1;
        if (!aOwned && bOwned) return 1;
        const numA = Number.parseInt(a.number.replace(/\D/g, ''), 10) || 0;
        const numB = Number.parseInt(b.number.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      }

      return 0;
    });
  }, [cards, searchQuery, sortMode, ownershipFilter, owned]);

  const missingCards = useMemo(
    () => visibleCards.filter((card) => !owned[card.id]),
    [owned, visibleCards]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setOwnershipFilter('all');
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedSetId]);

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

        const response = await fetch('/api/pokemon/sets');

        if (!response.ok) {
          throw new Error('Failed to load sets from the Pokemon TCG API.');
        }

        const json = (await response.json()) as SetApiResponse;
        const nextSets = buildSetList(json.data ?? []);

        setSets(nextSets);
        setSelectedSetId((current) => current || nextSets[0]?.id || '');
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

    async function loadCards() {
      try {
        setLoadingCards(true);
        setError('');

        const response = await fetch(`/api/pokemon/cards?setId=${encodeURIComponent(selectedSetId)}&pageSize=250`);

        if (!response.ok) {
          throw new Error('Failed to load cards from the Pokemon TCG API.');
        }

        const json = (await response.json()) as CardApiResponse;
        setCards(buildVariants(json.data ?? []));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Something went wrong loading cards.');
      } finally {
        setLoadingCards(false);
      }
    }

    loadCards();
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
  const ownedCount = cards.filter((card) => owned[card.id]).length;
  const completion = total === 0 ? 0 : Math.round((ownedCount / total) * 100);
  const allOwned = cards.length > 0 && cards.every((card) => owned[card.id]);

  async function toggleOwned(card: CardVariant) {
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
  }

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

  const isLoading = loadingSets || (!!selectedSetId && loadingCards);

  return {
    user,
    sets,
    groupedSets,
    selectedSet,
    selectedSetId,
    setSelectedSetId,
    owned,
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
    ownershipFilter,
    setOwnershipFilter,
  };
}
