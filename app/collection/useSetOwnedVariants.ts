'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CardVariant, UserCardRow } from '../binder/types';
import { LEGACY_SET_ID } from '../binder/utils';
import { normalizeVariantForSet, variantToSlug } from '../../lib/constants/cardVariants';
import { fetchSetVariants } from '../../lib/setCardsCache';

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
        .map((row) => {
          const setId = row.set_id ?? selectedSetId;
          const normalized = normalizeVariantForSet(setId, row.variant);
          return `${row.card_id}-${variantToSlug(normalized)}`;
        })
    );
  }, [ownedRows, selectedSetId]);

  useEffect(() => {
    let active = true;

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

        const variants = await fetchSetVariants(selectedSetId);

        if (!active) {
          return;
        }

        setCards(variants.filter((variant) => ownedMap.has(variant.id)));
      } catch (cause) {
        if (!active) {
          return;
        }

        setError(cause instanceof Error ? cause.message : 'Failed to load cards for this set.');
        setCards([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCards();

    return () => {
      active = false;
    };
  }, [ownedMap, selectedSetId]);

  return { loading, error, cards };
}
