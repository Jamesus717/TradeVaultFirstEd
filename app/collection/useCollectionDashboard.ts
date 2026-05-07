'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../auth';
import type { UserCardRow } from '../binder/types';
import { buildSetList } from '../binder/utils';

type PokemonSet = {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  total?: number;
  printedTotal?: number;
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

export type CollectionSortMode = 'completion-desc' | 'owned-desc' | 'release-desc';

const LEGACY_SET_ID = 'sv3pt5';
const LEGACY_SET_NAME = 'Scarlet & Violet 151';

function buildSetMap(sets: PokemonSet[]) {
  return sets.reduce<Record<string, PokemonSet>>((accumulator, set) => {
    accumulator[set.id] = set;
    return accumulator;
  }, {});
}

export function useCollectionDashboard() {
  const { user, authLoading, supabaseDisabled } = useAuth();
  const [rows, setRows] = useState<UserCardRow[]>([]);
  const [sets, setSets] = useState<PokemonSet[]>([]);
  const [setMap, setSetMap] = useState<Record<string, PokemonSet>>({});
  const [setTotals, setSetTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [totalsLoading, setTotalsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortMode, setSortMode] = useState<CollectionSortMode>('completion-desc');
  const [nearCompleteOnly, setNearCompleteOnly] = useState(false);

  useEffect(() => {
    async function loadCollection() {
      if (!user) {
        setRows([]);
        setSets([]);
        setSetMap({});
        setSetTotals({});
        setLoading(false);
        setTotalsLoading(false);
        setError('');
        return;
      }

      if (supabaseDisabled || !supabase) {
        setRows([]);
        setSets([]);
        setSetMap({});
        setSetTotals({});
        setLoading(false);
        setTotalsLoading(false);
        setError('Supabase environment variables are missing.');
        return;
      }

      try {
        setLoading(true);
        setTotalsLoading(true);
        setError('');

        const [setsResponse, ownedResponse] = await Promise.all([
          fetch('/api/pokemon/sets'),
          supabase
            .from('user_cards')
            .select('card_id, set_id, variant, owned')
            .eq('user_id', user.id)
            .eq('owned', true),
        ]);

        if (!setsResponse.ok) {
          throw new Error('Failed to load set metadata.');
        }

        const setsJson = (await setsResponse.json()) as SetApiResponse;
        const nextSets = buildSetList(setsJson.data ?? []);
        const nextSetMap = buildSetMap(nextSets);
        setSets(nextSets);
        setSetMap(nextSetMap);

        if (ownedResponse.error) {
          throw new Error(ownedResponse.error.message);
        }

        const nextRows = (ownedResponse.data ?? []) as UserCardRow[];
        setRows(nextRows);

        const setIds = Array.from(new Set(nextRows.map((row) => row.set_id ?? LEGACY_SET_ID)));

        if (setIds.length === 0) {
          setSetTotals({});
          return;
        }

        const totalsResults = await Promise.all(
          setIds.map(async (setId) => {
            try {
              const response = await fetch(`/api/pokemon/sets/${encodeURIComponent(setId)}`);

              if (!response.ok) {
                return [setId, null] as const;
              }

              const json = (await response.json()) as SetDetailResponse;
              const totalCount = json.data?.totalCount;
              return [setId, typeof totalCount === 'number' ? totalCount : null] as const;
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
        setError(cause instanceof Error ? cause.message : 'Something went wrong loading your collection.');
        setSets([]);
      } finally {
        setLoading(false);
        setTotalsLoading(false);
      }
    }

    loadCollection();
  }, [supabaseDisabled, user]);

  const ownedBySet = useMemo(() => {
    return rows.reduce<Record<string, number>>((accumulator, row) => {
      const setId = row.set_id ?? LEGACY_SET_ID;
      accumulator[setId] = (accumulator[setId] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [rows]);

  const setGroups = useMemo(() => {
    const grouped = rows.reduce<
      Array<{
        setId: string;
        setName: string;
        series: string;
        releaseDate: string;
        ownedVariants: number;
        normalOwned: number;
        reverseOwned: number;
      }>
    >((accumulator, row) => {
      const effectiveSetId = row.set_id ?? LEGACY_SET_ID;
      const existing = accumulator.find((entry) => entry.setId === effectiveSetId);
      const setInfo = setMap[effectiveSetId];
      const setName =
        setInfo?.name ?? (effectiveSetId === LEGACY_SET_ID ? LEGACY_SET_NAME : effectiveSetId);
      const series = setInfo?.series ?? 'Unknown Series';
      const releaseDate = setInfo?.releaseDate ?? '';
      const isNormal = row.variant === 'Normal';
      const isReverse = row.variant === 'Reverse Holo';

      if (existing) {
        existing.ownedVariants += 1;
        existing.normalOwned += isNormal ? 1 : 0;
        existing.reverseOwned += isReverse ? 1 : 0;
        return accumulator;
      }

      accumulator.push({
        setId: effectiveSetId,
        setName,
        series,
        releaseDate,
        ownedVariants: 1,
        normalOwned: isNormal ? 1 : 0,
        reverseOwned: isReverse ? 1 : 0,
      });

      return accumulator;
    }, []);

    const withTotals = grouped.map((group) => {
      const totalCount = setTotals[group.setId];
      const totalVariants = typeof totalCount === 'number' ? totalCount * 2 : null;
      const completion = totalVariants ? group.ownedVariants / totalVariants : null;

      return {
        ...group,
        totalVariants,
        completion,
        completionPercent: completion ? Math.round(completion * 100) : null,
      };
    });

    const filtered = nearCompleteOnly
      ? withTotals.filter((group) => (group.completion ?? 0) >= 0.9)
      : withTotals;

    const sorted = filtered.slice();

    sorted.sort((a, b) => {
      if (sortMode === 'owned-desc') {
        return b.ownedVariants - a.ownedVariants;
      }

      if (sortMode === 'release-desc') {
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      }

      const aCompletion = a.completion ?? -1;
      const bCompletion = b.completion ?? -1;
      return bCompletion - aCompletion;
    });

    return sorted;
  }, [nearCompleteOnly, rows, setMap, setTotals, sortMode]);

  const stats = useMemo(() => {
    const totalOwnedVariants = rows.length;
    const setsTracked = Array.from(new Set(rows.map((row) => row.set_id ?? LEGACY_SET_ID))).length;

    const completeSets = setGroups.filter(
      (group) => group.totalVariants && group.ownedVariants >= group.totalVariants
    ).length;

    return {
      totalOwnedVariants,
      setsTracked,
      completeSets,
    };
  }, [rows, setGroups]);

  function addOwnedRow(row: UserCardRow) {
    setRows((current) => {
      const exists = current.some(
        (entry) =>
          entry.card_id === row.card_id &&
          (entry.set_id ?? LEGACY_SET_ID) === (row.set_id ?? LEGACY_SET_ID) &&
          entry.variant === row.variant
      );

      if (exists) {
        return current;
      }

      return [...current, row];
    });
  }

  return {
    user,
    authLoading,
    rows,
    loading,
    totalsLoading,
    error,
    stats,
    sets,
    setMap,
    ownedBySet,
    setGroups,
    addOwnedRow,
    sortMode,
    setSortMode,
    nearCompleteOnly,
    setNearCompleteOnly,
  };
}
