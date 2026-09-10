'use client';

import { useEffect, useRef, useState } from 'react';
import type { CardSearchMode, CardSearchResult } from '../types';

type Params = {
  enabled: boolean;
  query: string;
  mode: CardSearchMode;
  ownedCardIdSet: Set<string>;
  selectedCard: CardSearchResult | null;
};

export function useCardSearch({ enabled, query, mode, ownedCardIdSet, selectedCard }: Params) {
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cardSearchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function searchCards() {
      const needle = query.trim();

      if (!enabled || selectedCard || needle.length < 2) {
        setResults([]);
        setLoading(false);
        setError('');
        return;
      }

      setLoading(true);
      setError('');

      if (mode === 'collection' && ownedCardIdSet.size === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      if (cardSearchAbortRef.current) {
        cardSearchAbortRef.current.abort();
      }

      const controller = new AbortController();
      cardSearchAbortRef.current = controller;

      try {
        const response = await fetch(
          `/api/pokemon/search/cards?name=${encodeURIComponent(needle)}&pageSize=12`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Card search failed.');
        }

        const json = (await response.json()) as { data?: CardSearchResult[] };
        const allResults = json.data ?? [];
        const filtered =
          mode === 'collection'
            ? allResults.filter((card) => ownedCardIdSet.has(card.id))
            : allResults;
        setResults(filtered);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }

        setResults([]);
        setError('Card search failed.');
      } finally {
        setLoading(false);
      }
    }

    const handle = setTimeout(searchCards, 400);
    return () => clearTimeout(handle);
  }, [mode, enabled, query, ownedCardIdSet, selectedCard]);

  function clearResults() {
    setResults([]);
  }

  function reset() {
    setError('');
    setLoading(false);
    setResults([]);
  }

  function abort() {
    if (cardSearchAbortRef.current) {
      cardSearchAbortRef.current.abort();
    }
  }

  return { results, loading, error, clearResults, reset, abort };
}
