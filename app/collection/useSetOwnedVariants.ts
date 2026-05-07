'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CardApiResponse, CardVariant, UserCardRow } from '../binder/types';
import { buildVariants, LEGACY_SET_ID, variantSuffix } from '../binder/utils';

type Params = {
  selectedSetId: string | null;
  ownedRows: UserCardRow[];
};

export function useSetOwnedVariants({ selectedSetId, ownedRows }: Params) {
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<CardVariant[]>([]);
  const [error, setError] = useState('');

  const ownedMap = useMemo(() => {
    if (!selectedSetId) {
      return new Set<string>();
    }

    return new Set(
      ownedRows
        .filter((row) => {
          if (selectedSetId === LEGACY_SET_ID) {
            return row.set_id === LEGACY_SET_ID || row.set_id === null;
          }

          return row.set_id === selectedSetId;
        })
        .map((row) => `${row.card_id}-${variantSuffix(row.variant)}`)
    );
  }, [ownedRows, selectedSetId]);

  useEffect(() => {
    async function loadCards() {
      if (!selectedSetId) {
        setCards([]);
        setError('');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const response = await fetch(
          `/api/pokemon/cards?setId=${encodeURIComponent(selectedSetId)}&pageSize=250`
        );

        if (!response.ok) {
          throw new Error('Failed to load cards for this set.');
        }

        const json = (await response.json()) as CardApiResponse;
        const variants = buildVariants(json.data ?? []);
        setCards(variants.filter((variant) => ownedMap.has(variant.id)));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to load cards for this set.');
        setCards([]);
      } finally {
        setLoading(false);
      }
    }

    loadCards();
  }, [ownedMap, selectedSetId]);

  return { loading, error, cards };
}

